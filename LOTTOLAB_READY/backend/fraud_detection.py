"""
LOTTOLAB Anti-Fraud Monitoring System
Detects suspicious patterns and generates alerts
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from utils import generate_id, get_current_timestamp

# Fraud thresholds (configurable)
THRESHOLDS = {
    "max_sales_per_hour": 100,          # Max sales per agent per hour
    "max_sales_amount_per_hour": 50000, # Max HTG per agent per hour
    "max_void_rate_percent": 20,        # Max void rate per agent
    "max_same_number_count": 10,        # Max times same number can be played
    "suspicious_win_rate_percent": 30,  # Suspicious if win rate > 30%
    "rapid_sale_seconds": 10,           # Sales faster than 10 seconds are suspicious
}

# Alert severity levels
class AlertSeverity:
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


async def create_fraud_alert(
    db: AsyncIOMotorDatabase,
    alert_type: str,
    severity: str,
    agent_id: str,
    company_id: str,
    details: Dict,
    metadata: Optional[Dict] = None
):
    """Create a fraud alert record"""
    alert = {
        "alert_id": generate_id("alert_"),
        "alert_type": alert_type,
        "severity": severity,
        "agent_id": agent_id,
        "company_id": company_id,
        "details": details,
        "metadata": metadata or {},
        "status": "NEW",
        "created_at": get_current_timestamp(),
        "reviewed_at": None,
        "reviewed_by": None
    }
    await db.fraud_alerts.insert_one(alert)
    return alert


async def check_high_volume(db: AsyncIOMotorDatabase, agent_id: str, company_id: str) -> Optional[Dict]:
    """Check for unusually high sales volume"""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    # Count sales in last hour
    sales_count = await db.lottery_transactions.count_documents({
        "agent_id": agent_id,
        "created_at": {"$gte": one_hour_ago}
    })
    
    if sales_count > THRESHOLDS["max_sales_per_hour"]:
        await create_fraud_alert(
            db=db,
            alert_type="HIGH_SALES_VOLUME",
            severity=AlertSeverity.HIGH,
            agent_id=agent_id,
            company_id=company_id,
            details={
                "sales_count": sales_count,
                "threshold": THRESHOLDS["max_sales_per_hour"],
                "period": "1 hour"
            }
        )
        return {"type": "HIGH_VOLUME", "sales_count": sales_count}
    
    return None


async def check_rapid_sales(
    db: AsyncIOMotorDatabase, 
    agent_id: str, 
    company_id: str,
    last_sale_time: Optional[str]
) -> Optional[Dict]:
    """Check for suspiciously rapid consecutive sales"""
    if not last_sale_time:
        return None
    
    try:
        last_time = datetime.fromisoformat(last_sale_time.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        seconds_diff = (now - last_time).total_seconds()
        
        if seconds_diff < THRESHOLDS["rapid_sale_seconds"]:
            await create_fraud_alert(
                db=db,
                alert_type="RAPID_CONSECUTIVE_SALES",
                severity=AlertSeverity.MEDIUM,
                agent_id=agent_id,
                company_id=company_id,
                details={
                    "seconds_between_sales": seconds_diff,
                    "threshold_seconds": THRESHOLDS["rapid_sale_seconds"]
                }
            )
            return {"type": "RAPID_SALES", "seconds": seconds_diff}
    except:
        pass
    
    return None


async def check_high_void_rate(db: AsyncIOMotorDatabase, agent_id: str, company_id: str) -> Optional[Dict]:
    """Check for unusually high void/cancellation rate"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    
    # Get today's sales and voids
    total_sales = await db.lottery_transactions.count_documents({
        "agent_id": agent_id,
        "created_at": {"$gte": today_start}
    })
    
    voided = await db.lottery_transactions.count_documents({
        "agent_id": agent_id,
        "status": "VOID",
        "created_at": {"$gte": today_start}
    })
    
    if total_sales >= 10:  # Only check if significant volume
        void_rate = (voided / total_sales) * 100
        
        if void_rate > THRESHOLDS["max_void_rate_percent"]:
            await create_fraud_alert(
                db=db,
                alert_type="HIGH_VOID_RATE",
                severity=AlertSeverity.HIGH,
                agent_id=agent_id,
                company_id=company_id,
                details={
                    "void_rate_percent": round(void_rate, 2),
                    "voided_count": voided,
                    "total_sales": total_sales,
                    "threshold_percent": THRESHOLDS["max_void_rate_percent"]
                }
            )
            return {"type": "HIGH_VOID_RATE", "rate": void_rate}
    
    return None


