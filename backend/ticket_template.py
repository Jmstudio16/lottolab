"""
LOTTOLAB - Professional 80mm Thermal Ticket Template
EXACT FORMAT as specified - Logo centered, professional alignment
Optimized for POS/Android thermal printers
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
    """Get current server time in Haiti timezone. Returns (date_str, time_12h)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        now_haiti = datetime.now(haiti_tz)
        date_str = now_haiti.strftime("%d/%m/%Y")
        time_12h = now_haiti.strftime("%I:%M %p")
        return date_str, time_12h
    except Exception as e:
        logger.error(f"[TICKET] Time conversion failed: {e}")
        now = datetime.now(timezone.utc)
        return now.strftime("%d/%m/%Y"), now.strftime("%I:%M %p")


def format_datetime_haiti(iso_datetime: str) -> tuple:
    """Convert ISO datetime to Haiti timezone. Returns (date_str, time_12h)"""
    try:
        haiti_tz = pytz.timezone("America/Port-au-Prince")
        dt = datetime.fromisoformat(iso_datetime.replace("Z", "+00:00"))
        dt_local = dt.astimezone(haiti_tz)
        return dt_local.strftime("%d/%m/%Y"), dt_local.strftime("%I:%M %p")
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
    EXACT FORMAT matching user specification with configurable font sizes.
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
    
    # Font size configuration (small, normal, large)
    font_size_config = company.get("ticket_font_size", "normal")
    font_sizes = {
        "small": {"base": 10, "title": 14, "numbers": 11, "total": 16},
        "normal": {"base": 12, "title": 16, "numbers": 13, "total": 18},
        "large": {"base": 14, "title": 18, "numbers": 15, "total": 22}
    }
    fs = font_sizes.get(font_size_config, font_sizes["normal"])
    
    # Legal text
    legal_text = company.get("ticket_legal_text", "")
    if not legal_text:
        legal_text = """Vérifiez votre ticket avant de vous déplacer.
Ce ticket doit être payé UNE SEULE FOIS
dans les 90 jours. Le PREMIER qui
présente ce ticket est le bénéficiaire.
Si le numéro est effacé, on ne paie pas.
Protégez le ticket de la chaleur, humidité
et ne gardez pas dans les pièces de monnaie."""
    
    # Thank you text
    thank_you_text = company.get("ticket_thank_you_text", "")
    if not thank_you_text:
        thank_you_text = "MERCI POUR VOTRE CONFIANCE"
    
    # Branch/Succursale - NEVER show N/A
    branch_name = branch.get("name") or branch.get("nom_succursale") or ticket.get("succursale_name") or ticket.get("branch_name")
    if not branch_name or branch_name == "N/A":
        branch_name = company.get("default_branch", "Principal")
    
    # Agent info - NEVER show N/A
    agent_name = agent.get("name") or agent.get("full_name") or ticket.get("agent_name")
    if not agent_name or agent_name == "N/A":
        agent_name = "Vendeur"
    
    # POS ID - NEVER show MACHINE TEST
    pos_id = agent.get("pos_serial_number") or ticket.get("pos_id") or ticket.get("machine_id")
    if not pos_id or pos_id == "MACHINE TEST" or pos_id == "N/A":
        pos_id = f"POS-{ticket.get('ticket_id', 'WEB')[-4:].upper()}"
    
    # Ticket info
    ticket_id = ticket.get("ticket_id", "")
    ticket_code = ticket.get("ticket_code", ticket_id[:12].upper() if ticket_id else "XXXXXX")
    verification_code = ticket.get("verification_code", "")
    
    # Format verification code (XXXX-XXXX-XXXX)
    display_code = verification_code if verification_code else ticket_code
    if len(display_code) >= 12 and '-' not in display_code:
        display_code = f"{display_code[:4]}-{display_code[4:8]}-{display_code[8:12]}"
    
    lottery_name = ticket.get("lottery_name", "LOTERIE")
    draw_name = ticket.get("draw_name", "Standard")
    currency = ticket.get("currency", "HTG")
    total_amount = ticket.get("total_amount", 0)
    
    # Get time
    server_date, server_time_12h = get_server_time_haiti()
    ticket_date = server_date
    ticket_time = server_time_12h
    if ticket.get("created_at"):
        ticket_date, ticket_time = format_datetime_haiti(ticket["created_at"])
    
    # Build plays rows - simple aligned format
    plays_html = ""
    for play in ticket.get("plays", []):
        numbers = play.get("numbers", "-")
        amount = play.get("amount", 0)
        # Format: "45                        10.0 HTG"
        plays_html += f'<div class="play-line"><span class="play-num">{numbers}</span><span class="play-amt">{amount:.1f} {currency}</span></div>\n'
    
    if not plays_html:
        plays_html = f'<div class="play-line"><span class="play-num">-</span><span class="play-amt">0.0 {currency}</span></div>'
    
    # Logo HTML - centered, only if exists
    logo_html = ""
    if company_logo_url:
        if company_logo_url.startswith("/"):
            company_logo_url = f"{base_url}{company_logo_url}"
        logo_html = f'''<div class="logo-section">
<img src="{company_logo_url}" class="logo-img" alt="Logo" onerror="this.parentElement.style.display='none'" />
</div>'''
    
    # QR Code HTML
    qr_html = ""
    if qr_code_enabled and verification_code:
        qr_url = f"{base_url}/api/verify-ticket/{verification_code}"
        qr_base64 = generate_qr_code_base64(qr_url)
        if qr_base64:
            qr_html = f'''<div class="qr-section">
<div class="code-text">CODE : {display_code}</div>
<img src="data:image/png;base64,{qr_base64}" class="qr-img" alt="QR" />
</div>'''
        else:
            qr_html = f'<div class="code-text">CODE : {display_code}</div>'
    else:
        qr_html = f'<div class="code-text">CODE : {display_code}</div>'
    
    # Auto print script
    auto_print_script = ""
    if auto_print:
        auto_print_script = '<script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>'
    
    # Generate HTML - EXACT FORMAT with configurable font sizes
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
font-size:{fs['base']}px;
width:80mm;
max-width:80mm;
padding:3mm;
background:#fff;
color:#000;
line-height:1.4;
}}

