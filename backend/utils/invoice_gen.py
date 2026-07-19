from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
import os
from datetime import datetime
from pathlib import Path


def _money(amount):
    return f"${amount:,.2f}"


# Resolve the Invoices directory relative to this file, not the cwd
_INVOICES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Invoices")
_DEFAULT_PDF   = os.path.normpath(os.path.join(_INVOICES_DIR, "invoice.pdf"))


def generate_invoice(output_path=None, data=None):
    """
    data: optional dict to override fields. Expected keys:
      - invoice_no, issued_to (dict with name, address, phone, email),
      - issued_date, due_date, items (list of dicts with desc, qty, price),
      - company_name, payment_details (dict)
    """
    if output_path is None:
        output_path = _DEFAULT_PDF

    # Defaults matching the look of the attached template
    defaults = {
        "invoice_no": "16910",
        "company_name": "LICERIA & CO.",
        "issued_to": {
            "name": "Jimmy Anderson",
            "address": ["123 Anywhere St., Any City"],
            "phone": "+123 456 7890",
            "email": "hello@reallygreatsite.com",
        },
        "issued_date": datetime(2025, 12, 20),
        "due_date": datetime(2025, 12, 21),
        "items": [
            {"desc": "Product Photography\nCustom Branding Shot", "qty": 10, "price": 500},
            {"desc": "Social Media Reel\nBasic Package", "qty": 6, "price": 1000},
            {"desc": "Full Commercial Video\nStandard Package", "qty": 1, "price": 3000},
            {"desc": "Scriptwriting\nCustom Scriptwriting Package", "qty": 1, "price": 500},
            {"desc": "Personal Voice Over\nStandard Voice-over Package", "qty": 1, "price": 500},
        ],
        "tax_rate": 0.10,
        "payment_details": {
            "bank": "Borcelle Bank",
            "account_no": "0123 4567 8901",
            "account_name": "Marcella Fontana",
        },
    }

    if data:
        # shallow merge
        for k, v in data.items():
            defaults[k] = v

    d = defaults

    # Ensure output dir exists
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    c = canvas.Canvas(output_path, pagesize=letter)
    w, h = letter

    margin = 36

    # Header
    c.setFont("Helvetica-Bold", 48)
    c.drawString(margin, h - 80, "INVOICE")

    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(w - margin, h - 70, d.get("company_name", ""))

    c.setStrokeColor(colors.black)
    c.setLineWidth(1)
    c.line(margin, h - 95, w - margin, h - 95)

    # Invoice number (right aligned under company)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - margin, h - 110, f"INVOICE NO. {d.get('invoice_no')}")

    # Issued To block
    y = h - 140
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "ISSUED TO :")
    y -= 18

    it = d.get("issued_to", {})
    c.setFont("Helvetica", 10)
    c.drawString(margin, y, f'Name: {it.get("name", "")}')
    y -= 14
    for line in it.get("address", []):
        c.drawString(margin, y, line)
        y -= 14
    c.drawString(margin, y, f'Mobile: {it.get("phone", "")}')
    y -= 14
    c.drawString(margin, y, f'Email: {it.get("email", "")}')

    # Dates on right
    date_x = w - margin - 200
    date_y = h - 140
    c.setFont("Helvetica", 10)
    issued_date = d.get("issued_date")
    due_date = d.get("due_date")
    if isinstance(issued_date, datetime):
        issued_date = issued_date.strftime("%d %B %Y")
    if isinstance(due_date, datetime):
        due_date = due_date.strftime("%d %B %Y")

    c.drawRightString(w - margin, date_y, f"Issued Date  :  {issued_date}")
    c.drawRightString(w - margin, date_y - 16, f"Due Date     :  {due_date}")

    # Table header
    table_top = h - 260
    c.setLineWidth(1)
    c.line(margin, table_top + 6, w - margin, table_top + 6)

    # column positions (tuned to avoid overlap)
    col_total_x = w - margin - 6
    col_price_x = col_total_x - 90
    col_qty_x = col_price_x - 60
    col_desc_x = margin + 6

    c.setFont("Helvetica-Bold", 11)
    c.drawString(col_desc_x, table_top - 6, "DESCRIPTION")
    c.drawCentredString(col_qty_x, table_top - 6, "QTY")
    c.drawRightString(col_price_x, table_top - 6, "PRICE")
    c.drawRightString(col_total_x, table_top - 6, "TOTAL")

    c.line(margin, table_top - 14, w - margin, table_top - 14)

    # Items
    y = table_top - 34
    c.setFont("Helvetica", 10)
    subtotal = 0
    for item in d.get("items", []):
        desc = item.get("desc", "")
        qty = item.get("qty", 1)
        price = item.get("price", 0)
        total = qty * price
        subtotal += total

        # Draw multi-line description
        lines = desc.split("\n")
        for i, line in enumerate(lines):
            c.drawString(col_desc_x, y, line)
            if i == 0:
                # quantity centred, price and total right-aligned on the first line only
                c.drawCentredString(col_qty_x, y, str(qty))
                c.drawRightString(col_price_x, y, _money(price))
                c.drawRightString(col_total_x, y, _money(total))
            y -= 14

        y -= 6
        if y < 140:
            # For simplicity this generator targets single-page invoices
            break

    # Totals (right side) - anchor above bottom and avoid overlap
    tax = subtotal * d.get("tax_rate", 0)
    total = subtotal + tax

    # Ensure totals area has a minimum Y (keep it above the bottom section)
    min_totals_y = 180
    if y < min_totals_y:
        y = min_totals_y

    line_y = y - 6

    # Draw a single horizontal rule above the totals area
    c.setStrokeColor(colors.grey)
    c.setLineWidth(0.8)
    rule_y = line_y
    c.line(col_price_x - 55, rule_y, col_total_x + 5, rule_y)

    # Stack Subtotal, Tax, Total under the rule with clear spacing
    subtotal_y = rule_y - 18
    tax_y = subtotal_y - 18
    total_y = tax_y - 24

    label_x = col_price_x - 10
    value_x = col_total_x

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawRightString(label_x, subtotal_y, "Subtotal")
    c.drawRightString(value_x, subtotal_y, _money(subtotal))

    c.drawRightString(label_x, tax_y, "Tax")
    c.drawRightString(value_x, tax_y, _money(tax))

    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(label_x, total_y, "Total")
    c.drawRightString(value_x, total_y, _money(total))

    # restore stroke color
    c.setStrokeColor(colors.black)

    # Payment details bottom-left
    pay_y = 90
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, pay_y + 60, "PAYMENT TO :")
    c.setFont("Helvetica", 10)
    pd = d.get("payment_details", {})
    c.drawString(margin, pay_y + 42, pd.get("bank", ""))
    c.drawString(margin, pay_y + 28, f"Account No. :  {pd.get('account_no', '')}")
    c.drawString(margin, pay_y + 14, f"Account Name:  {pd.get('account_name', '')}")

    # Thank you note bottom-right
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(w - margin, pay_y + 20, "THANK YOU FOR")
    c.drawRightString(w - margin, pay_y + 6, "ORDERING FROM US")

    c.showPage()
    c.save()

    return output_path

def clear():
    path = Path(_DEFAULT_PDF)
    path.unlink(missing_ok=True)
