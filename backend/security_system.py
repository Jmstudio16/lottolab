"""
LOTTOLAB - Security & Anti-Fraud System
========================================
Complete security layer for lottery operations:
1. Audit Trail - Log every action with IP, device, timestamp
2. Anti-Duplicate Tickets - Hash-based duplicate detection
3. Cryptographic Signature - SHA256 ticket signatures
4. Login Protection - Rate limiting, temporary blocks
5. Anti-Collision Codes - Secure UUID generation
"""

import hashlib
import hmac
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import Request
import logging

logger = logging.getLogger(__name__)

# Secret key for HMAC signatures (should be in .env in production)
SIGNATURE_SECRET_KEY = "LOTTOLAB_SECURE_SIGNATURE_KEY_2026_HAITI"


# ============================================================================
# 1. AUDIT TRAIL SYSTEM
# ============================================================================

class AuditAction:
    """Audit action types"""
    LOGIN = "LOGIN"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    TICKET_CREATE = "TICKET_CREATE"
    TICKET_VOID = "TICKET_VOID"
    TICKET_PRINT = "TICKET_PRINT"
    TICKET_REPRINT = "TICKET_REPRINT"
    RESULT_PUBLISH = "RESULT_PUBLISH"
    RESULT_MODIFY = "RESULT_MODIFY"
    PAYOUT_REQUEST = "PAYOUT_REQUEST"
    PAYOUT_APPROVE = "PAYOUT_APPROVE"
    PAYOUT_REJECT = "PAYOUT_REJECT"
    USER_CREATE = "USER_CREATE"
    USER_MODIFY = "USER_MODIFY"
    USER_DELETE = "USER_DELETE"
    USER_SUSPEND = "USER_SUSPEND"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    LIMIT_EXCEEDED = "LIMIT_EXCEEDED"
    FRAUD_ALERT = "FRAUD_ALERT"
    DUPLICATE_ATTEMPT = "DUPLICATE_ATTEMPT"
    BLOCKED_NUMBER = "BLOCKED_NUMBER"


def get_client_info(request: Request) -> Dict[str, Any]:
    """Extract client information from request for audit"""
    # Get real IP (considering proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    
    # Get device info from headers
    user_agent = request.headers.get("User-Agent", "unknown")
    device_id = request.headers.get("X-Device-ID", None)
    device_imei = request.headers.get("X-Device-IMEI", None)
    
    # Parse user agent for device type
    device_type = "UNKNOWN"
    if "Android" in user_agent:
        device_type = "ANDROID"
    elif "iPhone" in user_agent or "iPad" in user_agent:
        device_type = "IOS"
    elif "Windows" in user_agent:
        device_type = "WINDOWS"
    elif "Linux" in user_agent:
        device_type = "LINUX"
    elif "Mac" in user_agent:
        device_type = "MAC"
    
    return {
        "client_ip": client_ip,
        "user_agent": user_agent[:500],  # Truncate long user agents
        "device_type": device_type,
        "device_id": device_id,
        "device_imei": device_imei,
        "origin": request.headers.get("Origin", ""),
        "referer": request.headers.get("Referer", "")
    }


async def create_audit_log(
    db,
    action: str,
    user_id: str,
    request: Request,
    details: Dict[str, Any] = None,
    entity_type: str = None,
    entity_id: str = None,
    severity: str = "INFO",
    company_id: str = None
) -> str:
    """
    Create a comprehensive audit log entry.
    
    Args:
        db: MongoDB database instance
        action: Action type (from AuditAction)
        user_id: ID of user performing action
        request: FastAPI request object
        details: Additional details about the action
        entity_type: Type of entity affected (ticket, user, result, etc.)
        entity_id: ID of affected entity
        severity: Log severity (INFO, WARNING, CRITICAL, FRAUD)
        company_id: Company ID for filtering
    
    Returns:
        audit_log_id: ID of created audit log
    """
    client_info = get_client_info(request)
    
    audit_log = {
        "audit_id": f"audit_{uuid.uuid4().hex[:16]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "user_id": user_id,
        "company_id": company_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "severity": severity,
        "client_ip": client_info["client_ip"],
        "user_agent": client_info["user_agent"],
        "device_type": client_info["device_type"],
        "device_id": client_info["device_id"],
        "device_imei": client_info["device_imei"],
        "origin": client_info["origin"],
        "details": details or {},
        "session_id": request.headers.get("X-Session-ID"),
    }
    
    await db.security_audit_logs.insert_one(audit_log)
    
    # Log critical/fraud events to console
    if severity in ["CRITICAL", "FRAUD"]:
        logger.warning(f"[SECURITY] {severity}: {action} by {user_id} from {client_info['client_ip']}")
    
    return audit_log["audit_id"]


