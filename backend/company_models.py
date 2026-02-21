# Company-specific settings model (stored per company)
class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    timezone: str = "America/New_York"
    currency: str = "HTG"
    sales_stop_minutes_before_draw: int = 5
    max_devices_per_agent: int = 3
    ticket_void_timeout_minutes: int = 30
    updated_at: str
    updated_by: str

class CompanySettingsUpdate(BaseModel):
    timezone: Optional[str] = None
    currency: Optional[str] = None
    sales_stop_minutes_before_draw: Optional[int] = None
    max_devices_per_agent: Optional[int] = None
    ticket_void_timeout_minutes: Optional[int] = None

class ScheduleOverride(BaseModel):
    model_config = ConfigDict(extra="ignore")
    override_id: str
    company_id: str
    lottery_id: str
    lottery_name: str
    override_type: str  # OPEN_NOW, CLOSE_NOW, CUSTOM
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    active: bool = True
    created_by: str
    created_at: str

class ScheduleOverrideCreate(BaseModel):
    lottery_id: str
    override_type: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class ReportSummary(BaseModel):
    total_tickets: int = 0
    total_sales: float = 0.0
    active_agents: int = 0
    top_lottery: Optional[str] = None
    period: str = "today"
