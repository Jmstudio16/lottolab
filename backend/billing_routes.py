"""
LOTTOLAB PRO — SaaS Billing Routes
====================================
Super-Admin-only module that tracks agent usage per company and
generates monthly invoices billed to each active company.

Counters per company (per month):
  • agents_active            — users with role in AGENT_ROLES and status=ACTIVE
  • agents_online_now        — users with last_login within the last 5 minutes
  • agents_monthly_active    — distinct users who logged in during the period
  • agents_monthly_sellers   — distinct users with ≥1 ticket sold during the period

Billing modes:
  • fixed_per_agent  — amount = rate_per_agent * billable_agents
  • tiered           — piecewise rate brackets
  • percentage       — amount = company_revenue * percentage_rate
  • custom           — Super Admin sets the amount manually

The counter used as `billable_agents` is configurable per company via the
`counting_method` field.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
import io

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from auth import decode_token
from utils import generate_id, get_current_timestamp


billing_router = APIRouter(prefix="/api/super/billing")
security = HTTPBearer()

# Roles considered as "agents" for billing purposes
AGENT_ROLES = ["AGENT_POS", "BRANCH_USER", "BRANCH_SUPERVISOR"]

# Default config when a company has no explicit billing config yet
DEFAULT_CONFIG = {
    "billing_mode": "fixed_per_agent",
    "rate_per_agent": 500.0,            # HTG / agent / month
    "counting_method": "monthly_active",  # which counter feeds billable_agents
    "percentage_rate": 0.02,            # 2% if billing_mode='percentage'
    "tiers": [                          # for billing_mode='tiered'
        {"max_agents": 10, "rate": 500.0},
        {"max_agents": 50, "rate": 400.0},
        {"max_agents": 999999, "rate": 300.0}
    ],
    "currency": "HTG",
    "notes": ""
}

db = None


def set_db(database):
    global db
    db = database


# ----------------------------- Auth dependency -----------------------------

async def get_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"user_id": payload.get("user_id")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user


# ----------------------------- Pydantic models -----------------------------

class BillingTier(BaseModel):
    max_agents: int
    rate: float


class BillingConfig(BaseModel):
    billing_mode: str = "fixed_per_agent"
    rate_per_agent: float = 500.0
    counting_method: str = "monthly_active"
    percentage_rate: float = 0.02
    tiers: List[BillingTier] = []
    currency: str = "HTG"
    notes: str = ""


class InvoiceStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|paid|overdue|cancelled)$")
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None


# ----------------------------- Helpers -------------------------------------

def _month_bounds(month: Optional[str] = None) -> tuple[str, str, str]:
    """Return (period_start_iso, period_end_iso, label) for the given YYYY-MM.
    Defaults to the previous calendar month."""
    if month:
        try:
            year, mo = map(int, month.split("-"))
        except Exception:
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    else:
        today = datetime.now(timezone.utc)
        first_of_this = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_prev = first_of_this - timedelta(seconds=1)
        year, mo = last_prev.year, last_prev.month

    start = datetime(year, mo, 1, tzinfo=timezone.utc)
    if mo == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, mo + 1, 1, tzinfo=timezone.utc)
    return start.isoformat(), end.isoformat(), f"{year:04d}-{mo:02d}"


async def _company_agent_counters(company_id: str, period_start: str, period_end: str) -> dict:
    """Compute the four agent counters for a company over the period."""
    # 1. agents_active: status=ACTIVE
    agents_active = await db.users.count_documents({
        "company_id": company_id,
        "role": {"$in": AGENT_ROLES},
        "status": "ACTIVE"
    })

    # 2. agents_online_now: last_login within last 5 minutes
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    agents_online_now = await db.users.count_documents({
        "company_id": company_id,
        "role": {"$in": AGENT_ROLES},
        "last_login": {"$gte": five_min_ago}
    })

    # 3. agents_monthly_active: last_login within the period
    agents_monthly_active = await db.users.count_documents({
        "company_id": company_id,
        "role": {"$in": AGENT_ROLES},
        "last_login": {"$gte": period_start, "$lt": period_end}
    })

    # 4. agents_monthly_sellers: distinct agents who sold ≥1 ticket in the period
    sellers = await db.lottery_transactions.distinct(
        "agent_id",
        {
            "company_id": company_id,
            "created_at": {"$gte": period_start, "$lt": period_end}
        }
    )
    agents_monthly_sellers = len([s for s in sellers if s])

    return {
        "agents_active": agents_active,
        "agents_online_now": agents_online_now,
        "agents_monthly_active": agents_monthly_active,
        "agents_monthly_sellers": agents_monthly_sellers
    }


async def _company_revenue(company_id: str, period_start: str, period_end: str) -> float:
    """Total sales revenue for a company in the period."""
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "created_at": {"$gte": period_start, "$lt": period_end}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    res = await db.lottery_transactions.aggregate(pipeline).to_list(1)
    return float(res[0]["total"]) if res else 0.0


async def _get_or_default_config(company_id: str) -> dict:
    cfg = await db.billing_configs.find_one({"company_id": company_id}, {"_id": 0})
    if not cfg:
        return {"company_id": company_id, **DEFAULT_CONFIG}
    # Fill in any missing default keys for older configs
    for k, v in DEFAULT_CONFIG.items():
        cfg.setdefault(k, v)
    return cfg


def _compute_amount(config: dict, counters: dict, revenue: float) -> tuple[float, int]:
    """Return (amount_htg, billable_agents) based on config + counters."""
    counting = config.get("counting_method", "monthly_active")
    billable = counters.get(f"agents_{counting}", counters.get("agents_monthly_active", 0))

    mode = config.get("billing_mode", "fixed_per_agent")
    if mode == "fixed_per_agent":
        amount = billable * float(config.get("rate_per_agent", 0))
    elif mode == "tiered":
        rate = 0.0
        for tier in sorted(config.get("tiers", []), key=lambda t: t["max_agents"]):
            if billable <= tier["max_agents"]:
                rate = float(tier["rate"])
                break
        amount = billable * rate
    elif mode == "percentage":
        amount = revenue * float(config.get("percentage_rate", 0))
    elif mode == "custom":
        amount = float(config.get("custom_amount", 0))
    else:
        amount = 0.0
    return round(amount, 2), billable


# ----------------------------- Routes --------------------------------------

@billing_router.get("/summary")
async def billing_summary(current_user: dict = Depends(get_super_admin)):
    """Global billing snapshot for the dashboard header."""
    active_companies = await db.companies.count_documents({"status": "ACTIVE"})

    # Sums by invoice status (lifetime)
    pipeline = [{"$group": {"_id": "$status", "total": {"$sum": "$amount_due"}, "count": {"$sum": 1}}}]
    by_status = {}
    async for row in db.billing_invoices.aggregate(pipeline):
        by_status[row["_id"]] = {"total": float(row.get("total") or 0), "count": int(row.get("count") or 0)}

    # Total online agents right now across the platform
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    online_agents_now = await db.users.count_documents({
        "role": {"$in": AGENT_ROLES},
        "last_login": {"$gte": five_min_ago}
    })

    return {
        "active_companies": active_companies,
        "online_agents_now": online_agents_now,
        "invoices": {
            "pending": by_status.get("pending", {"total": 0, "count": 0}),
            "paid": by_status.get("paid", {"total": 0, "count": 0}),
            "overdue": by_status.get("overdue", {"total": 0, "count": 0}),
            "cancelled": by_status.get("cancelled", {"total": 0, "count": 0})
        }
    }


@billing_router.get("/companies")
async def list_companies_with_billing(
    month: Optional[str] = Query(default=None, description="YYYY-MM, defaults to previous month"),
    current_user: dict = Depends(get_super_admin)
):
    """List every ACTIVE company along with live agent counters and the
    projected amount that would be billed for the given period."""
    period_start, period_end, label = _month_bounds(month)
    rows = []
    async for company in db.companies.find({"status": "ACTIVE"}, {"_id": 0}):
        cid = company["company_id"]
        counters = await _company_agent_counters(cid, period_start, period_end)
        revenue = await _company_revenue(cid, period_start, period_end)
        config = await _get_or_default_config(cid)
        amount, billable = _compute_amount(config, counters, revenue)

        # Latest invoice (if any) for this period
        latest = await db.billing_invoices.find_one(
            {"company_id": cid, "period_label": label},
            {"_id": 0}
        )

        rows.append({
            "company_id": cid,
            "name": company.get("name"),
            "slug": company.get("slug"),
            "plan": company.get("plan"),
            "currency": config.get("currency", "HTG"),
            "billing_mode": config.get("billing_mode"),
            "counting_method": config.get("counting_method"),
            "rate_per_agent": config.get("rate_per_agent"),
            "counters": counters,
            "revenue_htg": revenue,
            "billable_agents": billable,
            "projected_amount": amount,
            "current_invoice": latest
        })

    return {"period": label, "period_start": period_start, "period_end": period_end, "companies": rows}


@billing_router.get("/company/{company_id}/config")
async def get_company_billing_config(company_id: str, current_user: dict = Depends(get_super_admin)):
    cfg = await _get_or_default_config(company_id)
    cfg.pop("_id", None)
    return cfg


@billing_router.put("/company/{company_id}/config")
async def upsert_company_billing_config(
    company_id: str,
    config: BillingConfig,
    current_user: dict = Depends(get_super_admin)
):
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "company_id": 1})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    now = get_current_timestamp()
    payload = {
        **config.dict(),
        "company_id": company_id,
        "updated_at": now,
        "updated_by": current_user.get("user_id")
    }
    await db.billing_configs.update_one(
        {"company_id": company_id},
        {"$set": payload, "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    return await _get_or_default_config(company_id)


@billing_router.post("/generate-invoices")
async def generate_invoices(
    month: Optional[str] = Query(default=None, description="YYYY-MM, defaults to previous month"),
    force: bool = Query(default=False, description="Overwrite existing invoices for the period"),
    current_user: dict = Depends(get_super_admin)
):
    """Generate (or refresh) invoices for every ACTIVE company for the given month."""
    period_start, period_end, label = _month_bounds(month)
    created, updated, skipped = [], [], []

    async for company in db.companies.find({"status": "ACTIVE"}, {"_id": 0}):
        cid = company["company_id"]
        counters = await _company_agent_counters(cid, period_start, period_end)
        revenue = await _company_revenue(cid, period_start, period_end)
        config = await _get_or_default_config(cid)
        amount, billable = _compute_amount(config, counters, revenue)

        existing = await db.billing_invoices.find_one(
            {"company_id": cid, "period_label": label},
            {"_id": 0}
        )

        now = get_current_timestamp()
        doc = {
            "company_id": cid,
            "company_name": company.get("name"),
            "period_label": label,
            "period_start": period_start,
            "period_end": period_end,
            "currency": config.get("currency", "HTG"),
            "billing_mode": config.get("billing_mode"),
            "counting_method": config.get("counting_method"),
            "rate_per_agent": config.get("rate_per_agent"),
            "percentage_rate": config.get("percentage_rate"),
            "tiers": config.get("tiers"),
            "counters": counters,
            "billable_agents": billable,
            "amount_due": amount,
            "company_revenue": revenue,
            "updated_at": now
        }

        if existing and not force:
            skipped.append(existing["invoice_id"])
            continue

        if existing and force:
            await db.billing_invoices.update_one(
                {"invoice_id": existing["invoice_id"]},
                {"$set": doc}
            )
            updated.append(existing["invoice_id"])
        else:
            doc["invoice_id"] = generate_id("inv_")
            doc["status"] = "pending"
            doc["created_at"] = now
            doc["created_by"] = current_user.get("user_id")
            await db.billing_invoices.insert_one(doc.copy())
            created.append(doc["invoice_id"])

    return {
        "period": label,
        "created": created,
        "updated": updated,
        "skipped_existing": skipped,
        "total": len(created) + len(updated) + len(skipped)
    }


@billing_router.get("/invoices")
async def list_invoices(
    status: Optional[str] = None,
    company_id: Optional[str] = None,
    month: Optional[str] = None,
    current_user: dict = Depends(get_super_admin)
):
    query = {}
    if status:
        query["status"] = status
    if company_id:
        query["company_id"] = company_id
    if month:
        query["period_label"] = month
    cursor = db.billing_invoices.find(query, {"_id": 0}).sort("created_at", -1)
    invoices = await cursor.to_list(length=500)
    return {"count": len(invoices), "invoices": invoices}


@billing_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_super_admin)):
    inv = await db.billing_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@billing_router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    body: InvoiceStatusUpdate,
    current_user: dict = Depends(get_super_admin)
):
    inv = await db.billing_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update = {"status": body.status, "updated_at": get_current_timestamp()}
    if body.status == "paid":
        update["paid_at"] = get_current_timestamp()
        if body.payment_method:
            update["payment_method"] = body.payment_method
        if body.payment_reference:
            update["payment_reference"] = body.payment_reference

    await db.billing_invoices.update_one({"invoice_id": invoice_id}, {"$set": update})
    return await db.billing_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})


@billing_router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, current_user: dict = Depends(get_super_admin)):
    """Generate a PDF for the invoice using reportlab."""
    inv = await db.billing_invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=1.8 * cm, rightMargin=1.8 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=22,
                                  textColor=colors.HexColor('#0f172a'), spaceAfter=6)
    h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12,
                        textColor=colors.HexColor('#334155'))
    body = styles['BodyText']

    story = []
    story.append(Paragraph("LOTTOLAB — Facture SaaS", title_style))
    story.append(Paragraph(f"Période : <b>{inv['period_label']}</b>", h2))
    story.append(Paragraph(f"Compagnie : <b>{inv.get('company_name', '')}</b>", h2))
    story.append(Paragraph(f"N° Facture : {inv['invoice_id']}", body))
    story.append(Paragraph(f"Statut : <b>{inv.get('status', 'pending').upper()}</b>", body))
    story.append(Spacer(1, 0.6 * cm))

    counters = inv.get("counters", {})
    counter_rows = [
        ["Compteur", "Valeur"],
        ["Agents Actifs (status=ACTIVE)", str(counters.get("agents_active", 0))],
        ["Agents en ligne maintenant", str(counters.get("agents_online_now", 0))],
        ["Agents actifs ce mois", str(counters.get("agents_monthly_active", 0))],
        ["Agents ayant vendu ce mois", str(counters.get("agents_monthly_sellers", 0))]
    ]
    t = Table(counter_rows, colWidths=[10 * cm, 5 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6)
    ]))
    story.append(t)
    story.append(Spacer(1, 0.6 * cm))

    mode = inv.get("billing_mode", "fixed_per_agent")
    detail_rows = [["Champ", "Valeur"], ["Mode de facturation", mode]]
    if mode == "fixed_per_agent":
        detail_rows.append(["Tarif par agent", f"{inv.get('rate_per_agent', 0):,.2f} {inv.get('currency', 'HTG')}"])
    if mode == "percentage":
        detail_rows.append(["Taux %", f"{(inv.get('percentage_rate', 0) * 100):.2f}%"])
        detail_rows.append(["Chiffre d'affaires", f"{inv.get('company_revenue', 0):,.2f} {inv.get('currency', 'HTG')}"])
    detail_rows.append(["Méthode de comptage", inv.get("counting_method", "")])
    detail_rows.append(["Agents facturables", str(inv.get("billable_agents", 0))])
    detail_rows.append(["MONTANT À PAYER", f"{inv.get('amount_due', 0):,.2f} {inv.get('currency', 'HTG')}"])

    t2 = Table(detail_rows, colWidths=[10 * cm, 5 * cm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fde68a')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 6)
    ]))
    story.append(t2)
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(
        "Merci d'effectuer votre paiement avant la fin du mois suivant la période facturée.<br/>"
        "Pour toute question, contactez support@lottolab.tech.",
        body
    ))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice_{inv["invoice_id"]}.pdf"'}
    )
