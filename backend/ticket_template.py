"""
LOTTOLAB - Professional 80mm Thermal Ticket Template
ULTRA PRO with Smart Pagination for long tickets
Optimized for POS/Android thermal printers (80mm and 58mm)
"""

from datetime import datetime, timezone
import pytz
import qrcode
import io
import base64
import logging
import math

logger = logging.getLogger(__name__)

# Constants for pagination
MAX_PLAYS_PER_PAGE = 15  # Maximum plays before splitting
COMPACT_THRESHOLD = 20   # Use compact mode if plays exceed this


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
    base_url: str = "https://lottolab.tech",
    page_number: int = None,
    total_pages: int = None,
    plays_subset: list = None
) -> str:
    """
    Generate professional 80mm thermal ticket HTML.
    Supports smart pagination for long tickets.
    
    Args:
        ticket: Ticket data
        company: Company data
        agent: Agent/vendeur data
        branch: Branch/succursale data
        auto_print: Whether to auto-print on load
        base_url: Base URL for QR code verification
        page_number: Current page (1-indexed) for multi-page tickets
        total_pages: Total pages for multi-page tickets
        plays_subset: Subset of plays for this page (for pagination)
    """
    
    company = company or {}
    agent = agent or {}
    branch = branch or {}
    
    # Company info
    company_name = company.get("name", "LOTTOLAB")
    company_slogan = company.get("slogan", "JOUER POU GENYEN")
    company_phone = company.get("phone", "")
    company_address = company.get("address", "")
    
    # Logo URL - Priority: company_logo_url > logo_url > logo_storage_path
    # This ensures company's own logo is always used if available
    company_logo_url = None
    
    # First check logo_storage_path (Object Storage - new system)
    if company.get("logo_storage_path"):
        company_logo_url = f"/api/files/{company.get('logo_storage_path')}"
    # Then check company_logo_url (may be old format or new format)
    elif company.get("company_logo_url"):
        url = company.get("company_logo_url")
        # Skip if it's a system logo URL
        if not url.startswith("http") and not "lottolab-logo" in url.lower():
            company_logo_url = url
    # Then check logo_url
    elif company.get("logo_url"):
        url = company.get("logo_url")
        # Skip if it's a system logo URL (starts with http and contains lottolab)
        if not (url.startswith("http") and "lottolab" in url.lower()):
            company_logo_url = url
    
    qr_code_enabled = company.get("qr_code_enabled", True)
    
    # Font size configuration (small, normal, large)
    font_size_config = company.get("ticket_font_size", "normal")
    paper_width = company.get("paper_width", "80mm")
    
    # Determine if we should use compact mode
    all_plays = plays_subset if plays_subset is not None else ticket.get("plays", [])
    use_compact = len(all_plays) > COMPACT_THRESHOLD
    
    # Adjust font sizes based on paper width and compact mode
    if paper_width == "58mm":
        font_sizes = {
            "small": {"base": 8, "title": 11, "numbers": 9, "total": 13},
            "normal": {"base": 9, "title": 12, "numbers": 10, "total": 14},
            "large": {"base": 10, "title": 14, "numbers": 11, "total": 16}
        }
    else:
        font_sizes = {
            "small": {"base": 10, "title": 14, "numbers": 11, "total": 16},
            "normal": {"base": 12, "title": 16, "numbers": 13, "total": 18},
            "large": {"base": 14, "title": 18, "numbers": 15, "total": 22}
        }
    
    # Use smaller fonts in compact mode
    if use_compact:
        fs = font_sizes.get("small", font_sizes["normal"])
    else:
        fs = font_sizes.get(font_size_config, font_sizes["normal"])
    
    # Paper width value
    paper_px = "80mm" if paper_width == "80mm" else "58mm"
    
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
    
    # Build plays rows - with compact mode support
    plays_html = ""
    line_margin = "2px" if use_compact else "4px"
    
    for play in all_plays:
        numbers = play.get("numbers", "-")
        amount = play.get("amount", 0)
        bet_type = play.get("bet_type", "")
        
        # In compact mode, show bet type abbreviation
        if use_compact and bet_type:
            type_abbr = bet_type[:3].upper()
            plays_html += f'<div class="play-line" style="margin:{line_margin} 0"><span class="play-num">{numbers}</span><span class="play-type">{type_abbr}</span><span class="play-amt">{amount:.0f}</span></div>\n'
        else:
            plays_html += f'<div class="play-line" style="margin:{line_margin} 0"><span class="play-num">{numbers}</span><span class="play-amt">{amount:.1f} {currency}</span></div>\n'
    
    if not plays_html:
        plays_html = f'<div class="play-line"><span class="play-num">-</span><span class="play-amt">0.0 {currency}</span></div>'
    
    # Calculate subtotal for this page if paginated
    if plays_subset is not None:
        page_subtotal = sum(p.get("amount", 0) for p in plays_subset)
        subtotal_html = f'<div class="subtotal">Sous-total page: {page_subtotal:.0f} {currency}</div>'
    else:
        subtotal_html = ""
    
    # Pagination indicator
    pagination_html = ""
    if page_number is not None and total_pages is not None and total_pages > 1:
        pagination_html = f'''<div class="pagination-indicator">
<span class="page-badge">PAGE {page_number} / {total_pages}</span>
</div>'''
    
    # Logo HTML - centered, only if exists
    logo_html = ""
    if company_logo_url:
        if company_logo_url.startswith("/"):
            company_logo_url = f"{base_url}{company_logo_url}"
        logo_html = f'''<div class="logo-section">
<img src="{company_logo_url}" class="logo-img" alt="Logo" onerror="this.parentElement.style.display='none'" />
</div>'''
    
    # QR Code HTML - only on last page or single page
    qr_html = ""
    show_qr = qr_code_enabled and verification_code
    if total_pages and page_number and page_number < total_pages:
        show_qr = False  # Don't show QR on intermediate pages
    
    if show_qr:
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
    
    # Footer elements - only on last page for multi-page tickets
    show_footer = True
    if total_pages and page_number and page_number < total_pages:
        show_footer = False
    
    footer_html = ""
    if show_footer:
        footer_html = f'''
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
'''
    else:
        footer_html = f'''
<div class="continue-notice">
<span>SUITE SUR PAGE {page_number + 1}</span>
</div>
'''
    
    # Auto print script
    auto_print_script = ""
    if auto_print:
        auto_print_script = '<script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>'
    
    # Generate HTML - EXACT FORMAT with configurable font sizes
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width={paper_px},initial-scale=1">
<title>Ticket {ticket_code}{f' - Page {page_number}' if page_number else ''}</title>
<style>
@page{{size:{paper_px} auto;margin:0}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{
font-family:'Courier New',Courier,monospace;
font-size:{fs['base']}px;
width:{paper_px};
max-width:{paper_px};
padding:3mm;
background:#fff;
color:#000;
line-height:1.3;
}}

