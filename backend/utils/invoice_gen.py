from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
import os
from datetime import datetime
from pathlib import Path

# ── Constants ─────────────────────────────────────────────────────────────────
_INVOICES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Invoices")
_DEFAULT_PDF  = os.path.normpath(os.path.join(_INVOICES_DIR, "invoice.pdf"))

BLUE    = colors.HexColor("#2563EB")
DARK    = colors.HexColor("#0f172a")
MID     = colors.HexColor("#64748b")
LIGHT   = colors.HexColor("#f8fafc")
GREEN   = colors.HexColor("#10B981")
AMBER   = colors.HexColor("#F59E0B")
RED     = colors.HexColor("#EF4444")
BORDER  = colors.HexColor("#e2e8f0")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _inr(amount):
    try:
        val = float(amount or 0)
        return f"\u20b9{val:,.2f}"
    except Exception:
        return f"\u20b9{amount}"


def _money(amount):
    try:
        val = float(amount or 0)
        return f"${val:,.2f}"
    except Exception:
        return f"${amount}"


def _fmt_date(raw):
    if not raw:
        return ""
    if isinstance(raw, datetime):
        return raw.strftime("%d-%b-%Y")
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d %B %Y"):
        try:
            return datetime.strptime(str(raw), fmt).strftime("%d-%b-%Y")
        except ValueError:
            continue
    return str(raw)


def _header_band(c, w, h, margin, title, voucher_no, date_str, subtitle=""):
    """Draw the standard top header band used by all voucher types."""
    band_h = 52
    c.setFillColor(DARK)
    c.rect(0, h - band_h, w, band_h, fill=1, stroke=0)
    c.setFillColor(LIGHT)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, h - 32, title)
    if subtitle:
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#93c5fd"))
        c.drawString(margin, h - 46, subtitle)
    c.setFillColor(LIGHT)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - margin, h - 28, f"No. {voucher_no}")
    c.setFont("Helvetica", 9)
    c.drawRightString(w - margin, h - 42, f"Date: {_fmt_date(date_str)}")


def _section_label(c, x, y, text):
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(MID)
    c.drawString(x, y, text.upper())
    c.setFillColor(DARK)


def _narration_footer(c, margin, y, narration, extra=""):
    if narration:
        c.setFont("Helvetica", 9)
        c.setFillColor(MID)
        c.drawString(margin, y, f"Narration: {narration[:120]}")
        y -= 14
    if extra:
        c.setFont("Helvetica", 9)
        c.setFillColor(MID)
        c.drawString(margin, y, extra[:120])
    c.setFillColor(DARK)


def _horiz_rule(c, x1, x2, y, color=BORDER):
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    c.line(x1, y, x2, y)
    c.setStrokeColor(DARK)


