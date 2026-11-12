#!/usr/bin/env python3
"""Builds the blank tech pack template: one SVG master per page (named fields for DesignCraft
to fill from ds_tech_pack_snapshot JSON) and a merged PDF. A4 landscape, units = mm.
Run: python3 build_template.py  (needs cairosvg + pypdf + the Space Mono font installed)"""
import os, io
from xml.sax.saxutils import escape
import cairosvg
from pypdf import PdfWriter, PdfReader

W, H = 297, 210
M = 10
INK = "#111111"; GREY = "#8a8a8a"; RULE = "#111111"; FILL = "#e4e4e4"; LIGHT = "#bdbdbd"
FONT = "Space Mono, DejaVu Sans Mono, monospace"
OUT = os.path.dirname(os.path.abspath(__file__))

PAGES = [
    ("01_technical_sketch", "TECHNICAL SKETCH"),
    ("02_construction_details", "CONSTRUCTION DETAILS"),
    ("03_measurement_guide", "MEASUREMENT GUIDE"),
    ("04_measurement_chart", "MEASUREMENT CHART"),
    ("05_bill_of_materials", "BILL OF MATERIALS"),
    ("06_material_and_trims", "MATERIAL AND TRIMS"),
    ("07_colorways", "COLORWAYS"),
    ("08_artwork_details", "ARTWORK DETAILS"),
    ("09_label_details", "LABEL DETAILS"),
    ("10_hang_tag", "HANG TAG"),
    ("11_packaging", "PACKAGING"),
]


class P:
    def __init__(self):
        self.e = []

    def add(self, s):
        self.e.append(s)

    def t(self, x, y, s, size=2.4, bold=False, color=INK, anchor="start", field=None, ls=0.08):
        f = f' data-field="{field}" id="{field}"' if field else ""
        self.add(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{FONT}" font-size="{size}" '
                 f'font-weight="{"700" if bold else "400"}" fill="{color}" text-anchor="{anchor}" '
                 f'letter-spacing="{ls}"{f}>{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, w=0.25, color=RULE, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}" stroke-width="{w}"{d}/>')

    def rect(self, x, y, w, h, sw=0.25, fill="none", color=RULE, slot=None, dash=None):
        a = f' data-slot="{slot}" id="{slot}"' if slot else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}" '
                 f'stroke="{color}" stroke-width="{sw}"{a}{d}/>')

    def svg(self, pid):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}" '
                f'data-template="tech_pack" data-page="{pid}" data-version="1">\n'
                f'<rect width="{W}" height="{H}" fill="#ffffff"/>\n' + "\n".join(self.e) + "\n</svg>\n")


def header(p, title, n):
    p.t(M, 18, "TECH PACK", size=5.2, bold=True, ls=0.5)
    p.t(W - M, 18, title, size=5.2, bold=True, anchor="end", ls=0.5, field="page.title")
    p.line(M, 22, W - M, 22, w=0.35)
    p.rect(M, 25, 38, 26, sw=0.3, slot="header.logo")
    p.t(M + 19, 39, "BRAND LOGO", size=2, color=LIGHT, anchor="middle")
    cols = [
        [("BRAND", "header.brand"), ("SEASON", "header.season"), ("STYLE", "header.style_number")],
        [("DESIGNER", "header.designer"), ("DATE", "header.date"), ("CATEGORY", "header.category")],
        [("SIZE RANGE", "header.size_range"), ("MAIN FABRIC", "header.main_fabric"), ("DESCRIPTION", "header.description")],
    ]
    x0, cw = 53, (W - M - 53) / 3
    for r in range(3):
        y = 25 + r * 8.7
        p.line(x0, y + 8.7, W - M, y + 8.7, w=0.3)
        for c in range(3):
            lab, fid = cols[c][r]
            x = x0 + c * cw
            p.t(x + 1, y + 5.6, lab, size=2.3, bold=True)
            p.t(x + 26, y + 5.6, "", size=2.2, color=GREY, field=fid)
    # footer
    p.line(M, 199, W - M, 199, w=0.25)
    fy = 203.5
    p.t(M, fy, "CONFIDENTIAL · DO NOT SHARE OUTSIDE THE STUDIO PORTAL", size=1.9, color=GREY)
    p.t(150, fy, "REV", size=1.9, bold=True); p.t(157, fy, "", size=1.9, color=GREY, field="footer.revision")
    p.t(170, fy, "STATUS", size=1.9, bold=True); p.t(182, fy, "", size=1.9, color=GREY, field="footer.status")
    p.t(205, fy, "APPROVED", size=1.9, bold=True); p.t(220, fy, "", size=1.9, color=GREY, field="footer.approved_by")
    p.t(W - M, fy, f"PAGE {n} / {len(PAGES)}", size=1.9, bold=True, anchor="end", field="footer.page")
    # watermark slot (PdfCraft stamps the per-viewer watermark here on supplier copies)
    p.add('<g id="watermark" data-slot="watermark"></g>')


