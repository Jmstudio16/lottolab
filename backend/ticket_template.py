"""
LOTTOLAB - Professional 80mm Thermal Ticket Template
Unified template generator for both online and offline (sync) ticket printing
Exact format matching the user's specification
"""

from datetime import datetime, timezone
import pytz
import qrcode
import io
import base64
import logging

logger = logging.getLogger(__name__)


def generate_qr_code_base64(data: str) -> str:
    """Generate QR code as base64 string for embedding in HTML"""
    try:
        qr = qrcode.QRCode(version=1, box_size=3, border=1)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()
    except Exception as e:
        logger.error(f"[TICKET] QR generation failed: {e}")
        return ""


def get_server_time_haiti() -> tuple:
    """Get current server time in Haiti timezone. Returns (date_str, time_str)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        now_haiti = datetime.now(haiti_tz)
        date_str = now_haiti.strftime("%d/%m/%Y")
        time_str = now_haiti.strftime("%H:%M:%S")
        return date_str, time_str
    except Exception as e:
        logger.error(f"[TICKET] Time conversion failed: {e}")
        now = datetime.now(timezone.utc)
        return now.strftime("%d/%m/%Y"), now.strftime("%H:%M:%S")


def format_datetime_haiti(iso_datetime: str) -> tuple:
    """Convert ISO datetime to Haiti timezone. Returns (date_str, time_str)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        dt = datetime.fromisoformat(iso_datetime.replace("Z", "+00:00"))
        dt_local = dt.astimezone(haiti_tz)
        return dt_local.strftime("%d/%m/%Y"), dt_local.strftime("%H:%M:%S")
    except Exception as e:
        logger.error(f"[TICKET] Date format failed: {e}")
        return iso_datetime[:10] if len(iso_datetime) >= 10 else "N/A", ""