# ── Accounting voucher (Payment / Receipt / Contra) ───────────────────────────
def _gen_accounting_voucher(output_path, data):
    """Generic Particulars | Amount layout."""
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4
    margin = 36

    voucher_type = data.get("voucher_type", "Accounting Voucher")
    voucher_no   = data.get("voucher_number", data.get("invoice_no", "—"))
    date_str     = data.get("date", data.get("issued_date", ""))
    company      = data.get("company_name", "")
    mode         = data.get("mode", "")
    narration    = data.get("narration", "")

    _header_band(c, w, h, margin, f"ACCOUNTING VOUCHER  —  {voucher_type.upper()}", voucher_no, date_str, company)

    y = h - 80
    if mode:
        c.setFont("Helvetica", 10)
        c.setFillColor(DARK)
        c.drawString(margin, y, f"Mode: {mode}")
        y -= 20

    # Table header
    _horiz_rule(c, margin, w - margin, y)
    y -= 16
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(MID)
    c.drawString(margin, y, "Particulars")
    c.drawRightString(w - margin, y, "Amount (₹)")
    y -= 8
    _horiz_rule(c, margin, w - margin, y)
    y -= 20
    c.setFillColor(DARK)

    # Build entry rows from schema fields
    entries = []
    if voucher_type == "Payment":
        # Debit entries
        for e in data.get("debit_entries", []):
            entries.append((e.get("ledger_id", "Ledger"), "Dr", e.get("amount", 0)))
        # TDS payable as credit
        if data.get("tds_applicable") and data.get("tds_amount"):
            sect = data.get("tds_section", "")
            entries.append((f"TDS Payable u/s {sect}", "Cr", data["tds_amount"]))
        # Net bank credit
        gross = sum(e.get("amount", 0) for e in data.get("debit_entries", []))
        net   = gross - float(data.get("tds_amount", 0))
        entries.append((data.get("paid_from_ledger_id", "Bank/Cash"), "Cr", net))

    elif voucher_type == "Receipt":
        entries.append((data.get("received_into_ledger_id", "Bank/Cash"), "Dr",
                        sum(e.get("amount", 0) for e in data.get("credit_entries", []))))
        for e in data.get("credit_entries", []):
            entries.append((e.get("ledger_id", "Party"), "Cr", e.get("amount", 0)))

    elif voucher_type == "Contra":
        entries.append((data.get("to_ledger_id", "Bank"), "Dr", data.get("amount", 0)))
        entries.append((data.get("from_ledger_id", "Cash"), "Cr", data.get("amount", 0)))

    elif voucher_type in ("AdvanceReceipt",):
        tax = data.get("tax_liability", {})
        advance_net = float(data.get("advance_amount", 0)) - float(tax.get("igst_amount", 0) or
                                                                    float(tax.get("cgst_amount", 0) or 0) * 2)
        entries.append((data.get("received_into_ledger_id", "Bank"), "Dr", data.get("advance_amount", 0)))
        entries.append((f"Advance Received - {data.get('received_from', 'Party')}", "Cr", round(advance_net, 2)))
        if tax.get("igst_amount"):
            entries.append(("Output IGST on Advance", "Cr", tax["igst_amount"]))
        elif tax.get("cgst_amount"):
            entries.append(("Output CGST on Advance", "Cr", tax["cgst_amount"]))
            entries.append(("Output SGST on Advance", "Cr", tax.get("sgst_amount", tax["cgst_amount"])))

    elif voucher_type == "RefundVoucher":
        tax = data.get("tax_reversed", {})
        refund = float(data.get("refund_amount", 0))
        entries.append((f"Advance Received - {data.get('refunded_to', 'Party')}", "Dr",
                        round(refund - float(tax.get("igst_amount", 0) or float(tax.get("cgst_amount", 0) or 0) * 2), 2)))
        if tax.get("igst_amount"):
            entries.append(("Output IGST on Advance", "Dr", tax["igst_amount"]))
        entries.append((data.get("received_into_ledger_id", "Bank"), "Cr", refund))

    else:
        # Generic fallback from entries list
        for e in data.get("entries", []):
            entries.append((e.get("ledger_id", "Ledger"), e.get("type", "Dr")[:2], e.get("amount", 0)))

    # Draw rows
    c.setFont("Helvetica", 10)
    for ledger, side, amount in entries:
        side_tag = f" ({side})"
        c.drawString(margin, y, ledger + side_tag)
        c.drawRightString(w - margin, y, _inr(amount))
        y -= 18
        if y < 100:
            break

    _horiz_rule(c, margin, w - margin, y)
    y -= 28
    _narration_footer(c, margin, y, narration,
                      f"Mode: {mode}" + (f"  |  GSTR-1: {data.get('gstr1_section', '')}" if data.get("gstr1_section") else ""))

    c.showPage()
    c.save()
    return output_path