async def check_repeated_numbers(
    db: AsyncIOMotorDatabase, 
    agent_id: str, 
    company_id: str,
    numbers: List[str]
) -> Optional[Dict]:
    """Check for same numbers being played repeatedly (potential insider knowledge)"""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    for number in numbers:
        # Count how many times this number was played by this agent
        count = await db.lottery_transactions.count_documents({
            "agent_id": agent_id,
            "created_at": {"$gte": one_hour_ago},
            "plays.number": number
        })
        
        if count > THRESHOLDS["max_same_number_count"]:
            await create_fraud_alert(
                db=db,
                alert_type="REPEATED_NUMBER_PATTERN",
                severity=AlertSeverity.CRITICAL,
                agent_id=agent_id,
                company_id=company_id,
                details={
                    "number": number,
                    "play_count": count,
                    "threshold": THRESHOLDS["max_same_number_count"],
                    "period": "1 hour"
                }
            )
            return {"type": "REPEATED_NUMBER", "number": number, "count": count}
    
    return None


async def check_suspicious_win_rate(db: AsyncIOMotorDatabase, agent_id: str, company_id: str) -> Optional[Dict]:
    """Check for unusually high win rate (potential result manipulation)"""
    # Get last 7 days of results
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    total_tickets = await db.lottery_transactions.count_documents({
        "agent_id": agent_id,
        "created_at": {"$gte": week_ago},
        "status": {"$in": ["WINNER", "LOSER", "PAID"]}
    })
    
    winners = await db.lottery_transactions.count_documents({
        "agent_id": agent_id,
        "created_at": {"$gte": week_ago},
        "status": {"$in": ["WINNER", "PAID"]}
    })
    
    if total_tickets >= 50:  # Need significant sample
        win_rate = (winners / total_tickets) * 100
        
        if win_rate > THRESHOLDS["suspicious_win_rate_percent"]:
            await create_fraud_alert(
                db=db,
                alert_type="SUSPICIOUS_WIN_RATE",
                severity=AlertSeverity.CRITICAL,
                agent_id=agent_id,
                company_id=company_id,
                details={
                    "win_rate_percent": round(win_rate, 2),
                    "winner_count": winners,
                    "total_tickets": total_tickets,
                    "threshold_percent": THRESHOLDS["suspicious_win_rate_percent"],
                    "period": "7 days"
                }
            )
            return {"type": "HIGH_WIN_RATE", "rate": win_rate}
    
    return None


async def run_fraud_checks(
    db: AsyncIOMotorDatabase,
    agent_id: str,
    company_id: str,
    sale_data: Optional[Dict] = None,
    last_sale_time: Optional[str] = None
) -> List[Dict]:
    """Run all fraud checks for a sale or agent activity"""
    alerts = []
    
    # Check high volume
    result = await check_high_volume(db, agent_id, company_id)
    if result:
        alerts.append(result)
    
    # Check rapid sales
    if last_sale_time:
        result = await check_rapid_sales(db, agent_id, company_id, last_sale_time)
        if result:
            alerts.append(result)
    
    # Check void rate
    result = await check_high_void_rate(db, agent_id, company_id)
    if result:
        alerts.append(result)
    
    # Check repeated numbers
    if sale_data and "plays" in sale_data:
        numbers = [p.get("number") for p in sale_data["plays"] if p.get("number")]
        result = await check_repeated_numbers(db, agent_id, company_id, numbers)
        if result:
            alerts.append(result)
    
    return alerts


async def get_pending_alerts(db: AsyncIOMotorDatabase, company_id: Optional[str] = None) -> List[Dict]:
    """Get all pending fraud alerts"""
    query = {"status": "NEW"}
    if company_id:
        query["company_id"] = company_id
    
    alerts = await db.fraud_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return alerts


async def review_alert(
    db: AsyncIOMotorDatabase,
    alert_id: str,
    reviewed_by: str,
    status: str,  # "DISMISSED", "CONFIRMED", "INVESTIGATING"
    notes: Optional[str] = None
):
    """Mark an alert as reviewed"""
    now = get_current_timestamp()
    await db.fraud_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {
            "status": status,
            "reviewed_at": now,
            "reviewed_by": reviewed_by,
            "review_notes": notes
        }}
    )