# ============================================================================
# 2. ANTI-DUPLICATE TICKET SYSTEM
# ============================================================================

def generate_ticket_hash(
    lottery_id: str,
    draw_name: str,
    plays: List[Dict],
    agent_id: str,
    timestamp: str
) -> str:
    """
    Generate unique hash for a ticket to detect duplicates.
    Hash is based on: lottery, draw, plays (numbers + amounts), agent, time window.
    """
    # Sort plays for consistent hashing
    sorted_plays = sorted(plays, key=lambda p: (p.get("numbers", ""), p.get("amount", 0)))
    
    # Create hash input string
    plays_str = "|".join([f"{p.get('numbers')}:{p.get('amount')}" for p in sorted_plays])
    
    # Use 5-minute window to catch rapid duplicates
    time_window = timestamp[:15]  # YYYY-MM-DDTHH:MM (5-min precision)
    
    hash_input = f"{lottery_id}|{draw_name}|{plays_str}|{agent_id}|{time_window}"
    
    return hashlib.sha256(hash_input.encode()).hexdigest()


async def check_duplicate_ticket(
    db,
    lottery_id: str,
    draw_name: str,
    plays: List[Dict],
    agent_id: str,
    company_id: str
) -> Dict[str, Any]:
    """
    Check if this ticket is a duplicate of a recent one.
    
    Returns:
        {
            "is_duplicate": bool,
            "existing_ticket_id": str or None,
            "existing_ticket_code": str or None
        }
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    ticket_hash = generate_ticket_hash(lottery_id, draw_name, plays, agent_id, timestamp)
    
    # Check for existing ticket with same hash in last 10 minutes
    ten_minutes_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    
    existing = await db.lottery_transactions.find_one({
        "ticket_hash": ticket_hash,
        "created_at": {"$gte": ten_minutes_ago},
        "company_id": company_id,
        "status": {"$ne": "VOID"}
    }, {"_id": 0, "ticket_id": 1, "ticket_code": 1})
    
    if existing:
        return {
            "is_duplicate": True,
            "existing_ticket_id": existing.get("ticket_id"),
            "existing_ticket_code": existing.get("ticket_code"),
            "ticket_hash": ticket_hash
        }
    
    return {
        "is_duplicate": False,
        "ticket_hash": ticket_hash
    }


# ============================================================================
# 3. CRYPTOGRAPHIC SIGNATURE SYSTEM
# ============================================================================

def generate_ticket_signature(
    ticket_id: str,
    ticket_code: str,
    verification_code: str,
    total_amount: float,
    created_at: str
) -> str:
    """
    Generate HMAC-SHA256 signature for ticket verification.
    This signature proves the ticket hasn't been tampered with.
    """
    message = f"{ticket_id}|{ticket_code}|{verification_code}|{total_amount}|{created_at}"
    
    signature = hmac.new(
        SIGNATURE_SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return signature


def verify_ticket_signature(
    ticket_id: str,
    ticket_code: str,
    verification_code: str,
    total_amount: float,
    created_at: str,
    signature: str
) -> bool:
    """
    Verify ticket signature to detect tampering.
    """
    expected_signature = generate_ticket_signature(
        ticket_id, ticket_code, verification_code, total_amount, created_at
    )
    
    return hmac.compare_digest(signature, expected_signature)


def generate_payout_signature(
    ticket_id: str,
    win_amount: float,
    payout_id: str,
    paid_by: str,
    paid_at: str
) -> str:
    """
    Generate signature for payout verification.
    Prevents fraudulent payout claims.
    """
    message = f"{ticket_id}|{win_amount}|{payout_id}|{paid_by}|{paid_at}"
    
    return hmac.new(
        SIGNATURE_SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()


# ============================================================================
# 4. LOGIN PROTECTION SYSTEM
# ============================================================================

class LoginProtection:
    """Manages login attempts and temporary blocks"""
    
    MAX_ATTEMPTS = 5
    BLOCK_DURATION_MINUTES = 15
    ATTEMPT_WINDOW_MINUTES = 10
    
    @staticmethod
    async def record_attempt(
        db,
        email: str,
        ip_address: str,
        success: bool,
        user_agent: str = None
    ):
        """Record a login attempt"""
        attempt = {
            "attempt_id": f"attempt_{uuid.uuid4().hex[:12]}",
            "email": email.lower(),
            "ip_address": ip_address,
            "success": success,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_agent": user_agent
        }
        
        await db.login_attempts.insert_one(attempt)
    
    @staticmethod
    async def check_blocked(db, email: str, ip_address: str) -> Dict[str, Any]:
        """
        Check if email or IP is blocked due to too many failed attempts.
        
        Returns:
            {
                "is_blocked": bool,
                "blocked_until": str or None,
                "reason": str or None,
                "attempts_remaining": int
            }
        """
        # Check for active block
        now = datetime.now(timezone.utc)
        block = await db.login_blocks.find_one({
            "$or": [
                {"email": email.lower()},
                {"ip_address": ip_address}
            ],
            "blocked_until": {"$gt": now.isoformat()}
        })
        
        if block:
            return {
                "is_blocked": True,
                "blocked_until": block["blocked_until"],
                "reason": block.get("reason", "Too many failed attempts"),
                "attempts_remaining": 0
            }
        
        # Count recent failed attempts
        window_start = (now - timedelta(minutes=LoginProtection.ATTEMPT_WINDOW_MINUTES)).isoformat()
        
        failed_count = await db.login_attempts.count_documents({
            "$or": [
                {"email": email.lower()},
                {"ip_address": ip_address}
            ],
            "success": False,
            "timestamp": {"$gte": window_start}
        })
        
        attempts_remaining = max(0, LoginProtection.MAX_ATTEMPTS - failed_count)
        
        return {
            "is_blocked": False,
            "blocked_until": None,
            "reason": None,
            "attempts_remaining": attempts_remaining
        }
    
    @staticmethod
    async def create_block(
        db,
        email: str,
        ip_address: str,
        reason: str = "Too many failed login attempts"
    ) -> str:
        """Create a temporary block for email/IP"""
        now = datetime.now(timezone.utc)
        blocked_until = now + timedelta(minutes=LoginProtection.BLOCK_DURATION_MINUTES)
        
        block = {
            "block_id": f"block_{uuid.uuid4().hex[:12]}",
            "email": email.lower(),
            "ip_address": ip_address,
            "reason": reason,
            "created_at": now.isoformat(),
            "blocked_until": blocked_until.isoformat()
        }
        
        await db.login_blocks.insert_one(block)
        
        logger.warning(f"[SECURITY] Login blocked: {email} from {ip_address} until {blocked_until}")
        
        return block["block_id"]
    
    @staticmethod
    async def check_and_block_if_needed(
        db,
        email: str,
        ip_address: str
    ) -> bool:
        """
        Check if block threshold reached and create block if needed.
        Returns True if user was just blocked.
        """
        status = await LoginProtection.check_blocked(db, email, ip_address)
        
        if status["is_blocked"]:
            return False  # Already blocked
        
        if status["attempts_remaining"] <= 0:
            await LoginProtection.create_block(db, email, ip_address)
            return True  # Just blocked
        
        return False


# ============================================================================
# 5. ANTI-COLLISION CODE GENERATION
# ============================================================================

def generate_secure_verification_code(length: int = 12) -> str:
    """
    Generate cryptographically secure verification code.
    Uses secrets module for true randomness.
    """
    # Use only digits for easy manual entry
    return ''.join(secrets.choice('0123456789') for _ in range(length))


def generate_secure_ticket_code(prefix: str = "TK") -> str:
    """
    Generate unique ticket code with timestamp component.
    Format: TK-YYYYMMDD-XXXXXX
    """
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = secrets.token_hex(3).upper()  # 6 hex chars
    
    return f"{prefix}-{date_part}-{random_part}"


async def get_unique_verification_code(db, max_attempts: int = 10) -> str:
    """
    Generate a guaranteed unique verification code.
    Checks database for collisions.
    """
    for _ in range(max_attempts):
        code = generate_secure_verification_code(12)
        
        # Check both collections for collision
        existing = await db.lottery_transactions.find_one(
            {"verification_code": code},
            {"_id": 1}
        )
        
        if not existing:
            existing = await db.tickets.find_one(
                {"verification_code": code},
                {"_id": 1}
            )
        
        if not existing:
            return code
    
    # Fallback: use UUID-based code (virtually impossible to collide)
    return uuid.uuid4().hex[:12].upper()


async def get_unique_ticket_code(db, prefix: str = "TK", max_attempts: int = 10) -> str:
    """
    Generate a guaranteed unique ticket code.
    """
    for _ in range(max_attempts):
        code = generate_secure_ticket_code(prefix)
        
        existing = await db.lottery_transactions.find_one(
            {"ticket_code": code},
            {"_id": 1}
        )
        
        if not existing:
            return code
    
    # Fallback with more randomness
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


# ============================================================================
# 6. FRAUD DETECTION HELPERS
# ============================================================================

async def check_suspicious_activity(
    db,
    agent_id: str,
    company_id: str,
    action: str
) -> List[Dict[str, Any]]:
    """
    Check for suspicious patterns that might indicate fraud.
    
    Returns list of alerts if suspicious activity detected.
    """
    alerts = []
    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    five_minutes_ago = (now - timedelta(minutes=5)).isoformat()
    
    # 1. Too many tickets in short time (more than 20 in 5 minutes)
    if action == AuditAction.TICKET_CREATE:
        recent_tickets = await db.lottery_transactions.count_documents({
            "agent_id": agent_id,
            "created_at": {"$gte": five_minutes_ago}
        })
        
        if recent_tickets > 20:
            alerts.append({
                "type": "HIGH_VELOCITY",
                "message": f"Agent created {recent_tickets} tickets in 5 minutes",
                "severity": "WARNING"
            })
    
    # 2. Large payout request
    if action == AuditAction.PAYOUT_REQUEST:
        large_payouts = await db.lottery_transactions.count_documents({
            "agent_id": agent_id,
            "status": "WINNER",
            "win_amount": {"$gte": 50000},
            "updated_at": {"$gte": one_hour_ago}
        })
        
        if large_payouts > 3:
            alerts.append({
                "type": "MULTIPLE_LARGE_PAYOUTS",
                "message": f"Agent requested {large_payouts} large payouts in 1 hour",
                "severity": "CRITICAL"
            })
    
    # 3. Same winning number pattern
    if action == AuditAction.TICKET_CREATE:
        # Check if agent is betting heavily on same numbers
        pipeline = [
            {"$match": {
                "agent_id": agent_id,
                "created_at": {"$gte": one_hour_ago}
            }},
            {"$unwind": "$plays"},
            {"$group": {
                "_id": "$plays.numbers",
                "total_amount": {"$sum": "$plays.amount"},
                "count": {"$sum": 1}
            }},
            {"$match": {"total_amount": {"$gte": 10000}}},
            {"$sort": {"total_amount": -1}},
            {"$limit": 5}
        ]
        
        heavy_numbers = await db.lottery_transactions.aggregate(pipeline).to_list(5)
        
        if heavy_numbers:
            for num in heavy_numbers:
                if num["total_amount"] >= 50000:
                    alerts.append({
                        "type": "HEAVY_BETTING",
                        "message": f"Agent bet {num['total_amount']} HTG on number {num['_id']}",
                        "severity": "WARNING"
                    })
    
    return alerts


# ============================================================================
# 7. SECURITY MIDDLEWARE HELPER
# ============================================================================

async def security_check_middleware(
    db,
    request: Request,
    user_id: str,
    action: str
) -> Dict[str, Any]:
    """
    Perform security checks before allowing an action.
    
    Returns:
        {
            "allowed": bool,
            "reason": str or None,
            "alerts": list
        }
    """
    client_info = get_client_info(request)
    
    # Check if IP is blacklisted
    blacklisted = await db.ip_blacklist.find_one({
        "ip_address": client_info["client_ip"],
        "active": True
    })
    
    if blacklisted:
        return {
            "allowed": False,
            "reason": "IP address is blacklisted",
            "alerts": [{
                "type": "BLACKLISTED_IP",
                "severity": "CRITICAL"
            }]
        }
    
    # Check user status
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "status": 1})
    if user and user.get("status") != "ACTIVE":
        return {
            "allowed": False,
            "reason": f"User account is {user.get('status', 'INACTIVE')}",
            "alerts": []
        }
    
    return {
        "allowed": True,
        "reason": None,
        "alerts": []
    }