# ── Journal / Memorandum / Reversing Journal ──────────────────────────────────
def _gen_journal_voucher(output_path, data):
    """Two-column Debit | Credit layout."""
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4
    margin = 36

    voucher_type = data.get("voucher_type", "Journal")
    voucher_no   = data.get("voucher_number", data.get("invoice_no", "—"))
    date_str     = data.get("date", "")
    company      = data.get("company_name", "")
    narration    = data.get("narration", data.get("purpose", ""))

    subtitle = company
    if voucher_type == "Memorandum" and not data.get("posted_to_books", True):
        subtitle += "  |  Not posted to books"
    if voucher_type == "ReversingJournal":
        auto_rev = _fmt_date(data.get("auto_reverses_on", ""))
        subtitle += f"  |  Auto-reverses: {auto_rev}"

    _header_band(c, w, h, margin, f"VOUCHER  —  {voucher_type.upper()}", voucher_no, date_str, subtitle)

    y = h - 80

    if data.get("is_gst_adjustment"):
        c.setFont("Helvetica", 9)
        c.setFillColor(AMBER)
        c.drawString(margin, y, f"GST Adjustment: {data.get('adjustment_type', '')}")
        c.setFillColor(DARK)
        y -= 18

    # Table header
    col_mid = w / 2
    _horiz_rule(c, margin, w - margin, y)
    y -= 16
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(MID)
    c.drawString(margin, y, "Particulars")
    c.drawRightString(col_mid - 10, y, "Debit (₹)")
    c.drawRightString(w - margin, y, "Credit (₹)")
    y -= 8
    _horiz_rule(c, margin, w - margin, y)
    y -= 20
    c.setFillColor(DARK)

    entries = data.get("entries", [])
    total_dr, total_cr = 0.0, 0.0
    c.setFont("Helvetica", 10)
    for e in entries:
        ledger = e.get("ledger_id", "Ledger")
        etype  = (e.get("type") or "Dr").strip().lower()
        amount = float(e.get("amount", 0))
        dr_str = _inr(amount) if etype.startswith("d") else ""
        cr_str = _inr(amount) if etype.startswith("c") else ""
        if etype.startswith("d"):
            total_dr += amount
            c.drawString(margin, y, ledger)
            c.drawRightString(col_mid - 10, y, dr_str)
        else:
            total_cr += amount
            c.drawString(margin + 20, y, ledger)
            c.drawRightString(w - margin, y, cr_str)
        y -= 18
        if y < 120:
            break

    _horiz_rule(c, margin, w - margin, y)
    y -= 16
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Total")
    c.drawRightString(col_mid - 10, y, _inr(total_dr))
    c.drawRightString(w - margin, y, _inr(total_cr))
    y -= 28
    _narration_footer(c, margin, y, narration)

    c.showPage()
    c.save()
    return output_path


