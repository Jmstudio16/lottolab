"""
Rate Limiting Configuration for LOTTOLAB
Production-grade rate limiting using SlowAPI
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter instance - shared across all routes
limiter = Limiter(key_func=get_remote_address)

# Rate limit configurations
RATE_LIMITS = {
    # Authentication endpoints
    "login": "10/minute",           # 10 login attempts per minute per IP
    "agent_login": "10/minute",     # 10 agent login attempts per minute
    
    # Ticket sales (critical for financial integrity)
    "ticket_sell": "120/minute",    # 120 sales per minute per IP (2/second)
    "ticket_check": "60/minute",    # 60 checks per minute
    "ticket_payout": "30/minute",   # 30 payouts per minute
    
    # Sync endpoints (high frequency)
    "device_sync": "60/minute",     # 60 sync requests per minute (5s interval = 12/min)
    "device_config": "30/minute",   # 30 config requests per minute
    
    # Admin operations (lower frequency)
    "admin_create": "30/minute",    # 30 create operations per minute
    "admin_update": "60/minute",    # 60 update operations per minute
    "admin_delete": "10/minute",    # 10 delete operations per minute
    
    # Default for other endpoints
    "default": "300/minute"         # 300 requests per minute default
}