/* Separators */
.sep-double{{text-align:center;font-size:{fs['base']}px;margin:6px 0;letter-spacing:0}}
.sep-single{{text-align:center;font-size:{fs['base']}px;margin:4px 0;letter-spacing:0}}

/* Logo Section */
.logo-section{{text-align:center;margin-bottom:6px}}
.logo-img{{
max-width:50mm;
max-height:20mm;
margin:0 auto;
display:block;
filter:grayscale(100%) contrast(1.3);
}}

/* Header - Company Info */
.header{{text-align:center;margin-bottom:4px}}
.company-name{{font-size:{fs['title']}px;font-weight:bold;letter-spacing:1px}}
.company-phone{{font-size:{fs['base']}px;margin:2px 0}}
.company-address{{font-size:{fs['base']}px;margin:2px 0}}
.company-slogan{{font-size:{fs['base'] - 1}px;font-style:italic;margin:4px 0}}

/* Info Section */
.info-section{{margin:6px 0}}
.info-line{{font-size:{fs['base']}px;margin:3px 0}}
.info-row{{display:flex;justify-content:space-between}}
.info-label{{}}
.info-value{{font-weight:bold}}

/* Lottery Info */
.lottery-section{{margin:6px 0}}
.lottery-line{{font-size:{fs['base']}px;margin:2px 0}}

/* Numbers Section */
.numbers-title{{text-align:center;font-weight:bold;font-size:{fs['base']}px;margin:8px 0 4px 0}}
.play-line{{
display:flex;
justify-content:space-between;
margin:4px 0;
padding:2px 0;
}}
.play-num{{font-weight:bold;font-size:{fs['numbers']}px;letter-spacing:1px}}
.play-amt{{font-size:{fs['base']}px}}

/* Total */
.total-section{{text-align:center;margin:10px 0;padding:4px 0}}
.total-text{{font-size:{fs['total']}px;font-weight:bold}}

/* Status */
.status-section{{text-align:center;margin:10px 0}}
.status-box{{
display:inline-block;
padding:6px 16px;
border:2px solid #000;
font-weight:bold;
font-size:{fs['base']}px;
}}

/* Footer */
.thank-you{{text-align:center;font-weight:bold;font-size:{fs['base']}px;margin:10px 0}}
.legal-text{{font-size:{fs['base'] - 2}px;line-height:1.3;margin:6px 0;text-align:center}}
.qr-section{{text-align:center;margin:8px 0}}
.qr-img{{width:26mm;height:26mm;margin:4px auto}}
.code-text{{font-family:monospace;font-size:{fs['base']}px;letter-spacing:1px;margin:4px 0}}
.watermark{{text-align:center;font-weight:bold;font-size:{fs['base']}px;margin:8px 0;letter-spacing:2px}}

@media print{{
body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@page{{margin:0}}
}}
</style>
</head>
<body>

{logo_html}

<div class="header">
<div class="company-name">{company_name}</div>
{f'<div class="company-phone">Tél: {company_phone}</div>' if company_phone else ''}
{f'<div class="company-address">{company_address}</div>' if company_address else ''}
{f'<div class="company-slogan">{company_slogan}</div>' if company_slogan else ''}
</div>

<div class="sep-double">================================</div>

<div class="info-section">
<div class="info-row">
<span>VENDEUR : {agent_name}</span>
<span>POS : {pos_id}</span>
</div>
<div class="info-line">SUCCURSALE : {branch_name}</div>
<div class="info-line">TICKET : {ticket_code}</div>
</div>

<div class="sep-single">--------------------------------</div>

<div class="lottery-section">
<div class="lottery-line">LOTERIE : {lottery_name}</div>
<div class="lottery-line">TIRAGE  : {draw_name}</div>
<div class="lottery-line">DATE    : {ticket_date}</div>
<div class="lottery-line">HEURE   : {ticket_time}</div>
</div>

<div class="sep-single">--------------------------------</div>

<div class="numbers-title">NUMÉROS JOUÉS</div>

{plays_html}

<div class="sep-single">--------------------------------</div>

<div class="total-section">
<div class="total-text">TOTAL MISE : {total_amount:,.0f} {currency}</div>
</div>

<div class="sep-double">================================</div>

<div class="status-section">
<span class="status-box">STATUT : VALIDÉ</span>
</div>

<div class="sep-single">--------------------------------</div>

<div class="thank-you">
{thank_you_text}<br>
{company_name}
</div>

<div class="sep-single">--------------------------------</div>

<div class="legal-text">
{legal_text.replace(chr(10), '<br>')}
</div>

<div class="sep-single">--------------------------------</div>

{qr_html}

<div class="watermark">LOTTOLAB.TECH</div>

<div class="sep-double">================================</div>

{auto_print_script}
</body>
</html>"""
    
    return html
