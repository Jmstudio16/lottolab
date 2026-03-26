"""
LOTTOLAB - Professional 80mm Thermal Ticket Template
Unified template generator for both online and offline (sync) ticket printing
PRO FORMAT - Optimized for POS thermal printers
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
        qr = qrcode.QRCode(version=1, box_size=4, border=1)
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
    """Get current server time in Haiti timezone. Returns (date_str, time_str, time_12h)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        now_haiti = datetime.now(haiti_tz)
        date_str = now_haiti.strftime("%d/%m/%Y")
        time_str = now_haiti.strftime("%H:%M:%S")
        time_12h = now_haiti.strftime("%I:%M %p")
        return date_str, time_str, time_12h
    except Exception as e:
        logger.error(f"[TICKET] Time conversion failed: {e}")
        now = datetime.now(timezone.utc)
        return now.strftime("%d/%m/%Y"), now.strftime("%H:%M:%S"), now.strftime("%I:%M %p")


def format_datetime_haiti(iso_datetime: str) -> tuple:
    """Convert ISO datetime to Haiti timezone. Returns (date_str, time_str, time_12h)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        dt = datetime.fromisoformat(iso_datetime.replace("Z", "+00:00"))
        dt_local = dt.astimezone(haiti_tz)
        return dt_local.strftime("%d/%m/%Y"), dt_local.strftime("%H:%M:%S"), dt_local.strftime("%I:%M %p")
    except Exception as e:
        logger.error(f"[TICKET] Date format failed: {e}")
        return iso_datetime[:10] if len(iso_datetime) >= 10 else "N/A", "", ""


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
    PRO FORMAT with proper alignment for POS/Android printers.
    
    Format:
        █████████████████
        █   LOTTOLAB   █
        █████████████████

        LOTO PAM CENTER
      "JOUER POU GENYEN"
        Tel: +509XXXXXXXX
        Pétion-Ville
    ================================
    VENDEUR    : Jean Pierre
    SUCCURSALE : Delmas 33
    POS        : POS-1023
    TICKET ID  : 3PQ4XD7LRPQK
    --------------------------------
    LOTERIE : IL Pick 3 Evening
    TIRAGE  : SOIR
    DATE    : 24/03/2026
    HEURE   : 08:59 PM
    --------------------------------
         NUMÉROS JOUÉS
    --------------------------------
    45                         10 HTG
    --------------------------------
    TOTAL MISE :            10 HTG
    ================================
        [ STATUT : VALIDÉ ]
    ================================
    CODE : A9X7-23F8-PLK9
          [QR CODE]
    ================================
    MERCI DE JOUER AVEC
    LOTO PAM CENTER
    --------------------------------
    ⚠ Vérifiez votre ticket
    ⚠ Valable UNE SEULE FOIS
    ⚠ Valide 90 jours
    --------------------------------
        LOTTOLAB.TECH
    ================================
    """
    
    company = company or {}
    agent = agent or {}
    branch = branch or {}
    
    # Company info
    company_name = company.get("name", "LOTTOLAB")
    company_slogan = company.get("slogan", "JOUER POU GENYEN")
    company_phone = company.get("phone", "")
    company_address = company.get("address", "")
    company_logo_url = company.get("logo_url") or company.get("company_logo_url", "")
    qr_code_enabled = company.get("qr_code_enabled", True)
    ticket_header_text = company.get("ticket_header_text", "")
    ticket_footer_text = company.get("ticket_footer_text", "")
    thank_you_text = company.get("ticket_thank_you_text", f"MERCI DE JOUER AVEC<br><b>{company_name}</b>")
    
    # Default legal text - short version for thermal
    legal_text = company.get("ticket_legal_text", "")
    if not legal_text:
        legal_text = """⚠ Vérifiez votre ticket
⚠ Valable UNE SEULE FOIS
⚠ Valide 90 jours
⚠ Ticket = preuve unique"""
    
    # Branch/Succursale - NEVER show N/A
    branch_name = branch.get("name") or branch.get("nom_succursale") or ticket.get("succursale_name") or ticket.get("branch_name")
    if not branch_name or branch_name == "N/A":
        branch_name = company.get("default_branch", "PRINCIPAL")
    
    # Agent info - NEVER show N/A
    agent_name = agent.get("name") or agent.get("full_name") or ticket.get("agent_name")
    if not agent_name or agent_name == "N/A":
        agent_name = "VENDEUR"
    
    # POS ID
    pos_id = agent.get("pos_serial_number") or ticket.get("pos_id") or ticket.get("machine_id") or "POS-WEB"
    
    # Ticket info
    ticket_id = ticket.get("ticket_id", "")
    ticket_code = ticket.get("ticket_code", ticket_id[:12].upper() if ticket_id else "XXXXXX")
    verification_code = ticket.get("verification_code", "")
    
    # Format verification code nicely (XXXX-XXXX-XXXX)
    display_code = verification_code if verification_code else ticket_code
    if len(display_code) >= 12 and '-' not in display_code:
        display_code = f"{display_code[:4]}-{display_code[4:8]}-{display_code[8:12]}"
    
    lottery_name = ticket.get("lottery_name", "LOTERIE")
    draw_name = ticket.get("draw_name", "STANDARD")
    currency = ticket.get("currency", "HTG")
    total_amount = ticket.get("total_amount", 0)
    
    # Get real-time server time
    server_date, server_time, server_time_12h = get_server_time_haiti()
    
    # Also get ticket creation time for reference
    ticket_date = server_date
    ticket_time_12h = server_time_12h
    if ticket.get("created_at"):
        ticket_date, _, ticket_time_12h = format_datetime_haiti(ticket["created_at"])
    
    # Build plays rows with bet type
    plays_html = ""
    for play in ticket.get("plays", []):
        numbers = play.get("numbers", "-")
        bet_type = play.get("bet_type", "")
        amount = play.get("amount", 0)
        # Format bet type display
        bet_display = ""
        if bet_type:
            type_map = {
                "BORLETTE": "Borl.",
                "LOTO3": "L3",
                "LOTO4": "L4",
                "LOTO5": "L5",
                "MARIAGE": "Mar.",
                "MARIAGE_GRATIS": "🎁 Mar.",
            }
            bet_display = type_map.get(bet_type.upper(), bet_type[:4])
        
        plays_html += f"""<div class="play-row">
<span class="num">{numbers}</span>
<span class="type">{bet_display}</span>
<span class="amt">{amount} {currency}</span>
</div>"""
    
    if not plays_html:
        plays_html = '<div class="play-row"><span class="num">-</span><span class="type"></span><span class="amt">0 HTG</span></div>'
    
    # Logo HTML - with fallback text logo
    logo_html = ""
    if company_logo_url:
        if company_logo_url.startswith("/"):
            company_logo_url = f"{base_url}{company_logo_url}"
        logo_html = f'''<div class="logo-container">
<img src="{company_logo_url}" class="logo" alt="Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
<div class="logo-text-fallback" style="display:none;">
<div class="logo-box">
<span class="logo-letter">L</span>
</div>
</div>
</div>'''
    else:
        # Text-based logo fallback
        logo_html = f'''<div class="logo-container">
<div class="logo-text-box">
█████████████████<br>
█  <b>{company_name[:7].upper()}</b>  █<br>
█████████████████
</div>
</div>'''
    
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
        auto_print_script = '<script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>'
    
    # Generate HTML - PRO FORMAT
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=80mm,initial-scale=1">
<title>Ticket {ticket_code}</title>
<style>
@page{{size:80mm auto;margin:0}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{
font-family:'Courier New',Courier,monospace;
font-size:12px;
width:80mm;
max-width:80mm;
padding:3mm;
background:#fff;
color:#000;
line-height:1.4;
-webkit-font-smoothing:antialiased;
}}
.sep{{text-align:center;letter-spacing:0;margin:4px 0;font-size:10px;font-weight:bold}}
.sep-double{{border-top:3px double #000;margin:6px 0}}
.sep-dashed{{border-top:1px dashed #000;margin:4px 0}}

/* Logo Section */
.logo-container{{text-align:center;margin-bottom:4px}}
.logo{{max-width:45mm;max-height:18mm;margin:0 auto;display:block;filter:grayscale(100%) contrast(1.2)}}
.logo-text-box{{font-size:9px;letter-spacing:0;white-space:pre}}
.logo-box{{display:inline-block;padding:4px 8px;border:2px solid #000}}
.logo-letter{{font-size:24px;font-weight:bold}}

/* Header */
.header{{text-align:center;margin-bottom:6px}}
.company-name{{font-size:18px;font-weight:bold;letter-spacing:1px;margin:4px 0}}
.slogan{{font-size:10px;font-style:italic;margin:2px 0}}
.contact{{font-size:9px;margin:1px 0}}

/* Info Rows - Fixed width alignment */
.info-section{{margin:4px 0}}
.info-row{{
display:flex;
justify-content:space-between;
font-size:11px;
margin:2px 0;
}}
.info-row .lbl{{min-width:85px}}
.info-row .val{{font-weight:bold;text-align:right;flex:1}}

/* Lottery Box */
.lottery-box{{
text-align:center;
margin:6px 0;
padding:6px 0;
background:#f5f5f5;
}}
.lottery-name{{font-weight:bold;font-size:13px}}
.lottery-info{{font-size:10px;margin-top:2px}}

/* Plays Section */
.section-title{{
text-align:center;
font-weight:bold;
font-size:11px;
margin:6px 0 4px 0;
text-transform:uppercase;
letter-spacing:1px;
}}
.plays-container{{margin:4px 0}}
.play-row{{
display:flex;
justify-content:space-between;
align-items:center;
padding:4px 0;
border-bottom:1px dotted #ccc;
}}
.play-row:last-child{{border-bottom:none}}
.play-row .num{{font-weight:bold;font-size:14px;letter-spacing:2px;min-width:50px}}
.play-row .type{{font-size:9px;color:#555;flex:1;text-align:center}}
.play-row .amt{{font-size:12px;text-align:right;min-width:60px}}

/* Total Box */
.total-box{{
text-align:center;
padding:8px;
margin:6px 0;
border:3px double #000;
background:#f8f8f8;
}}
.total-lbl{{font-size:11px;font-weight:bold}}
.total-amt{{font-size:22px;font-weight:bold;margin-top:2px}}

/* Status */
.status-box{{text-align:center;margin:8px 0}}
.status-badge{{
display:inline-block;
padding:6px 20px;
border:3px solid #000;
font-weight:bold;
font-size:12px;
letter-spacing:1px;
background:#fff;
}}

/* Footer */
.footer{{text-align:center;margin-top:6px;font-size:9px}}
.thank-you{{font-weight:bold;font-size:11px;margin:8px 0}}
.code-section{{margin:6px 0}}
.code-label{{font-size:9px;color:#555}}
.code-display{{
font-family:monospace;
font-size:14px;
font-weight:bold;
letter-spacing:2px;
margin:4px 0;
}}
.qr-section{{text-align:center;margin:8px 0}}
.qr-img{{width:28mm;height:28mm}}
.legal{{font-size:8px;margin:6px 0;line-height:1.3;text-align:left;padding:0 4px}}
.watermark{{
font-weight:bold;
font-size:10px;
margin-top:8px;
letter-spacing:2px;
}}

/* Print Optimizations */
@media print{{
body{{
-webkit-print-color-adjust:exact;
print-color-adjust:exact;
}}
@page{{margin:0}}
.no-print{{display:none!important}}
}}
</style>
</head>
<body>
<div class="sep">================================</div>

{logo_html}

<div class="header">
<div class="company-name">{company_name}</div>
{f'<div class="slogan">"{company_slogan}"</div>' if company_slogan else ''}
{f'<div class="contact">Tel: {company_phone}</div>' if company_phone else ''}
{f'<div class="contact">{company_address}</div>' if company_address else ''}
{f'<div class="contact">{ticket_header_text}</div>' if ticket_header_text else ''}
</div>

<div class="sep">================================</div>

<div class="info-section">
<div class="info-row"><span class="lbl">VENDEUR</span><span class="val">: {agent_name.upper()}</span></div>
<div class="info-row"><span class="lbl">SUCCURSALE</span><span class="val">: {branch_name.upper()}</span></div>
<div class="info-row"><span class="lbl">POS</span><span class="val">: {pos_id}</span></div>
<div class="info-row"><span class="lbl">TICKET ID</span><span class="val">: {ticket_code}</span></div>
</div>

<div class="sep-dashed"></div>

<div class="lottery-box">
<div class="lottery-name">LOTERIE : {lottery_name}</div>
<div class="lottery-info">TIRAGE : {draw_name.upper() if draw_name else 'STANDARD'}</div>
<div class="lottery-info">DATE : {ticket_date} | HEURE : {ticket_time_12h}</div>
</div>

<div class="sep-dashed"></div>
<div class="section-title">NUMÉROS JOUÉS</div>
<div class="sep-dashed"></div>

<div class="plays-container">
{plays_html}
</div>

<div class="total-box">
<div class="total-lbl">TOTAL MISE :</div>
<div class="total-amt">{total_amount:,.0f} {currency}</div>
</div>

<div class="status-box">
<span class="status-badge">STATUT : VALIDÉ ✓</span>
</div>

<div class="sep">================================</div>

<div class="footer">
<div class="code-section">
<div class="code-label">CODE DE VÉRIFICATION</div>
<div class="code-display">{display_code}</div>
</div>

{qr_html}

<div class="thank-you">{thank_you_text}</div>

{f'<div style="margin:4px 0;">{ticket_footer_text}</div>' if ticket_footer_text else ''}

<div class="sep-dashed"></div>

<div class="legal">{legal_text.replace(chr(10), '<br>')}</div>

<div class="sep-dashed"></div>

<div class="watermark">LOTTOLAB.TECH</div>
</div>

<div class="sep">================================</div>

{auto_print_script}
</body>
</html>"""
    
    return html
