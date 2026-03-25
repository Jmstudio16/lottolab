"""
LOTTOLAB - Moteur de Calcul Automatique des Gains (PayoutEngine)
================================================
Implémente les règles officielles haïtiennes pour:
- Borlette (60/20/10)
- Loto 3, Loto 4, Loto 5
- Mariage
- Mariage Gratuit

Ce module est la source unique de calcul des gains.
Les primes sont récupérées depuis la configuration de la compagnie (company_configurations).
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from utils import generate_id, get_current_timestamp

logger = logging.getLogger(__name__)

# Global database reference
db: AsyncIOMotorDatabase = None


def set_payout_engine_db(database: AsyncIOMotorDatabase):
    """Initialize the payout engine with database reference"""
    global db
    db = database


# ============================================================================
# PRIME CONFIGURATION - DEFAULT VALUES
# ============================================================================

# Default primes if company has not configured them
DEFAULT_PRIMES = {
    "BORLETTE": "60|20|10",    # 1er rang x60, 2ème x20, 3ème x10
    "LOTO3": "500",            # exact match x500
    "LOTO4": "5000",           # exact match x5000 (L401, L402, L403)
    "LOTO5": "50000",          # exact match x50000 (L501, L502, L503)
    "MARIAGE": "750",          # marriage match x750
    "MARIAGE_GRATUIT": "750",  # free marriage x750
    "L401": "5000",
    "L402": "5000",
    "L403": "5000",
    "L501": "50000",
    "L502": "50000",
    "L503": "50000",
}


def parse_prime(prime_str: str) -> List[float]:
    """
    Parse prime string to list of multipliers.
    
    Examples:
        "60|20|10" -> [60.0, 20.0, 10.0]
        "500" -> [500.0]
    """
    if not prime_str:
        return [0.0]
    
    try:
        parts = prime_str.split("|")
        return [float(p.strip()) for p in parts if p.strip()]
    except (ValueError, AttributeError):
        return [0.0]


async def get_company_primes(company_id: str) -> Dict[str, str]:
    """
    Get prime configurations for a company.
    Returns dict mapping bet_type to prime formula string.
    
    Source of truth: company_configurations collection
    """
    primes = dict(DEFAULT_PRIMES)  # Start with defaults
    
    if db is None:
        return primes
    
    # Try company_configurations first
    config = await db.company_configurations.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if config:
        # Map config fields to primes
        if config.get("prime_borlette"):
            primes["BORLETTE"] = config.get("prime_borlette")
        if config.get("prime_loto3"):
            primes["LOTO3"] = config.get("prime_loto3")
        if config.get("prime_loto4"):
            primes["LOTO4"] = config.get("prime_loto4")
        if config.get("prime_loto5"):
            primes["LOTO5"] = config.get("prime_loto5")
        if config.get("prime_mariage"):
            primes["MARIAGE"] = config.get("prime_mariage")
        if config.get("prime_mariage_gratuit"):
            primes["MARIAGE_GRATUIT"] = config.get("prime_mariage_gratuit")
        # L4XX and L5XX variants
        if config.get("prime_l401"):
            primes["L401"] = config.get("prime_l401")
        if config.get("prime_l402"):
            primes["L402"] = config.get("prime_l402")
        if config.get("prime_l403"):
            primes["L403"] = config.get("prime_l403")
        if config.get("prime_l501"):
            primes["L501"] = config.get("prime_l501")
        if config.get("prime_l502"):
            primes["L502"] = config.get("prime_l502")
        if config.get("prime_l503"):
            primes["L503"] = config.get("prime_l503")
    
    # Also check prime_configs collection (legacy)
    prime_configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    for pc in prime_configs:
        bet_type = pc.get("bet_type", "").upper()
        formula = pc.get("payout_formula") or pc.get("formula")
        if bet_type and formula:
            primes[bet_type] = formula
    
    return primes


# ============================================================================
# BORLETTE CALCULATION - Rule 60/20/10
# ============================================================================

def extract_borlette_number(first_prize: str) -> str:
    """
    Extract borlette number from 1st prize (3-digit result).
    
    Rule: Borlette = last 2 digits of 1st prize.
    Example: first_prize="123" -> borlette="23"
    """
    if not first_prize:
        return ""
    
    # Clean the number
    clean = str(first_prize).strip()
    
    # If 3 digits, take last 2
    if len(clean) >= 2:
        return clean[-2:]
    
    return clean


def calculate_borlette_win(
    played_number: str,
    first_prize: str,
    second_prize: str,
    third_prize: str,
    bet_amount: float,
    prime_formula: str = "60|20|10"
) -> Tuple[bool, float, str]:
    """
    Calculate Borlette winning.
    
    Rules:
    - Borlette number = last 2 digits of 1st prize
    - 1st rank win if played_number == borlette (from 1st prize)
    - 2nd rank win if played_number == 2nd prize
    - 3rd rank win if played_number == 3rd prize
    
    Returns: (is_winner, win_amount, match_type)
    """
    multipliers = parse_prime(prime_formula)
    mult_1st = multipliers[0] if len(multipliers) > 0 else 60
    mult_2nd = multipliers[1] if len(multipliers) > 1 else 20
    mult_3rd = multipliers[2] if len(multipliers) > 2 else 10
    
    # Clean inputs
    played = str(played_number).strip().zfill(2)
    
    # Extract borlette from 1st prize
    borlette = extract_borlette_number(first_prize)
    second = str(second_prize).strip().zfill(2) if second_prize else ""
    third = str(third_prize).strip().zfill(2) if third_prize else ""
    
    # Check 1st rank (borlette)
    if played == borlette:
        return True, bet_amount * mult_1st, "1er_rang"
    
    # Check 2nd rank
    if played == second:
        return True, bet_amount * mult_2nd, "2eme_rang"
    
    # Check 3rd rank
    if played == third:
        return True, bet_amount * mult_3rd, "3eme_rang"
    
    return False, 0.0, ""


# ============================================================================
# LOTO 3 CALCULATION
# ============================================================================

def calculate_loto3_win(
    played_number: str,
    first_prize: str,
    bet_amount: float,
    prime_formula: str = "500"
) -> Tuple[bool, float, str]:
    """
    Calculate Loto 3 winning.
    
    Rule: Player must match EXACTLY the 3 digits of 1st prize.
    
    Returns: (is_winner, win_amount, match_type)
    """
    multiplier = parse_prime(prime_formula)[0]
    
    # Clean and compare
    played = str(played_number).strip()
    first = str(first_prize).strip()
    
    # Exact 3-digit match
    if len(played) == 3 and played == first:
        return True, bet_amount * multiplier, "exact"
    
    return False, 0.0, ""


# ============================================================================
# LOTO 4 CALCULATION
# ============================================================================

def calculate_loto4_win(
    played_number: str,
    winning_number: str,
    bet_amount: float,
    prime_formula: str = "5000"
) -> Tuple[bool, float, str]:
    """
    Calculate Loto 4 winning.
    
    Rule: Player must match EXACTLY 4 digits.
    
    Returns: (is_winner, win_amount, match_type)
    """
    multiplier = parse_prime(prime_formula)[0]
    
    played = str(played_number).strip()
    winning = str(winning_number).strip()
    
    if len(played) == 4 and played == winning:
        return True, bet_amount * multiplier, "exact"
    
    return False, 0.0, ""


# ============================================================================
# LOTO 5 CALCULATION
# ============================================================================

def calculate_loto5_win(
    played_number: str,
    winning_number: str,
    bet_amount: float,
    prime_formula: str = "50000"
) -> Tuple[bool, float, str]:
    """
    Calculate Loto 5 winning.
    
    Rule: Player must match EXACTLY 5 digits.
    
    Returns: (is_winner, win_amount, match_type)
    """
    multiplier = parse_prime(prime_formula)[0]
    
    played = str(played_number).strip()
    winning = str(winning_number).strip()
    
    if len(played) == 5 and played == winning:
        return True, bet_amount * multiplier, "exact"
    
    return False, 0.0, ""


# ============================================================================
# MARIAGE CALCULATION
# ============================================================================

def calculate_mariage_win(
    played_numbers: str,
    first_prize: str,
    second_prize: str,
    third_prize: str,
    bet_amount: float,
    prime_formula: str = "750"
) -> Tuple[bool, float, str]:
    """
    Calculate Mariage winning.
    
    Rule: Player plays 2 numbers (e.g., "12x34" or "12-34").
    Both numbers must appear in the winning set (borlette, 2nd, 3rd).
    
    Returns: (is_winner, win_amount, match_type)
    """
    multiplier = parse_prime(prime_formula)[0]
    
    # Parse the played mariage numbers
    played = str(played_numbers).strip()
    
    # Try different separators
    nums = []
    for sep in ["x", "-", " ", ","]:
        if sep in played:
            nums = [n.strip() for n in played.split(sep) if n.strip()]
            break
    
    if len(nums) != 2:
        # Maybe it's a 4-digit number (first 2 + last 2)
        if len(played) == 4:
            nums = [played[:2], played[2:]]
        else:
            return False, 0.0, ""
    
    num1, num2 = nums[0].zfill(2), nums[1].zfill(2)
    
    # Build winning set
    borlette = extract_borlette_number(first_prize)
    winning_set = {
        borlette,
        str(second_prize).strip().zfill(2) if second_prize else "",
        str(third_prize).strip().zfill(2) if third_prize else ""
    }
    winning_set.discard("")  # Remove empty strings
    
    # Both numbers must be in winning set
    if num1 in winning_set and num2 in winning_set:
        return True, bet_amount * multiplier, "mariage"
    
    return False, 0.0, ""


# ============================================================================
# MAIN PAYOUT CALCULATION - PROCESS SINGLE PLAY
# ============================================================================

def calculate_play_win(
    play: Dict[str, Any],
    winning_numbers: Dict[str, str],
    primes: Dict[str, str]
) -> Dict[str, Any]:
    """
    Calculate winning for a single play against winning numbers.
    
    Args:
        play: {"numbers": "23", "bet_type": "BORLETTE", "amount": 10}
        winning_numbers: {"first": "123", "second": "45", "third": "78"}
        primes: {"BORLETTE": "60|20|10", "LOTO3": "500", ...}
    
    Returns:
        {
            "is_winner": bool,
            "win_amount": float,
            "match_type": str,
            "numbers": str,
            "bet_type": str,
            "bet_amount": float
        }
    """
    numbers = str(play.get("numbers", "")).strip()
    bet_type = str(play.get("bet_type", "BORLETTE")).upper()
    amount = float(play.get("amount", 0))
    
    # Use prime at moment of sale if stored, otherwise current prime
    prime_at_sale = play.get("prime_at_sale")
    prime_formula = prime_at_sale or primes.get(bet_type) or primes.get("BORLETTE", "60|20|10")
    
    first = winning_numbers.get("first", "")
    second = winning_numbers.get("second", "")
    third = winning_numbers.get("third", "")
    
    is_winner = False
    win_amount = 0.0
    match_type = ""
    
    if bet_type == "BORLETTE":
        is_winner, win_amount, match_type = calculate_borlette_win(
            numbers, first, second, third, amount, prime_formula
        )
    
    elif bet_type in ["LOTO3", "L3", "PICK3"]:
        is_winner, win_amount, match_type = calculate_loto3_win(
            numbers, first, amount, primes.get("LOTO3", "500")
        )
    
    elif bet_type in ["LOTO4", "L4", "PICK4", "L401", "L402", "L403"]:
        prime_key = bet_type if bet_type in primes else "LOTO4"
        is_winner, win_amount, match_type = calculate_loto4_win(
            numbers, first, amount, primes.get(prime_key, "5000")
        )
    
    elif bet_type in ["LOTO5", "L5", "PICK5", "L501", "L502", "L503"]:
        prime_key = bet_type if bet_type in primes else "LOTO5"
        is_winner, win_amount, match_type = calculate_loto5_win(
            numbers, first, amount, primes.get(prime_key, "50000")
        )
    
    elif bet_type in ["MARIAGE", "MARRIAGE", "MAR"]:
        is_winner, win_amount, match_type = calculate_mariage_win(
            numbers, first, second, third, amount, primes.get("MARIAGE", "750")
        )
    
    elif bet_type in ["MARIAGE_GRATUIT", "FREE_MARRIAGE", "MG"]:
        is_winner, win_amount, match_type = calculate_mariage_win(
            numbers, first, second, third, amount, primes.get("MARIAGE_GRATUIT", "750")
        )
    
    return {
        "is_winner": is_winner,
        "win_amount": win_amount,
        "match_type": match_type,
        "numbers": numbers,
        "bet_type": bet_type,
        "bet_amount": amount
    }


# ============================================================================
# PROCESS FULL TICKET
# ============================================================================

async def process_ticket(
    ticket: Dict[str, Any],
    winning_numbers: Dict[str, str],
    company_primes: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Process a single ticket against winning numbers.
    
    Args:
        ticket: Full ticket document from lottery_transactions
        winning_numbers: {"first": "123", "second": "45", "third": "78"}
        company_primes: Optional pre-fetched primes dict
    
    Returns:
        {
            "ticket_id": str,
            "is_winner": bool,
            "total_win": float,
            "winning_plays": [...],
            "all_plays_results": [...]
        }
    """
    ticket_id = ticket.get("ticket_id")
    company_id = ticket.get("company_id")
    plays = ticket.get("plays", [])
    
    # Get primes (use provided or fetch)
    if company_primes is None:
        company_primes = await get_company_primes(company_id)
    
    total_win = 0.0
    winning_plays = []
    all_results = []
    
    for play in plays:
        result = calculate_play_win(play, winning_numbers, company_primes)
        all_results.append(result)
        
        if result["is_winner"]:
            total_win += result["win_amount"]
            winning_plays.append(result)
    
    return {
        "ticket_id": ticket_id,
        "is_winner": total_win > 0,
        "total_win": total_win,
        "winning_plays": winning_plays,
        "all_plays_results": all_results
    }