/* Separators */
.sep-double{{text-align:center;font-size:{fs['base']}px;margin:{'4px' if use_compact else '6px'} 0;letter-spacing:0}}
.sep-single{{text-align:center;font-size:{fs['base']}px;margin:{'2px' if use_compact else '4px'} 0;letter-spacing:0}}

/* Logo Section */
.logo-section{{text-align:center;margin-bottom:{'3px' if use_compact else '6px'}}}
.logo-img{{
max-width:{'40mm' if paper_width == '58mm' else '50mm'};
max-height:{'15mm' if use_compact else '20mm'};
margin:0 auto;
display:block;
filter:grayscale(100%) contrast(1.3);
}}

/* Header - Company Info */
.header{{text-align:center;margin-bottom:{'2px' if use_compact else '4px'}}}
.company-name{{font-size:{fs['title']}px;font-weight:bold;letter-spacing:1px}}
.company-phone{{font-size:{fs['base']}px;margin:{'1px' if use_compact else '2px'} 0}}
.company-address{{font-size:{fs['base']}px;margin:{'1px' if use_compact else '2px'} 0}}
.company-slogan{{font-size:{fs['base'] - 1}px;font-style:italic;margin:{'2px' if use_compact else '4px'} 0}}

/* Pagination Indicator */
.pagination-indicator{{
text-align:center;
margin:4px 0;
}}
.page-badge{{
display:inline-block;
background:#000;
color:#fff;
padding:2px 10px;
font-weight:bold;
font-size:{fs['base']}px;
}}

