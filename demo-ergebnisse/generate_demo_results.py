"""
Generates three FICTIONAL payroll-software result logs (demo1.pdf … demo3.pdf)
for the "Validierung & Bericht" page.

They imitate the processing log a payroll program could export after a test run
of the DBVO scenario (Vorerkrankungsanfrage, Abgabegrund 41) from the DTA EEL
procedure description 13.4, section 3.12, and the "Hinweise zur
Testkonstellation". Every page is marked as demo data: no real payroll run,
no real person, no transmission to a health insurer took place.

  demo1.pdf  all prerequisites met, query 41 created           -> expected: Bestanden
  demo2.pdf  29 accumulated days, query 41 created anyway       -> expected: Abweichung
  demo3.pdf  no AU certificate, query correctly blocked;
             page 2 of the log exported incompletely             -> expected: teils nicht feststellbar

Usage:  python3 generate_demo_results.py   (needs reportlab and the DejaVu fonts)
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))

OUT = Path(__file__).resolve().parent
SOFTWARE = "Musterlohn Demo 4.2 (fiktive Entgeltabrechnungssoftware)"
DISCLAIMER = "DEMO-DATEN – fiktiv. Kein echter Abrechnungslauf, keine echte Person, keine Übermittlung an eine Krankenkasse."

H1 = ParagraphStyle("h1", fontName="DejaVu-Bold", fontSize=15, leading=19, spaceAfter=4)
H2 = ParagraphStyle("h2", fontName="DejaVu-Bold", fontSize=11, leading=14, spaceBefore=10, spaceAfter=4, keepWithNext=1)
BODY = ParagraphStyle("body", fontName="DejaVu", fontSize=9, leading=12)
WARN = ParagraphStyle("warn", parent=BODY, textColor=colors.HexColor("#b0102f"))
CELL = ParagraphStyle("cell", fontName="DejaVu", fontSize=8, leading=10)
HEAD = ParagraphStyle("head", parent=CELL, fontName="DejaVu-Bold")
SMALL = ParagraphStyle("small", parent=CELL, fontSize=7, leading=9)
SMALL_HEAD = ParagraphStyle("smallhead", parent=SMALL, fontName="DejaVu-Bold")

def table(rows, widths, small=False):
    # Paragraph cells wrap long values instead of overflowing the column.
    body, head = (SMALL, SMALL_HEAD) if small else (CELL, HEAD)
    wrapped = [[Paragraph(str(cell), head if r == 0 else body) for cell in row] for r, row in enumerate(rows)]
    t = Table(wrapped, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "DejaVu", 8),
        ("FONT", (0, 0), (-1, 0), "DejaVu-Bold", 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef1f5")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d1da")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t

def kv(rows):
    return table([["Feld", "Wert"], *rows], [70 * mm, 100 * mm])

def frame(canvas, doc):
    canvas.saveState()
    canvas.setFont("DejaVu-Bold", 8)
    canvas.setFillColor(colors.HexColor("#b0102f"))
    canvas.drawString(18 * mm, 287 * mm, DISCLAIMER)
    canvas.setFont("DejaVu", 7.5)
    canvas.setFillColor(colors.HexColor("#5f6c78"))
    canvas.drawString(18 * mm, 10 * mm, f"{SOFTWARE} · Verarbeitungsprotokoll DTA EEL · Seite {doc.page}")
    canvas.restoreState()

def build(name, run):
    story = [
        Paragraph("Verarbeitungsprotokoll DTA EEL – Testlauf", H1),
        Paragraph(SOFTWARE, BODY),
        Spacer(1, 4),
        kv([
            ["Testlauf-ID", run["id"]],
            ["Erstellt am", run["created"]],
            ["Szenario", run["scenario"]],
            ["Bezug", "Verfahrensbeschreibung DTA EEL Version 13.4, Abschnitt 3.12 Datenbaustein DBVO – Vorerkrankungszeiten"],
        ]),
        Paragraph("1 Stammdaten", H2),
        kv([
            ["Arbeitnehmer", "Erika Musterfrau (fiktiv)"],
            ["Personalnummer", "DEMO-000123"],
            ["Krankenkasse", "Demo-BKK (fiktiv)"],
            ["Ende der Beschäftigung", run.get("employment_end", "–")],
        ]),
        Paragraph("2 Im System hinterlegte AU-Zeiten", H2),
        table([["Nr", "Beginn", "Ende", "Kalendertage", "Nachweis", "Art"], *run["au"]],
              [10 * mm, 24 * mm, 24 * mm, 28 * mm, 46 * mm, 40 * mm]),
        Paragraph("3 Prüfung der Voraussetzungen (Programmprotokoll)", H2),
        kv(run["checks"]),
    ]
    for note in run.get("notes", []):
        story.append(Paragraph(note, WARN))
    if run.get("page_break"):
        story.append(PageBreak())
    story += [Paragraph("4 Erzeugte Meldungen", H2)]
    if run["messages"]:
        story.append(table([["Nr", "Richtung", "Baustein", "Abgabegrund", "Storno", "DSID / REF-ID", "Status"], *run["messages"]],
                           [7 * mm, 17 * mm, 22 * mm, 22 * mm, 12 * mm, 58 * mm, 34 * mm], small=True))
    else:
        story.append(Paragraph("Keine Meldung erzeugt.", BODY))
    if run.get("dbvo"):
        story += [Paragraph("5 Datenbaustein DBVO (Auszug)", H2), kv(run["dbvo"])]
    story += [Paragraph("6 Ergebnis des Testlaufs", H2), kv(run["result"])]
    for note in run.get("tail_notes", []):
        story.append(Paragraph(note, WARN))
    doc = SimpleDocTemplate(str(OUT / name), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=16 * mm, title=f"{name} – Demo-Ergebnis", author="Demo (fiktiv)")
    doc.build(story, onFirstPage=frame, onLaterPages=frame)

DSID_41 = "11111111-2222-AAAA-EEEE-111111111111"

# demo1 – constellation of the "Hinweise zur Testkonstellation": 2+17+3+3+10 = 35 days >= 30.
build("demo1.pdf", {
    "id": "DEMO-01",
    "created": "27.10.2026 09:12",
    "scenario": "DBVO – Vorerkrankungsanfrage (Abgabegrund 41), alle Voraussetzungen erfüllt",
    "employment_end": "31.03.2026",
    "au": [
        ["1", "14.07.2025", "15.07.2025", "2", "eAU", "Vorerkrankung"],
        ["2", "01.10.2025", "17.10.2025", "17", "eAU", "Vorerkrankung"],
        ["3", "01.12.2025", "03.12.2025", "3", "eAU", "Vorerkrankung"],
        ["4", "01.03.2026", "03.03.2026", "3", "Papiernachweis beim AG", "Vorerkrankung"],
        ["5", "11.03.2026", "20.03.2026", "10", "eAU", "aktuelle AU"],
    ],
    "checks": [
        ["AU-Bescheinigung für aktuelle AU", "vorhanden (eAU)"],
        ["Bescheinigte Vorerkrankung in den letzten 6 Monaten", "ja (01.03.2026 bis 03.03.2026)"],
        ["Kumulierte AU-Tage (12 Monate, inkl. aktueller AU)", "35"],
        ["Schwellenwert 30 Tage erreicht", "ja"],
        ["Ergebnis der Prüfung", "Vorerkrankungsanfrage zulässig"],
    ],
    "messages": [
        ["1", "AG → KK", "DSKO + DBVO", "41", "N", DSID_41, "übermittelt (simuliert)"],
        ["2", "KK → AG", "DBVO", "61", "N", DSID_41, "empfangen (simuliert)"],
    ],
    "dbvo": [
        ["Anzahl der zu prüfenden Arbeitsunfähigkeiten", "4"],
        ["Beginn-AU-01 / Ende-AU-01", "14.07.2025 / 15.07.2025"],
        ["Beginn-AU-02 / Ende-AU-02", "01.10.2025 / 17.10.2025"],
        ["Beginn-AU-03 / Ende-AU-03", "01.12.2025 / 03.12.2025"],
        ["Beginn-AU-04 / Ende-AU-04", "01.03.2026 / 03.03.2026"],
        ["Beginn 12-Monatsfrist (Rückmeldung KK)", "14.07.2025"],
    ],
    "result": [
        ["Meldung wird erzeugt", "ja"],
        ["Vorgang ist zulässig", "ja"],
        ["Abgabegrund", "41"],
        ["Anzahl Vorerkrankungen", "4"],
        ["Kumulierte AU-Tage", "35"],
        ["Rückmeldung der Krankenkasse", "Abgabegrund 61"],
    ],
})

# demo2 – 17 + 3 + 9 = 29 days < 30, but the program creates query 41 anyway (deliberate defect).
build("demo2.pdf", {
    "id": "DEMO-02",
    "created": "27.10.2026 09:31",
    "scenario": "DBVO – Grenzwert mindestens 30 Tage: 29 Tage (Schwellenwert nicht erreicht)",
    "employment_end": "–",
    "au": [
        ["1", "01.10.2025", "17.10.2025", "17", "eAU", "Vorerkrankung"],
        ["2", "01.03.2026", "03.03.2026", "3", "eAU", "Vorerkrankung"],
        ["3", "11.03.2026", "19.03.2026", "9", "eAU", "aktuelle AU"],
    ],
    "checks": [
        ["AU-Bescheinigung für aktuelle AU", "vorhanden (eAU)"],
        ["Bescheinigte Vorerkrankung in den letzten 6 Monaten", "ja (01.03.2026 bis 03.03.2026)"],
        ["Kumulierte AU-Tage (12 Monate, inkl. aktueller AU)", "29"],
        ["Schwellenwert 30 Tage erreicht", "nein"],
        ["Ergebnis der Prüfung", "Vorerkrankungsanfrage erzeugt"],
    ],
    "notes": ["Hinweis W-117: Plausibilitätsprüfung „Schwellenwert 30 Tage“ übersprungen (Konfiguration DEMO-FEHLER)."],
    "messages": [
        ["1", "AG → KK", "DSKO + DBVO", "41", "N", "22222222-3333-BBBB-FFFF-222222222222", "übermittelt (simuliert)"],
    ],
    "dbvo": [
        ["Anzahl der zu prüfenden Arbeitsunfähigkeiten", "2"],
        ["Beginn-AU-01 / Ende-AU-01", "01.10.2025 / 17.10.2025"],
        ["Beginn-AU-02 / Ende-AU-02", "01.03.2026 / 03.03.2026"],
    ],
    "result": [
        ["Meldung wird erzeugt", "ja"],
        ["Vorgang ist zulässig", "ja"],
        ["Abgabegrund", "41"],
        ["Anzahl Vorerkrankungen", "2"],
        ["Kumulierte AU-Tage", "29"],
    ],
})

# demo3 – current AU only reported, no certificate: query correctly blocked; page 2 incomplete.
build("demo3.pdf", {
    "id": "DEMO-03",
    "created": "27.10.2026 09:48",
    "scenario": "DBVO – Bedingung 1 nicht erfüllt: keine Arbeitsunfähigkeitsbescheinigung für die aktuelle AU",
    "employment_end": "–",
    "au": [
        ["1", "01.10.2025", "17.10.2025", "17", "eAU", "Vorerkrankung"],
        ["2", "01.12.2025", "21.12.2025", "21", "eAU", "Vorerkrankung"],
        ["3", "11.03.2026", "13.03.2026", "3", "ohne Bescheinigung (Krankmeldung)", "aktuelle AU"],
    ],
    "checks": [
        ["AU-Bescheinigung für aktuelle AU", "nicht vorhanden"],
        ["Bescheinigte Vorerkrankung in den letzten 6 Monaten", "ja (01.12.2025 bis 21.12.2025)"],
        ["Kumulierte AU-Tage (12 Monate, inkl. aktueller AU)", "41"],
        ["Ergebnis der Prüfung", "Vorerkrankungsanfrage nicht zulässig – keine AU-Bescheinigung für die aktuelle AU"],
    ],
    "page_break": True,
    "messages": [],
    "result": [
        ["Meldung wird erzeugt", "nein"],
        ["Vorgang ist zulässig", "nein"],
        ["Abgabegrund", "– (keine Meldung)"],
    ],
    "tail_notes": [
        "Export-Hinweis E-204: Protokollseite 2 unvollständig exportiert – Datenbaustein DBVO und Anzahl der Vorerkrankungen fehlen im Ausdruck.",
    ],
})

print("written:", ", ".join(f"demo{i}.pdf" for i in (1, 2, 3)))