def generate_ticket_html(
    ticket: dict,
    company: dict = None,
    agent: dict = None,
    branch: dict = None,
    auto_print: bool = False,
    base_url: str = "https://lottolab.tech"
) -> str:
    """
    Generate professional 80mm thermal ticket HTML.
    
    Exact format:
    [LOGO COMPAGNIE]
    LOTO PAM CENTER
    Tel: +509XXXXXXXX
    Succursale: PETION VILLE
    --------------------------------
    VENDEUR : JEFFERSON
    MACHINE : POS-01
    TICKET ID : XXXXXXXX
    --------------------------------
    LOTERIE : New York Evening
    TIRAGE  : SOIR
    DATE    : 24/03/2026
    HEURE   : TEMPS RÉEL (SERVEUR)
    --------------------------------
    NUMÉROS JOUÉS
    --------------------------------
    45                 10 HTG
    23                 20 HTG
    --------------------------------
    TOTAL MISE :       30 HTG
    --------------------------------
    STATUT : VALIDÉ
    --------------------------------
    MERCI DE JOUER AVEC
    LOTO PAM CENTER
    --------------------------------
    CODE : 123456789012
    QR CODE
    --------------------------------
    LOTTOLAB.TECH
    """
    
    company = company or {}
    agent = agent or {}
    branch = branch or {}
    
    # Company info
    company_name = company.get("name", "LOTTOLAB")
    company_phone = company.get("phone", "")
    company_address = company.get("address", "")
    company_logo_url = company.get("logo_url") or company.get("company_logo_url", "")
    qr_code_enabled = company.get("qr_code_enabled", True)
    ticket_header_text = company.get("ticket_header_text", "")
    ticket_footer_text = company.get("ticket_footer_text", "")
    thank_you_text = company.get("ticket_thank_you_text", f"MERCI DE JOUER AVEC<br>{company_name}")
    
    # Default legal text
    legal_text = company.get("ticket_legal_text", "")
    if not legal_text:
        legal_text = """Vérifiez votre ticket avant de vous déplacer.
Ce ticket doit être payé UNE SEULE FOIS
dans les 90 jours. Le PREMIER qui
présente ce ticket est le bénéficiaire.
Si le numéro est effacé, on NE PAIE PAS.
Protégez le ticket de la chaleur, humidité
et ne gardez pas dans les pièces de monnaie."""
    
    # Branch/Succursale
    branch_name = branch.get("name") or branch.get("nom_succursale") or ticket.get("succursale_name", "N/A")
    if branch_name == "N/A":
        branch_name = ticket.get("branch_name", "N/A")
    
    # Agent info
    agent_name = agent.get("name") or agent.get("full_name") or ticket.get("agent_name", "N/A")
    pos_id = agent.get("pos_serial_number") or ticket.get("pos_id") or "POS-WEB"
    
    # Ticket info
    ticket_id = ticket.get("ticket_id", "")
    ticket_code = ticket.get("ticket_code", ticket_id[:12].upper() if ticket_id else "")
    verification_code = ticket.get("verification_code", "")
    lottery_name = ticket.get("lottery_name", "N/A")
    draw_name = ticket.get("draw_name", "STANDARD")
    currency = ticket.get("currency", "HTG")
    total_amount = ticket.get("total_amount", 0)
    
    # Get real-time server time
    server_date, server_time = get_server_time_haiti()
    
    # Also get ticket creation time for reference
    ticket_date = server_date
    ticket_time = server_time
    if ticket.get("created_at"):
        ticket_date, ticket_time = format_datetime_haiti(ticket["created_at"])
    
    # Build plays rows
    plays_html = ""
    for play in ticket.get("plays", []):
        numbers = play.get("numbers", "N/A")
        amount = play.get("amount", 0)
        plays_html += f"""<div class="play-row"><span class="num">{numbers}</span><span class="amt">{amount} {currency}</span></div>"""
    
    if not plays_html:
        plays_html = '<div class="play-row"><span class="num">-</span><span class="amt">0 {}</span></div>'.format(currency)
    
    # Logo HTML (base64 or URL)
    logo_html = ""
    if company_logo_url:
        # If it's a relative URL, make it absolute
        if company_logo_url.startswith("/"):
            company_logo_url = f"{base_url}{company_logo_url}"
        logo_html = f'<img src="{company_logo_url}" class="logo" alt="Logo" onerror="this.style.display=\'none\'" />'
    
    # Contact info
    contact_html = ""
    if company_phone:
        contact_html += f'<div class="contact">Tel: {company_phone}</div>'
    if company_address:
        contact_html += f'<div class="contact">{company_address}</div>'
    
    # QR Code HTML
    qr_html = ""
    if qr_code_enabled and verification_code:
        qr_url = f"{base_url}/api/verify-ticket/{verification_code}"
        qr_base64 = generate_qr_code_base64(qr_url)
        if qr_base64:
            qr_html = f'<div class="qr-section"><img src="data:image/png;base64,{qr_base64}" class="qr-img" alt="QR" /></div>'
    
    # Auto print script
    auto_print_script = ""
    if auto_print:
        auto_print_script = '<script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>'
    
    # Generate HTML
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=80mm">
<title>Ticket {ticket_code}</title>
<style>
@page{{size:80mm auto;margin:0}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Courier New',Courier,monospace;font-size:11px;width:80mm;max-width:80mm;padding:2mm;background:#fff;color:#000;line-height:1.3}}
.sep{{text-align:center;letter-spacing:1px;margin:4px 0;font-size:10px}}
.header{{text-align:center;margin-bottom:4px}}
.logo{{max-width:50mm;max-height:15mm;margin:0 auto 4px;display:block;filter:grayscale(100%)}}
.company{{font-size:16px;font-weight:bold;letter-spacing:1px}}
.contact{{font-size:8px;margin:1px 0}}
.branch{{font-size:10px;margin-top:2px}}
.info-row{{display:flex;justify-content:space-between;font-size:10px;margin:2px 0}}
.info-row .lbl{{}}
.info-row .val{{font-weight:bold;text-align:right}}
.section-title{{text-align:center;font-weight:bold;font-size:10px;margin:4px 0;text-transform:uppercase}}
.lottery-box{{text-align:center;margin:4px 0;padding:4px 0;border-top:1px dashed #000;border-bottom:1px dashed #000}}
.lottery-name{{font-weight:bold;font-size:12px}}
.lottery-info{{font-size:9px;margin-top:2px}}
.play-row{{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}}
.play-row .num{{font-weight:bold;font-size:12px;letter-spacing:1px}}
.play-row .amt{{}}
.total-box{{text-align:center;padding:6px 0;margin:4px 0;border-top:2px solid #000;border-bottom:2px solid #000}}
.total-lbl{{font-size:10px;font-weight:bold}}
.total-amt{{font-size:18px;font-weight:bold;margin-top:2px}}
.status-box{{text-align:center;margin:6px 0}}
.status-badge{{display:inline-block;padding:4px 16px;border:2px solid #000;font-weight:bold;font-size:11px}}
.footer{{text-align:center;margin-top:6px;font-size:8px}}
.thank-you{{font-weight:bold;font-size:10px;margin:6px 0}}
.code-display{{font-family:monospace;font-size:10px;margin:4px 0;letter-spacing:1px}}
.qr-section{{text-align:center;margin:6px 0}}
.qr-img{{width:22mm;height:22mm}}
.legal{{font-size:7px;margin-top:4px;text-align:center;line-height:1.2}}
.watermark{{font-weight:bold;margin-top:6px;font-size:9px}}
@media print{{body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@page{{margin:0}}}}
</style>
</head>
<body>
<div class="sep">================================</div>

<div class="header">
{logo_html}
<div class="company">{company_name}</div>
{contact_html}
{f'<div class="branch">{ticket_header_text}</div>' if ticket_header_text else ''}
<div class="branch">Succursale: {branch_name}</div>
</div>

<div class="sep">--------------------------------</div>

<div class="info-row"><span class="lbl">VENDEUR :</span><span class="val">{agent_name.upper() if agent_name else 'N/A'}</span></div>
<div class="info-row"><span class="lbl">MACHINE :</span><span class="val">{pos_id}</span></div>
<div class="info-row"><span class="lbl">TICKET ID :</span><span class="val">{ticket_code}</span></div>

<div class="sep">--------------------------------</div>

<div class="lottery-box">
<div class="lottery-name">LOTERIE : {lottery_name}</div>
<div class="lottery-info">TIRAGE : {draw_name.upper() if draw_name else 'STANDARD'}</div>
<div class="lottery-info">DATE : {ticket_date}</div>
<div class="lottery-info">HEURE : {server_time} (Serveur)</div>
</div>

<div class="sep">--------------------------------</div>
<div class="section-title">NUMÉROS JOUÉS</div>
<div class="sep">--------------------------------</div>

{plays_html}

<div class="total-box">
<div class="total-lbl">TOTAL MISE :</div>
<div class="total-amt">{total_amount:,.0f} {currency}</div>
</div>

<div class="status-box">
<span class="status-badge">STATUT : VALIDÉ</span>
</div>

<div class="sep">--------------------------------</div>

<div class="footer">
<div class="thank-you">{thank_you_text}</div>
{f'<div style="margin-top:2px;">{ticket_footer_text}</div>' if ticket_footer_text else ''}
<div class="code-display">CODE : {verification_code if verification_code else ticket_code}</div>
{qr_html}
<div class="legal">{legal_text.replace(chr(10), '<br>')}</div>
<div class="sep">--------------------------------</div>
<div class="watermark">LOTTOLAB.TECH</div>
</div>

<div class="sep">================================</div>

{auto_print_script}
</body>
</html>"""
    
    return html