def panel(p, x, y, w, h, title, slot=None):
    p.rect(x, y, w, h, sw=0.3)
    p.rect(x, y, w, 5.5, sw=0.3, fill=FILL)
    p.t(x + w / 2, y + 3.9, title, size=2.3, bold=True, anchor="middle")
    if slot:
        p.add(f'<g id="{slot}" data-slot="{slot}" data-x="{x}" data-y="{y + 5.5}" data-w="{w}" data-h="{h - 5.5}"></g>')


def view(p, x, y, w, h, label, slot, hint="place flat here"):
    p.t(x + w / 2, y + 4, label, size=2.4, anchor="middle")
    p.rect(x, y + 6, w, h - 6, sw=0.2, color=LIGHT, dash="1,1", slot=slot)
    p.t(x + w / 2, y + h / 2 + 3, hint, size=2, color=LIGHT, anchor="middle")


def table(p, x, y, cols, rows, rh=5.4, repeat=None, hh=6):
    tw = sum(c[1] for c in cols)
    p.rect(x, y, tw, hh, sw=0.3, fill=FILL)
    cx = x
    for name, w in cols:
        p.t(cx + 1.2, y + hh / 2 + 0.9, name, size=2.0, bold=True)
        cx += w
    body_h = rows * rh
    p.rect(x, y, tw, hh + body_h, sw=0.3)
    for r in range(1, rows + 1):
        p.line(x, y + hh + r * rh, x + tw, y + hh + r * rh, w=0.12, color=LIGHT)
    cx = x
    for name, w in cols[:-1]:
        cx += w
        p.line(cx, y, cx, y + hh + body_h, w=0.15, color=LIGHT)
    if repeat:
        keys = ",".join(n.lower().replace(" ", "_").replace("/", "_").replace("+", "plus").replace("–", "minus")
                        .replace("#", "no").replace(".", "") for n, _ in cols)
        p.add(f'<g id="{repeat}" data-repeat="{repeat}" data-x="{x}" data-y="{y + hh}" data-row-h="{rh}" '
              f'data-rows="{rows}" data-cols="{keys}" data-widths="{",".join(str(w) for _, w in cols)}"></g>')
    return y + hh + body_h


def field_rows(p, x, y, w, pairs, rh=5.6, lw=34):
    for i, (lab, fid) in enumerate(pairs):
        yy = y + i * rh
        p.t(x + 1, yy + 3.9, lab, size=2.0, bold=True)
        p.t(x + lw, yy + 3.9, "", size=2.0, color=GREY, field=fid)
        p.line(x, yy + rh, x + w, yy + rh, w=0.12, color=LIGHT)
    return y + len(pairs) * rh


TOP = 56


def pg_sketch(p):
    view(p, 12, TOP + 4, 113, 136, "FRONT VIEW", "sketch.front")
    view(p, 129, TOP + 4, 113, 136, "BACK VIEW", "sketch.back")
    sx = 247; sw = W - M - sx
    panel(p, sx, TOP, sw, 46, "MAIN FABRIC")
    p.t(sx + sw / 2, TOP + 9.5, "", size=2, color=GREY, anchor="middle", field="sketch.main_fabric_name")
    p.rect(sx + 3, TOP + 12, sw - 6, 31, sw=0.15, color=LIGHT, slot="sketch.main_fabric_swatch")
    panel(p, sx, TOP + 49, sw, 38, "PANTONE MAIN FABRIC")
    for i in range(2):
        bx = sx + 3 + i * ((sw - 6) / 2 + 1)
        p.rect(bx, TOP + 57, (sw - 8) / 2, 18, sw=0.15, color=LIGHT, slot=f"sketch.pantone_{i + 1}.chip")
        p.t(bx, TOP + 79, "PANTONE", size=1.7, bold=True)
        p.t(bx, TOP + 82.5, "", size=1.7, color=GREY, field=f"sketch.pantone_{i + 1}.code")
    panel(p, sx, TOP + 90, sw, 50, "REFERENCE IMAGES", slot="sketch.reference_images")


