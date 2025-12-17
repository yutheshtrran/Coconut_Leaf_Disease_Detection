import os
from datetime import datetime
from fpdf import FPDF

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATED_DIR = os.path.join(BASE_DIR, "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)

def generate_dummy_report(report_id):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)

    pdf.cell(0, 10, "Coconut Leaf Disease Analysis Report", ln=True, align="C")
    pdf.ln(10)

    pdf.set_font("Arial", "", 12)

    # Dummy data (matches your table)
    pdf.cell(0, 10, f"Report ID: {report_id}", ln=True)
    pdf.cell(0, 10, "Farm Name: Farm A", ln=True)
    pdf.cell(0, 10, f"Date: {datetime.now().strftime('%Y-%m-%d')}", ln=True)
    pdf.cell(0, 10, "Major Issue: Potassium Deficiency", ln=True)

    pdf.set_text_color(255, 0, 0)
    pdf.cell(0, 10, "Severity: 92% (CRITICAL)", ln=True)
    pdf.set_text_color(0, 0, 0)

    pdf.cell(0, 10, "Status: Finalized", ln=True)

    pdf_path = os.path.join(GENERATED_DIR, f"{report_id}.pdf")
    pdf.output(pdf_path)

    return pdf_path
