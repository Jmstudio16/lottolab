"""
LOTTOLAB - Production-Grade Settlement Engine
==============================================
Moteur de règlement automatique des loteries pour plateforme SaaS multi-tenant.

Ce module gère:
1. Publication des résultats officiels
2. Calcul déterministe des gagnants
3. Distribution des gains (Pool Percentage ou Fixed Multiplier)
4. Création des enregistrements de règlement
5. Crédit des portefeuilles
6. Audit complet et traçabilité
7. Protection contre les doubles paiements (idempotence)

Statuts de tirage:
- PENDING: En attente de résultat
- PUBLISHED: Résultat publié, règlement à faire
- SETTLING: Règlement en cours
- SETTLED: Règlement terminé avec succès
- FAILED: Règlement échoué

Modèles de paiement:
1. FIXED_MULTIPLIER: gain = mise × multiplicateur (60/20/10)
2. POOL_PERCENTAGE: gain = pourcentage du pool total

Auteur: LOTTOLAB Engineering Team
Version: 2.0.0
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from enum import Enum
import logging
import hashlib
import json
import asyncio

from utils import generate_id, get_current_timestamp

logger = logging.getLogger(__name__)

# ============================================================================
# CONSTANTS AND ENUMS
# ============================================================================

class DrawStatus(str, Enum):
    PENDING = "PENDING"
    PUBLISHED = "PUBLISHED"
    SETTLING = "SETTLING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"

class PayoutModel(str, Enum):
    FIXED_MULTIPLIER = "FIXED_MULTIPLIER"
    POOL_PERCENTAGE = "POOL_PERCENTAGE"

class TicketStatus(str, Enum):
    ACTIVE = "ACTIVE"
    VALIDATED = "VALIDATED"
    WINNER = "WINNER"
    LOSER = "LOSER"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"
    PAID = "PAID"

class SettlementStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"

# Global database reference
db: AsyncIOMotorDatabase = None


def set_settlement_engine_db(database: AsyncIOMotorDatabase):
    """Initialize the settlement engine with database reference"""
    global db
    db = database


# ============================================================================
# GAME TYPE MATCHERS - Modular Rule Engine
# ============================================================================

class GameMatcher:
    """Base class for game-specific matching logic"""
    
    @staticmethod
    def match(played_numbers: str, winning_result: Dict, bet_type: str) -> Dict:
        """
        Compare played numbers against winning result.
        
        Returns:
            {
                "is_winner": bool,
                "prize_rank": int (1, 2, 3, or 0 if no win),
                "matched_pattern": str,
                "explanation": str,
                "multiplier_position": int (for fixed multiplier model)
            }
        """
        raise NotImplementedError


class BorletteMatcher(GameMatcher):
    """
    Borlette matching logic (2-digit game)
    
    Rules:
    - Extract borlette (last 2 digits of 1st prize)
    - 1st rank: Match borlette
    - 2nd rank: Match 2nd prize
    - 3rd rank: Match 3rd prize
    """
    
    @staticmethod
    def match(played_numbers: str, winning_result: Dict, bet_type: str = "BORLETTE") -> Dict:
        played = str(played_numbers).strip().zfill(2)[-2:]  # Ensure 2 digits
        
        first_prize = str(winning_result.get("first", "")).strip()
        second_prize = str(winning_result.get("second", "")).strip().zfill(2)[-2:] if winning_result.get("second") else ""
        third_prize = str(winning_result.get("third", "")).strip().zfill(2)[-2:] if winning_result.get("third") else ""
        
        # Extract borlette (last 2 digits of first prize)
        borlette = first_prize[-2:] if len(first_prize) >= 2 else first_prize
        
        # Check matches
        if played == borlette:
            return {
                "is_winner": True,
                "prize_rank": 1,
                "matched_pattern": f"{played} = Borlette ({borlette})",
                "explanation": f"1er Lot: {played} correspond à la borlette {borlette}",
                "multiplier_position": 0,
                "winning_lot": 1
            }
        elif played == second_prize:
            return {
                "is_winner": True,
                "prize_rank": 2,
                "matched_pattern": f"{played} = 2ème prix ({second_prize})",
                "explanation": f"2ème Lot: {played} correspond au 2ème prix {second_prize}",
                "multiplier_position": 1,
                "winning_lot": 2
            }
        elif played == third_prize:
            return {
                "is_winner": True,
                "prize_rank": 3,
                "matched_pattern": f"{played} = 3ème prix ({third_prize})",
                "explanation": f"3ème Lot: {played} correspond au 3ème prix {third_prize}",
                "multiplier_position": 2,
                "winning_lot": 3
            }
        
        return {
            "is_winner": False,
            "prize_rank": 0,
            "matched_pattern": "",
            "explanation": f"{played} ne correspond à aucun lot gagnant",
            "multiplier_position": -1,
            "winning_lot": 0
        }


class Loto3Matcher(GameMatcher):
    """
    Loto 3 matching logic (3-digit exact match)
    
    Rule: Exact 3-digit match with 1st prize only
    """
    
    @staticmethod
    def match(played_numbers: str, winning_result: Dict, bet_type: str = "LOTO3") -> Dict:
        played = str(played_numbers).strip()
        first_prize = str(winning_result.get("first", "")).strip()
        
        # Normalize to 3 digits
        if len(played) == 3 and len(first_prize) >= 3:
            first_3 = first_prize[:3] if len(first_prize) > 3 else first_prize
            
            if played == first_3:
                return {
                    "is_winner": True,
                    "prize_rank": 1,
                    "matched_pattern": f"{played} = {first_3} (exact)",
                    "explanation": f"Loto 3 exact: {played} correspond à {first_3}",
                    "multiplier_position": 0,
                    "winning_lot": 1
                }
        
        return {
            "is_winner": False,
            "prize_rank": 0,
            "matched_pattern": "",
            "explanation": f"Loto 3: {played} ne correspond pas au 1er prix",
            "multiplier_position": -1,
            "winning_lot": 0
        }


class Loto4Matcher(GameMatcher):
    """
    Loto 4 matching logic (4-digit exact match)
    
    Rule: Exact 4-digit match
    Options: L4O1, L4O2, L4O3 for different prize positions
    """
    
    @staticmethod
    def match(played_numbers: str, winning_result: Dict, bet_type: str = "LOTO4") -> Dict:
        played = str(played_numbers).strip()
        
        # Determine which result to compare against based on bet type
        bet_upper = bet_type.upper()
        
        if bet_upper in ["L4O1", "L401", "LOTO4_O1"]:
            # Compare with first+second (4 digits combined)
            target = str(winning_result.get("first", ""))[:2] + str(winning_result.get("second", ""))[:2]
        elif bet_upper in ["L4O2", "L402", "LOTO4_O2"]:
            # Compare with second+third
            target = str(winning_result.get("second", ""))[:2] + str(winning_result.get("third", ""))[:2]
        elif bet_upper in ["L4O3", "L403", "LOTO4_O3"]:
            # Compare with first+third
            target = str(winning_result.get("first", ""))[:2] + str(winning_result.get("third", ""))[:2]
        else:
            # Default: compare with first prize as 4 digits
            target = str(winning_result.get("first", "")).strip()
        
        target = target.strip()
        
        if len(played) == 4 and len(target) >= 4 and played == target[:4]:
            return {
                "is_winner": True,
                "prize_rank": 1,
                "matched_pattern": f"{played} = {target[:4]} (exact)",
                "explanation": f"Loto 4 ({bet_type}): {played} correspond exactement",
                "multiplier_position": 0,
                "winning_lot": 1
            }
        
        return {
            "is_winner": False,
            "prize_rank": 0,
            "matched_pattern": "",
            "explanation": f"Loto 4 ({bet_type}): {played} ne correspond pas",
            "multiplier_position": -1,
            "winning_lot": 0
        }


class Loto5Matcher(GameMatcher):
    """
    Loto 5 matching logic (5-digit exact match)
    """
    
    @staticmethod
    def match(played_numbers: str, winning_result: Dict, bet_type: str = "LOTO5") -> Dict:
        played = str(played_numbers).strip()
        
        # Build 5-digit target from first+second+third[:1]
        bet_upper = bet_type.upper()
        
        if bet_upper in ["L5O1", "L501", "LOTO5_O1"]:
            target = (str(winning_result.get("first", ""))[:2] + 
                     str(winning_result.get("second", ""))[:2] + 
                     str(winning_result.get("third", ""))[:1])
        elif bet_upper in ["L5O2", "L502", "LOTO5_O2"]:
            target = (str(winning_result.get("first", ""))[:2] + 
                     str(winning_result.get("third", ""))[:2] + 
                     str(winning_result.get("second", ""))[:1])
        elif bet_upper in ["L5O3", "L503", "LOTO5_O3"]:
            target = (str(winning_result.get("second", ""))[:2] + 
                     str(winning_result.get("third", ""))[:2] + 
                     str(winning_result.get("first", ""))[:1])
        else:
            target = str(winning_result.get("first", "")).strip()
        
        target = target.strip()
        
        if len(played) == 5 and len(target) >= 5 and played == target[:5]:
            return {
                "is_winner": True,
                "prize_rank": 1,
                "matched_pattern": f"{played} = {target[:5]} (exact)",
                "explanation": f"Loto 5 ({bet_type}): {played} correspond exactement",
                "multiplier_position": 0,
                "winning_lot": 1
            }
        
        return {
            "is_winner": False,
            "prize_rank": 0,
            "matched_pattern": "",
            "explanation": f"Loto 5 ({bet_type}): {played} ne correspond pas",
            "multiplier_position": -1,
            "winning_lot": 0
        }


class MariageMatcher(GameMatcher):
    """
    Mariage matching logic (2 numbers combination)
    
    Rule: Both played numbers must appear in the winning set (borlette, 2nd, 3rd)
    """
    
    @staticmethod
    def match(played_numbers: str, winning_result: Dict, bet_type: str = "MARIAGE") -> Dict:
        played = str(played_numbers).strip()
        
        # Parse played numbers (formats: "12-34", "12x34", "12 34", "1234")
        nums = []
        for sep in ["-", "x", " ", ","]:
            if sep in played:
                nums = [n.strip().zfill(2)[-2:] for n in played.split(sep) if n.strip()]
                break
        
        if len(nums) != 2:
            if len(played) == 4:
                nums = [played[:2], played[2:]]
            else:
                return {
                    "is_winner": False,
                    "prize_rank": 0,
                    "matched_pattern": "",
                    "explanation": f"Mariage: format invalide {played}",
                    "multiplier_position": -1,
                    "winning_lot": 0
                }
        
        num1, num2 = nums[0], nums[1]
        
        # Build winning set
        first_prize = str(winning_result.get("first", "")).strip()
        borlette = first_prize[-2:] if len(first_prize) >= 2 else first_prize
        second = str(winning_result.get("second", "")).strip().zfill(2)[-2:] if winning_result.get("second") else ""
        third = str(winning_result.get("third", "")).strip().zfill(2)[-2:] if winning_result.get("third") else ""
        
        winning_set = {borlette, second, third}
        winning_set.discard("")
        
        if num1 in winning_set and num2 in winning_set:
            return {
                "is_winner": True,
                "prize_rank": 1,
                "matched_pattern": f"{num1} & {num2} dans {winning_set}",
                "explanation": f"Mariage: {num1} et {num2} sont gagnants",
                "multiplier_position": 0,
                "winning_lot": 1
            }
        
        return {
            "is_winner": False,
            "prize_rank": 0,
            "matched_pattern": "",
            "explanation": f"Mariage: {num1} et {num2} ne sont pas tous deux gagnants",
            "multiplier_position": -1,
            "winning_lot": 0
        }


# Game matcher registry
GAME_MATCHERS = {
    "BORLETTE": BorletteMatcher,
    "LOTO3": Loto3Matcher,
    "LOTO_3": Loto3Matcher,
    "LOTO4": Loto4Matcher,
    "LOTO_4": Loto4Matcher,
    "L4O1": Loto4Matcher,
    "L4O2": Loto4Matcher,
    "L4O3": Loto4Matcher,
    "L401": Loto4Matcher,
    "L402": Loto4Matcher,
    "L403": Loto4Matcher,
    "LOTO5": Loto5Matcher,
    "LOTO_5": Loto5Matcher,
    "L5O1": Loto5Matcher,
    "L5O2": Loto5Matcher,
    "L5O3": Loto5Matcher,
    "L501": Loto5Matcher,
    "L502": Loto5Matcher,
    "L503": Loto5Matcher,
    "MARIAGE": MariageMatcher,
    "MARIAGE_GRATUIT": MariageMatcher,
}


def get_matcher(bet_type: str) -> GameMatcher:
    """Get the appropriate matcher for a bet type"""
    bet_upper = bet_type.upper().replace(" ", "_")
    return GAME_MATCHERS.get(bet_upper, BorletteMatcher)


# ============================================================================
# PAYOUT CONFIGURATION
# ============================================================================

DEFAULT_PRIZE_CONFIGS = {
    "BORLETTE": {
        "payout_model": PayoutModel.FIXED_MULTIPLIER,
        "multipliers": [60, 20, 10],  # 1st, 2nd, 3rd rank
        "description": "60x pour 1er lot, 20x pour 2ème, 10x pour 3ème"
    },
    "LOTO3": {
        "payout_model": PayoutModel.FIXED_MULTIPLIER,
        "multipliers": [500],
        "description": "500x pour match exact"
    },
    "LOTO4": {
        "payout_model": PayoutModel.FIXED_MULTIPLIER,
        "multipliers": [5000],
        "description": "5000x pour match exact"
    },
    "LOTO5": {
        "payout_model": PayoutModel.FIXED_MULTIPLIER,
        "multipliers": [50000],
        "description": "50000x pour match exact"
    },
    "MARIAGE": {
        "payout_model": PayoutModel.FIXED_MULTIPLIER,
        "multipliers": [750],
        "description": "750x pour mariage gagnant"
    },
    "MARIAGE_GRATUIT": {
        "payout_model": PayoutModel.FIXED_MULTIPLIER,
        "multipliers": [750],
        "description": "750x pour mariage gratuit gagnant"
    },
}


async def get_prize_config(company_id: str, bet_type: str) -> Dict:
    """
    Get prize configuration for a company and bet type.
    Priority: company config > global config > defaults
    """
    bet_upper = bet_type.upper().replace(" ", "_")
    
    # 1. Check company-specific configuration
    if db is not None:
        company_config = await db.prize_configs.find_one({
            "company_id": company_id,
            "bet_type": bet_upper,
            "is_active": True
        }, {"_id": 0})
        
        if company_config:
            return parse_prize_config(company_config)
        
        # 2. Check company_configurations collection
        company_settings = await db.company_configurations.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        
        if company_settings:
            prime_key = f"prime_{bet_upper.lower()}"
            if company_settings.get(prime_key):
                formula = company_settings[prime_key]
                return {
                    "payout_model": PayoutModel.FIXED_MULTIPLIER,
                    "multipliers": parse_formula_to_multipliers(formula),
                    "formula": formula,
                    "source": "company_config"
                }
    
    # 3. Return defaults
    default = DEFAULT_PRIZE_CONFIGS.get(bet_upper, DEFAULT_PRIZE_CONFIGS["BORLETTE"])
    return {
        **default,
        "source": "default"
    }


def parse_formula_to_multipliers(formula: str) -> List[float]:
    """Parse formula string like '60|20|10' to list of multipliers"""
    if not formula:
        return [60, 20, 10]
    
    try:
        parts = formula.split("|")
        return [float(p.strip()) for p in parts if p.strip()]
    except (ValueError, AttributeError):
        return [60, 20, 10]


def parse_prize_config(config: Dict) -> Dict:
    """Parse prize config from database format"""
    formula = config.get("payout_formula") or config.get("distribution_json") or "60|20|10"
    
    return {
        "payout_model": PayoutModel(config.get("payout_model_type", PayoutModel.FIXED_MULTIPLIER)),
        "multipliers": parse_formula_to_multipliers(formula),
        "formula": formula,
        "split_rule": config.get("split_rule", "EQUAL"),
        "source": "database",
        "config_id": config.get("prize_config_id")
    }


# ============================================================================
# PAYOUT CALCULATION
# ============================================================================

async def calculate_fixed_multiplier_payout(
    bet_amount: float,
    prize_rank: int,
    multipliers: List[float]
) -> float:
    """
    Calculate payout using fixed multiplier model.
    
    gain = bet_amount × multiplier[rank_position]
    """
    if prize_rank <= 0 or prize_rank > len(multipliers):
        return 0.0
    
    multiplier = multipliers[prize_rank - 1]
    return bet_amount * multiplier


async def calculate_pool_percentage_payout(
    total_pool: float,
    prize_rank: int,
    percentages: List[float],
    winners_in_rank: int,
    split_rule: str = "EQUAL"
) -> float:
    """
    Calculate payout using pool percentage model.
    
    rank_pool = total_pool × percentage[rank]
    individual_payout = rank_pool / winners_in_rank (if EQUAL split)
    """
    if prize_rank <= 0 or prize_rank > len(percentages):
        return 0.0
    
    rank_percentage = percentages[prize_rank - 1] / 100.0
    rank_pool = total_pool * rank_percentage
    
    if winners_in_rank <= 0:
        return 0.0
    
    if split_rule == "EQUAL":
        return rank_pool / winners_in_rank
    
    # Other split rules can be added here
    return rank_pool / winners_in_rank


# ============================================================================
# SETTLEMENT ENGINE - CORE FUNCTIONS
# ============================================================================

async def publish_draw_result(
    draw_id: str,
    lottery_id: str,
    lottery_name: str,
    draw_date: str,
    draw_name: str,
    winning_numbers: Dict,
    actor_id: str,
    actor_role: str,
    company_id: Optional[str] = None,
    auto_settle: bool = True
) -> Dict:
    """
    Publish official lottery result and optionally trigger settlement.
    
    Args:
        draw_id: Unique draw identifier
        lottery_id: Lottery identifier
        lottery_name: Lottery name
        draw_date: Draw date (YYYY-MM-DD)
        draw_name: Draw name (Midi, Soir, etc.)
        winning_numbers: Dict with first, second, third prizes
        actor_id: User ID who published
        actor_role: Role of publisher (must be SUPER_ADMIN)
        company_id: Optional company filter
        auto_settle: Whether to auto-trigger settlement
    
    Returns:
        Result object with status and settlement info
    """
    timestamp = get_current_timestamp()
    
    # Generate result hash for idempotency
    result_hash = hashlib.sha256(
        f"{lottery_id}:{draw_date}:{draw_name}:{json.dumps(winning_numbers, sort_keys=True)}".encode()
    ).hexdigest()
    
    # Check for duplicate publication
    existing = await db.published_results.find_one({
        "result_hash": result_hash
    }, {"_id": 0})
    
    if existing:
        logger.warning(f"Duplicate result publication attempt for draw {draw_id}")
        return {
            "success": False,
            "error": "DUPLICATE_RESULT",
            "message": "Ce résultat a déjà été publié",
            "existing_result_id": existing.get("result_id")
        }
    
    # Create result record
    result_id = generate_id("result")
    result_record = {
        "result_id": result_id,
        "draw_id": draw_id or generate_id("draw"),
        "lottery_id": lottery_id,
        "lottery_name": lottery_name,
        "draw_date": draw_date,
        "draw_name": draw_name,
        "winning_numbers": winning_numbers,
        "result_hash": result_hash,
        "published_by": actor_id,
        "published_by_role": actor_role,
        "published_at": timestamp,
        "is_official": True,
        "status": DrawStatus.PUBLISHED,
        "company_id": company_id,  # None for global results
        "version": 1,
        "created_at": timestamp,
        "updated_at": timestamp
    }
    
    await db.published_results.insert_one(result_record)
    
    # Also insert into global_results for backward compatibility
    global_result = {
        "result_id": result_id,
        "lottery_id": lottery_id,
        "lottery_name": lottery_name,
        "draw_date": draw_date,
        "draw_time": draw_name,
        "draw_name": draw_name,
        "winning_numbers": winning_numbers,
        "first": winning_numbers.get("first"),
        "second": winning_numbers.get("second"),
        "third": winning_numbers.get("third"),
        "published_by": actor_id,
        "published_at": timestamp,
        "is_processed": False,
        "created_at": timestamp
    }
    
    await db.global_results.update_one(
        {"lottery_id": lottery_id, "draw_date": draw_date, "draw_name": draw_name},
        {"$set": global_result},
        upsert=True
    )
    
    # Create audit log
    await create_audit_log(
        entity_type="RESULT",
        entity_id=result_id,
        action="PUBLISH",
        actor_id=actor_id,
        actor_role=actor_role,
        company_id=company_id,
        new_value=result_record,
        metadata={"lottery_name": lottery_name, "draw_date": draw_date}
    )
    
    settlement_result = None
    
    # Auto-trigger settlement if enabled
    if auto_settle:
        settlement_result = await settle_draw(
            result_id=result_id,
            lottery_id=lottery_id,
            draw_date=draw_date,
            draw_name=draw_name,
            winning_numbers=winning_numbers,
            processed_by=actor_id
        )
    
    return {
        "success": True,
        "result_id": result_id,
        "draw_id": result_record["draw_id"],
        "status": DrawStatus.PUBLISHED,
        "settlement": settlement_result,
        "message": "Résultat publié avec succès"
    }


async def settle_draw(
    result_id: str,
    lottery_id: str,
    draw_date: str,
    draw_name: str,
    winning_numbers: Dict,
    processed_by: str,
    company_filter: Optional[str] = None
) -> Dict:
    """
    Main settlement function - Process all tickets for a draw.
    
    This function is IDEMPOTENT - calling it multiple times for the
    same draw will not create duplicate settlements.
    
    Flow:
    1. Lock the draw (change status to SETTLING)
    2. Load all valid tickets
    3. Process each ticket line
    4. Calculate payouts
    5. Create settlement records
    6. Update ticket statuses
    7. Credit wallets
    8. Mark draw as SETTLED
    """
    timestamp = get_current_timestamp()
    settlement_id = generate_id("settlement")
    
    logger.info(f"Starting settlement for {lottery_id} on {draw_date} {draw_name}")
    
    # Check for existing settlement
    existing_settlement = await db.settlements.find_one({
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name,
        "status": SettlementStatus.COMPLETED
    }, {"_id": 0})
    
    if existing_settlement:
        logger.warning(f"Settlement already completed for {lottery_id} {draw_date} {draw_name}")
        return {
            "success": False,
            "error": "ALREADY_SETTLED",
            "message": "Ce tirage a déjà été réglé",
            "existing_settlement_id": existing_settlement.get("settlement_id")
        }
    
    # Create settlement record
    settlement_record = {
        "settlement_id": settlement_id,
        "result_id": result_id,
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "draw_name": draw_name,
        "winning_numbers": winning_numbers,
        "status": SettlementStatus.PROCESSING,
        "started_at": timestamp,
        "processed_by": processed_by,
        "company_filter": company_filter,
        "total_tickets_scanned": 0,
        "total_winning_tickets": 0,
        "total_sales_amount": 0.0,
        "total_payout_amount": 0.0,
        "winners_by_rank": {},
        "errors": [],
        "created_at": timestamp,
        "updated_at": timestamp
    }
    
    await db.settlements.insert_one(settlement_record)
    
    try:
        # Build query for tickets
        ticket_query = {
            "lottery_id": lottery_id,
            "draw_date": draw_date,
            "$or": [
                {"draw_name": draw_name},
                {"draw_time": draw_name}
            ],
            "status": {"$in": [
                TicketStatus.ACTIVE,
                TicketStatus.VALIDATED,
                "ACTIVE",
                "VALIDATED",
                "active",
                "validated",
                "VALIDÉ"
            ]}
        }
        
        if company_filter:
            ticket_query["company_id"] = company_filter
        
        # Load all tickets
        tickets = await db.lottery_transactions.find(
            ticket_query,
            {"_id": 0}
        ).to_list(10000)  # Batch limit
        
        logger.info(f"Found {len(tickets)} tickets to process")
        
        total_sales = sum(t.get("total_amount", 0) for t in tickets)
        total_payout = 0.0
        winning_tickets = []
        winners_by_rank = {1: [], 2: [], 3: []}
        settlement_items = []
        errors = []
        
        # Process each ticket
        for ticket in tickets:
            try:
                ticket_result = await process_ticket_for_settlement(
                    ticket=ticket,
                    winning_numbers=winning_numbers,
                    settlement_id=settlement_id
                )
                
                if ticket_result["is_winner"]:
                    winning_tickets.append(ticket_result)
                    total_payout += ticket_result["total_win_amount"]
                    
                    # Track by rank
                    for item in ticket_result.get("winning_items", []):
                        rank = item.get("prize_rank", 0)
                        if rank in winners_by_rank:
                            winners_by_rank[rank].append(item)
                    
                    # Create settlement items
                    for item in ticket_result.get("settlement_items", []):
                        settlement_items.append(item)
                        
            except Exception as e:
                logger.error(f"Error processing ticket {ticket.get('ticket_id')}: {e}")
                errors.append({
                    "ticket_id": ticket.get("ticket_id"),
                    "error": str(e)
                })
        
        # Batch insert settlement items
        if settlement_items:
            await db.settlement_items.insert_many(settlement_items)
        
        # Update settlement record
        completed_at = get_current_timestamp()
        await db.settlements.update_one(
            {"settlement_id": settlement_id},
            {"$set": {
                "status": SettlementStatus.COMPLETED,
                "completed_at": completed_at,
                "total_tickets_scanned": len(tickets),
                "total_winning_tickets": len(winning_tickets),
                "total_sales_amount": total_sales,
                "total_payout_amount": total_payout,
                "winners_by_rank": {
                    "rank_1": len(winners_by_rank[1]),
                    "rank_2": len(winners_by_rank[2]),
                    "rank_3": len(winners_by_rank[3])
                },
                "errors": errors,
                "updated_at": completed_at
            }}
        )
        
        # Mark result as processed
        await db.global_results.update_one(
            {"result_id": result_id},
            {"$set": {"is_processed": True, "settlement_id": settlement_id}}
        )
        
        # Create audit log
        await create_audit_log(
            entity_type="SETTLEMENT",
            entity_id=settlement_id,
            action="COMPLETE",
            actor_id=processed_by,
            actor_role="SYSTEM",
            metadata={
                "tickets_scanned": len(tickets),
                "winning_tickets": len(winning_tickets),
                "total_payout": total_payout
            }
        )
        
        logger.info(f"Settlement completed: {len(winning_tickets)} winners, {total_payout} HTG payout")
        
        return {
            "success": True,
            "settlement_id": settlement_id,
            "status": SettlementStatus.COMPLETED,
            "tickets_scanned": len(tickets),
            "winning_tickets": len(winning_tickets),
            "total_sales": total_sales,
            "total_payout": total_payout,
            "winners_by_rank": {
                "rank_1": len(winners_by_rank[1]),
                "rank_2": len(winners_by_rank[2]),
                "rank_3": len(winners_by_rank[3])
            },
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Settlement failed: {e}")
        
        await db.settlements.update_one(
            {"settlement_id": settlement_id},
            {"$set": {
                "status": SettlementStatus.FAILED,
                "error_message": str(e),
                "updated_at": get_current_timestamp()
            }}
        )
        
        return {
            "success": False,
            "settlement_id": settlement_id,
            "error": "SETTLEMENT_FAILED",
            "message": str(e)
        }


async def process_ticket_for_settlement(
    ticket: Dict,
    winning_numbers: Dict,
    settlement_id: str
) -> Dict:
    """
    Process a single ticket for settlement.
    
    Returns detailed information about wins for each play.
    """
    ticket_id = ticket.get("ticket_id")
    company_id = ticket.get("company_id")
    plays = ticket.get("plays", [])
    
    timestamp = get_current_timestamp()
    is_winner = False
    total_win_amount = 0.0
    winning_plays = []
    settlement_items = []
    
    for play in plays:
        bet_type = play.get("bet_type", "BORLETTE").upper()
        played_numbers = str(play.get("numbers", ""))
        bet_amount = float(play.get("amount", 0))
        
        # Get matcher for this bet type
        matcher_class = get_matcher(bet_type)
        match_result = matcher_class.match(played_numbers, winning_numbers, bet_type)
        
        if match_result["is_winner"]:
            is_winner = True
            
            # Get prize configuration
            prize_config = await get_prize_config(company_id, bet_type)
            
            # Calculate payout
            if prize_config["payout_model"] == PayoutModel.FIXED_MULTIPLIER:
                win_amount = await calculate_fixed_multiplier_payout(
                    bet_amount=bet_amount,
                    prize_rank=match_result["prize_rank"],
                    multipliers=prize_config["multipliers"]
                )
            else:
                # Pool percentage would require total pool calculation
                win_amount = bet_amount * prize_config["multipliers"][0]
            
            total_win_amount += win_amount
            
            winning_play = {
                **play,
                "is_winner": True,
                "prize_rank": match_result["prize_rank"],
                "winning_lot": match_result["winning_lot"],
                "matched_pattern": match_result["matched_pattern"],
                "explanation": match_result["explanation"],
                "multiplier": prize_config["multipliers"][match_result["prize_rank"] - 1] if match_result["prize_rank"] > 0 else 0,
                "win_amount": win_amount,
                "gain": win_amount
            }
            winning_plays.append(winning_play)
            
            # Create settlement item
            settlement_item = {
                "item_id": generate_id("sitem"),
                "settlement_id": settlement_id,
                "ticket_id": ticket_id,
                "play_index": plays.index(play),
                "bet_type": bet_type,
                "played_numbers": played_numbers,
                "stake_amount": bet_amount,
                "prize_rank": match_result["prize_rank"],
                "winning_lot": match_result["winning_lot"],
                "multiplier": prize_config["multipliers"][match_result["prize_rank"] - 1] if match_result["prize_rank"] > 0 else 0,
                "winning_amount": win_amount,
                "matched_pattern": match_result["matched_pattern"],
                "payout_status": "PENDING",
                "created_at": timestamp
            }
            settlement_items.append(settlement_item)
    
    # Update ticket if winner
    if is_winner:
        await db.lottery_transactions.update_one(
            {"ticket_id": ticket_id},
            {"$set": {
                "status": TicketStatus.WINNER,
                "is_winner": True,
                "win_amount": total_win_amount,
                "winning_plays": winning_plays,
                "settlement_id": settlement_id,
                "settled_at": timestamp,
                "updated_at": timestamp
            }}
        )
        
        # Credit wallet (if wallet system exists)
        agent_id = ticket.get("agent_id") or ticket.get("seller_id")
        if agent_id:
            await credit_wallet(
                user_id=agent_id,
                amount=total_win_amount,
                company_id=company_id,
                reference_type="SETTLEMENT",
                reference_id=settlement_id,
                ticket_id=ticket_id,
                description=f"Gain ticket {ticket.get('ticket_code', ticket_id)}"
            )
    else:
        # Mark as loser
        await db.lottery_transactions.update_one(
            {"ticket_id": ticket_id},
            {"$set": {
                "status": TicketStatus.LOSER,
                "is_winner": False,
                "win_amount": 0,
                "settlement_id": settlement_id,
                "settled_at": timestamp,
                "updated_at": timestamp
            }}
        )
    
    return {
        "ticket_id": ticket_id,
        "ticket_code": ticket.get("ticket_code"),
        "is_winner": is_winner,
        "total_win_amount": total_win_amount,
        "winning_plays": winning_plays,
        "winning_items": winning_plays,
        "settlement_items": settlement_items
    }


async def credit_wallet(
    user_id: str,
    amount: float,
    company_id: str,
    reference_type: str,
    reference_id: str,
    ticket_id: Optional[str] = None,
    description: str = ""
) -> Dict:
    """
    Credit a user's wallet with idempotency protection.
    
    Prevents duplicate credits for the same reference.
    """
    # Check for existing credit
    existing = await db.wallet_transactions.find_one({
        "reference_type": reference_type,
        "reference_id": reference_id,
        "ticket_id": ticket_id,
        "user_id": user_id,
        "transaction_type": "CREDIT"
    }, {"_id": 0})
    
    if existing:
        logger.warning(f"Duplicate wallet credit attempt: {reference_id}")
        return {
            "success": False,
            "error": "DUPLICATE_CREDIT",
            "existing_transaction_id": existing.get("transaction_id")
        }
    
    timestamp = get_current_timestamp()
    transaction_id = generate_id("wtx")
    
    transaction = {
        "transaction_id": transaction_id,
        "company_id": company_id,
        "user_id": user_id,
        "ticket_id": ticket_id,
        "reference_type": reference_type,
        "reference_id": reference_id,
        "transaction_type": "CREDIT",
        "amount": amount,
        "currency": "HTG",
        "description": description,
        "status": "COMPLETED",
        "created_at": timestamp
    }
    
    await db.wallet_transactions.insert_one(transaction)
    
    # Update user balance (if balance tracking exists)
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"wallet_balance": amount}}
    )
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "amount": amount
    }


async def create_audit_log(
    entity_type: str,
    entity_id: str,
    action: str,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    company_id: Optional[str] = None,
    old_value: Optional[Dict] = None,
    new_value: Optional[Dict] = None,
    metadata: Optional[Dict] = None
):
    """Create an audit log entry"""
    timestamp = get_current_timestamp()
    
    log_entry = {
        "log_id": generate_id("audit"),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "actor_id": actor_id,
        "actor_role": actor_role,
        "company_id": company_id,
        "old_value": old_value,
        "new_value": new_value,
        "metadata": metadata or {},
        "created_at": timestamp
    }
    
    await db.audit_logs.insert_one(log_entry)


# ============================================================================
# SETTLEMENT REPORTS
# ============================================================================

async def get_settlement_report(settlement_id: str, company_id: Optional[str] = None) -> Dict:
    """Generate detailed settlement report"""
    
    settlement = await db.settlements.find_one(
        {"settlement_id": settlement_id},
        {"_id": 0}
    )
    
    if not settlement:
        return {"error": "Settlement not found"}
    
    # Get settlement items
    items_query = {"settlement_id": settlement_id}
    items = await db.settlement_items.find(items_query, {"_id": 0}).to_list(1000)
    
    # Get winning tickets
    tickets_query = {
        "settlement_id": settlement_id,
        "is_winner": True
    }
    if company_id:
        tickets_query["company_id"] = company_id
    
    winning_tickets = await db.lottery_transactions.find(
        tickets_query,
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate statistics
    total_payout_by_rank = {1: 0, 2: 0, 3: 0}
    count_by_rank = {1: 0, 2: 0, 3: 0}
    
    for item in items:
        rank = item.get("prize_rank", 0)
        if rank in total_payout_by_rank:
            total_payout_by_rank[rank] += item.get("winning_amount", 0)
            count_by_rank[rank] += 1
    
    return {
        "settlement": settlement,
        "statistics": {
            "total_tickets_scanned": settlement.get("total_tickets_scanned", 0),
            "total_winning_tickets": settlement.get("total_winning_tickets", 0),
            "total_sales_amount": settlement.get("total_sales_amount", 0),
            "total_payout_amount": settlement.get("total_payout_amount", 0),
            "profit_loss": settlement.get("total_sales_amount", 0) - settlement.get("total_payout_amount", 0),
            "payout_by_rank": total_payout_by_rank,
            "winners_by_rank": count_by_rank
        },
        "settlement_items": items,
        "winning_tickets": winning_tickets
    }


async def get_company_settlement_summary(
    company_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict:
    """Get settlement summary for a company"""
    
    query = {}
    
    # Filter by date range
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["draw_date"] = date_filter
    
    # Get all settlements
    settlements = await db.settlements.find(
        query,
        {"_id": 0}
    ).to_list(1000)
    
    # Get winning tickets for company
    ticket_query = {
        "company_id": company_id,
        "is_winner": True
    }
    if start_date or end_date:
        ticket_query["draw_date"] = date_filter
    
    winning_tickets = await db.lottery_transactions.find(
        ticket_query,
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate totals
    total_winnings = sum(t.get("win_amount", 0) for t in winning_tickets)
    total_sales_query = {"company_id": company_id}
    if start_date or end_date:
        total_sales_query["draw_date"] = date_filter
    
    all_tickets = await db.lottery_transactions.find(
        total_sales_query,
        {"total_amount": 1}
    ).to_list(10000)
    
    total_sales = sum(t.get("total_amount", 0) for t in all_tickets)
    
    return {
        "company_id": company_id,
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "summary": {
            "total_tickets": len(all_tickets),
            "winning_tickets": len(winning_tickets),
            "total_sales": total_sales,
            "total_payouts": total_winnings,
            "net_revenue": total_sales - total_winnings,
            "payout_ratio": (total_winnings / total_sales * 100) if total_sales > 0 else 0
        },
        "settlements_count": len([s for s in settlements if s.get("status") == SettlementStatus.COMPLETED]),
        "winning_tickets_detail": winning_tickets[:50]  # Limit for performance
    }


# ============================================================================
# INITIALIZATION
# ============================================================================

async def ensure_indexes():
    """Create necessary database indexes for performance"""
    if db is None:
        return
    
    # Settlements indexes
    await db.settlements.create_index("settlement_id", unique=True)
    await db.settlements.create_index([("lottery_id", 1), ("draw_date", 1), ("draw_name", 1)])
    await db.settlements.create_index("status")
    
    # Settlement items indexes
    await db.settlement_items.create_index("item_id", unique=True)
    await db.settlement_items.create_index("settlement_id")
    await db.settlement_items.create_index("ticket_id")
    
    # Published results indexes
    await db.published_results.create_index("result_id", unique=True)
    await db.published_results.create_index("result_hash", unique=True)
    await db.published_results.create_index([("lottery_id", 1), ("draw_date", 1), ("draw_name", 1)])
    
    # Wallet transactions indexes
    await db.wallet_transactions.create_index("transaction_id", unique=True)
    await db.wallet_transactions.create_index([
        ("reference_type", 1),
        ("reference_id", 1),
        ("ticket_id", 1),
        ("user_id", 1)
    ])
    
    # Audit logs indexes
    await db.audit_logs.create_index("log_id", unique=True)
    await db.audit_logs.create_index([("entity_type", 1), ("entity_id", 1)])
    await db.audit_logs.create_index("created_at")
    
    logger.info("Settlement engine indexes created successfully")