def pg_construction(p):
    view(p, 50, TOP + 2, 90, 92, "FRONT VIEW", "construction.front")
    view(p, 157, TOP + 2, 90, 92, "BACK VIEW", "construction.back")
    p.add('<g id="construction.callouts" data-repeat="construction_callouts" '
          'data-style="leader:#d62828;dot:0.8;font:2.0"></g>')
    p.t(12, TOP + 8, "CALLOUTS: numbered leaders drawn", size=1.8, color=GREY)
    p.t(12, TOP + 11, "from each row's anchor point", size=1.8, color=GREY)
    table(p, 12, TOP + 97, [("#", 8), ("AREA", 40), ("OPERATION", 62), ("STITCH (ISO 4915)", 34), ("SPI", 14),
                            ("SEAM ALLOW. MM", 30), ("NOTES", 87)], 6, rh=5.0, repeat="construction")


def pg_measure_guide(p):
    view(p, 12, TOP + 2, 120, 138, "FRONT VIEW — POM MARKERS", "measure_guide.front")
    view(p, 136, TOP + 2, 60, 138, "BACK VIEW", "measure_guide.back")
    p.add('<g id="measure_guide.markers" data-repeat="pom_markers" data-style="arrow:#d62828;label:2.2"></g>')
    table(p, 200, TOP + 2, [("POM", 12), ("DESCRIPTION", 35), ("HOW TO MEASURE", 40)], 22, rh=5.6, repeat="pom_guide")


def pg_measure_chart(p):
    cols = [("POM", 12), ("DESCRIPTION", 58), ("TOL +", 13), ("TOL –", 13)]
    for i in range(8):
        cols.append((f"S{i + 1}", 20))
    cols.append(("GRADE", 17))
    end = table(p, 12, TOP + 2, cols, 22, rh=5.4, repeat="measurements")
    p.t(12, end + 4.5, "UNIT", size=2, bold=True); p.t(22, end + 4.5, "", size=2, color=GREY, field="measurements.unit")
    p.t(45, end + 4.5, "BASE SIZE", size=2, bold=True); p.t(65, end + 4.5, "", size=2, color=GREY, field="measurements.base_size")
    p.t(90, end + 4.5, "Size columns S1–S8 are renamed from the tech pack's size range; base size column is shaded.",
        size=1.8, color=GREY)


def pg_bom(p):
    cols = [("#", 8), ("COMPONENT", 30), ("PLACEMENT", 30), ("MATERIAL CODE", 26), ("DESCRIPTION", 56),
            ("COMPOSITION / GSM", 34), ("COLOR", 22), ("SUPPLIER", 28), ("QTY", 12), ("UOM", 11), ("UNIT COST", 18)]
    end = table(p, 12, TOP + 2, cols, 21, rh=5.6, repeat="bom")
    p.t(12, end + 4.5, "UNIT COST is internal: PdfCraft removes the column on supplier copies.", size=1.8, color=GREY)


def pg_materials(p):
    cw, ch = 44, 66
    for i in range(12):
        r, c = divmod(i, 6)
        x = 12 + c * (cw + 2.2); y = TOP + 2 + r * (ch + 4)
        p.rect(x, y, cw, ch, sw=0.3)
        p.rect(x + 2, y + 2, cw - 4, 26, sw=0.15, color=LIGHT, slot=f"materials.{i + 1}.swatch")
        yy = y + 30
        for lab, k in [("NAME", "name"), ("CODE", "code"), ("COMP.", "composition"), ("GSM", "weight_gsm"),
                       ("COLOR", "color_ref"), ("SUPPLIER", "supplier"), ("USE", "placement")]:
            p.t(x + 1.5, yy + 3, lab, size=1.7, bold=True)
            p.t(x + 15, yy + 3, "", size=1.7, color=GREY, field=f"materials.{i + 1}.{k}")
            yy += 5
    p.add('<g id="materials" data-repeat="materials" data-cards="12"></g>')


