"""
LOTTOLAB - Moteur Central de Calcul des Gains (LOT 1)
======================================================
Ce module est le SEUL point de calcul pour tous les gains de loterie.
Il gère:
- Lecture des primes depuis la configuration (compagnie → globale)
- Calcul pour tous les types de jeux (Borlette, Mariage, Loto 3/4/5)
- Détection automatique des gagnants après publication de résultat
- Journalisation complète pour audit

Règle métier 60/20/10:
- 1er lot = multiplicateur 60
- 2e lot = multiplicateur 20
- 3e lot = multiplicateur 10

Formule: gain = mise × multiplicateur_du_lot
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
import re

from utils import generate_id, get_current_timestamp

# Configure logging
logger = logging.getLogger(__name__)

# Global database reference
db: AsyncIOMotorDatabase = None


def set_winning_engine_db(database: AsyncIOMotorDatabase):
    """Set the database connection for the winning engine"""
    global db
    db = database


# ============================================================================
# CONFIGURATION - PRIMES PAR DÉFAUT (GLOBALES)
# ============================================================================

# Primes par défaut si aucune configuration n'existe
DEFAULT_PRIMES = {
    "BORLETTE": {
        "bet_code": "20",
        "name": "Borlette",
        "payout_formula": "60|20|10",  # 1er|2e|3e lot
        "description": "2 chiffres, gains sur 1er/2e/3e lot"
    },
    "LOTO3": {
        "bet_code": "30",
        "name": "Loto 3",
        "payout_formula": "500",  # Un seul multiplicateur
        "description": "3 chiffres exacts"
    },
    "MARIAGE": {
        "bet_code": "40",
        "name": "Mariage",
        "payout_formula": "750",  # Deux numéros combinés
        "description": "2 numéros combinés"
    },
    "L4O1": {
        "bet_code": "41",
        "name": "Loto 4 Option 1",
        "payout_formula": "750",
        "description": "Loto 4 variante 1"
    },
    "L4O2": {
        "bet_code": "42",
        "name": "Loto 4 Option 2",
        "payout_formula": "750",
        "description": "Loto 4 variante 2"
    },
    "L4O3": {
        "bet_code": "43",
        "name": "Loto 4 Option 3",
        "payout_formula": "750",
        "description": "Loto 4 variante 3"
    },
    "L5O1": {
        "bet_code": "51",
        "name": "Loto 5 Option 1",
        "payout_formula": "750",
        "description": "Loto 5 variante 1"
    },
    "L5O2": {
        "bet_code": "52",
        "name": "Loto 5 Option 2",
        "payout_formula": "750",
        "description": "Loto 5 variante 2"
    },
    "L5O3": {
        "bet_code": "53",
        "name": "Loto 5 Option 3",
        "payout_formula": "750",
        "description": "Loto 5 variante 3"
    },
    "MARIAGE_GRATUIT": {
        "bet_code": "44",
        "name": "Mariage Gratuit",
        "payout_formula": "750",
        "description": "Mariage offert"
    }
}


# ============================================================================
# 1. LECTURE DES PRIMES DEPUIS LA CONFIGURATION
# ============================================================================

async def get_payout_config(company_id: str, bet_type: str) -> Dict:
    """
    Récupère la configuration de prime pour un type de jeu.
    Priorité:
    1. Configuration de la compagnie
    2. Configuration globale (si existe)
    3. Valeurs par défaut hardcodées
    
    Returns:
        {
            "multipliers": [60, 20, 10] ou [500],
            "source": "company" | "global" | "default",
            "config_id": "prime_xyz"
        }
    """
    bet_type_upper = bet_type.upper().replace(" ", "_")
    
    # 1. Chercher dans la configuration de la compagnie
    company_config = await db.prime_configs.find_one({
        "company_id": company_id,
        "bet_type": bet_type_upper,
        "is_active": True
    }, {"_id": 0})
    
    if company_config:
        formula = company_config.get("payout_formula", "60|20|10")
        multipliers = parse_payout_formula(formula)
        return {
            "multipliers": multipliers,
            "source": "company",
            "config_id": company_config.get("prime_id"),
            "formula": formula
        }
    
    # 2. Chercher une configuration globale (sans company_id)
    global_config = await db.prime_configs.find_one({
        "company_id": None,
        "bet_type": bet_type_upper,
        "is_active": True
    }, {"_id": 0})
    
    if global_config:
        formula = global_config.get("payout_formula", "60|20|10")
        multipliers = parse_payout_formula(formula)
        return {
            "multipliers": multipliers,
            "source": "global",
            "config_id": global_config.get("prime_id"),
            "formula": formula
        }
    
    # 3. Utiliser les valeurs par défaut
    default_config = DEFAULT_PRIMES.get(bet_type_upper, DEFAULT_PRIMES.get("BORLETTE"))
    formula = default_config.get("payout_formula", "60|20|10")
    multipliers = parse_payout_formula(formula)
    
    return {
        "multipliers": multipliers,
        "source": "default",
        "config_id": None,
        "formula": formula
    }


def parse_payout_formula(formula: str) -> List[int]:
    """
    Parse une formule de payout.
    Exemples:
    - "60|20|10" → [60, 20, 10] (1er, 2e, 3e lot)
    - "500" → [500] (un seul multiplicateur)
    - "750|500" → [750, 500]
    """
    if not formula:
        return [60, 20, 10]  # Default
    
    parts = str(formula).split("|")
    multipliers = []
    
    for part in parts:
        try:
            multipliers.append(int(part.strip()))
        except ValueError:
            continue
    
    return multipliers if multipliers else [60, 20, 10]


# ============================================================================
# 2. PARSING DES NUMÉROS GAGNANTS
# ============================================================================

def parse_winning_numbers(winning_data: Any) -> Dict[str, str]:
    """
    Parse les numéros gagnants depuis différents formats.
    
    Formats supportés:
    - Dict: {"first": "42", "second": "15", "third": "88"}
    - String: "42-15-88" ou "42,15,88" ou "42 15 88"
    - List: ["42", "15", "88"]
    
    Returns:
        {
            "first": "42",   # 1er lot
            "second": "15",  # 2e lot
            "third": "88"    # 3e lot
        }
    """
    result = {"first": None, "second": None, "third": None}
    
    if not winning_data:
        return result
    
    # Si c'est déjà un dict
    if isinstance(winning_data, dict):
        result["first"] = str(winning_data.get("first", "")).strip() or None
        result["second"] = str(winning_data.get("second", "")).strip() or None
        result["third"] = str(winning_data.get("third", "")).strip() or None
        # Support pour "loto3" ou autres champs
        if not result["first"] and winning_data.get("loto3"):
            result["first"] = str(winning_data.get("loto3", "")).strip()
        return result
    
    # Si c'est une liste
    if isinstance(winning_data, list):
        if len(winning_data) >= 1:
            result["first"] = str(winning_data[0]).strip()
        if len(winning_data) >= 2:
            result["second"] = str(winning_data[1]).strip()
        if len(winning_data) >= 3:
            result["third"] = str(winning_data[2]).strip()
        return result
    
    # Si c'est une string
    winning_str = str(winning_data).strip()
    
    # Séparer par différents délimiteurs
    parts = re.split(r'[-,\s]+', winning_str)
    parts = [p.strip() for p in parts if p.strip()]
    
    if len(parts) >= 1:
        result["first"] = parts[0]
    if len(parts) >= 2:
        result["second"] = parts[1]
    if len(parts) >= 3:
        result["third"] = parts[2]
    
    return result


# ============================================================================
# 3. DÉTECTION DES LOTS GAGNANTS
# ============================================================================

def determine_winning_lot(
    played_number: str,
    winning_numbers: Dict[str, str],
    bet_type: str
) -> Optional[int]:
    """
    Détermine si un numéro joué a gagné et sur quel lot.
    
    Args:
        played_number: Le numéro joué (ex: "42", "12-45" pour mariage)
        winning_numbers: {"first": "42", "second": "15", "third": "88"}
        bet_type: "BORLETTE", "MARIAGE", "LOTO3", etc.
    
    Returns:
        1, 2, ou 3 pour le lot gagné
        None si pas de gain
    """
    if not played_number or not winning_numbers:
        return None
    
    played = str(played_number).strip()
    bet_type_upper = bet_type.upper() if bet_type else "BORLETTE"
    
    # ===== BORLETTE (2 chiffres) =====
    if bet_type_upper in ["BORLETTE", "20"]:
        # Vérifier sur les 3 lots
        if winning_numbers.get("first") and played == str(winning_numbers["first"]).strip():
            return 1  # 1er lot
        if winning_numbers.get("second") and played == str(winning_numbers["second"]).strip():
            return 2  # 2e lot
        if winning_numbers.get("third") and played == str(winning_numbers["third"]).strip():
            return 3  # 3e lot
        return None
    
    # ===== MARIAGE (2 numéros combinés) =====
    if bet_type_upper in ["MARIAGE", "MARIAGE_GRATUIT", "40", "44"]:
        # Le mariage est gagnant si les 2 numéros joués sont dans les 3 lots
        played_parts = re.split(r'[-,\s]+', played)
        if len(played_parts) < 2:
            return None
        
        num1 = played_parts[0].strip()
        num2 = played_parts[1].strip()
        
        winning_set = set()
        for key in ["first", "second", "third"]:
            if winning_numbers.get(key):
                winning_set.add(str(winning_numbers[key]).strip())
        
        if num1 in winning_set and num2 in winning_set:
            return 1  # Mariage gagnant = 1er lot (multiplicateur unique)
        return None
    
    # ===== LOTO 3 (3 chiffres exacts) =====
    if bet_type_upper in ["LOTO3", "LOTO_3", "30"]:
        # Le Loto 3 gagne si les 3 chiffres correspondent exactement au 1er lot
        first_lot = winning_numbers.get("first", "")
        if first_lot and played == str(first_lot).strip():
            return 1
        return None
    
    # ===== LOTO 4 (4 chiffres) =====
    if bet_type_upper in ["LOTO4", "LOTO_4", "L4O1", "L4O2", "L4O3", "41", "42", "43"]:
        # Compare avec les numéros gagnants combinés
        # Le Loto 4 peut avoir des variantes
        first_lot = winning_numbers.get("first", "")
        second_lot = winning_numbers.get("second", "")
        
        # Combiner les 2 premiers lots pour former un numéro à 4 chiffres
        combined = f"{first_lot}{second_lot}".replace(" ", "")
        
        if played == combined:
            return 1
        return None
    
    # ===== LOTO 5 (5 chiffres) =====
    if bet_type_upper in ["LOTO5", "LOTO_5", "L5O1", "L5O2", "L5O3", "51", "52", "53"]:
        # Compare avec les numéros gagnants combinés
        first_lot = winning_numbers.get("first", "")
        second_lot = winning_numbers.get("second", "")
        third_lot = winning_numbers.get("third", "")
        
        # Combiner les 3 lots
        combined = f"{first_lot}{second_lot}"
        if third_lot:
            combined += str(third_lot)[:1]  # Premier chiffre du 3e lot
        combined = combined.replace(" ", "")
        
        if played == combined:
            return 1
        return None
    
    # ===== Par défaut: comportement Borlette =====
    if winning_numbers.get("first") and played == str(winning_numbers["first"]).strip():
        return 1
    if winning_numbers.get("second") and played == str(winning_numbers["second"]).strip():
        return 2
    if winning_numbers.get("third") and played == str(winning_numbers["third"]).strip():
        return 3
    
    return None


# ============================================================================
# 4. CALCUL DES GAINS
# ============================================================================

async def calculate_line_winnings(
    played_number: str,
    bet_type: str,
    bet_amount: float,
    winning_numbers: Dict[str, str],
    company_id: str
) -> Dict:
    """
    Calcule le gain pour UNE ligne de ticket.
    
    Args:
        played_number: Numéro joué
        bet_type: Type de jeu (BORLETTE, MARIAGE, LOTO3, etc.)
        bet_amount: Montant misé sur cette ligne
        winning_numbers: Les numéros gagnants publiés
        company_id: ID de la compagnie pour lire la config des primes
    
    Returns:
        {
            "played_number": "42",
            "bet_type": "BORLETTE",
            "bet_amount": 100.0,
            "winning_lot": 1,  # ou 2, 3, None
            "multiplier": 60,
            "gain": 6000.0,
            "is_winner": True,
            "status": "WINNER",
            "payout_config": {...}
        }
    """
    # Récupérer la configuration des primes
    payout_config = await get_payout_config(company_id, bet_type)
    multipliers = payout_config.get("multipliers", [60, 20, 10])
    
    # Déterminer si c'est gagnant et sur quel lot
    winning_lot = determine_winning_lot(played_number, winning_numbers, bet_type)
    
    result = {
        "played_number": played_number,
        "bet_type": bet_type,
        "bet_amount": float(bet_amount),
        "winning_lot": winning_lot,
        "multiplier": 0,
        "gain": 0.0,
        "is_winner": False,
        "status": "LOSER",
        "payout_config": payout_config,
        "winning_numbers_matched": winning_numbers
    }
    
    if winning_lot is not None:
        # Déterminer le multiplicateur selon le lot
        if winning_lot == 1:
            result["multiplier"] = multipliers[0] if len(multipliers) >= 1 else 60
        elif winning_lot == 2:
            result["multiplier"] = multipliers[1] if len(multipliers) >= 2 else 20
        elif winning_lot == 3:
            result["multiplier"] = multipliers[2] if len(multipliers) >= 3 else 10
        
        # Calculer le gain
        result["gain"] = float(bet_amount) * result["multiplier"]
        result["is_winner"] = True
        result["status"] = "WINNER"
    
    return result


async def calculate_ticket_winnings(
    ticket: Dict,
    winning_numbers: Dict[str, str],
    company_id: str
) -> Dict:
    """
    Calcule les gains pour un ticket complet (toutes les lignes).
    
    Args:
        ticket: Le ticket avec ses plays
        winning_numbers: Les numéros gagnants
        company_id: ID de la compagnie
    
    Returns:
        {
            "ticket_id": "...",
            "total_bet": 500.0,
            "total_gain": 6500.0,
            "is_winner": True,
            "status": "WINNER",
            "winning_plays": [...],
            "all_plays_calculated": [...],
            "calculation_details": {...}
        }
    """
    plays = ticket.get("plays", [])
    ticket_id = ticket.get("ticket_id", "")
    
    all_plays_calculated = []
    winning_plays = []
    total_bet = 0.0
    total_gain = 0.0
    
    for play in plays:
        # Extraire les infos de la ligne
        played_number = play.get("numbers") or play.get("number") or ""
        bet_type = play.get("bet_type") or play.get("type") or "BORLETTE"
        bet_amount = float(play.get("amount", 0) or play.get("bet_amount", 0) or 0)
        
        total_bet += bet_amount
        
        # Calculer le gain pour cette ligne
        line_result = await calculate_line_winnings(
            played_number=played_number,
            bet_type=bet_type,
            bet_amount=bet_amount,
            winning_numbers=winning_numbers,
            company_id=company_id
        )
        
        all_plays_calculated.append(line_result)
        
        if line_result["is_winner"]:
            total_gain += line_result["gain"]
            winning_plays.append(line_result)
    
    is_winner = total_gain > 0
    
    return {
        "ticket_id": ticket_id,
        "ticket_code": ticket.get("ticket_code"),
        "total_bet": total_bet,
        "total_gain": total_gain,
        "is_winner": is_winner,
        "status": "WINNER" if is_winner else "LOSER",
        "winning_plays": winning_plays,
        "winning_plays_count": len(winning_plays),
        "all_plays_calculated": all_plays_calculated,
        "calculation_details": {
            "company_id": company_id,
            "winning_numbers": winning_numbers,
            "calculated_at": get_current_timestamp()
        }
    }


# ============================================================================
# 5. TRAITEMENT AUTOMATIQUE APRÈS PUBLICATION DE RÉSULTAT
# ============================================================================

async def process_result_and_calculate_winners(
    result: Dict,
    company_id: Optional[str] = None
) -> Dict:
    """
    Traite un résultat publié et calcule tous les gagnants.
    Cette fonction est appelée automatiquement après publication d'un résultat.
    
    Args:
        result: Le résultat publié avec les numéros gagnants
        company_id: Si spécifié, ne traiter que les tickets de cette compagnie
    
    Returns:
        {
            "processed_tickets": 150,
            "winners": 12,
            "losers": 138,
            "total_payout": 125000.0,
            "tickets_details": [...]
        }
    """
    lottery_id = result.get("lottery_id")
    draw_date = result.get("draw_date")
    draw_name = result.get("draw_name") or result.get("draw_type")
    winning_numbers_raw = result.get("winning_numbers")
    
    # Parser les numéros gagnants
    winning_numbers = parse_winning_numbers(winning_numbers_raw)
    
    if not winning_numbers.get("first"):
        logger.warning(f"[WinningEngine] No winning numbers found in result: {result}")
        return {"processed_tickets": 0, "winners": 0, "losers": 0, "total_payout": 0, "error": "No winning numbers"}
    
    # Construire la requête pour trouver les tickets concernés
    query = {
        "lottery_id": lottery_id,
        "draw_date": draw_date,
        "status": {"$in": ["VALIDATED", "PENDING", "PENDING_RESULT"]}
    }
    
    if draw_name:
        query["draw_name"] = draw_name
    
    if company_id:
        query["company_id"] = company_id
    
    # Récupérer tous les tickets concernés
    tickets = await db.lottery_transactions.find(query, {"_id": 0}).to_list(50000)
    
    logger.info(f"[WinningEngine] Processing {len(tickets)} tickets for {lottery_id}/{draw_name}/{draw_date}")
    
    processed = 0
    winners = 0
    losers = 0
    total_payout = 0.0
    tickets_details = []
    now = get_current_timestamp()
    
    for ticket in tickets:
        ticket_company_id = ticket.get("company_id")
        
        # Calculer les gains
        calculation = await calculate_ticket_winnings(
            ticket=ticket,
            winning_numbers=winning_numbers,
            company_id=ticket_company_id
        )
        
        # Préparer la mise à jour
        update_data = {
            "status": calculation["status"],
            "winnings": calculation["total_gain"],
            "win_amount": calculation["total_gain"],
            "is_winner": calculation["is_winner"],
            "winning_plays": calculation["winning_plays"],
            "all_plays_calculated": calculation["all_plays_calculated"],
            "calculation_details": calculation["calculation_details"],
            "result_processed_at": now,
            "result_id": result.get("result_id")
        }
        
        # Mettre à jour le ticket
        await db.lottery_transactions.update_one(
            {"ticket_id": ticket.get("ticket_id")},
            {"$set": update_data}
        )
        
        processed += 1
        
        if calculation["is_winner"]:
            winners += 1
            total_payout += calculation["total_gain"]
        else:
            losers += 1
        
        tickets_details.append({
            "ticket_id": ticket.get("ticket_id"),
            "ticket_code": ticket.get("ticket_code"),
            "status": calculation["status"],
            "total_bet": calculation["total_bet"],
            "total_gain": calculation["total_gain"],
            "winning_plays_count": calculation["winning_plays_count"]
        })
    
    # Journaliser l'opération
    audit_log = {
        "audit_id": generate_id("audit_"),
        "action": "RESULT_PROCESSED",
        "lottery_id": lottery_id,
        "draw_name": draw_name,
        "draw_date": draw_date,
        "winning_numbers": winning_numbers,
        "processed_tickets": processed,
        "winners": winners,
        "losers": losers,
        "total_payout": total_payout,
        "created_at": now
    }
    await db.winning_calculations_audit.insert_one(audit_log)
    
    logger.info(f"[WinningEngine] Completed: {processed} tickets, {winners} winners, {total_payout} HTG payout")
    
    return {
        "processed_tickets": processed,
        "winners": winners,
        "losers": losers,
        "total_payout": total_payout,
        "tickets_details": tickets_details,
        "winning_numbers": winning_numbers
    }


# ============================================================================
# 6. RECALCUL MANUEL D'UN TICKET
# ============================================================================

async def recalculate_ticket(ticket_id: str) -> Dict:
    """
    Recalcule les gains pour un ticket spécifique.
    Utile pour les corrections ou vérifications.
    
    Returns:
        Le résultat du calcul
    """
    # Récupérer le ticket
    ticket = await db.lottery_transactions.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        return {"error": "Ticket not found", "ticket_id": ticket_id}
    
    # Récupérer le résultat correspondant
    result = await db.global_results.find_one({
        "lottery_id": ticket.get("lottery_id"),
        "draw_date": ticket.get("draw_date"),
        "draw_name": ticket.get("draw_name")
    }, {"_id": 0})
    
    if not result:
        return {"error": "No result published for this draw", "ticket_id": ticket_id}
    
    winning_numbers = parse_winning_numbers(result.get("winning_numbers"))
    
    # Calculer
    calculation = await calculate_ticket_winnings(
        ticket=ticket,
        winning_numbers=winning_numbers,
        company_id=ticket.get("company_id")
    )
    
    # Mettre à jour le ticket
    now = get_current_timestamp()
    await db.lottery_transactions.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "status": calculation["status"],
                "winnings": calculation["total_gain"],
                "win_amount": calculation["total_gain"],
                "is_winner": calculation["is_winner"],
                "winning_plays": calculation["winning_plays"],
                "all_plays_calculated": calculation["all_plays_calculated"],
                "calculation_details": calculation["calculation_details"],
                "recalculated_at": now
            }
        }
    )
    
    return calculation


# ============================================================================
# 7. INITIALISATION DES PRIMES PAR DÉFAUT
# ============================================================================

async def seed_default_primes(company_id: str) -> Dict:
    """
    Crée les configurations de primes par défaut pour une compagnie.
    
    Returns:
        {"created": 10, "message": "..."}
    """
    now = get_current_timestamp()
    created_count = 0
    
    for bet_type, config in DEFAULT_PRIMES.items():
        # Vérifier si existe déjà
        existing = await db.prime_configs.find_one({
            "company_id": company_id,
            "bet_type": bet_type
        })
        
        if existing:
            continue
        
        prime_id = generate_id("prime_")
        prime_doc = {
            "prime_id": prime_id,
            "company_id": company_id,
            "bet_code": config["bet_code"],
            "bet_type": bet_type,
            "bet_name": config["name"],
            "payout_formula": config["payout_formula"],
            "description": config["description"],
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        
        await db.prime_configs.insert_one(prime_doc)
        created_count += 1
    
    return {
        "created": created_count,
        "message": f"Created {created_count} prime configurations for company {company_id}"
    }


# ============================================================================
# 8. VALIDATION DE LA CONFIGURATION
# ============================================================================

async def validate_payout_config(company_id: str) -> Dict:
    """
    Valide que la configuration des primes est correcte pour une compagnie.
    
    Returns:
        {
            "valid": True,
            "configs_found": 10,
            "missing": [],
            "warnings": []
        }
    """
    required_types = ["BORLETTE", "LOTO3", "MARIAGE"]
    optional_types = ["L4O1", "L4O2", "L4O3", "L5O1", "L5O2", "L5O3", "MARIAGE_GRATUIT"]
    
    configs = await db.prime_configs.find(
        {"company_id": company_id, "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    found_types = {c.get("bet_type") for c in configs}
    
    missing = [t for t in required_types if t not in found_types]
    warnings = []
    
    # Vérifier les formules
    for config in configs:
        formula = config.get("payout_formula", "")
        multipliers = parse_payout_formula(formula)
        
        if not multipliers:
            warnings.append(f"Invalid formula for {config.get('bet_type')}: {formula}")
        elif config.get("bet_type") == "BORLETTE" and len(multipliers) < 3:
            warnings.append(f"BORLETTE should have 3 multipliers (60|20|10), found: {formula}")
    
    return {
        "valid": len(missing) == 0 and len(warnings) == 0,
        "configs_found": len(configs),
        "found_types": list(found_types),
        "missing": missing,
        "warnings": warnings
    }


# ============================================================================
# 9. TESTS UNITAIRES INTÉGRÉS
# ============================================================================

async def run_calculation_tests() -> Dict:
    """
    Exécute des tests de calcul pour vérifier la logique.
    
    Returns:
        {"passed": 5, "failed": 0, "tests": [...]}
    """
    tests = []
    
    # Test 1: Borlette 1er lot
    winning_numbers = {"first": "42", "second": "15", "third": "88"}
    lot = determine_winning_lot("42", winning_numbers, "BORLETTE")
    tests.append({
        "name": "Borlette 1er lot",
        "input": "42",
        "expected_lot": 1,
        "actual_lot": lot,
        "passed": lot == 1
    })
    
    # Test 2: Borlette 2e lot
    lot = determine_winning_lot("15", winning_numbers, "BORLETTE")
    tests.append({
        "name": "Borlette 2e lot",
        "input": "15",
        "expected_lot": 2,
        "actual_lot": lot,
        "passed": lot == 2
    })
    
    # Test 3: Borlette 3e lot
    lot = determine_winning_lot("88", winning_numbers, "BORLETTE")
    tests.append({
        "name": "Borlette 3e lot",
        "input": "88",
        "expected_lot": 3,
        "actual_lot": lot,
        "passed": lot == 3
    })
    
    # Test 4: Borlette perdant
    lot = determine_winning_lot("99", winning_numbers, "BORLETTE")
    tests.append({
        "name": "Borlette perdant",
        "input": "99",
        "expected_lot": None,
        "actual_lot": lot,
        "passed": lot is None
    })
    
    # Test 5: Mariage gagnant
    lot = determine_winning_lot("42-15", winning_numbers, "MARIAGE")
    tests.append({
        "name": "Mariage gagnant",
        "input": "42-15",
        "expected_lot": 1,
        "actual_lot": lot,
        "passed": lot == 1
    })
    
    # Test 6: Mariage perdant (un seul numéro match)
    lot = determine_winning_lot("42-99", winning_numbers, "MARIAGE")
    tests.append({
        "name": "Mariage perdant",
        "input": "42-99",
        "expected_lot": None,
        "actual_lot": lot,
        "passed": lot is None
    })
    
    # Test 7: Parse payout formula
    multipliers = parse_payout_formula("60|20|10")
    tests.append({
        "name": "Parse formula 60|20|10",
        "input": "60|20|10",
        "expected": [60, 20, 10],
        "actual": multipliers,
        "passed": multipliers == [60, 20, 10]
    })
    
    # Test 8: Parse single multiplier
    multipliers = parse_payout_formula("500")
    tests.append({
        "name": "Parse formula 500",
        "input": "500",
        "expected": [500],
        "actual": multipliers,
        "passed": multipliers == [500]
    })
    
    passed = sum(1 for t in tests if t["passed"])
    failed = len(tests) - passed
    
    return {
        "passed": passed,
        "failed": failed,
        "total": len(tests),
        "tests": tests
    }