# ============================================================================
# MAIN ENGINE - PROCESS ALL TICKETS FOR A RESULT
# ============================================================================

async def process_result_for_all_tickets(
    result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Main entry point: Process all pending tickets for a published result.
    
    This is called when Super Admin publishes a result.
    
    Args:
        result: {
            "result_id": str,
            "lottery_id": str,
            "draw_date": str,  # "YYYY-MM-DD"
            "draw_name": str,  # "Midday", "Soir", etc.
            "winning_numbers": {"first": "123", "second": "45", "third": "78"}
        }
    
    Returns:
        {
            "processed": int,
            "winners": int,
            "losers": int,
            "total_payout": float,
            "winner_details": [...]
        }
    """
    if db is None:
        logger.error("[PayoutEngine] Database not initialized")
        return {"error": "Database not initialized", "processed": 0}
    
    lottery_id = result.get("lottery_id")
    draw_date = result.get("draw_date")
    draw_name = result.get("draw_name")
    result_id = result.get("result_id")
    
    # Parse winning numbers
    winning_numbers = result.get("winning_numbers", {})
    if isinstance(winning_numbers, str):
        # Parse string format "123-45-78"
        parts = winning_numbers.replace(" ", "").split("-")
        winning_numbers = {
            "first": parts[0] if len(parts) > 0 else "",
            "second": parts[1] if len(parts) > 1 else "",
            "third": parts[2] if len(parts) > 2 else ""
        }
    
    logger.info(f"[PayoutEngine] Processing result for {lottery_id} on {draw_date} ({draw_name})")
    logger.info(f"[PayoutEngine] Winning numbers: {winning_numbers}")
    
    # Find all pending tickets for this lottery/draw
    # Match on: lottery_id + draw_date + draw_name + status=VALIDATED or PENDING_RESULT
    query = {
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "status": {"$in": ["VALIDATED", "PENDING_RESULT", "ACTIVE", "pending"]}
    }
    
    # Also match draw_name if provided
    if draw_name:
        # Fuzzy match on draw_name (Midday, Midi, Evening, Soir, etc.)
        query["$or"] = [
            {"draw_name": draw_name},
            {"draw_name": {"$regex": draw_name, "$options": "i"}}
        ]
    
    pending_tickets = await db.lottery_transactions.find(query, {"_id": 0}).to_list(10000)
    
    logger.info(f"[PayoutEngine] Found {len(pending_tickets)} pending tickets to process")
    
    # Group tickets by company for prime optimization
    tickets_by_company: Dict[str, List[Dict]] = {}
    for ticket in pending_tickets:
        company_id = ticket.get("company_id", "unknown")
        if company_id not in tickets_by_company:
            tickets_by_company[company_id] = []
        tickets_by_company[company_id].append(ticket)
    
    # Process
    processed_count = 0
    winners_count = 0
    losers_count = 0
    total_payout = 0.0
    winner_details = []
    now = get_current_timestamp()
    
    for company_id, tickets in tickets_by_company.items():
        # Fetch primes once per company
        company_primes = await get_company_primes(company_id)
        
        for ticket in tickets:
            ticket_id = ticket.get("ticket_id")
            
            try:
                # Process ticket
                result_data = await process_ticket(ticket, winning_numbers, company_primes)
                
                is_winner = result_data["is_winner"]
                total_win = result_data["total_win"]
                winning_plays = result_data["winning_plays"]
                
                # Determine new status
                new_status = "WINNER" if is_winner else "LOSER"
                
                # Update ticket in database
                update_data = {
                    "status": new_status,
                    "win_amount": total_win,
                    "winnings": total_win,  # Alias for compatibility
                    "winning_plays": winning_plays,
                    "winning_numbers": winning_numbers,
                    "result_id": result_id,
                    "processed_at": now,
                    "is_winner": is_winner
                }
                
                await db.lottery_transactions.update_one(
                    {"ticket_id": ticket_id},
                    {"$set": update_data}
                )
                
                processed_count += 1
                
                if is_winner:
                    winners_count += 1
                    total_payout += total_win
                    
                    # Update agent balance (add to total_winnings)
                    agent_id = ticket.get("agent_id")
                    if agent_id:
                        await db.agent_balances.update_one(
                            {"agent_id": agent_id},
                            {
                                "$inc": {"total_winnings": total_win},
                                "$set": {"updated_at": now}
                            },
                            upsert=True
                        )
                    
                    # Record winner details
                    winner_details.append({
                        "ticket_id": ticket_id,
                        "ticket_code": ticket.get("ticket_code"),
                        "agent_name": ticket.get("agent_name"),
                        "company_id": company_id,
                        "total_bet": ticket.get("total_amount", 0),
                        "total_win": total_win,
                        "winning_plays": winning_plays
                    })
                    
                    # Create payout record
                    payout_id = generate_id("pay_")
                    payout_doc = {
                        "payout_id": payout_id,
                        "ticket_id": ticket_id,
                        "ticket_code": ticket.get("ticket_code"),
                        "agent_id": agent_id,
                        "company_id": company_id,
                        "lottery_id": lottery_id,
                        "draw_date": draw_date,
                        "draw_name": draw_name,
                        "winning_numbers": winning_numbers,
                        "winning_plays": winning_plays,
                        "total_bet": ticket.get("total_amount", 0),
                        "total_payout": total_win,
                        "currency": ticket.get("currency", "HTG"),
                        "status": "PENDING",  # Will be PAID when claimed
                        "created_at": now
                    }
                    await db.payouts.insert_one(payout_doc)
                    
                    logger.info(f"[PayoutEngine] WINNER: Ticket {ticket_id} won {total_win} HTG")
                else:
                    losers_count += 1
                    
            except Exception as e:
                logger.error(f"[PayoutEngine] Error processing ticket {ticket_id}: {str(e)}")
                continue
    
    # Update result with processing stats
    await db.global_results.update_one(
        {"result_id": result_id},
        {"$set": {
            "winners_processed": True,
            "tickets_processed": processed_count,
            "winners_count": winners_count,
            "losers_count": losers_count,
            "total_payout": total_payout,
            "processed_at": now
        }}
    )
    
    logger.info(f"[PayoutEngine] Completed: {processed_count} tickets, {winners_count} winners, {total_payout} HTG payout")
    
    return {
        "result_id": result_id,
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name,
        "processed": processed_count,
        "winners": winners_count,
        "losers": losers_count,
        "total_payout": total_payout,
        "winner_details": winner_details[:50]  # Limit to first 50
    }


# ============================================================================
# MANUAL REPROCESSING
# ============================================================================

async def reprocess_result(result_id: str) -> Dict[str, Any]:
    """
    Manually trigger reprocessing of a result.
    Useful if tickets were added after result publication.
    """
    if db is None:
        return {"error": "Database not initialized"}
    
    result = await db.global_results.find_one({"result_id": result_id}, {"_id": 0})
    if not result:
        return {"error": "Result not found"}
    
    return await process_result_for_all_tickets(result)


# ============================================================================
# TICKET SNAPSHOT - Save prime at moment of sale
# ============================================================================

async def get_primes_snapshot(company_id: str, plays: List[Dict]) -> List[Dict]:
    """
    Get current primes and attach to each play.
    Should be called at moment of sale to snapshot the prime.
    
    Returns plays with prime_at_sale field added.
    """
    primes = await get_company_primes(company_id)
    
    enriched_plays = []
    for play in plays:
        bet_type = str(play.get("bet_type", "BORLETTE")).upper()
        prime = primes.get(bet_type) or primes.get("BORLETTE", "60|20|10")
        
        enriched_play = dict(play)
        enriched_play["prime_at_sale"] = prime
        enriched_plays.append(enriched_play)
    
    return enriched_plays