def pg_colorways(p):
    cw = 67
    for i in range(4):
        x = 12 + i * (cw + 2.3)
        p.rect(x, TOP + 2, cw, 70, sw=0.3)
        p.rect(x, TOP + 2, cw, 6, sw=0.3, fill=FILL)
        p.t(x + 2, TOP + 6, f"COLORWAY {i + 1}", size=2.1, bold=True)
        p.t(x + cw - 2, TOP + 6, "", size=2.0, color=GREY, anchor="end", field=f"colorways.{i + 1}.name")
        p.rect(x + 3, TOP + 10, cw - 6, 44, sw=0.15, color=LIGHT, dash="1,1", slot=f"colorways.{i + 1}.render")
        p.rect(x + 3, TOP + 57, 12, 12, sw=0.15, color=LIGHT, slot=f"colorways.{i + 1}.chip")
        p.t(x + 18, TOP + 61, "BODY", size=1.8, bold=True)
        p.t(x + 30, TOP + 61, "", size=1.8, color=GREY, field=f"colorways.{i + 1}.hex")
        p.t(x + 18, TOP + 66, "PANTONE", size=1.8, bold=True)
        p.t(x + 34, TOP + 66, "", size=1.8, color=GREY, field=f"colorways.{i + 1}.pantone")
    table(p, 12, TOP + 76, [("COMPONENT", 69), ("COLORWAY 1", 51.5), ("COLORWAY 2", 51.5), ("COLORWAY 3", 51.5),
                            ("COLORWAY 4", 51.5)], 10, rh=5.4, repeat="colorway_components")


def pg_artwork(p):
    panel(p, 12, TOP + 2, 88, 70, "ARTWORK", slot="artwork.image")
    view(p, 105, TOP + 2, 90, 70, "PLACEMENT — FRONT", "artwork.placement_front")
    view(p, 200, TOP + 2, 85, 70, "PLACEMENT — BACK", "artwork.placement_back")
    table(p, 12, TOP + 76, [("#", 8), ("ARTWORK", 34), ("VIEW", 16), ("PLACEMENT", 32), ("TECHNIQUE", 30),
                            ("W × H MM", 24), ("FROM", 16), ("OFFSET X / Y MM", 30), ("PANTONE / THREAD", 47),
                            ("STITCHES", 18), ("NOTES", 18)], 9, rh=5.4, repeat="artwork")


def label_card(p, x, y, w, h, title, key, extra=()):
    panel(p, x, y, w, h, title)
    p.rect(x + 3, y + 8, w - 6, 34, sw=0.15, color=LIGHT, dash="1,1", slot=f"labels.{key}.artwork")
    rows = [("TYPE", f"labels.{key}.type"), ("SIZE MM", f"labels.{key}.size_mm"), ("MATERIAL", f"labels.{key}.material"),
            ("COLOR", f"labels.{key}.color"), ("ATTACH", f"labels.{key}.attachment"),
            ("POSITION", f"labels.{key}.placement")] + list(extra)
    field_rows(p, x + 2, y + 44, w - 4, rows, rh=5.2, lw=20)


def pg_labels(p):
    w = 67
    label_card(p, 12, TOP + 2, w, 137, "MAIN / BRAND LABEL", "main", [("TEXT", "labels.main.text")])
    label_card(p, 12 + (w + 2.3), TOP + 2, w, 137, "SIZE LABEL", "size", [("SIZES", "labels.size.text")])
    label_card(p, 12 + 2 * (w + 2.3), TOP + 2, w, 137, "CARE / CONTENT LABEL", "care",
               [("FIBRE", "labels.care.fibre"), ("COUNTRY", "labels.care.country"), ("CARE TEXT", "labels.care.text"),
                ("SYMBOLS", "labels.care.symbols")])
    label_card(p, 12 + 3 * (w + 2.3), TOP + 2, w, 137, "ADDITIONAL LABEL", "extra", [("TEXT", "labels.extra.text")])


