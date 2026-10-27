"""
Generates two versions of a FICTIONAL demo specification for the change log
("Änderungsprotokoll → Regeln & Spezifikationen"):

  DEMO_Spezifikation_DBVO_Version_1.0.pdf   (Stand 01.07.2026)
  DEMO_Spezifikation_DBVO_Version_1.1.pdf   (Stand 01.10.2026)

The wording follows the DBVO example (DTA-EEL-Beispiel_Vorerkrankung.docx /
Verfahrensbeschreibung DTA EEL 3.12). Version 1.1 deliberately changes rules,
so the app can show what it detects:

  2.1 Voraussetzung          mindestens 30 Tage   -> mindestens 42 Tage      (Geändert)
  Kriterium 0cefe80e…        nicht mehr als 6 Monate -> 3 Monate              (Geändert)
  Kriterium 9c8c9b58…        mindestens 30 Tage   -> mindestens 42 Tage      (Geändert)
  Kriterium aade0289…        removed                                         (Entfallen)
  Kriterium 5b1e2c3d…        new: Stornierung mit Abgabegrund 88             (Neu)
  2.3, Kriterium f41c7278…   unchanged

These are NOT official documents; every page says so.
Usage:  python3 generate_demo_specs.py   (needs reportlab and the DejaVu fonts)
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))

OUT = Path(__file__).resolve().parent
DISCLAIMER = "DEMO – fiktive Spezifikation zur Vorführung der Änderungserkennung, kein offizielles Dokument."

TITLE = ParagraphStyle("t", fontName="DejaVu-Bold", fontSize=15, leading=19, spaceAfter=4)
H1 = ParagraphStyle("h1", fontName="DejaVu-Bold", fontSize=12, leading=15, spaceBefore=12, spaceAfter=4, keepWithNext=1)
H2 = ParagraphStyle("h2", fontName="DejaVu-Bold", fontSize=10.5, leading=13, spaceBefore=8, spaceAfter=3, keepWithNext=1)
BODY = ParagraphStyle("b", fontName="DejaVu", fontSize=9.5, leading=13, spaceAfter=5)
BULLET = ParagraphStyle("bl", parent=BODY, leftIndent=10, spaceAfter=2)

def frame(canvas, doc):
    canvas.saveState()
    canvas.setFont("DejaVu-Bold", 8)
    canvas.setFillColor(colors.HexColor("#b0102f"))
    canvas.drawString(18 * mm, 287 * mm, DISCLAIMER)
    canvas.setFont("DejaVu", 7.5)
    canvas.setFillColor(colors.HexColor("#5f6c78"))
    canvas.drawString(18 * mm, 10 * mm, f"Demo-Spezifikation DBVO · Seite {doc.page}")
    canvas.restoreState()

def build(version, stand, days, months, drop_daumen, add_storno):
    story = [
        Paragraph("Demo-Spezifikation Vorerkrankungsanfrage (DBVO)", TITLE),
        Paragraph(f"Version {version}", BODY),
        Paragraph(f"Stand: {stand}", BODY),
        Paragraph("Fiktives Beispiel, angelehnt an die Verfahrensbeschreibung DTA EEL, Abschnitt 3.12.", BODY),
        Spacer(1, 4),
        Paragraph("1 Geltungsbereich", H1),
        Paragraph("Dieses Dokument beschreibt Regeln für die Vorerkrankungsanfrage im Datenaustausch Entgeltersatzleistungen. Es dient nur der Demonstration.", BODY),
        Paragraph("2 Vorerkrankungsanfrage", H1),
        Paragraph("2.1 Voraussetzung", H2),
        Paragraph("Die Vorerkrankungsanfrage (3.1.18 „Abgabegrund“ = „41“) darf nur dann durch den Arbeitgeber ausgelöst werden, wenn", BODY),
        Paragraph("• dem Arbeitgeber für die aktuelle Arbeitsunfähigkeit eine Arbeitsunfähigkeitsbescheinigung vorliegt,", BULLET),
        Paragraph("• zusätzlich in den letzten 6 Monaten vor Beginn der aktuellen Arbeitsunfähigkeit mindestens eine bescheinigte potentielle Vorerkrankung im Datenbestand vorliegt und", BULLET),
        Paragraph(f"• die kumulierten Zeiten aller potentiellen Vorerkrankungen in den letzten 12 Monaten zusammen mit der aktuellen Arbeitsunfähigkeit zum Zeitpunkt der Meldung mindestens {days} Tage umfassen.", BULLET),
        Paragraph("2.2 Ergänzende Kriterien", H2),
        Paragraph("f41c7278-b5a5-4ec3-b321-39bca5c3aeeb Es ist systemseitig sichergestellt, dass eine Meldung mit Abgabegrund „41“ nur erzeugt werden kann, wenn sowohl die aktuelle Arbeitsunfähigkeit als auch mindestens eine vorherige Arbeitsunfähigkeit attestiert sind.", BODY),
        Paragraph(f"0cefe80e-4fd9-41e1-be4f-3ae1ecbde646 Es ist maschinell sichergestellt, dass die Meldung mit Abgabegrund „41“ nur erzeugt werden kann, wenn zwischen dem Beginn der aktuellen Arbeitsunfähigkeit und dem Ende der letzten attestierten Arbeitsunfähigkeit nicht mehr als {months} Monate liegen.", BODY),
    ]
    if not drop_daumen:
        story.append(Paragraph("aade0289-e8f9-4e12-9c49-464cf6cd0789 AU-Zeiten vor Beginn der aktuellen Arbeitsunfähigkeit werden nur dann in die Meldung mit Abgabegrund „41“ aufgenommen, wenn jeweils zwischen dem Beginn einer AU-Zeit und dem Ende der vorhergehenden AU-Zeit nicht mehr als 6 Monate liegen.", BODY))
    story.append(Paragraph(f"9c8c9b58-4d0f-4066-98ac-973095418d63 Es ist systemseitig sichergestellt, dass eine Meldung mit Abgabegrund „41“ nur erzeugt werden kann, wenn die systemseitig vorliegenden Vorerkrankungszeiten zusammen mit der aktuellen AU-Zeit mindestens {days} Tage umfassen.", BODY))
    if add_storno:
        story.append(Paragraph("5b1e2c3d-7a8f-4c21-9d3e-0f1a2b3c4d5e Es ist systemseitig sichergestellt, dass eine Stornierung mit Abgabegrund „88“ nur erzeugt werden kann, wenn zuvor eine Entgeltbescheinigung mit Abgabegrund „01“ übermittelt wurde.", BODY))
    story += [
        Paragraph("2.3 Offene Fehlzeiten", H2),
        Paragraph("Werden im Entgeltabrechnungssystem die Fehlzeiten mit einem offenen Ende verwaltet, ist zur Prüfung der Frist die AU mit einer Dauer von einer Woche in die Zukunft ab dem Tagesdatum zu beurteilen.", BODY),
    ]
    name = f"DEMO_Spezifikation_DBVO_Version_{version}.pdf"
    doc = SimpleDocTemplate(str(OUT / name), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=16 * mm, title=f"Demo-Spezifikation DBVO {version}", author="Demo (fiktiv)")
    doc.build(story, onFirstPage=frame, onLaterPages=frame)
    return name

print("written:",
      build("1.0", "01.07.2026", days=30, months=6, drop_daumen=False, add_storno=False),
      build("1.1", "01.10.2026", days=42, months=3, drop_daumen=True, add_storno=True))
