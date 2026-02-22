"""
LOTO PAM Lottery Engine
Handles automatic winner detection, winnings calculation, and payouts
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio
import re

from utils import generate_id, get_current_timestamp
from websocket_manager import notify_player, notify_admins, broadcast_result, NotificationType

# Global database reference
db: AsyncIOMotorDatabase = None

def set_lottery_engine_db(database: AsyncIOMotorDatabase):
    global db
    db = database


# ============ WINNING NUMBER MATCHING ============

def parse_winning_numbers(winning_numbers: str) -> List[str]:
    """Parse winning numbers from various formats to list"""
    if not winning_numbers:
        return []
    
    if isinstance(winning_numbers, list):
        return [str(n).strip() for n in winning_numbers if n]
    
    # Split by common delimiters
    numbers = re.split(r'[-,\s]+', str(winning_numbers).strip())
    return [n.strip() for n in numbers if n.strip()]


def check_straight_match(played_number: str, winning_numbers: List[str]) -> bool:
    """Check if played number matches winning numbers exactly (straight bet)"""
    if not winning_numbers:
        return False
    
    # For Pick 3/4/5, the winning number is usually a single combined number
    winning_combined = ''.join(winning_numbers)
    
    # Exact match
    if played_number == winning_combined:
        return True
    
    # Check each winning number
    if played_number in winning_numbers:
        return True
    
    return False


def check_box_match(played_number: str, winning_numbers: List[str]) -> bool:
    """Check if played number matches in any order (box bet)"""
    if not winning_numbers:
        return False
    
    winning_combined = ''.join(winning_numbers)
    
    # Sort and compare
    played_sorted = ''.join(sorted(played_number))
    winning_sorted = ''.join(sorted(winning_combined))
    
    return played_sorted == winning_sorted


def check_combo_match(played_number: str, winning_numbers: List[str]) -> Tuple[bool, int]:
    """Check combo bet - returns (is_winner, number_of_matches)"""
    if not winning_numbers:
        return False, 0
    
    winning_combined = ''.join(winning_numbers)
    
    # Generate all permutations of played number
    from itertools import permutations
    perms = set([''.join(p) for p in permutations(played_number)])
    
    # Count how many permutations match
    matches = sum(1 for p in perms if p == winning_combined)
    
    return matches > 0, matches


# ============ PAYOUT CALCULATION ============

# Payout multipliers by bet type and number length
PAYOUT_MULTIPLIERS = {
    "straight": {
        2: 50,    # Pick 2 straight: 50x
        3: 500,   # Pick 3 straight: 500x
        4: 5000,  # Pick 4 straight: 5000x
        5: 50000  # Pick 5 straight: 50000x
    },
    "box": {
        2: 25,    # Pick 2 box: 25x
        3: 80,    # Pick 3 box: 80x
        4: 400,   # Pick 4 box: 400x
        5: 2000   # Pick 5 box: 2000x
    },
    "combo": {
        2: 25,    # Pick 2 combo: 25x per match
        3: 167,   # Pick 3 combo: 167x per match
        4: 833,   # Pick 4 combo: 833x per match
        5: 4166   # Pick 5 combo: 4166x per match
    }
}


def calculate_winnings(played_number: str, bet_type: str, bet_amount: float, 
                       winning_numbers: List[str]) -> Tuple[bool, float]:
    """
    Calculate winnings for a single play
    Returns: (is_winner, amount_won)
    """
    num_length = len(played_number)
    
    if bet_type == "straight":
        if check_straight_match(played_number, winning_numbers):
            multiplier = PAYOUT_MULTIPLIERS["straight"].get(num_length, 500)
            return True, bet_amount * multiplier
    
    elif bet_type == "box":
        if check_box_match(played_number, winning_numbers):
            multiplier = PAYOUT_MULTIPLIERS["box"].get(num_length, 80)
            return True, bet_amount * multiplier
    
    elif bet_type == "combo":
        is_winner, matches = check_combo_match(played_number, winning_numbers)
        if is_winner:
            multiplier = PAYOUT_MULTIPLIERS["combo"].get(num_length, 100)
            return True, bet_amount * multiplier * matches
    
    return False, 0.0


# ============ MAIN ENGINE FUNCTIONS ============

async def process_result_for_online_tickets(result: dict) -> dict:
    """
    Process a published result and determine winners for online tickets
    This is called automatically when a result is published
    """
    lottery_id = result.get("lottery_id")
    draw_date = result.get("draw_date")
    draw_type = result.get("draw_name") or result.get("draw_type")
    winning_numbers_raw = result.get("winning_numbers")
    
    # Parse winning numbers
    winning_numbers = parse_winning_numbers(winning_numbers_raw)
    
    if not winning_numbers:
        print("[LotteryEngine] No winning numbers found for result")
        return {"processed": 0, "winners": 0, "total_payout": 0}
    
    # Find all pending tickets for this lottery and draw
    query = {
        "game_id": lottery_id,
        "draw_date": draw_date,
        "status": "pending"
    }
    
    # Also match by draw_type if provided
    if draw_type:
        query["draw_type"] = {"$regex": draw_type, "$options": "i"}
    
    tickets = await db.online_tickets.find(query).to_list(10000)
    
    processed = 0
    winners = 0
    total_payout = 0.0
    
    now = get_current_timestamp()
    
    for ticket in tickets:
        ticket_id = ticket.get("ticket_id")
        player_id = ticket.get("player_id")
        plays = ticket.get("plays", [])
        
        ticket_won = False
        ticket_winnings = 0.0
        winning_plays = []
        
        for play in plays:
            played_number = play.get("number", "")
            bet_type = play.get("bet_type", "straight").lower()
            bet_amount = play.get("amount", 0)
            
            is_winner, amount_won = calculate_winnings(
                played_number, bet_type, bet_amount, winning_numbers
            )
            
            if is_winner:
                ticket_won = True
                ticket_winnings += amount_won
                winning_plays.append({
                    "number": played_number,
                    "bet_type": bet_type,
                    "amount_bet": bet_amount,
                    "amount_won": amount_won
                })
        
        # Update ticket status
        new_status = "won" if ticket_won else "lost"
        
        await db.online_tickets.update_one(
            {"ticket_id": ticket_id},
            {
                "$set": {
                    "status": new_status,
                    "actual_win": ticket_winnings,
                    "winning_plays": winning_plays if winning_plays else None,
                    "result_processed_at": now,
                    "result_id": result.get("result_id")
                }
            }
        )
        
        processed += 1
        
        if ticket_won:
            winners += 1
            total_payout += ticket_winnings
            
            # Credit player wallet
            await credit_player_wallet(player_id, ticket_winnings, ticket_id)
            
            # Notify player about win
            await notify_player(player_id, NotificationType.TICKET_WON, {
                "ticket_id": ticket_id,
                "amount_won": ticket_winnings,
                "winning_numbers": winning_numbers,
                "winning_plays": winning_plays
            })
            
            # Notify admins about high win (if significant)
            if ticket_winnings >= 50000:  # High win threshold
                await notify_admins(NotificationType.HIGH_WIN, {
                    "ticket_id": ticket_id,
                    "player_id": player_id,
                    "amount_won": ticket_winnings
                })
        else:
            # Notify player about loss
            await notify_player(player_id, NotificationType.TICKET_LOST, {
                "ticket_id": ticket_id,
                "winning_numbers": winning_numbers
            })
    
    # Broadcast result to all players
    await broadcast_result({
        "lottery_id": lottery_id,
        "lottery_name": result.get("lottery_name"),
        "draw_date": draw_date,
        "draw_type": draw_type,
        "winning_numbers": winning_numbers
    })
    
    print(f"[LotteryEngine] Processed {processed} tickets, {winners} winners, {total_payout} HTG payout")
    
    return {
        "processed": processed,
        "winners": winners,
        "total_payout": total_payout
    }


async def credit_player_wallet(player_id: str, amount: float, reference: str):
    """Credit winnings to player wallet"""
    now = get_current_timestamp()
    transaction_id = generate_id("txn_")
    
    # Update wallet balance
    result = await db.online_wallets.update_one(
        {"player_id": player_id},
        {
            "$inc": {"balance": amount},
            "$set": {"updated_at": now}
        }
    )
    
    # Create transaction record
    await db.online_wallet_transactions.insert_one({
        "transaction_id": transaction_id,
        "player_id": player_id,
        "type": "winning_credit",
        "amount": amount,
        "reference": reference,
        "status": "approved",
        "notes": "Automatic lottery winnings credit",
        "created_at": now,
        "processed_at": now
    })
    
    # Notify player about wallet credit
    await notify_player(player_id, NotificationType.WALLET_CREDITED, {
        "amount": amount,
        "reason": "lottery_winnings",
        "reference": reference
    })
    
    return transaction_id


# ============ DRAW TIME MANAGEMENT ============

def get_next_draw_time(schedule: dict) -> Optional[datetime]:
    """Calculate next draw time from schedule"""
    draw_time = schedule.get("draw_time")
    if not draw_time:
        return None
    
    now = datetime.now(timezone.utc)
    
    try:
        # Parse draw time
        time_parts = draw_time.split(":")
        hour = int(time_parts[0])
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        
        # Create datetime for today's draw
        draw_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # If already passed, use tomorrow
        if draw_dt <= now:
            draw_dt += timedelta(days=1)
        
        return draw_dt
    except:
        return None


def is_draw_open(schedule: dict) -> Tuple[bool, Optional[datetime], int]:
    """
    Check if a draw is currently open for betting
    Returns: (is_open, close_time, seconds_remaining)
    """
    close_time_str = schedule.get("close_time") or schedule.get("draw_time")
    if not close_time_str:
        return True, None, -1
    
    now = datetime.now(timezone.utc)
    
    try:
        time_parts = close_time_str.split(":")
        hour = int(time_parts[0])
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        
        close_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # If close time passed today, check if we should consider tomorrow
        if close_dt <= now:
            # Draw closed for today
            return False, close_dt, 0
        
        seconds_remaining = int((close_dt - now).total_seconds())
        return True, close_dt, seconds_remaining
    except:
        return True, None, -1


# ============ BETTING LIMITS & FRAUD DETECTION ============

# Configuration
MAX_BET_PER_PLAY = 10000  # 10,000 HTG max per single play
MAX_DAILY_BET_PER_USER = 100000  # 100,000 HTG max per day
FRAUD_CONSECUTIVE_THRESHOLD = 5  # Alert after 5 bets in 1 minute
FRAUD_SAME_NUMBER_THRESHOLD = 3  # Alert if same number bet 3+ times


async def validate_bet_limits(player_id: str, plays: List[dict]) -> Tuple[bool, str]:
    """
    Validate betting limits for a player
    Returns: (is_valid, error_message)
    """
    # Check max bet per play
    for play in plays:
        if play.get("amount", 0) > MAX_BET_PER_PLAY:
            return False, f"Le montant maximum par pari est {MAX_BET_PER_PLAY:,} HTG"
    
    # Check daily limit
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    daily_bets = await db.online_tickets.aggregate([
        {
            "$match": {
                "player_id": player_id,
                "created_at": {"$gte": today_start.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$total_amount"}
            }
        }
    ]).to_list(1)
    
    current_daily_total = daily_bets[0]["total"] if daily_bets else 0
    new_bet_total = sum(p.get("amount", 0) for p in plays)
    
    if current_daily_total + new_bet_total > MAX_DAILY_BET_PER_USER:
        remaining = MAX_DAILY_BET_PER_USER - current_daily_total
        return False, f"Limite journalière atteinte. Reste disponible: {max(0, remaining):,} HTG"
    
    return True, ""


async def check_fraud_patterns(player_id: str, plays: List[dict]) -> Tuple[bool, str]:
    """
    Check for suspicious betting patterns
    Returns: (is_suspicious, alert_reason)
    """
    now = datetime.now(timezone.utc)
    one_minute_ago = (now - timedelta(minutes=1)).isoformat()
    
    # Check consecutive bets in last minute
    recent_bets = await db.online_tickets.count_documents({
        "player_id": player_id,
        "created_at": {"$gte": one_minute_ago}
    })
    
    if recent_bets >= FRAUD_CONSECUTIVE_THRESHOLD:
        await notify_admins(NotificationType.FRAUD_ALERT, {
            "player_id": player_id,
            "reason": "rapid_betting",
            "details": f"{recent_bets} bets in last minute"
        })
        return True, "Trop de paris rapides détectés"
    
    # Check repeated numbers
    for play in plays:
        number = play.get("number")
        same_number_bets = await db.online_tickets.count_documents({
            "player_id": player_id,
            "plays.number": number,
            "created_at": {"$gte": (now - timedelta(hours=1)).isoformat()}
        })
        
        if same_number_bets >= FRAUD_SAME_NUMBER_THRESHOLD:
            await notify_admins(NotificationType.FRAUD_ALERT, {
                "player_id": player_id,
                "reason": "repeated_number",
                "details": f"Number {number} bet {same_number_bets} times in last hour"
            })
    
    return False, ""


# ============ LOGIN SECURITY ============

MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 30


async def check_login_allowed(email: str) -> Tuple[bool, str]:
    """Check if login is allowed (not locked out)"""
    player = await db.online_players.find_one({"email": email.lower()})
    if not player:
        return True, ""  # Allow attempt, will fail on password check
    
    locked_until = player.get("locked_until")
    if locked_until:
        lock_time = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) < lock_time:
            remaining = int((lock_time - datetime.now(timezone.utc)).total_seconds() / 60)
            return False, f"Compte temporairement bloqué. Réessayez dans {remaining} minutes."
    
    return True, ""


async def record_login_attempt(email: str, success: bool):
    """Record login attempt and lock account if too many failures"""
    now = get_current_timestamp()
    
    if success:
        # Reset failed attempts on successful login
        await db.online_players.update_one(
            {"email": email.lower()},
            {
                "$set": {
                    "failed_login_attempts": 0,
                    "locked_until": None,
                    "last_login_at": now
                }
            }
        )
    else:
        # Increment failed attempts
        player = await db.online_players.find_one({"email": email.lower()})
        if player:
            attempts = player.get("failed_login_attempts", 0) + 1
            
            update = {
                "$set": {"failed_login_attempts": attempts}
            }
            
            if attempts >= MAX_LOGIN_ATTEMPTS:
                lock_until = datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
                update["$set"]["locked_until"] = lock_until.isoformat()
                
                # Notify admins
                await notify_admins(NotificationType.FRAUD_ALERT, {
                    "player_id": player.get("player_id"),
                    "reason": "account_locked",
                    "details": f"Account locked after {attempts} failed login attempts"
                })
            
            await db.online_players.update_one(
                {"email": email.lower()},
                update
            )