# ── Sales Invoice ─────────────────────────────────────────────────────────────
def generate_invoice(output_path=None, data=None):
    """
    Legacy Sales invoice generator (original style).
    data keys: invoice_no, company_name, issued_to, issued_date, due_date,
                items (list of {desc, qty, price}), tax_rate, payment_details.
    """
    if output_path is None:
        output_path = _DEFAULT_PDF

    defaults = {
        "invoice_no":   "16910",
        "company_name": "LICERIA & CO.",
        "issued_to": {"name": "Jimmy Anderson", "address": ["123 Anywhere St., Any City"],
                      "phone": "+123 456 7890", "email": "hello@reallygreatsite.com"},
        "issued_date": datetime(2025, 12, 20),
        "due_date":    datetime(2025, 12, 21),
        "items": [
            {"desc": "Product Photography\nCustom Branding Shot", "qty": 10, "price": 500},
            {"desc": "Social Media Reel\nBasic Package",           "qty":  6, "price": 1000},
        ],
        "tax_rate": 0.18,
        "payment_details": {"bank": "Borcelle Bank", "account_no": "0123 4567 8901",
                            "account_name": "Marcella Fontana"},
    }
    if data:
        for k, v in data.items():
            defaults[k] = v
    d = defaults

    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4
    margin = 36

    # Header
    c.setFont("Helvetica-Bold", 40)
    c.setFillColor(DARK)
    c.drawString(margin, h - 80, "INVOICE")
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(w - margin, h - 68, d.get("company_name", ""))
    _horiz_rule(c, margin, w - margin, h - 95, DARK)

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - margin, h - 112, f"INVOICE NO. {d.get('invoice_no')}")

    # Issued To
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

    # Dates
    issued_date = d.get("issued_date")
    due_date    = d.get("due_date")
    if isinstance(issued_date, datetime):
        issued_date = issued_date.strftime("%d %B %Y")
    if isinstance(due_date, datetime):
        due_date = due_date.strftime("%d %B %Y")
    c.setFont("Helvetica", 10)
    c.drawRightString(w - margin, h - 140, f"Issued Date  :  {issued_date}")
    c.drawRightString(w - margin, h - 156, f"Due Date     :  {due_date}")

    # Table
    table_top   = h - 260
    col_total_x = w - margin - 6
    col_price_x = col_total_x - 90
    col_qty_x   = col_price_x - 60
    col_desc_x  = margin + 6

    _horiz_rule(c, margin, w - margin, table_top + 6, DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(col_desc_x, table_top - 6, "DESCRIPTION")
    c.drawCentredString(col_qty_x,   table_top - 6, "QTY")
    c.drawRightString(col_price_x,   table_top - 6, "PRICE")
    c.drawRightString(col_total_x,   table_top - 6, "TOTAL")
    _horiz_rule(c, margin, w - margin, table_top - 14, DARK)

    y = table_top - 34
    c.setFont("Helvetica", 10)
    subtotal = 0
    for item in d.get("items", []):
        desc  = item.get("desc", "")
        qty   = item.get("qty", 1)
        price = item.get("price", 0)
        total = qty * price
        subtotal += total
        lines = desc.split("\n")
        for i, line in enumerate(lines):
            c.drawString(col_desc_x, y, line)
            if i == 0:
                c.drawCentredString(col_qty_x,   y, str(qty))
                c.drawRightString(col_price_x,   y, _money(price))
                c.drawRightString(col_total_x,   y, _money(total))
            y -= 14
        y -= 6
        if y < 140:
            break

    tax   = subtotal * d.get("tax_rate", 0)
    total = subtotal + tax
    min_totals_y = 180
    if y < min_totals_y:
        y = min_totals_y
    rule_y = y - 6
    c.setStrokeColor(colors.grey)
    c.setLineWidth(0.8)
    c.line(col_price_x - 55, rule_y, col_total_x + 5, rule_y)
    subtotal_y = rule_y - 18
    tax_y      = subtotal_y - 18
    total_y    = tax_y - 24
    c.setFillColor(DARK)
    c.setFont("Helvetica", 10)
    c.drawRightString(col_price_x - 10, subtotal_y, "Subtotal")
    c.drawRightString(col_total_x, subtotal_y, _money(subtotal))
    c.drawRightString(col_price_x - 10, tax_y, f"Tax ({int(d.get('tax_rate', 0)*100)}%)")
    c.drawRightString(col_total_x, tax_y, _money(tax))
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(col_price_x - 10, total_y, "Total")
    c.drawRightString(col_total_x, total_y, _money(total))

    # Payment details
    pay_y = 90
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, pay_y + 60, "PAYMENT TO :")
    c.setFont("Helvetica", 10)
    pd = d.get("payment_details", {})
    c.drawString(margin, pay_y + 42, pd.get("bank", ""))
    c.drawString(margin, pay_y + 28, f"Account No. :  {pd.get('account_no', '')}")
    c.drawString(margin, pay_y + 14, f"Account Name:  {pd.get('account_name', '')}")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(w - margin, pay_y + 20, "THANK YOU FOR")
    c.drawRightString(w - margin, pay_y + 6, "ORDERING FROM US")

    c.showPage()
    c.save()
    return output_path


