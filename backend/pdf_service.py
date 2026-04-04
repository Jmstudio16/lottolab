"""
PDF Export Service for LottoLab
Generates PDF reports for sales, winning tickets, financial reports, etc.
"""
from io import BytesIO
from datetime import datetime, timezone, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import logging

logger = logging.getLogger(__name__)


def get_haiti_time():
    """Get current time in Haiti timezone (UTC-5)"""
    return datetime.now(timezone.utc) - timedelta(hours=5)


def format_currency(amount):
    """Format amount as HTG currency"""
    return f"{amount:,.0f} HTG"


def create_pdf_report(
    title: str,
    headers: list,
    data: list,
    summary: dict = None,
    company_name: str = "LOTTOLAB",
    report_type: str = "report"
) -> BytesIO:
    """
    Create a generic PDF report.
    
    Args:
        title: Report title
        headers: Column headers
        data: List of rows (each row is a list of values)
        summary: Optional summary dict with totals
        company_name: Company name for header
        report_type: Type of report (sales, winners, financial)
    
    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e293b'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    # Header
    elements.append(Paragraph(f"<b>{company_name}</b>", title_style))
    elements.append(Paragraph(title, title_style))
    
    haiti_time = get_haiti_time()
    date_str = haiti_time.strftime("%d/%m/%Y à %H:%M")
    elements.append(Paragraph(f"Généré le {date_str} (Heure d'Haïti)", subtitle_style))
    
    # Summary section if provided
    if summary:
        summary_data = []
        for key, value in summary.items():
            if isinstance(value, (int, float)):
                value = format_currency(value) if 'montant' in key.lower() or 'total' in key.lower() else str(value)
            summary_data.append([key, str(value)])
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
    
    # Main data table
    if data:
        table_data = [headers] + data
        
        # Calculate column widths dynamically
        num_cols = len(headers)
        col_width = (7*inch) / num_cols
        col_widths = [col_width] * num_cols
        
        main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Table styling
        table_style = [
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            
            # Borders
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#1e293b')),
            
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]
        
        main_table.setStyle(TableStyle(table_style))
        elements.append(main_table)
    else:
        elements.append(Paragraph("Aucune donnée disponible", styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#94a3b8'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph(f"© {haiti_time.year} {company_name} - Rapport généré automatiquement", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def create_sales_report_pdf(
    sales_data: list,
    company_name: str,
    period: str = "Aujourd'hui",
    totals: dict = None
) -> BytesIO:
    """Create a sales report PDF"""
    headers = ["#", "Agent", "Date", "Loterie", "Numéros", "Type", "Montant", "Statut"]
    
    data = []
    for idx, sale in enumerate(sales_data, 1):
        data.append([
            str(idx),
            sale.get("agent_name", "-"),
            sale.get("created_at", "-")[:16] if sale.get("created_at") else "-",
            sale.get("lottery_name", "-"),
            sale.get("numbers", "-"),
            sale.get("bet_type", "-"),
            format_currency(sale.get("amount", 0)),
            sale.get("status", "-")
        ])
    
    summary = {
        "Période": period,
        "Total Ventes": len(sales_data),
        "Montant Total": totals.get("total_amount", 0) if totals else sum(s.get("amount", 0) for s in sales_data)
    }
    
    return create_pdf_report(
        title=f"Rapport des Ventes - {period}",
        headers=headers,
        data=data,
        summary=summary,
        company_name=company_name,
        report_type="sales"
    )


def create_winners_report_pdf(
    winners_data: list,
    company_name: str,
    period: str = "Aujourd'hui",
    totals: dict = None
) -> BytesIO:
    """Create a winners report PDF"""
    headers = ["#", "Ticket", "Agent", "Loterie", "Numéros", "Mise", "Gain", "Statut"]
    
    data = []
    for idx, winner in enumerate(winners_data, 1):
        data.append([
            str(idx),
            winner.get("ticket_id", "-")[:12] if winner.get("ticket_id") else "-",
            winner.get("agent_name", "-"),
            winner.get("lottery_name", "-"),
            winner.get("winning_numbers", "-"),
            format_currency(winner.get("bet_amount", 0)),
            format_currency(winner.get("payout_amount", 0)),
            "Payé" if winner.get("is_paid") else "Non payé"
        ])
    
    summary = {
        "Période": period,
        "Total Gagnants": len(winners_data),
        "Montant Total Gagné": totals.get("total_payout", 0) if totals else sum(w.get("payout_amount", 0) for w in winners_data)
    }
    
    return create_pdf_report(
        title=f"Fiches Gagnantes - {period}",
        headers=headers,
        data=data,
        summary=summary,
        company_name=company_name,
        report_type="winners"
    )


def create_financial_report_pdf(
    report_data: list,
    company_name: str,
    period: str = "Aujourd'hui",
    totals: dict = None
) -> BytesIO:
    """Create a financial report PDF"""
    headers = ["#", "Agent", "Tickets", "Ventes", "Payé", "%Agent", "Profit/Perte", "Balance"]
    
    data = []
    for idx, item in enumerate(report_data, 1):
        profit = item.get("profit", 0)
        profit_str = format_currency(abs(profit))
        if profit < 0:
            profit_str = f"-{profit_str}"
        
        data.append([
            str(idx),
            item.get("agent_name", "-"),
            str(item.get("ticket_count", 0)),
            format_currency(item.get("total_sales", 0)),
            format_currency(item.get("total_paid", 0)),
            f"{item.get('commission_percent', 0):.1f}%",
            profit_str,
            format_currency(item.get("balance", 0))
        ])
    
    summary = {
        "Période": period,
        "Total Agents": len(report_data),
        "Total Ventes": totals.get("total_sales", 0) if totals else sum(r.get("total_sales", 0) for r in report_data),
        "Total Payé": totals.get("total_paid", 0) if totals else sum(r.get("total_paid", 0) for r in report_data),
        "Profit Net": totals.get("net_profit", 0) if totals else sum(r.get("profit", 0) for r in report_data)
    }
    
    return create_pdf_report(
        title=f"Rapport Financier - {period}",
        headers=headers,
        data=data,
        summary=summary,
        company_name=company_name,
        report_type="financial"
    )


def create_daily_report_pdf(
    report_data: list,
    company_name: str,
    date: str = None
) -> BytesIO:
    """Create SGL-style daily report PDF"""
    headers = ["No", "Agent", "Tfiche", "Vente", "A payé", "%Agent", "P/P", "B.Final"]
    
    data = []
    for idx, item in enumerate(report_data, 1):
        pp = item.get("profit_loss", 0)
        pp_str = format_currency(abs(pp))
        if pp < 0:
            pp_str = f"({pp_str})"
        
        data.append([
            str(idx),
            item.get("agent_name", "-"),
            str(item.get("ticket_count", 0)),
            format_currency(item.get("sales", 0)),
            format_currency(item.get("paid", 0)),
            f"{item.get('commission_percent', 0):.1f}%",
            pp_str,
            format_currency(item.get("final_balance", 0))
        ])
    
    if not date:
        date = get_haiti_time().strftime("%d/%m/%Y")
    
    summary = {
        "Date": date,
        "Nombre d'agents": len(report_data),
        "Total Ventes": sum(r.get("sales", 0) for r in report_data),
        "Total Payé": sum(r.get("paid", 0) for r in report_data)
    }
    
    return create_pdf_report(
        title=f"Rapport Journalier - {date}",
        headers=headers,
        data=data,
        summary=summary,
        company_name=company_name,
        report_type="daily"
    )
