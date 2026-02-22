# LOTTOLAB - Enterprise Lottery SaaS Platform
## Product Requirements Document (PRD)

### Overview
LOTTOLAB is a production-ready, enterprise-grade multi-tenant Lottery SaaS platform with hierarchical RBAC model (SUPER_ADMIN, COMPANY_ADMIN, AGENT_POS). The system includes **LOTO PAM**, a public-facing online gaming platform.

**Status**: ✅ **PRODUCTION READY** 
**Last Update**: 2026-02-22
**Current Phase**: Phase 2 Complete

---

## Implementation Status

### ✅ Phase 1 - COMPLETE (Infrastructure Core)
- [x] User Registration & Login with JWT
- [x] Wallet System (MonCash/NatCash)
- [x] Super Admin LOTO PAM Control Panel
- [x] KYC Submission Flow
- [x] Domain-based Rendering

### ✅ Phase 2 - COMPLETE (Lottery Engine)
- [x] Real countdown timers per lottery draw
- [x] Automatic closing when time reached
- [x] Backend validation (reject after closing)
- [x] Ticket creation with instant balance deduction
- [x] Tickets stored with draw_id
- [x] Numbers locked after submission
- [x] Auto-detect winners on result publication
- [x] Automatic winnings calculation
- [x] Wallet auto-credit for winners
- [x] Ticket status update (won/lost)
- [x] Transaction log entries
- [x] WebSocket real-time notifications
- [x] Max bet limit (10,000 HTG per play)
- [x] Daily bet limit (100,000 HTG per user)
- [x] Account lockout (5 failed logins = 30 min lock)
- [x] KYC mandatory for withdrawals

### 🔄 Phase 3 - NEXT (Keno & Raffle)
- [ ] Keno game engine with auto draw scheduler
- [ ] Raffle/Tombola campaign management
- [ ] Configurable payout tables

---

## Lottery Engine Features

### Payout Multipliers
| Bet Type | Pick 2 | Pick 3 | Pick 4 | Pick 5 |
|----------|--------|--------|--------|--------|
| Straight | 50x | 500x | 5,000x | 50,000x |
| Box | 25x | 80x | 400x | 2,000x |
| Combo | 25x | 167x | 833x | 4,166x |

### Winner Detection Flow
```
Result Published (Super Admin)
    ↓
process_result_for_online_tickets()
    ↓
For each pending ticket:
    ├── Parse winning numbers
    ├── Check each play (straight/box/combo)
    ├── Calculate winnings
    └── Update ticket status
    ↓
If winner:
    ├── credit_player_wallet()
    ├── Create transaction log
    └── notify_player(TICKET_WON)
    ↓
Broadcast result to all players
```

### Security Features
| Feature | Value | Description |
|---------|-------|-------------|
| Max Bet Per Play | 10,000 HTG | Returns error if exceeded |
| Max Daily Bet | 100,000 HTG | Per user per day |
| Login Lockout | 5 attempts | 30 minute lockout |
| KYC Required | Withdrawals | Must be verified status |
| Fraud Detection | Automatic | Rapid betting, same number alerts |

---

## WebSocket Notifications

### Player Events
| Event | Description |
|-------|-------------|
| `result_published` | New lottery result available |
| `ticket_won` | Player won on a ticket |
| `ticket_lost` | Player lost on a ticket |
| `wallet_credited` | Money added to wallet |
| `deposit_approved` | Deposit request approved |
| `deposit_rejected` | Deposit request rejected |
| `withdrawal_processed` | Withdrawal paid |
| `withdrawal_rejected` | Withdrawal rejected |
| `kyc_approved` | KYC verification passed |
| `kyc_rejected` | KYC verification failed |

### Admin Events
| Event | Description |
|-------|-------------|
| `new_deposit` | New deposit request |
| `new_withdrawal` | New withdrawal request |
| `fraud_alert` | Suspicious activity detected |
| `high_win` | Large win detected (>50,000 HTG) |

---

## API Endpoints

### Public LOTO PAM Routes (`/api/online/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/register` | POST | Player registration |
| `/login` | POST | Player login (rate limited: 10/min) |
| `/me` | GET | Get player profile |
| `/wallet` | GET | Get wallet balance |
| `/wallet/deposit` | POST | Request deposit |
| `/wallet/withdraw` | POST | Request withdrawal (KYC required) |
| `/lotteries` | GET | Available lotteries with countdowns |
| `/lotteries/countdowns` | GET | Active draw countdowns (public) |
| `/tickets` | GET | Player tickets |
| `/tickets/create` | POST | Create ticket (validates limits) |
| `/results` | GET | Public results |
| `/kyc/submit` | POST | Submit KYC documents |
| `/kyc/status` | GET | Check KYC status |