# ── GST Invoice (Sales Tax Invoice / BillOfSupply / ExportInvoice) ────────────
def _gen_gst_invoice(output_path, data):
    """Line-items table with HSN, Rate, GST%, Amount columns."""
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4
    margin = 36

    voucher_type = data.get("voucher_type", "Sales")
    voucher_no   = data.get("voucher_number", data.get("invoice_no", "—"))
    date_str     = data.get("date", data.get("issued_date", ""))
    company      = data.get("company_name", "")
    pos          = data.get("place_of_supply", "")
    party_gstin  = data.get("party_gstin", "")
    irn          = data.get("irn", "")
    gstr1_sec    = data.get("gstr1_section", "")
    export_type  = data.get("export_type", "")
    lut_arn      = data.get("lut_arn", "")
    currency     = data.get("currency", "INR")
    exc_rate     = data.get("exchange_rate", 1)
    consignee_c  = data.get("consignee_country", "")
    composition  = data.get("composition_note", "")

    type_labels = {
        "Sales":         "TAX INVOICE",
        "BillOfSupply":  "BILL OF SUPPLY",
        "ExportInvoice": "EXPORT INVOICE",
        "CreditNote":    "CREDIT NOTE",
        "DebitNote":     "DEBIT NOTE",
        "SelfInvoiceRCM":"SELF-INVOICE (RCM)",
        "Purchase":      "PURCHASE INVOICE",
    }
    title = type_labels.get(voucher_type, voucher_type.upper())

    sub_parts = [company]
    if pos:
        sub_parts.append(f"PoS: {pos}")
    if export_type:
        sub_parts.append(export_type)
    if lut_arn:
        sub_parts.append(f"LUT ARN: {lut_arn}")

    _header_band(c, w, h, margin, title, voucher_no, date_str, "  |  ".join(filter(None, sub_parts)))

    y = h - 75

    # Party / supplier info row
    if party_gstin or data.get("supplier_invoice_number") or data.get("original_voucher_id"):
        c.setFont("Helvetica", 9)
        c.setFillColor(MID)
        info_parts = []
        if party_gstin:
            info_parts.append(f"Party GSTIN: {party_gstin}")
        if data.get("supplier_invoice_number"):
            info_parts.append(f"Supplier Inv: {data['supplier_invoice_number']}")
        if data.get("original_voucher_id"):
            info_parts.append(f"Against: {data['original_voucher_id']}")
            if data.get("original_voucher_date"):
                info_parts.append(f"(dated {_fmt_date(data['original_voucher_date'])})")
        if consignee_c:
            info_parts.append(f"Consignee: {consignee_c}")
        c.drawString(margin, y, "  |  ".join(info_parts))
        c.setFillColor(DARK)
        y -= 16

    # Table header
    is_dr_cr = voucher_type in ("CreditNote", "DebitNote")
    col_item  = margin
    col_hsn   = col_item  + 160
    col_qty   = col_hsn   + 60
    col_rate  = col_qty   + 50
    col_txbl  = col_rate  + 70
    col_gst   = col_txbl  + 70
    col_amt   = w - margin

    _horiz_rule(c, margin, w - margin, y)
    y -= 14
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(MID)
    c.drawString(col_item, y, "Item / Service")
    c.drawString(col_hsn,  y, "HSN/SAC")
    c.drawCentredString(col_qty  + 20, y, "Qty")
    col_rate_label = "Rate (USD)" if currency != "INR" else "Rate"
    c.drawRightString(col_rate + 65, y, col_rate_label)
    if not is_dr_cr:
        c.drawRightString(col_txbl + 65, y, "Taxable")
    c.drawCentredString(col_gst  + 10, y, "GST%")
    c.drawRightString(col_amt,   y, "Amount")
    y -= 6
    _horiz_rule(c, margin, w - margin, y)
    y -= 14
    c.setFillColor(DARK)

    line_items = data.get("line_items", [])
    grand_total = 0.0
    total_tax   = 0.0

    c.setFont("Helvetica", 9)
    for item in line_items:
        name  = item.get("item", "")
        hsn   = str(item.get("hsn_sac_code", ""))
        qty   = item.get("quantity", 1)
        unit  = item.get("unit", "")
        if currency != "INR":
            rate_val = item.get("rate_usd", item.get("rate", 0))
            rate_disp = f"{rate_val:.2f}"
        else:
            rate_val  = item.get("rate", 0)
            rate_disp = _inr(rate_val)
        txbl  = float(item.get("taxable_value", float(qty) * float(rate_val)))
        gst_r = item.get("gst_rate", 0)
        tax_a = float(item.get("igst_amount", 0) or 0) + \
                float(item.get("cgst_amount", 0) or 0) + \
                float(item.get("sgst_amount", 0) or 0) + \
                float(item.get("tax_amount", 0) or 0)
        if not tax_a and gst_r:
            tax_a = round(txbl * float(gst_r) / 100, 2)
        total_line = txbl + tax_a
        grand_total += total_line
        total_tax   += tax_a

        qty_str = f"{qty} {unit}".strip()
        c.drawString(col_item, y, name[:28])
        c.drawString(col_hsn,  y, hsn)
        c.drawString(col_qty  + 5, y, qty_str)
        c.drawRightString(col_rate + 65, y, rate_disp)
        if not is_dr_cr:
            c.drawRightString(col_txbl + 65, y, _inr(txbl))
        c.drawCentredString(col_gst  + 10, y, f"{gst_r}%")
        c.drawRightString(col_amt,   y, _inr(total_line))
        y -= 14
        if y < 120:
            break

    # Totals
    _horiz_rule(c, margin, w - margin, y)
    y -= 14
    c.setFont("Helvetica", 9)
    c.setFillColor(MID)
    if total_tax:
        tax_label = "IGST" if data.get("place_of_supply", "").upper() not in ("MH", "GJ", "DL") else "CGST+SGST"
        c.drawString(margin, y, f"{tax_label}: {_inr(total_tax)}")
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK)
    c.drawRightString(w - margin - 70, y, "Grand Total")
    c.drawRightString(w - margin, y, _inr(data.get("grand_total", grand_total)))
    y -= 20

    # IRN / LUT / Composition notes
    notes = []
    if irn:
        ack = data.get("irn_ack_no", "")
        ack_date = _fmt_date(data.get("irn_ack_date", ""))
        notes.append(f"IRN generated (Ack No. {ack}, {ack_date})")
    if gstr1_sec:
        notes.append(f"GSTR-1 section: {gstr1_sec}")
    if composition:
        notes.append(composition[:80])
    if data.get("itc_claim_status"):
        notes.append(f"ITC status: {data['itc_claim_status']}  |  2B match: {data.get('gstr2b_match_status', '—')}")
    if data.get("supplier_name") and voucher_type == "SelfInvoiceRCM":
        notes.append(f"Supplier: {data['supplier_name']}  |  Tax paid by: {data.get('tax_paid_by', 'Recipient')}")
        notes.append(f"GSTR-3B Table: {data.get('gstr3b_table', '—')}")
    if data.get("reason"):
        notes.append(f"Reason: {data['reason']}")

    c.setFont("Helvetica", 8)
    c.setFillColor(MID)
    for note in notes:
        c.drawString(margin, y, note[:110])
        y -= 12

    c.showPage()
    c.save()
    return output_path