def pg_hangtag(p):
    panel(p, 12, TOP + 2, 70, 92, "TAG FRONT", slot="hangtag.front")
    panel(p, 86, TOP + 2, 70, 92, "TAG BACK", slot="hangtag.back")
    panel(p, 160, TOP + 2, 125, 137, "SPECIFICATION")
    field_rows(p, 162, TOP + 9, 121, [
        ("SIZE (W × H MM)", "hangtag.size_mm"), ("SHAPE / CORNERS", "hangtag.shape"), ("STOCK / GSM", "hangtag.stock"),
        ("PRINT", "hangtag.print"), ("FINISH", "hangtag.finish"), ("HOLE / EYELET", "hangtag.eyelet"),
        ("FASTENER", "hangtag.fastener"), ("FASTENER COLOR", "hangtag.fastener_color"),
        ("ATTACH POSITION", "hangtag.placement"), ("BARCODE / UPC", "hangtag.barcode"), ("PRICE", "hangtag.price"),
        ("SUPPLIER", "hangtag.supplier"), ("NOTES", "hangtag.notes")], rh=9.6, lw=38)
    view(p, 12, TOP + 97, 144, 42, "ATTACHMENT DIAGRAM", "hangtag.attach_diagram", hint="where and how the tag attaches")


def pg_packaging(p):
    panel(p, 12, TOP + 2, 273, 52, "FOLDING METHOD")
    sw = (273 - 6 - 3 * 3) / 4
    for i in range(4):
        x = 15 + i * (sw + 3)
        p.rect(x, TOP + 10, sw, 36, sw=0.15, color=LIGHT, dash="1,1", slot=f"packaging.fold_step_{i + 1}")
        p.t(x + 1.5, TOP + 50.5, f"STEP {i + 1}", size=1.9, bold=True)
        p.t(x + 14, TOP + 50.5, "", size=1.8, color=GREY, field=f"packaging.fold_step_{i + 1}.text")
    y2 = TOP + 58
    panel(p, 12, y2, 88, 80, "POLYBAG")
    field_rows(p, 14, y2 + 7, 84, [("SIZE MM", "packaging.polybag.size_mm"), ("THICKNESS", "packaging.polybag.thickness"),
                                    ("MATERIAL", "packaging.polybag.material"), ("CLOSURE", "packaging.polybag.closure"),
                                    ("WARNING", "packaging.polybag.warning"), ("PRINT", "packaging.polybag.print"),
                                    ("STICKER", "packaging.polybag.sticker"), ("UNITS / BAG", "packaging.polybag.units")],
               rh=8.3, lw=26)
    panel(p, 104, y2, 88, 80, "CARTON")
    field_rows(p, 106, y2 + 7, 84, [("DIMENSIONS", "packaging.carton.size_mm"), ("PLY / GRADE", "packaging.carton.ply"),
                                     ("MAX WEIGHT", "packaging.carton.max_kg"), ("UNITS / CTN", "packaging.carton.units"),
                                     ("SIZE RATIO", "packaging.carton.ratio"), ("ASSORTMENT", "packaging.carton.assortment"),
                                     ("TAPE", "packaging.carton.tape"), ("MARKINGS", "packaging.carton.markings")],
               rh=8.3, lw=26)
    panel(p, 196, y2, 89, 80, "CARTON MARKING / LABELS", slot="packaging.carton_marking")


BUILDERS = [pg_sketch, pg_construction, pg_measure_guide, pg_measure_chart, pg_bom, pg_materials, pg_colorways,
            pg_artwork, pg_labels, pg_hangtag, pg_packaging]


def main():
    svgdir = os.path.join(OUT, "svg"); os.makedirs(svgdir, exist_ok=True)
    writer = PdfWriter()
    for n, ((pid, title), fn) in enumerate(zip(PAGES, BUILDERS), 1):
        p = P(); header(p, title, n); fn(p)
        s = p.svg(pid)
        open(os.path.join(svgdir, f"{pid}.svg"), "w").write(s)
        pdf = cairosvg.svg2pdf(bytestring=s.encode())
        for pg in PdfReader(io.BytesIO(pdf)).pages:
            writer.add_page(pg)
    writer.add_metadata({"/Title": "Blank Tech Pack Template (A4 landscape, 11 pages)", "/Author": "Perplexity Computer"})
    with open(os.path.join(OUT, "blank_tech_pack_template.pdf"), "wb") as f:
        writer.write(f)
    print("ok")


if __name__ == "__main__":
    main()