### Super Admin LOTO PAM Routes (`/api/online-admin/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/overview` | GET | Dashboard statistics |
| `/players` | GET | List all players |
| `/players/{id}` | GET | Player details |
| `/players/{id}/status` | PUT | Update player status |
| `/deposits/pending` | GET | Pending deposits |
| `/deposits/approve` | POST | Approve/reject deposit |
| `/withdrawals/pending` | GET | Pending withdrawals |
| `/withdrawals/process` | POST | Mark as paid |
| `/withdrawals/reject` | POST | Reject and refund |
| `/tickets` | GET | All online tickets |
| `/kyc/pending` | GET | Pending KYC submissions |
| `/kyc/review` | POST | Approve/reject KYC |
| `/settings` | GET/PUT | Platform settings |

### WebSocket Endpoints
| Endpoint | Description |
|----------|-------------|
| `/ws/player/{player_id}` | Player notifications |
| `/ws/admin/{user_id}` | Admin notifications |

---

## Test Reports

### Latest Test: iteration_9.json
- **Backend**: 95% (18/19 tests passed)
- **Frontend**: 100% (All features working)
- **Player Balance**: 4,900 HTG (after 100 HTG in bets)
- **Tickets Created**: 2 tickets today

### Verified Features
- ✅ Countdown timers (h:mm:ss format)
- ✅ Ticket creation with balance deduction
- ✅ Max bet validation (French error messages)
- ✅ Account lockout (30 min after 5 failures)
- ✅ WebSocket endpoints configured
- ✅ KYC enforcement for withdrawals
- ✅ Admin dashboard statistics
- ✅ Deposit approval flow

---

## Database Collections

### Online Platform Collections
| Collection | Description |
|------------|-------------|
| `online_players` | Player accounts |
| `online_wallets` | Player balances |
| `online_wallet_transactions` | Transaction history |
| `online_tickets` | Betting tickets |
| `kyc_submissions` | KYC documents |
| `online_settings` | Platform config |

### Ticket Schema
```json
{
  "ticket_id": "otkt_xxx",
  "player_id": "player_xxx",
  "game_id": "lottery_id",
  "schedule_id": "schedule_id",
  "draw_type": "Morning",
  "draw_time": "10:00",
  "draw_date": "2026-02-22",
  "plays": [
    {"number": "123", "bet_type": "straight", "amount": 50}
  ],
  "total_amount": 50,
  "potential_win": 25000,
  "actual_win": 0,
  "status": "pending|won|lost|paid",
  "result_id": null,
  "winning_plays": null,
  "created_at": "timestamp"
}
```

---

## Active Accounts

### SaaS Platform
| Email | Role |
|-------|------|
| jefferson@jmstudio.com | SUPER_ADMIN |
| admin@lotopam.com | COMPANY_ADMIN |

### LOTO PAM Players
| Email | Balance | Status |
|-------|---------|--------|
| testplayer@example.com | 4,900 HTG | pending_kyc |

---

## File Structure

```
/app
├── backend/
│   ├── server.py                   # Main FastAPI + WebSocket
│   ├── lottery_engine.py           # Winner detection & payouts (NEW)
│   ├── websocket_manager.py        # Real-time notifications (NEW)
│   ├── online_routes.py            # LOTO PAM APIs
│   ├── online_models.py            # Pydantic models
│   ├── rate_limiter.py             # Rate limiting
│   └── fraud_detector.py           # Fraud detection
├── frontend/
│   ├── src/
│   │   ├── App.js                  # Domain-based routing
│   │   ├── context/
│   │   │   ├── LotoPamAuthContext.jsx  # Auth + WebSocket (UPDATED)
│   │   │   └── WebSocketContext.jsx    # WS Provider (NEW)
│   │   ├── pages/lotopam/
│   │   │   ├── LotoPamLotteryPlayPage.jsx  # Countdown timers (UPDATED)
│   │   │   └── ...
│   │   └── pages/super/
│   │       └── SuperOnlineDashboardPage.jsx
│   └── .env
└── test_reports/
    └── iteration_9.json            # Phase 2 test results
```

---

## Next Steps

### Phase 3: Keno & Raffle
1. Implement Keno game engine with 5-minute auto draws
2. Create Raffle campaign management system
3. Build configurable payout tables admin interface
4. Add prize pool visualization

### Enhancements
- SMS/Email notifications for winners
- Real-time result streaming
- Mobile-optimized responsive design
- Multi-currency support