# ── Inventory Voucher ─────────────────────────────────────────────────────────
def _gen_inventory_voucher(output_path, data):
    """Generic inventory voucher: Item | Qty | Godown/extra columns."""
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4
    margin = 36

    voucher_type = data.get("voucher_type", "Inventory")
    voucher_no   = data.get("voucher_number", data.get("invoice_no", "—"))
    date_str     = data.get("date", "")
    company      = data.get("company_name", "")

    # Sub-header info
    sub_parts = [company]
    if data.get("expected_delivery_date"):
        sub_parts.append(f"Due: {_fmt_date(data['expected_delivery_date'])}")
    if data.get("e_way_bill_no"):
        sub_parts.append(f"E-way: {data['e_way_bill_no']}")
    if data.get("vehicle_number"):
        sub_parts.append(f"Vehicle: {data['vehicle_number']}")
    if data.get("job_worker_name"):
        sub_parts.append(f"Job Worker: {data['job_worker_name']}")
    if data.get("status"):
        sub_parts.append(f"Status: {data['status']}")
    if data.get("journal_type"):
        sub_parts.append(f"Type: {data['journal_type']}")
    if data.get("valid_until"):
        sub_parts.append(f"Valid till: {_fmt_date(data['valid_until'])}")

    _header_band(c, w, h, margin, f"INVENTORY VOUCHER  —  {voucher_type.upper()}", voucher_no, date_str,
                 "  |  ".join(filter(None, sub_parts)))

    y = h - 75

    # Linked references
    refs = []
    for f, lbl in [("linked_sales_order_id", "Against SO"), ("linked_purchase_order_id", "Against PO"),
                   ("linked_delivery_note_id", "Against DN"), ("linked_receipt_note_id", "Against RN"),
                   ("linked_job_work_out_order_id", "Against JWO"), ("original_advance_receipt_id", "Against ARV"),
                   ("purpose", "Purpose"), ("godown_id", "Godown")]:
        if data.get(f):
            refs.append(f"{lbl}: {data[f]}")
    if data.get("count_date"):
        refs.append(f"Count date: {_fmt_date(data['count_date'])}")
    if refs:
        c.setFont("Helvetica", 9)
        c.setFillColor(MID)
        c.drawString(margin, y, "  |  ".join(refs[:3]))
        c.setFillColor(DARK)
        y -= 16

    # Table header — vary columns by type
    is_stock_journal = voucher_type == "StockJournal"
    is_physical      = voucher_type == "PhysicalStock"
    is_material_in   = voucher_type == "MaterialIn"
    is_rejection     = voucher_type in ("RejectionIn", "RejectionOut")
    is_purchase_order = voucher_type in ("PurchaseOrder", "SalesOrder", "Quotation")

    _horiz_rule(c, margin, w - margin, y)
    y -= 14
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(MID)
    c.drawString(margin, y, "Item")

    if is_stock_journal:
        c.drawCentredString(w / 2 - 60, y, "Qty")
        c.drawString(w / 2 - 40, y, "From Godown")
        c.drawString(w / 2 + 60, y, "To Godown")
    elif is_physical:
        c.drawCentredString(w / 2 - 60, y, "Book Qty")
        c.drawCentredString(w / 2 + 10, y, "Physical Qty")
        c.drawRightString(w - margin, y, "Variance")
    elif is_material_in:
        c.drawCentredString(w / 2 - 80, y, "Sent")
        c.drawCentredString(w / 2 - 20, y, "Received")
        c.drawCentredString(w / 2 + 40, y, "Process Loss")
        c.drawRightString(w - margin, y, "Godown")
    elif is_rejection:
        c.drawCentredString(w / 2 - 30, y, "Qty")
        c.drawRightString(w - margin, y, "Reason")
    elif is_purchase_order:
        c.drawCentredString(w / 2 - 30, y, "Qty")
        c.drawRightString(w - margin, y, "Rate")
    else:
        c.drawCentredString(w / 2 - 30, y, "Qty")
        c.drawString(w / 2 + 20, y, "Godown")
        c.drawRightString(w - margin, y, "Batch / QC")

    y -= 6
    _horiz_rule(c, margin, w - margin, y)
    y -= 14
    c.setFillColor(DARK)
    c.setFont("Helvetica", 9)

    # Gather items
    all_items = []
    if is_stock_journal:
        src = data.get("source_items", [])
        dst = data.get("destination_items", [])
        for s, d2 in zip(src, dst):
            all_items.append({"item": s.get("item", ""), "quantity": s.get("quantity", 0),
                              "_from": s.get("godown_id", ""), "_to": d2.get("godown_id", "")})
    else:
        all_items = data.get("line_items", [])

    for item in all_items:
        name = item.get("item", "")
        qty  = item.get("quantity", item.get("quantity_received", 0))
        c.drawString(margin, y, name[:30])

        if is_stock_journal:
            c.drawCentredString(w / 2 - 60, y, str(qty))
            c.drawString(w / 2 - 40, y, str(item.get("_from", "")))
            c.drawString(w / 2 + 60, y, str(item.get("_to", "")))
        elif is_physical:
            c.drawCentredString(w / 2 - 60, y, str(item.get("book_quantity", "")))
            c.drawCentredString(w / 2 + 10, y, str(item.get("physical_quantity", "")))
            c.drawRightString(w - margin, y, str(item.get("variance", "")))
        elif is_material_in:
            c.drawCentredString(w / 2 - 80, y, str(item.get("quantity_sent", "")))
            c.drawCentredString(w / 2 - 20, y, str(item.get("quantity_received", "")))
            c.drawCentredString(w / 2 + 40, y, str(item.get("process_loss", "")))
            c.drawRightString(w - margin, y, str(item.get("godown_id", "")))
        elif is_rejection:
            c.drawCentredString(w / 2 - 30, y, str(qty))
            c.drawRightString(w - margin, y, str(item.get("reason", "")))
        elif is_purchase_order:
            c.drawCentredString(w / 2 - 30, y, str(qty))
            c.drawRightString(w - margin, y, _inr(item.get("rate", 0)))
        else:
            c.drawCentredString(w / 2 - 30, y, str(qty))
            c.drawString(w / 2 + 20, y, str(item.get("godown_id", "")))
            extra = str(item.get("batch_no", item.get("qc_status", item.get("process", ""))))
            c.drawRightString(w - margin, y, extra)

        y -= 14
        if y < 100:
            break

    _horiz_rule(c, margin, w - margin, y)
    y -= 20
    # footer notes
    notes = []
    if data.get("advance_received"):
        notes.append(f"Advance received: {_inr(data['advance_received'])}")
    if data.get("expected_return_date"):
        notes.append(f"Expected return: {_fmt_date(data['expected_return_date'])}")
    if not data.get("is_taxable_supply", True):
        notes.append("Not a taxable supply — no invoice raised.")
    c.setFont("Helvetica", 8)
    c.setFillColor(MID)
    for note in notes:
        c.drawString(margin, y, note)
        y -= 12

    c.showPage()
    c.save()
    return output_path


