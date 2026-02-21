from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    COMPANY_MANAGER = "COMPANY_MANAGER"
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
    device_name: str
    agent_id: Optional[str] = None
    status: str = "ACTIVE"
    last_seen: Optional[str] = None
    created_at: str

class POSDeviceCreate(BaseModel):
    device_name: str
    agent_id: Optional[str] = None

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
    verification_code: str
    qr_payload: str
    agent_id: str
    company_id: str
    lottery_id: str
    lottery_name: str
    draw_datetime: str
    plays: List[TicketLine]
    total_amount: float
    currency: str
    status: TicketStatus
    created_at: str

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

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    action_type: str
    entity_type: str
    entity_id: str
    performed_by: str
    company_id: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: str

class Plan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    plan_id: str
    name: str
    max_agents: int
    max_tickets_per_day: int
    max_lotteries: int
    features: List[str] = []

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
