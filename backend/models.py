from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List, Dict, Any
from enum import Enum

class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    COMPANY_MANAGER = "COMPANY_MANAGER"
    BRANCH_SUPERVISOR = "BRANCH_SUPERVISOR"  # Superviseur de succursale
    BRANCH_USER = "BRANCH_USER"  # Utilisateur de succursale
    AGENT_POS = "AGENT_POS"
    AUDITOR_READONLY = "AUDITOR_READONLY"

class CompanyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    TRIAL = "TRIAL"

class AgentStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"

class TicketStatus(str, Enum):
    ACTIVE = "ACTIVE"
    VOID = "VOID"
    PAID = "PAID"
    WINNER = "WINNER"
    LOSER = "LOSER"
    PENDING_RESULT = "PENDING_RESULT"

class LotteryStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"

# Base Models
class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    name: str
    slug: str
    status: CompanyStatus
    plan: str = "Basic"
    license_start: Optional[str] = None
    license_end: Optional[str] = None
    currency: str = "HTG"
    timezone: str = "America/Port-au-Prince"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: str
    updated_at: str

class CompanyCreate(BaseModel):
    name: str
    slug: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    currency: str = "HTG"
    timezone: str = "America/Port-au-Prince"
    plan: str = "Basic"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    role: UserRole
    company_id: Optional[str] = None
    status: str = "ACTIVE"
    last_login: Optional[str] = None
    created_at: str
    updated_at: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    company_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[str] = None
    company_id: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: User
    redirect_path: str

class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    agent_id: str
    company_id: str
    name: str
    username: str
    phone: Optional[str] = None
    email: Optional[str] = None
    status: AgentStatus
    can_void_ticket: bool = False
    user_id: Optional[str] = None
    created_at: str
    updated_at: str

class AgentCreate(BaseModel):
    name: str
    username: str
    password: str
    phone: Optional[str] = None
    email: Optional[str] = None
    can_void_ticket: bool = False

class POSDevice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str
    company_id: str
    imei: Optional[str] = None  # Unique identifier
    device_name: str
    branch: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    agent_id: Optional[str] = None  # Legacy field
    status: str = "PENDING"  # PENDING, ACTIVE, BLOCKED
    last_seen: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class POSDeviceCreate(BaseModel):
    imei: str
    device_name: str
    branch: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    notes: Optional[str] = None

class POSDeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    branch: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class State(BaseModel):
    model_config = ConfigDict(extra="ignore")
    state_id: str
    name: str
    code: str
    country: str = "USA"

