"""
LOTO PAM Online Platform Models
Data models for online lottery players, wallets, tickets, and games
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from enum import Enum


# ============ ENUMS ============
class PlayerStatus(str, Enum):
    PENDING_KYC = "pending_kyc"
    VERIFIED = "verified"
    SUSPENDED = "suspended"
    BLOCKED = "blocked"


class WalletTransactionType(str, Enum):
    DEPOSIT_REQUEST = "deposit_request"
    DEPOSIT_APPROVED = "deposit_approved"
    DEPOSIT_REJECTED = "deposit_rejected"
    WITHDRAW_REQUEST = "withdraw_request"
    WITHDRAW_PAID = "withdraw_paid"
    WITHDRAW_REJECTED = "withdraw_rejected"
    BET_DEBIT = "bet_debit"
    WIN_CREDIT = "win_credit"
    MANUAL_ADJUSTMENT = "manual_adjustment"


class WalletTransactionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


class PaymentMethod(str, Enum):
    MONCASH = "MonCash"
    NATCASH = "NatCash"
    MANUAL = "Manual"


class OnlineTicketStatus(str, Enum):
    PENDING = "pending"
    LOST = "lost"
    WON = "won"
    PAID = "paid"
    CANCELLED = "cancelled"


class KenoRoundStatus(str, Enum):
    SCHEDULED = "scheduled"
    OPEN = "open"
    CLOSED = "closed"
    DRAWN = "drawn"


class RaffleCampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    DRAWN = "drawn"
    CANCELLED = "cancelled"


class KYCStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ============ PLAYER MODELS ============
class OnlinePlayerRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    username: str = Field(..., min_length=3, max_length=30, pattern=r'^[a-z0-9_]+$')
    email: EmailStr
    phone: str = Field(..., min_length=8, max_length=20)
    password: str = Field(..., min_length=8)
    preferred_language: str = "fr"
    accept_terms: bool


class OnlinePlayerLogin(BaseModel):
    email: EmailStr
    password: str


class OnlinePlayerProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    player_id: str
    full_name: str
    username: str
    email: str
    phone: str
    status: str
    preferred_language: str
    kyc_status: Optional[str] = None
    created_at: str
    last_login_at: Optional[str] = None


class OnlinePlayerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None


# ============ WALLET MODELS ============
class WalletInfo(BaseModel):
    player_id: str
    balance: float
    currency: str = "HTG"


class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    reference_code: str = Field(..., min_length=4, max_length=50)
    sender_phone: Optional[str] = None


class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    payout_phone: str = Field(..., min_length=8, max_length=20)


class TransactionApproval(BaseModel):
    transaction_id: str
    approved: bool
    notes: Optional[str] = None


class TransactionMarkPaid(BaseModel):
    transaction_id: str
    reference_notes: Optional[str] = None


# ============ ONLINE TICKET MODELS ============
class OnlineTicketCreate(BaseModel):
    game_id: str
    schedule_id: str
    plays: List[dict]  # [{number: "123", bet_type: "straight", amount: 50}]


class OnlineTicketResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str
    player_id: str
    game_id: str
    game_name: Optional[str] = None
    schedule_id: str
    draw_type: Optional[str] = None
    plays: List[dict]
    total_amount: float
    status: str
    potential_win: float
    actual_win: float
    created_at: str


# ============ KENO MODELS ============
class KenoTicketCreate(BaseModel):
    keno_round_id: str
    numbers: List[int] = Field(..., min_length=1, max_length=10)
    stake_amount: float = Field(..., gt=0)


class KenoRoundResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    round_id: str
    start_at: str
    close_at: str
    draw_at: str
    status: str
    drawn_numbers: Optional[List[int]] = None


# ============ RAFFLE MODELS ============
class RaffleCampaignCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    ticket_price: float = Field(..., gt=0)
    start_at: str
    end_at: str
    max_tickets: int = Field(..., gt=0)
    prize_description: str


class RaffleEntryCreate(BaseModel):
    campaign_id: str
    quantity: int = Field(..., gt=0, le=100)


# ============ KYC MODELS ============
class KYCSubmission(BaseModel):
    document_type: str = Field(..., description="id_card, passport, driver_license")
    document_number: str = Field(..., min_length=5, max_length=50)
    # Images would be uploaded separately


class KYCReview(BaseModel):
    submission_id: str
    approved: bool
    notes: Optional[str] = None


# ============ ONLINE SETTINGS ============
class OnlineSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    moncash_number: Optional[str] = None
    natcash_number: Optional[str] = None
    maintenance_mode: Optional[bool] = None
    terms_content: Optional[str] = None


# ============ ONLINE GAMES CONFIG ============
class OnlineGamesConfig(BaseModel):
    lottery_enabled: bool = True
    keno_enabled: bool = True
    raffle_enabled: bool = True
    enabled_lottery_ids: List[str] = []
    keno_payout_table: Optional[dict] = None


# ============ ADMIN RESPONSE MODELS ============
class OnlineOverviewStats(BaseModel):
    total_players: int
    active_players: int
    pending_kyc: int
    total_deposits_pending: int
    total_deposits_amount_pending: float
    total_withdrawals_pending: int
    total_withdrawals_amount_pending: float
    total_bets_today: int
    total_bets_amount_today: float
    total_winnings_today: float
    fraud_alerts_count: int
