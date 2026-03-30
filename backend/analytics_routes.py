"""
LOTTOLAB Analytics Pro
======================
Advanced analytics endpoints for business intelligence.

Dashboards:
1. Sales Dashboard: Daily/weekly/monthly sales, trends, top agents, top lotteries
2. Gains Dashboard: Most played numbers, most winning numbers, gains by game type
3. Performance Dashboard: Agent rankings, supervisor stats, conversion rates
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging

from auth import decode_token
from models import UserRole
from utils import get_current_timestamp

analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics Pro"])

logger = logging.getLogger(__name__)

# Global database reference
db = None

def set_analytics_db(database):
    global db
    db = database

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return current user."""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def require_company_access(current_user: dict):
    """Ensure user has company-level access."""
    if current_user["role"] not in [
        UserRole.SUPER_ADMIN, 
        UserRole.COMPANY_ADMIN, 
        UserRole.BRANCH_SUPERVISOR
    ]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return current_user


# ============ SALES DASHBOARD ============

@analytics_router.get("/sales/summary")
async def get_sales_summary(
    period: str = Query("day", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get sales summary for the specified period.
    Returns: total_sales, total_tickets, avg_ticket_value, comparison to previous period.
    """
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    # Calculate date ranges
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(days=1)
        prev_end = start_date
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date - timedelta(weeks=1)
        prev_end = start_date
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = (start_date - timedelta(days=1)).replace(day=1)
        prev_end = start_date
    else:  # year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_date.replace(year=start_date.year - 1)
        prev_end = start_date
    
    # Build query
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    prev_query = {
        "created_at": {"$gte": prev_start.isoformat(), "$lt": prev_end.isoformat()}
    }
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        prev_query["company_id"] = company_id
    
    # Current period stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "total_tickets": {"$sum": 1},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}}
        }}
    ]
    
    current_stats = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    current = current_stats[0] if current_stats else {"total_sales": 0, "total_tickets": 0, "total_winnings": 0}
    
    # Previous period stats
    prev_pipeline = [
        {"$match": prev_query},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "total_tickets": {"$sum": 1}
        }}
    ]
    
    prev_stats = await db.lottery_transactions.aggregate(prev_pipeline).to_list(1)
    prev = prev_stats[0] if prev_stats else {"total_sales": 0, "total_tickets": 0}
    
    # Calculate changes
    sales_change = 0
    if prev["total_sales"] > 0:
        sales_change = ((current["total_sales"] - prev["total_sales"]) / prev["total_sales"]) * 100
    
    tickets_change = 0
    if prev["total_tickets"] > 0:
        tickets_change = ((current["total_tickets"] - prev["total_tickets"]) / prev["total_tickets"]) * 100
    
    return {
        "period": period,
        "current": {
            "total_sales": current["total_sales"],
            "total_tickets": current["total_tickets"],
            "total_winnings": current.get("total_winnings", 0),
            "avg_ticket_value": current["total_sales"] / current["total_tickets"] if current["total_tickets"] > 0 else 0,
            "net_revenue": current["total_sales"] - current.get("total_winnings", 0)
        },
        "previous": {
            "total_sales": prev["total_sales"],
            "total_tickets": prev["total_tickets"]
        },
        "change": {
            "sales_percent": round(sales_change, 1),
            "tickets_percent": round(tickets_change, 1)
        },
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat()
    }


@analytics_router.get("/sales/trend")
async def get_sales_trend(
    period: str = Query("week", regex="^(week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get sales trend data for charting.
    Returns daily/weekly data points for the specified period.
    """
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    # Determine date range and grouping
    if period == "week":
        start_date = now - timedelta(days=7)
        group_format = "%Y-%m-%d"
    elif period == "month":
        start_date = now - timedelta(days=30)
        group_format = "%Y-%m-%d"
    else:  # year
        start_date = now - timedelta(days=365)
        group_format = "%Y-%m"
    
    # Build query
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    # Aggregate by date
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "date": {"$dateFromString": {"dateString": "$created_at"}}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": group_format, "date": "$date"}},
            "sales": {"$sum": "$total_amount"},
            "tickets": {"$sum": 1},
            "winnings": {"$sum": {"$ifNull": ["$winnings", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(366)
    
    # Format response
    data_points = []
    for r in results:
        data_points.append({
            "date": r["_id"],
            "sales": r["sales"],
            "tickets": r["tickets"],
            "winnings": r["winnings"],
            "net_revenue": r["sales"] - r["winnings"]
        })
    
    return {
        "period": period,
        "data": data_points,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat()
    }


@analytics_router.get("/sales/top-agents")
async def get_top_agents(
    limit: int = Query(10, ge=1, le=50),
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """Get top performing agents by sales."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)
    
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "total_sales": {"$sum": "$total_amount"},
            "total_tickets": {"$sum": 1},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}}
        }},
        {"$sort": {"total_sales": -1}},
        {"$limit": limit}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(limit)
    
    # Format response
    agents = []
    for i, r in enumerate(results):
        agents.append({
            "rank": i + 1,
            "agent_id": r["_id"],
            "agent_name": r["agent_name"] or "Unknown",
            "total_sales": r["total_sales"],
            "total_tickets": r["total_tickets"],
            "total_winnings": r["total_winnings"],
            "net_revenue": r["total_sales"] - r["total_winnings"],
            "avg_ticket_value": r["total_sales"] / r["total_tickets"] if r["total_tickets"] > 0 else 0
        })
    
    return {"period": period, "agents": agents}


@analytics_router.get("/sales/top-lotteries")
async def get_top_lotteries(
    limit: int = Query(10, ge=1, le=50),
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """Get most popular lotteries by sales."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)
    
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$lottery_id",
            "lottery_name": {"$first": "$lottery_name"},
            "total_sales": {"$sum": "$total_amount"},
            "total_tickets": {"$sum": 1}
        }},
        {"$sort": {"total_sales": -1}},
        {"$limit": limit}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(limit)
    
    lotteries = []
    for i, r in enumerate(results):
        lotteries.append({
            "rank": i + 1,
            "lottery_id": r["_id"],
            "lottery_name": r["lottery_name"] or "Unknown",
            "total_sales": r["total_sales"],
            "total_tickets": r["total_tickets"]
        })
    
    return {"period": period, "lotteries": lotteries}


# ============ GAINS DASHBOARD ============

@analytics_router.get("/gains/most-played-numbers")
async def get_most_played_numbers(
    limit: int = Query(20, ge=1, le=100),
    bet_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get most frequently played numbers."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    
    # Build query
    query = {}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    # Aggregate plays
    pipeline = [
        {"$match": query},
        {"$unwind": "$plays"},
    ]
    
    if bet_type:
        pipeline.append({"$match": {"plays.bet_type": bet_type}})
    
    pipeline.extend([
        {"$group": {
            "_id": "$plays.numbers",
            "bet_type": {"$first": "$plays.bet_type"},
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$plays.amount"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ])
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(limit)
    
    numbers = []
    for i, r in enumerate(results):
        numbers.append({
            "rank": i + 1,
            "number": r["_id"],
            "bet_type": r.get("bet_type", "BORLETTE"),
            "times_played": r["count"],
            "total_wagered": r["total_amount"]
        })
    
    return {"numbers": numbers}


@analytics_router.get("/gains/most-winning-numbers")
async def get_most_winning_numbers(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get numbers that have won the most."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    
    query = {"status": "WINNER"}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    pipeline = [
        {"$match": query},
        {"$unwind": "$winning_plays"},
        {"$group": {
            "_id": "$winning_plays.played_number",
            "wins_count": {"$sum": 1},
            "total_winnings": {"$sum": "$winning_plays.gain"}
        }},
        {"$sort": {"wins_count": -1}},
        {"$limit": limit}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(limit)
    
    numbers = []
    for i, r in enumerate(results):
        numbers.append({
            "rank": i + 1,
            "number": r["_id"],
            "wins_count": r["wins_count"],
            "total_winnings": r["total_winnings"]
        })
    
    return {"numbers": numbers}


@analytics_router.get("/gains/by-game-type")
async def get_gains_by_game_type(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """Get gains breakdown by game type (BORLETTE, LOTO3, LOTO4, etc.)."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)
    
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    pipeline = [
        {"$match": query},
        {"$unwind": "$plays"},
        {"$group": {
            "_id": "$plays.bet_type",
            "total_wagered": {"$sum": "$plays.amount"},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_wagered": -1}}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(20)
    
    # Also get winning stats
    winning_query = {**query, "status": "WINNER"}
    winning_pipeline = [
        {"$match": winning_query},
        {"$unwind": "$winning_plays"},
        {"$group": {
            "_id": "$winning_plays.bet_type",
            "total_winnings": {"$sum": "$winning_plays.gain"},
            "win_count": {"$sum": 1}
        }}
    ]
    
    winning_results = await db.lottery_transactions.aggregate(winning_pipeline).to_list(20)
    winning_map = {r["_id"]: r for r in winning_results}
    
    game_types = []
    for r in results:
        bet_type = r["_id"]
        winning_data = winning_map.get(bet_type, {"total_winnings": 0, "win_count": 0})
        
        game_types.append({
            "bet_type": bet_type,
            "total_wagered": r["total_wagered"],
            "total_plays": r["total_plays"],
            "total_winnings": winning_data["total_winnings"],
            "win_count": winning_data["win_count"],
            "net_revenue": r["total_wagered"] - winning_data["total_winnings"],
            "win_rate": (winning_data["win_count"] / r["total_plays"] * 100) if r["total_plays"] > 0 else 0
        })
    
    return {"period": period, "game_types": game_types}


# ============ PERFORMANCE DASHBOARD ============

@analytics_router.get("/performance/agents-ranking")
async def get_agents_performance_ranking(
    limit: int = Query(20, ge=1, le=100),
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive agent performance rankings."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)
    
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$agent_id",
            "agent_name": {"$first": "$agent_name"},
            "company_id": {"$first": "$company_id"},
            "total_sales": {"$sum": "$total_amount"},
            "total_tickets": {"$sum": 1},
            "winning_tickets": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "first_sale": {"$min": "$created_at"},
            "last_sale": {"$max": "$created_at"}
        }},
        {"$sort": {"total_sales": -1}},
        {"$limit": limit}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(limit)
    
    agents = []
    for i, r in enumerate(results):
        net_revenue = r["total_sales"] - r["total_winnings"]
        
        agents.append({
            "rank": i + 1,
            "agent_id": r["_id"],
            "agent_name": r["agent_name"] or "Unknown",
            "company_id": r["company_id"],
            "total_sales": r["total_sales"],
            "total_tickets": r["total_tickets"],
            "winning_tickets": r["winning_tickets"],
            "total_winnings": r["total_winnings"],
            "net_revenue": net_revenue,
            "avg_ticket_value": r["total_sales"] / r["total_tickets"] if r["total_tickets"] > 0 else 0,
            "win_rate": (r["winning_tickets"] / r["total_tickets"] * 100) if r["total_tickets"] > 0 else 0,
            "profit_margin": (net_revenue / r["total_sales"] * 100) if r["total_sales"] > 0 else 0,
            "activity": {
                "first_sale": r["first_sale"],
                "last_sale": r["last_sale"]
            }
        })
    
    return {"period": period, "agents": agents}


@analytics_router.get("/performance/summary")
async def get_performance_summary(
    period: str = Query("month", regex="^(day|week|month|year)$"),
    current_user: dict = Depends(get_current_user)
):
    """Get overall performance summary."""
    require_company_access(current_user)
    
    company_id = current_user.get("company_id")
    now = datetime.now(timezone.utc)
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)
    
    query = {"created_at": {"$gte": start_date.isoformat()}}
    if company_id and current_user["role"] != UserRole.SUPER_ADMIN:
        query["company_id"] = company_id
    
    # Get ticket stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "total_tickets": {"$sum": 1},
            "winning_tickets": {"$sum": {"$cond": [{"$eq": ["$status", "WINNER"]}, 1, 0]}},
            "paid_tickets": {"$sum": {"$cond": [{"$eq": ["$status", "PAID"]}, 1, 0]}},
            "total_winnings": {"$sum": {"$ifNull": ["$winnings", 0]}},
            "unique_agents": {"$addToSet": "$agent_id"}
        }}
    ]
    
    results = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    stats = results[0] if results else {
        "total_sales": 0,
        "total_tickets": 0,
        "winning_tickets": 0,
        "paid_tickets": 0,
        "total_winnings": 0,
        "unique_agents": []
    }
    
    return {
        "period": period,
        "summary": {
            "total_sales": stats["total_sales"],
            "total_tickets": stats["total_tickets"],
            "winning_tickets": stats["winning_tickets"],
            "paid_tickets": stats["paid_tickets"],
            "pending_payouts": stats["winning_tickets"] - stats["paid_tickets"],
            "total_winnings": stats["total_winnings"],
            "net_revenue": stats["total_sales"] - stats["total_winnings"],
            "profit_margin": ((stats["total_sales"] - stats["total_winnings"]) / stats["total_sales"] * 100) if stats["total_sales"] > 0 else 0,
            "active_agents": len(stats["unique_agents"]),
            "avg_sales_per_agent": stats["total_sales"] / len(stats["unique_agents"]) if stats["unique_agents"] else 0,
            "avg_ticket_value": stats["total_sales"] / stats["total_tickets"] if stats["total_tickets"] > 0 else 0,
            "win_rate": (stats["winning_tickets"] / stats["total_tickets"] * 100) if stats["total_tickets"] > 0 else 0
        },
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat()
    }