class Lottery(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lottery_id: str
    region: str
    state_id: Optional[str] = None
    lottery_name: str
    game_type: str
    draw_times: List[str] = []
    sales_open_offset_minutes: int = 240
    sales_close_offset_minutes: int = 5
    description: Optional[str] = None

class CompanyLottery(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    lottery_id: str
    enabled: bool = True
    sales_open_offset_minutes: Optional[int] = None
    sales_close_offset_minutes: Optional[int] = None

class TicketLine(BaseModel):
    numbers: str
    bet_type: str
    amount: float

class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str
    ticket_code: str
    verification_code: str  # 12-digit unique code
    qr_payload: Optional[str] = None
    agent_id: str
    agent_name: Optional[str] = None
    company_id: str
    succursale_id: Optional[str] = None  # Branch reference
    succursale_name: Optional[str] = None
    pos_device_id: Optional[str] = None
    lottery_id: str
    lottery_name: str
    draw_name: Optional[str] = None
    draw_datetime: str
    plays: List[TicketLine]
    total_amount: float
    potential_win: Optional[float] = None
    currency: str = "HTG"
    status: TicketStatus = TicketStatus.ACTIVE
    # Void/Cancellation fields
    void_reason: Optional[str] = None
    voided_by: Optional[str] = None
    voided_at: Optional[str] = None
    # Timestamps
    created_at: str
    updated_at: Optional[str] = None

class TicketCreate(BaseModel):
    lottery_id: str
    draw_datetime: str
    plays: List[TicketLine]

class Result(BaseModel):
    model_config = ConfigDict(extra="ignore")
    result_id: str
    lottery_id: str
    lottery_name: str
    company_id: str
    draw_datetime: str
    winning_numbers: str
    source: str = "MANUAL"
    entered_by: str
    created_at: str

class ResultCreate(BaseModel):
    lottery_id: str
    draw_datetime: str
    winning_numbers: str

class Plan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    plan_id: str
    name: str
    price: float = 0.0
    max_agents: int
    max_tickets_per_day: int
    max_lotteries: int
    max_pos_devices: int = 10
    features: List[str] = []
    status: str = "ACTIVE"
    created_at: str
    updated_at: str

class PlanCreate(BaseModel):
    name: str
    price: float = 0.0
    max_agents: int
    max_tickets_per_day: int
    max_lotteries: int
    max_pos_devices: int = 10
    features: List[str] = []

class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    max_agents: Optional[int] = None
    max_tickets_per_day: Optional[int] = None
    max_lotteries: Optional[int] = None
    max_pos_devices: Optional[int] = None
    features: Optional[List[str]] = None
    status: Optional[str] = None

class License(BaseModel):
    model_config = ConfigDict(extra="ignore")
    license_id: str
    company_id: str
    company_name: str
    plan_id: str
    plan_name: str
    start_date: str
    expiry_date: str
    status: str = "ACTIVE"
    created_at: str
    updated_at: str

class LicenseCreate(BaseModel):
    company_id: str
    plan_id: str
    start_date: str
    expiry_date: str

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    action_type: str
    entity_type: str
    entity_id: str
    performed_by: str
    performed_by_name: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    metadata: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: str

class SystemSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    settings_id: str = "system_settings"
    platform_name: str = "LOTTOLAB"
    platform_logo: Optional[str] = None
    default_currency: str = "HTG"
    default_timezone: str = "America/Port-au-Prince"
    ticket_code_length: int = 12
    verification_code_length: int = 12
    maintenance_mode: bool = False
    allow_company_registration: bool = False
    updated_at: str
    updated_by: Optional[str] = None

# ============ BRANCH/SUCCURSALE ============
class Branch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    branch_id: str
    company_id: str
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    status: str = "ACTIVE"
    created_at: str
    updated_at: Optional[str] = None

class BranchCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None
    status: Optional[str] = None

# ============ VENDOR/VENDEUR ============
class Vendor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    vendor_id: str
    company_id: str
    branch_id: Optional[str] = None
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_rate: float = 0.0
    status: str = "ACTIVE"
    created_at: str
    updated_at: Optional[str] = None

class VendorCreate(BaseModel):
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_rate: float = 0.0

# ============ PRIME (PAYOUT) CONFIG ============
class PrimeConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prime_id: str
    company_id: str
    bet_type: str  # BORLETTE, LOTO3, LOTO4, MARIAGE, etc.
    bet_code: str  # 20, 30, 40, etc.
    payout_first: float = 0.0
    payout_second: float = 0.0
    payout_third: float = 0.0
    description: Optional[str] = None
    is_active: bool = True
    updated_at: Optional[str] = None

class PrimeConfigCreate(BaseModel):
    bet_type: str
    bet_code: str
    payout_first: float
    payout_second: float = 0.0
    payout_third: float = 0.0
    description: Optional[str] = None

# ============ BLOCKED NUMBERS ============
class BlockedNumber(BaseModel):
    model_config = ConfigDict(extra="ignore")
    block_id: str
    company_id: str
    lottery_id: Optional[str] = None
    number: str
    block_type: str = "FULL"  # FULL, PARTIAL
    max_amount: Optional[float] = None
    reason: Optional[str] = None
    created_by: str
    created_at: str
    expires_at: Optional[str] = None

# ============ LIMITS ============
class SalesLimit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    limit_id: str
    company_id: str
    lottery_id: Optional[str] = None
    agent_id: Optional[str] = None
    number: Optional[str] = None
    bet_type: Optional[str] = None
    max_amount: float
    period: str = "DAILY"  # DAILY, DRAW
    created_at: str
    updated_at: Optional[str] = None

# ============ GLOBAL SCHEDULE (SUPER ADMIN) ============
class GlobalSchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    schedule_id: str
    lottery_id: str
    lottery_name: str
    day_of_week: int  # 0=Monday, 6=Sunday, -1=All days
    draw_name: str  # "Midday", "Evening", etc.
    open_time: str  # HH:MM
    close_time: str  # HH:MM
    draw_time: str  # HH:MM
    is_active: bool = True
    created_at: str
    updated_at: Optional[str] = None

class GlobalScheduleCreate(BaseModel):
    lottery_id: str
    day_of_week: int = -1
    draw_name: str
    open_time: str
    close_time: str
    draw_time: str
    is_active: bool = True

# ============ GLOBAL RESULT (SUPER ADMIN) ============
class GlobalResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    result_id: str
    lottery_id: str
    lottery_name: str
    draw_date: str  # YYYY-MM-DD
    draw_name: str  # "Midday", "Evening"
    winning_numbers: str
    bonus_number: Optional[str] = None
    entered_by: str
    entered_by_name: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class GlobalResultCreate(BaseModel):
    lottery_id: str
    draw_date: str
    draw_name: str
    winning_numbers: str
    bonus_number: Optional[str] = None

class SettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    default_currency: Optional[str] = None
    default_timezone: Optional[str] = None
    ticket_code_length: Optional[int] = None
    verification_code_length: Optional[int] = None
    maintenance_mode: Optional[bool] = None
    allow_company_registration: Optional[bool] = None

class DashboardStats(BaseModel):
    total_companies: int = 0
    active_companies: int = 0
    total_agents: int = 0
    tickets_today: int = 0
    monthly_revenue: float = 0.0

class CompanyDashboardStats(BaseModel):
    tickets_today: int = 0
    sales_today: float = 0.0
    active_agents: int = 0
    open_lotteries: int = 0

# ============ SCHEDULES ============
class Schedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    schedule_id: str
    company_id: str
    lottery_id: str
    lottery_name: str
    day_of_week: int  # 0=Monday, 6=Sunday
    open_time: str  # HH:MM format
    close_time: str  # HH:MM format
    draw_time: str  # HH:MM format
    is_active: bool = True
    created_at: str
    updated_at: str

class ScheduleCreate(BaseModel):
    lottery_id: str
    day_of_week: int
    open_time: str
    close_time: str
    draw_time: str
    is_active: bool = True

class ScheduleUpdate(BaseModel):
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    draw_time: Optional[str] = None
    is_active: Optional[bool] = None

# ============ COMPANY SETTINGS ============
class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    settings_id: str
    company_id: str
    timezone: str = "America/Port-au-Prince"
    currency: str = "HTG"
    stop_sales_before_draw_minutes: int = 5
    allow_ticket_void: bool = True
    max_ticket_amount: float = 10000.0
    min_ticket_amount: float = 10.0
    auto_print_ticket: bool = True
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None
    updated_at: str
    updated_by: Optional[str] = None

class CompanySettingsUpdate(BaseModel):
    timezone: Optional[str] = None
    currency: Optional[str] = None
    stop_sales_before_draw_minutes: Optional[int] = None
    allow_ticket_void: Optional[bool] = None
    max_ticket_amount: Optional[float] = None
    min_ticket_amount: Optional[float] = None
    auto_print_ticket: Optional[bool] = None
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None

# ============ REPORTS ============
class SalesReport(BaseModel):
    total_tickets: int = 0
    total_sales: float = 0.0
    total_wins: float = 0.0
    net_revenue: float = 0.0
    sales_by_agent: List[Dict[str, Any]] = []
    sales_by_lottery: List[Dict[str, Any]] = []
    period_start: str
    period_end: str

# ============ AGENT UPDATE ============
class AgentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    can_void_ticket: Optional[bool] = None
    pos_device_id: Optional[str] = None

# ============ ENHANCED COMPANY MODEL FOR SUPER ADMIN ============
class CompanyEnhanced(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    name: str
    slug: str
    status: CompanyStatus
    plan: str = "Basic"
    license_start: Optional[str] = None
    license_end: Optional[str] = None
    currency: str = "HTG"
    timezone: str = "America/Port-au-Prince"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    logo_url: Optional[str] = None
    last_login: Optional[str] = None
    agents_count: int = 0
    pos_count: int = 0
    created_at: str
    updated_at: str

class CompanyUpdateSuper(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    plan: Optional[str] = None
    license_start: Optional[str] = None
    license_end: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    logo_url: Optional[str] = None

# ============ POS DEVICE ENHANCED ============
class POSDeviceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    DISABLED = "DISABLED"
    PENDING = "PENDING"

class POSDeviceEnhanced(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str
    company_id: str
    company_name: Optional[str] = None
    imei: str
    device_name: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    assigned_vendor_id: Optional[str] = None
    assigned_vendor_name: Optional[str] = None
    status: str = "PENDING"
    last_seen_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class POSDeviceCreateEnhanced(BaseModel):
    imei: str
    device_name: str
    branch_id: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    assigned_vendor_id: Optional[str] = None
    notes: Optional[str] = None

class POSDeviceUpdateEnhanced(BaseModel):
    device_name: Optional[str] = None
    branch_id: Optional[str] = None
    location: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    assigned_vendor_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

# ============ GLOBAL LOTTERY CATALOG (SUPER ADMIN MANAGED) ============
class LotteryGameType(str, Enum):
    PICK3 = "PICK3"
    PICK4 = "PICK4"
    PICK5 = "PICK5"
    BORLETTE = "BORLETTE"
    LOTO3 = "LOTO3"
    LOTO4 = "LOTO4"
    LOTO5 = "LOTO5"
    MARIAGE = "MARIAGE"

class GlobalLottery(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lottery_id: str
    state_code: Optional[str] = None
    state_name: Optional[str] = None
    country: str = "USA"
    lottery_name: str
    game_type: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    is_active_global: Optional[bool] = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class GlobalLotteryCreate(BaseModel):
    state_code: str
    state_name: str
    country: str = "USA"
    lottery_name: str
    game_type: str
    description: Optional[str] = None
    is_active: bool = True

class GlobalLotteryUpdate(BaseModel):
    lottery_name: Optional[str] = None
    game_type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# ============ GLOBAL SCHEDULE (SUPER ADMIN MANAGED) ============
class GlobalScheduleEnhanced(BaseModel):
    model_config = ConfigDict(extra="ignore")
    schedule_id: str
    lottery_id: str
    lottery_name: Optional[str] = None
    state_code: Optional[str] = None
    draw_name: str  # "Midday", "Evening", "Night"
    days_of_week: List[int] = []  # 0=Monday, 6=Sunday, empty=all days
    open_time: str  # HH:MM
    close_time: str  # HH:MM
    draw_time: str  # HH:MM
    is_active: bool = True
    created_at: str
    updated_at: Optional[str] = None

class GlobalScheduleCreateEnhanced(BaseModel):
    lottery_id: str
    draw_name: str
    days_of_week: List[int] = []
    open_time: str
    close_time: str
    draw_time: str
    is_active: bool = True

class GlobalScheduleUpdateEnhanced(BaseModel):
    draw_name: Optional[str] = None
    days_of_week: Optional[List[int]] = None
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    draw_time: Optional[str] = None
    is_active: Optional[bool] = None

# ============ GLOBAL RESULT (SUPER ADMIN MANAGED) ============
class GlobalResultEnhanced(BaseModel):
    model_config = ConfigDict(extra="ignore")
    result_id: str
    lottery_id: str
    lottery_name: str
    state_code: Optional[str] = None
    draw_date: str  # YYYY-MM-DD
    draw_name: str  # "Midday", "Evening"
    winning_numbers: str
    winning_numbers_parsed: Dict[str, str] = {}  # {"first": "123", "second": "456", "third": "789"}
    bonus_number: Optional[str] = None
    entered_by: str
    entered_by_name: Optional[str] = None
    is_verified: bool = False
    created_at: str
    updated_at: Optional[str] = None

class GlobalResultCreateEnhanced(BaseModel):
    lottery_id: str
    draw_date: str
    draw_name: str
    winning_numbers: str
    winning_numbers_parsed: Dict[str, str] = {}
    bonus_number: Optional[str] = None

# ============ VENDOR ============
class VendorCreateModel(BaseModel):
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_rate: float = 0.0

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_rate: Optional[float] = None
    status: Optional[str] = None

# ============ PRIME CONFIG (PAYOUT CONFIGURATION) ============
class PrimeConfigEnhanced(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prime_id: str
    company_id: str
    bet_type: str
    bet_code: str
    bet_name: str
    payout_formula: str  # "60|20|10" for multi-position, "500" for single
    description: Optional[str] = None
    is_active: bool = True
    updated_at: Optional[str] = None

class PrimeConfigCreateEnhanced(BaseModel):
    bet_type: str
    bet_code: str
    bet_name: str
    payout_formula: str
    description: Optional[str] = None

class PrimeConfigUpdateEnhanced(BaseModel):
    bet_name: Optional[str] = None
    payout_formula: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

# ============ COMPANY LOTTERY AVAILABILITY ============
class CompanyLotteryAvailability(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    company_id: str
    lottery_id: str
    lottery_name: Optional[str] = None
    state_code: Optional[str] = None
    enabled: bool = True
    created_at: str
    updated_at: Optional[str] = None

# ============ BLOCKED NUMBERS ============
class BlockedNumberCreate(BaseModel):
    lottery_id: Optional[str] = None
    number: str
    block_type: str = "FULL"
    max_amount: Optional[float] = None
    reason: Optional[str] = None
    expires_at: Optional[str] = None

class BlockedNumberUpdate(BaseModel):
    block_type: Optional[str] = None
    max_amount: Optional[float] = None
    reason: Optional[str] = None
    expires_at: Optional[str] = None

# ============ SALES LIMITS ============
class SalesLimitCreate(BaseModel):
    lottery_id: Optional[str] = None
    agent_id: Optional[str] = None
    number: Optional[str] = None
    bet_type: Optional[str] = None
    limit_type: str = "GLOBAL"  # GLOBAL, LOTTERY, AGENT, NUMBER
    max_amount: float
    period: str = "DAILY"

class SalesLimitUpdate(BaseModel):
    max_amount: Optional[float] = None
    period: Optional[str] = None
    is_active: Optional[bool] = None

# ============ COMPANY CONFIGURATION ============
class CompanyConfiguration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    config_id: str
    company_id: str
    # Betting limits
    min_bet_amount: float = 10.0
    max_bet_amount: float = 10000.0
    max_bet_per_number: float = 5000.0
    max_bet_per_agent: float = 50000.0
    # Agent commission
    agent_commission_percent: float = 10.0
    # Marriage config
    marriage_enabled: bool = True
    marriage_min_amount: float = 25.0
    marriage_max_amount: float = 5000.0
    # Other settings
    stop_sales_before_draw_minutes: int = 5
    allow_ticket_void: bool = True
    void_window_minutes: int = 5
    auto_print_ticket: bool = True
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class CompanyConfigurationUpdate(BaseModel):
    min_bet_amount: Optional[float] = None
    max_bet_amount: Optional[float] = None
    max_bet_per_number: Optional[float] = None
    max_bet_per_agent: Optional[float] = None
    agent_commission_percent: Optional[float] = None
    marriage_enabled: Optional[bool] = None
    marriage_min_amount: Optional[float] = None
    marriage_max_amount: Optional[float] = None
    stop_sales_before_draw_minutes: Optional[int] = None
    allow_ticket_void: Optional[bool] = None
    void_window_minutes: Optional[int] = None
    auto_print_ticket: Optional[bool] = None
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None

# ============ ELIMINATION REQUEST ============
class EliminationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str
    company_id: str
    ticket_id: Optional[str] = None
    number: Optional[str] = None
    lottery_id: Optional[str] = None
    request_type: str  # TICKET, NUMBER
    reason: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    requested_by: str
    requested_by_name: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str

class EliminationRequestCreate(BaseModel):
    ticket_id: Optional[str] = None
    number: Optional[str] = None
    lottery_id: Optional[str] = None
    request_type: str
    reason: str

# ============ DAILY REPORT ============
class DailyReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    report_id: str
    company_id: str
    report_date: str
    total_tickets: int = 0
    total_sales: float = 0.0
    total_wins: float = 0.0
    total_commissions: float = 0.0
    net_revenue: float = 0.0
    sales_by_lottery: List[Dict[str, Any]] = []
    sales_by_agent: List[Dict[str, Any]] = []
    sales_by_branch: List[Dict[str, Any]] = []
    winning_tickets_count: int = 0
    voided_tickets_count: int = 0
    generated_at: str
    generated_by: Optional[str] = None


# ============ COMPANY LOTTERY CATALOG (REAL-TIME SYNC) ============
class CompanyLotteryCatalog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    company_id: str
    lottery_game_id: str
    lottery_name: Optional[str] = None
    state_code: Optional[str] = None
    game_type: Optional[str] = None
    enabled: bool = True
    allowed_draw_ids: List[str] = []
    cutoff_rules: Dict[str, Any] = {}  # {"open_time": "08:00", "close_time": "12:55"}
    max_bet_per_ticket: float = 10000.0
    max_bet_per_number: float = 5000.0
    max_payout_per_draw: float = 100000.0
    created_at: str
    updated_at: Optional[str] = None

class CompanyLotteryCatalogCreate(BaseModel):
    lottery_game_id: str
    enabled: bool = True
    cutoff_rules: Dict[str, Any] = {}
    max_bet_per_ticket: float = 10000.0
    max_bet_per_number: float = 5000.0
    max_payout_per_draw: float = 100000.0

class CompanyLotteryCatalogUpdate(BaseModel):
    enabled: Optional[bool] = None
    cutoff_rules: Optional[Dict[str, Any]] = None
    max_bet_per_ticket: Optional[float] = None
    max_bet_per_number: Optional[float] = None
    max_payout_per_draw: Optional[float] = None

# ============ COMPANY POS RULES ============
class TicketFormat(str, Enum):
    THERMAL_80MM = "80MM_THERMAL"
    A4_STANDARD = "A4_STANDARD"

class CompanyPosRules(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    company_id: str
    block_numbers_enabled: bool = True
    limits_enabled: bool = True
    allow_void_ticket: bool = True
    allow_reprint_ticket: bool = True
    allow_manual_results_view: bool = True
    ticket_format: str = "80MM_THERMAL"
    config_version: int = 1  # Increment on any change for sync
    created_at: str
    updated_at: Optional[str] = None

class CompanyPosRulesUpdate(BaseModel):
    block_numbers_enabled: Optional[bool] = None
    limits_enabled: Optional[bool] = None
    allow_void_ticket: Optional[bool] = None
    allow_reprint_ticket: Optional[bool] = None
    allow_manual_results_view: Optional[bool] = None
    ticket_format: Optional[str] = None

# ============ AGENT POLICY ============
class DeviceTypeEnum(str, Enum):
    POS = "POS"
    COMPUTER = "COMPUTER"
    PHONE = "PHONE"
    TABLET = "TABLET"

class AgentPolicy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    company_id: str
    agent_id: str
    allowed_device_types: List[str] = ["POS", "COMPUTER", "PHONE", "TABLET"]
    must_use_imei: bool = False
    max_credit_limit: float = 50000.0
    max_win_limit: float = 100000.0
    commission_percent: float = 0.0
    supervisor_percent: float = 0.0
    status: str = "active"  # active, suspended
    created_at: str
    updated_at: Optional[str] = None

class AgentPolicyCreate(BaseModel):
    agent_id: str
    allowed_device_types: List[str] = ["POS", "COMPUTER", "PHONE", "TABLET"]
    must_use_imei: bool = False
    max_credit_limit: float = 50000.0
    max_win_limit: float = 100000.0
    commission_percent: float = 0.0
    supervisor_percent: float = 0.0

class AgentPolicyUpdate(BaseModel):
    allowed_device_types: Optional[List[str]] = None
    must_use_imei: Optional[bool] = None
    max_credit_limit: Optional[float] = None
    max_win_limit: Optional[float] = None
    commission_percent: Optional[float] = None
    supervisor_percent: Optional[float] = None
    status: Optional[str] = None

# ============ ENHANCED AGENT CREATE (FULL FORM) ============
class AgentCreateFull(BaseModel):
    # Personal Info
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    
    # Location
    branch_id: Optional[str] = None
    zone: Optional[str] = None
    address: Optional[str] = None
    
    # Device Settings
    imei: Optional[str] = None  # Required if must_use_imei is true
    device_id: Optional[str] = None  # Auto-generated if not provided
    
    # Financial Settings
    commission_percent: float = 0.0
    supervisor_percent: float = 0.0
    credit_limit: float = 50000.0
    win_limit: float = 100000.0
    
    # Permissions
    allowed_device_types: List[str] = ["POS", "COMPUTER", "PHONE", "TABLET"]
    must_use_imei: bool = False
    can_void_ticket: bool = True
    can_reprint_ticket: bool = True
    
    # Status
    status: str = "ACTIVE"

class AgentProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    agent_id: str
    user_id: str
    company_id: str
    first_name: str
    last_name: str
    name: str
    email: str
    phone: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    zone: Optional[str] = None
    address: Optional[str] = None
    commission_percent: float = 0.0
    supervisor_percent: float = 0.0
    credit_limit: float = 50000.0
    win_limit: float = 100000.0
    current_credit: float = 0.0
    current_winnings: float = 0.0
    allowed_device_types: List[str] = []
    must_use_imei: bool = False
    can_void_ticket: bool = True
    can_reprint_ticket: bool = True
    status: str = "ACTIVE"
    pos_devices: List[Dict[str, Any]] = []
    enabled_lotteries_count: int = 0
    total_sales_today: float = 0.0
    total_tickets_today: int = 0
    created_at: str
    updated_at: Optional[str] = None
    last_login: Optional[str] = None

class AgentProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    branch_id: Optional[str] = None
    zone: Optional[str] = None
    address: Optional[str] = None
    commission_percent: Optional[float] = None
    supervisor_percent: Optional[float] = None
    credit_limit: Optional[float] = None
    win_limit: Optional[float] = None
    allowed_device_types: Optional[List[str]] = None
    must_use_imei: Optional[bool] = None
    can_void_ticket: Optional[bool] = None
    can_reprint_ticket: Optional[bool] = None
    status: Optional[str] = None

# ============ AGENT LOTTERY PERMISSIONS ============
class AgentLotteryPermission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    company_id: str
    agent_id: str
    lottery_game_id: str
    lottery_name: Optional[str] = None
    enabled: bool = True
    created_at: str
    updated_at: Optional[str] = None

# ============ LOTTERY TRANSACTION ACTIONS ============
class TransactionAction(str, Enum):
    SELL = "SELL"
    VOID = "VOID"
    REPRINT = "REPRINT"
    PAYOUT = "PAYOUT"
    BLOCK_NUMBER = "BLOCK_NUMBER"
    UNBLOCK_NUMBER = "UNBLOCK_NUMBER"

class LotteryTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    company_id: str
    agent_id: str
    agent_name: Optional[str] = None
    device_session_id: Optional[str] = None
    pos_device_id: Optional[str] = None
    device_type: Optional[str] = None
    ticket_id: Optional[str] = None
    action: str
    payload: Dict[str, Any] = {}
    created_at: str

# ============ ENHANCED TICKET (WITH FULL DETAILS) ============
class TicketEnhanced(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str
    ticket_code: str
    verification_code: str
    qr_payload: Optional[str] = None
    company_id: str
    company_name: Optional[str] = None
    agent_id: str
    agent_name: Optional[str] = None
    device_session_id: Optional[str] = None
    pos_device_id: Optional[str] = None
    device_type: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    lottery_id: str
    lottery_name: str
    draw_id: Optional[str] = None
    draw_date: str
    draw_name: str
    plays: List[Dict[str, Any]] = []  # [{numbers, bet_type, amount}]
    total_amount: float
    potential_win: float = 0.0
    actual_win: float = 0.0
    currency: str = "HTG"
    status: str = "PENDING_RESULT"  # PENDING_RESULT, WINNER, LOSER, VOID, PAID
    printed_count: int = 1
    voided_at: Optional[str] = None
    voided_by: Optional[str] = None
    void_reason: Optional[str] = None
    paid_at: Optional[str] = None
    paid_by: Optional[str] = None
    created_at: str

# ============ DEVICE CONFIG RESPONSE (FOR SYNC) ============
class DeviceConfigResponse(BaseModel):
    config_version: int = 1
    company: Dict[str, Any] = {}
    agent: Dict[str, Any] = {}
    pos_rules: Dict[str, Any] = {}
    enabled_lotteries: List[Dict[str, Any]] = []
    schedules: List[Dict[str, Any]] = []
    blocked_numbers: List[Dict[str, Any]] = []
    sales_limits: List[Dict[str, Any]] = []
    prime_configs: List[Dict[str, Any]] = []
    agent_policy: Dict[str, Any] = {}
    timestamp: str

class DeviceSyncResponse(BaseModel):
    config_version: int = 1
    latest_results: List[Dict[str, Any]] = []
    blocked_numbers: List[Dict[str, Any]] = []
    limits: List[Dict[str, Any]] = []
    agent_status: str = "active"
    pos_status: Optional[str] = None
    daily_stats: Dict[str, Any] = {}
    balance: Dict[str, Any] = {}
    server_time: str

# ============ COMPANY CONFIG VERSION TRACKING ============
class CompanyConfigVersion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    version: int = 1
    last_updated_at: str
    last_updated_by: Optional[str] = None
    change_type: Optional[str] = None  # LOTTERY_TOGGLE, BLOCKED_NUMBER, LIMIT, POS_RULE