# ── Generic fallback ──────────────────────────────────────────────────────────
def _gen_generic_voucher(output_path, data):
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4
    margin = 36
    voucher_type = data.get("voucher_type", "Voucher")
    voucher_no   = data.get("voucher_number", data.get("invoice_no", "—"))
    date_str     = data.get("date", data.get("issued_date", ""))
    _header_band(c, w, h, margin, voucher_type.upper(), voucher_no, date_str, data.get("company_name", ""))
    y = h - 90
    c.setFont("Helvetica", 10)
    c.setFillColor(DARK)
    for key, val in data.items():
        if key in ("voucher_type", "company_name", "date", "invoice_no", "voucher_number"):
            continue
        c.drawString(margin, y, f"{key}: {str(val)[:80]}")
        y -= 14
        if y < 80:
            break
    c.showPage()
    c.save()
    return output_path


# ── Dispatcher ────────────────────────────────────────────────────────────────
_ACCOUNTING_VOUCHERS = {"Payment", "Receipt", "Contra", "AdvanceReceipt", "RefundVoucher"}
_JOURNAL_VOUCHERS    = {"Journal", "Memorandum", "ReversingJournal"}
_GST_INVOICES        = {"Sales", "BillOfSupply", "ExportInvoice", "Purchase",
                        "SelfInvoiceRCM", "DebitNote", "CreditNote"}
_INVENTORY_VOUCHERS  = {"PurchaseOrder", "SalesOrder", "DeliveryNote", "DeliveryChallan",
                        "JobWorkOutOrder", "ReceiptNote", "MaterialIn",
                        "RejectionIn", "RejectionOut", "StockJournal", "PhysicalStock",
                        "Quotation"}


def generate_voucher_pdf(voucher_type: str, output_path: str, data: dict) -> str:
    """
    Route to the correct PDF generator based on voucher_type.
    Falls back to a generic layout for unknown types.
    """
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    if voucher_type in _ACCOUNTING_VOUCHERS:
        return _gen_accounting_voucher(output_path, data)
    elif voucher_type in _JOURNAL_VOUCHERS:
        return _gen_journal_voucher(output_path, data)
    elif voucher_type in _GST_INVOICES:
        return _gen_gst_invoice(output_path, data)
    elif voucher_type in _INVENTORY_VOUCHERS:
        return _gen_inventory_voucher(output_path, data)
    else:
        return _gen_generic_voucher(output_path, data)


def clear():
    path = Path(_DEFAULT_PDF)
    path.unlink(missing_ok=True)