/* Info Section */
.info-section{{margin:{'3px' if use_compact else '6px'} 0}}
.info-line{{font-size:{fs['base']}px;margin:{'1px' if use_compact else '3px'} 0}}
.info-row{{display:flex;justify-content:space-between}}
.info-label{{}}
.info-value{{font-weight:bold}}

/* Lottery Info */
.lottery-section{{margin:{'3px' if use_compact else '6px'} 0}}
.lottery-line{{font-size:{fs['base']}px;margin:{'1px' if use_compact else '2px'} 0}}

/* Numbers Section */
.numbers-title{{text-align:center;font-weight:bold;font-size:{fs['base']}px;margin:{'4px' if use_compact else '8px'} 0 {'2px' if use_compact else '4px'} 0}}
.play-line{{
display:flex;
justify-content:space-between;
align-items:center;
padding:{'1px' if use_compact else '2px'} 0;
}}
.play-num{{font-weight:bold;font-size:{fs['numbers']}px;letter-spacing:1px}}
.play-type{{font-size:{fs['base'] - 2}px;color:#666}}
.play-amt{{font-size:{fs['base']}px}}

/* Subtotal for pages */
.subtotal{{
text-align:right;
font-size:{fs['base']}px;
margin-top:4px;
padding-top:2px;
border-top:1px dashed #000;
}}

/* Total */
.total-section{{text-align:center;margin:{'6px' if use_compact else '10px'} 0;padding:{'2px' if use_compact else '4px'} 0}}
.total-text{{font-size:{fs['total']}px;font-weight:bold}}

/* Status */
.status-section{{text-align:center;margin:{'6px' if use_compact else '10px'} 0}}
.status-box{{
display:inline-block;
padding:{'4px 12px' if use_compact else '6px 16px'};
border:2px solid #000;
font-weight:bold;
font-size:{fs['base']}px;
}}

/* Continue Notice */
.continue-notice{{
text-align:center;
margin:10px 0;
padding:6px;
border:2px dashed #000;
font-weight:bold;
font-size:{fs['base'] + 2}px;
}}

/* Footer */
.thank-you{{text-align:center;font-weight:bold;font-size:{fs['base']}px;margin:{'6px' if use_compact else '10px'} 0}}
.legal-text{{font-size:{fs['base'] - 2}px;line-height:1.2;margin:{'4px' if use_compact else '6px'} 0;text-align:center}}
.qr-section{{text-align:center;margin:{'4px' if use_compact else '8px'} 0}}
.qr-img{{width:{'20mm' if use_compact else '26mm'};height:{'20mm' if use_compact else '26mm'};margin:{'2px' if use_compact else '4px'} auto}}
.code-text{{font-family:monospace;font-size:{fs['base']}px;letter-spacing:1px;margin:{'2px' if use_compact else '4px'} 0}}
.watermark{{text-align:center;font-weight:bold;font-size:{fs['base']}px;margin:{'4px' if use_compact else '8px'} 0;letter-spacing:2px}}

@media print{{
body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@page{{margin:0}}
}}
</style>
</head>
<body>

{logo_html}

{pagination_html}

<div class="header">
<div class="company-name">{company_name}</div>
{f'<div class="company-phone">Tél: {company_phone}</div>' if company_phone else ''}
{f'<div class="company-address">{company_address}</div>' if company_address else ''}
{f'<div class="company-slogan">{company_slogan}</div>' if company_slogan and not use_compact else ''}
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

{subtotal_html}

<div class="sep-single">--------------------------------</div>

<div class="total-section">
<div class="total-text">TOTAL MISE : {total_amount:,.0f} {currency}</div>
</div>

<div class="sep-double">================================</div>

<div class="status-section">
<span class="status-box">STATUT : VALIDÉ</span>
</div>

<div class="sep-single">--------------------------------</div>

{footer_html}

<div class="sep-double">================================</div>

{auto_print_script}
</body>
</html>"""
    
    return html


def generate_paginated_tickets(
    ticket: dict,
    company: dict = None,
    agent: dict = None,
    branch: dict = None,
    auto_print: bool = False,
    base_url: str = "https://lottolab.tech",
    max_plays_per_page: int = MAX_PLAYS_PER_PAGE
) -> list:
    """
    Generate multiple ticket pages if the ticket has too many plays.
    Returns a list of HTML strings, one for each page.
    
    Args:
        ticket: Ticket data
        company: Company data
        agent: Agent/vendeur data
        branch: Branch/succursale data
        auto_print: Whether to auto-print on load
        base_url: Base URL for QR code
        max_plays_per_page: Maximum plays per page before splitting
    
    Returns:
        List of HTML strings for each page
    """
    plays = ticket.get("plays", [])
    total_plays = len(plays)
    
    # If plays fit on one page, return single ticket
    if total_plays <= max_plays_per_page:
        return [generate_ticket_html(
            ticket=ticket,
            company=company,
            agent=agent,
            branch=branch,
            auto_print=auto_print,
            base_url=base_url
        )]
    
    # Calculate number of pages needed
    total_pages = math.ceil(total_plays / max_plays_per_page)
    pages = []
    
    for page_num in range(total_pages):
        start_idx = page_num * max_plays_per_page
        end_idx = min(start_idx + max_plays_per_page, total_plays)
        plays_subset = plays[start_idx:end_idx]
        
        page_html = generate_ticket_html(
            ticket=ticket,
            company=company,
            agent=agent,
            branch=branch,
            auto_print=auto_print and page_num == 0,  # Only auto-print first page
            base_url=base_url,
            page_number=page_num + 1,
            total_pages=total_pages,
            plays_subset=plays_subset
        )
        pages.append(page_html)
    
    return pages


def generate_combined_paginated_html(
    ticket: dict,
    company: dict = None,
    agent: dict = None,
    branch: dict = None,
    auto_print: bool = False,
    base_url: str = "https://lottolab.tech"
) -> str:
    """
    Generate a single HTML with page breaks for printing multiple pages.
    This is useful for browser print which can handle page breaks.
    """
    pages = generate_paginated_tickets(
        ticket=ticket,
        company=company,
        agent=agent,
        branch=branch,
        auto_print=auto_print,
        base_url=base_url
    )
    
    if len(pages) == 1:
        return pages[0]
    
    # Combine pages with page breaks
    combined_content = ""
    for i, page_html in enumerate(pages):
        # Extract body content
        body_start = page_html.find('<body>')
        body_end = page_html.find('</body>')
        if body_start != -1 and body_end != -1:
            body_content = page_html[body_start + 6:body_end]
            if i > 0:
                combined_content += '<div style="page-break-before: always;"></div>\n'
            combined_content += f'<div class="ticket-page">{body_content}</div>\n'
    
    # Get header from first page
    header_end = pages[0].find('<body>')
    header = pages[0][:header_end + 6] if header_end != -1 else ""
    
    # Add page break style
    header = header.replace('</style>', '''
.ticket-page { margin-bottom: 10mm; }
@media print {
  .ticket-page { page-break-after: always; }
  .ticket-page:last-child { page-break-after: auto; }
}
</style>''')
    
    auto_print_script = ""
    if auto_print:
        auto_print_script = '<script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>'
    
    return f"{header}\n{combined_content}\n{auto_print_script}</body></html>"
