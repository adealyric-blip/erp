// techpack-render — fill() + validateTemplate() (T13b).
// Pure string surgery over the SVG masters (no DOM): safe in Node and in
// the browser. One function, three jobs: write data-field text, paint
// colour chips into data-slot rects, and render data-repeat row groups
// (with continuation pages when a table overflows its page).

import {
  TEMPLATE_PAGES,
  type FillMode,
  type FillOptions,
  type FillResult,
  type FilledPage,
  type TechPackSnapshot,
  type TemplateValidation,
} from './types';

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const str = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v);

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 3) return s.slice(0, max);
  return `${s.slice(0, max - 1)}…`;
}

/** Humanise a data-cols token for the table header row. */
export function humaniseCol(col: string, sizes: string[]): string {
  if (/^s[1-8]$/.test(col)) {
    const i = Number(col.slice(1)) - 1;
    return sizes[i] ?? col.toUpperCase();
  }
  return col
    .replace(/___/g, ' / ')
    .replace(/_/g, ' ')
    .replace(/\(iso 4915\)/i, '(ISO 4915)')
    .toUpperCase();
}

// ---------------------------------------------------------------------
// Value resolution: snapshot -> flat field map + slot colour fills
// ---------------------------------------------------------------------
export interface ResolvedMaps {
  fields: Record<string, string>;
  slotFills: Record<string, string>;
  repeatRows: Record<string, Record<string, string>[]>;
}

function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(str(v));
  if (Number.isNaN(d.getTime())) return str(v);
  return d.toISOString().slice(0, 10);
}

export function resolveMaps(snapshot: TechPackSnapshot, mode: FillMode): ResolvedMaps {
  const tp = (snapshot.tech_pack ?? {}) as Record<string, unknown>;
  const header = (snapshot.header ?? {}) as Record<string, unknown>;
  const sizeRange = (snapshot.size_range ?? {}) as Record<string, unknown>;
  const sizes: string[] = Array.isArray(header.size_range)
    ? (header.size_range as string[])
    : Array.isArray(sizeRange.sizes)
      ? (sizeRange.sizes as string[])
      : [];
  const baseSize = str(header.base_size ?? tp.base_size ?? '');
  const unit = str(header.measure_unit ?? tp.measure_unit ?? 'cm');
  const colorways = snapshot.colorways ?? [];
  const bom = snapshot.bom ?? [];
  const mainFabric = (header.main_fabric ?? {}) as Record<string, unknown>;
  const labels = snapshot.labels ?? [];
  const hangtag = (snapshot.hangtags ?? [])[0] as Record<string, unknown> | undefined;
  const packaging = (snapshot.packaging ?? {}) as Record<string, unknown>;
  const foldSteps: Record<string, unknown>[] = Array.isArray(packaging.fold_steps)
    ? (packaging.fold_steps as Record<string, unknown>[])
    : [];

  const fields: Record<string, string> = {};
  // Header block (identical on every page) + footer.
  fields['header.brand'] = str(header.brand ?? '');
  fields['header.designer'] = str(header.designer ?? header.designer_id ?? '');
  fields['header.size_range'] = sizes.length ? `${sizes[0]}–${sizes[sizes.length - 1]}` : '';
  fields['header.season'] = str(header.season ?? '');
  fields['header.date'] = fmtDate(header.date ?? tp.updated_at ?? '');
  fields['header.main_fabric'] = str(mainFabric.description ?? '');
  fields['header.style_number'] = str(header.style_number ?? tp.style_number ?? '');
  fields['header.category'] = str(header.category ?? '');
  fields['header.description'] = str(header.description ?? tp.description ?? '');
  fields['footer.revision'] = `REV ${str(header.revision ?? tp.revision ?? 1)}`;
  fields['footer.status'] = str(header.status ?? tp.status ?? 'draft').toUpperCase();
  fields['footer.approved_by'] = str(header.approved_by ?? tp.approved_by ?? '—');
  fields['footer.page'] = ''; // set per emitted page
  // Sketch page.
  const firstPantoness: string[] = (() => {
    const cw = colorways[0] as Record<string, unknown> | undefined;
    return Array.isArray(cw?.pantone_codes) ? (cw.pantone_codes as string[]) : [];
  })();
  fields['sketch.main_fabric_name'] = str(mainFabric.description ?? '');
  fields['sketch.pantone_1.code'] = firstPantoness[0] ?? '';
  fields['sketch.pantone_2.code'] = firstPantoness[1] ?? '';
  // Measurement chart.
  fields['measurements.base_size'] = baseSize;
  fields['measurements.unit'] = unit;
  // Materials page (distinct BOM materials, fabric first then trims).
  const materials = [...bom].sort((a, b) => {
    const rank = (r: Record<string, unknown>) => (r.kind === 'fabric' ? 0 : 1);
    return rank(a) - rank(b);
  });
  for (let i = 0; i < 12; i++) {
    const m = materials[i] as Record<string, unknown> | undefined;
    const n = i + 1;
    fields[`materials.${n}.name`] = str(m?.description ?? '');
    fields[`materials.${n}.code`] = str(m?.material_code ?? '');
    fields[`materials.${n}.composition`] = str(m?.composition ?? '');
    fields[`materials.${n}.weight_gsm`] = m?.weight_gsm !== undefined && m?.weight_gsm !== null ? str(m.weight_gsm) : '';
    fields[`materials.${n}.placement`] = str(m?.placement ?? '');
    fields[`materials.${n}.color_ref`] = str(m?.color_name ?? m?.color ?? '');
    fields[`materials.${n}.supplier`] = str(m?.supplier_name ?? m?.supplier ?? '');
  }
  // Colorways page.
  for (let i = 0; i < 4; i++) {
    const cw = colorways[i] as Record<string, unknown> | undefined;
    const n = i + 1;
    fields[`colorways.${n}.name`] = str(cw?.name ?? '');
    fields[`colorways.${n}.hex`] = str(cw?.garment_color_hex ?? cw?.hex ?? '');
    const pantones: string[] = Array.isArray(cw?.pantone_codes) ? (cw.pantone_codes as string[]) : [];
    fields[`colorways.${n}.pantone`] = pantones[0] ?? '';
  }
  // Labels page (one block per kind).
  for (const kind of ['main', 'size', 'care', 'extra']) {
    const l = labels.find((x) => str(x.kind) === kind) as Record<string, unknown> | undefined;
    const fibre: Record<string, unknown>[] = Array.isArray(l?.fibre_content)
      ? (l.fibre_content as Record<string, unknown>[])
      : [];
    fields[`labels.${kind}.type`] = str(l?.label_type ?? '');
    fields[`labels.${kind}.material`] = str(l?.material_name ?? '');
    fields[`labels.${kind}.size_mm`] =
      l?.width_mm && l?.height_mm ? `${l.width_mm} × ${l.height_mm} mm` : '';
    fields[`labels.${kind}.color`] = str(l?.color ?? '');
    fields[`labels.${kind}.attachment`] = str(l?.attachment ?? '');
    fields[`labels.${kind}.placement`] = str(l?.placement ?? '');
    fields[`labels.${kind}.text`] = str(l?.text ?? '');
    if (kind === 'care') {
      fields['labels.care.fibre'] = fibre.map((f) => `${f.fibre} ${f.pct}%`).join(' / ');
      fields['labels.care.country'] = str(l?.country_of_origin ?? '');
      fields['labels.care.symbols'] = Array.isArray(l?.care_symbols)
        ? (l.care_symbols as string[]).join(' · ')
        : '';
    }
  }
  // Hang tag page.
  if (hangtag) {
    fields['hangtag.size_mm'] =
      hangtag.width_mm && hangtag.height_mm ? `${hangtag.width_mm} × ${hangtag.height_mm} mm` : '';
    fields['hangtag.shape'] = str(hangtag.shape ?? '');
    fields['hangtag.stock'] = str(hangtag.stock ?? '');
    fields['hangtag.print'] = str(hangtag.print ?? '');
    fields['hangtag.finish'] = str(hangtag.finish ?? '');
    fields['hangtag.eyelet'] = str(hangtag.eyelet ?? '');
    fields['hangtag.fastener'] = str(hangtag.fastener ?? '');
    fields['hangtag.fastener_color'] = str(hangtag.fastener_color ?? '');
    fields['hangtag.placement'] = str(hangtag.placement ?? '');
    fields['hangtag.barcode'] = str(hangtag.barcode_value ?? '');
    fields['hangtag.price'] =
      hangtag.retail_price !== undefined && hangtag.retail_price !== null
        ? `${hangtag.currency ?? 'USD'} ${hangtag.retail_price}`
        : '';
    fields['hangtag.supplier'] = str(hangtag.supplier_name ?? hangtag.vendor_id ?? '');
    fields['hangtag.notes'] = str(hangtag.notes ?? '');
  }
  // Packaging page.
  for (let i = 0; i < 4; i++) {
    fields[`packaging.fold_step_${i + 1}.text`] = str(foldSteps[i]?.text ?? '');
  }
  fields['packaging.polybag.size_mm'] = str(packaging.polybag_size_mm ?? '');
  fields['packaging.polybag.thickness'] =
    packaging.polybag_thickness_micron !== undefined && packaging.polybag_thickness_micron !== null
      ? `${packaging.polybag_thickness_micron} micron`
      : '';
  fields['packaging.polybag.material'] = str(packaging.polybag_material ?? '');
  fields['packaging.polybag.closure'] = str(packaging.polybag_closure ?? '');
  fields['packaging.polybag.warning'] = str(packaging.polybag_warning ?? '');
  fields['packaging.polybag.print'] = str(packaging.polybag_print ?? '');
  fields['packaging.polybag.sticker'] = str(packaging.polybag_sticker ?? '');
  fields['packaging.polybag.units'] =
    packaging.polybag_units !== undefined && packaging.polybag_units !== null ? str(packaging.polybag_units) : '';
  fields['packaging.carton.size_mm'] = str(packaging.carton_size_mm ?? '');
  fields['packaging.carton.ply'] =
    packaging.carton_ply !== undefined && packaging.carton_ply !== null ? str(packaging.carton_ply) : '';
  fields['packaging.carton.max_kg'] =
    packaging.carton_max_kg !== undefined && packaging.carton_max_kg !== null ? str(packaging.carton_max_kg) : '';
  fields['packaging.carton.units'] =
    packaging.carton_units !== undefined && packaging.carton_units !== null ? str(packaging.carton_units) : '';
  const ratio = packaging.carton_size_ratio as Record<string, unknown> | undefined;
  fields['packaging.carton.ratio'] = ratio
    ? Object.entries(ratio).map(([k, v]) => `${k}:${v}`).join(' / ')
    : '';
  fields['packaging.carton.assortment'] = str(packaging.carton_assortment ?? '');
  fields['packaging.carton.tape'] = str(packaging.carton_tape ?? '');
  fields['packaging.carton.markings'] = packaging.carton_markings_asset_id ? 'See artwork' : '';

  // Slot colour fills (chips + swatches).
  const slotFills: Record<string, string> = {};
  for (let i = 0; i < 4; i++) {
    const cw = colorways[i] as Record<string, unknown> | undefined;
    const hex = str(cw?.garment_color_hex ?? cw?.hex ?? '');
    if (hex) slotFills[`colorways.${i + 1}.chip`] = hex;
  }
  for (let i = 0; i < 12; i++) {
    const m = materials[i] as Record<string, unknown> | undefined;
    const hex = str(m?.color_hex ?? '');
    if (hex) slotFills[`materials.${i + 1}.swatch`] = hex;
  }
  const mainHex = str((bom.find((b) => b.is_main_fabric) as Record<string, unknown> | undefined)?.color_hex ?? '');
  if (mainHex) slotFills['sketch.main_fabric_swatch'] = mainHex;

  // Repeat rows.
  const repeatRows: Record<string, Record<string, string>[]> = {};
  // Measurements: one row per POM, s1..s8 = per-size values.
  const byPom = new Map<string, { name: string; sizes: Record<string, string>; tolPlus: string; tolMinus: string; grade: string }>();
  for (const m of snapshot.measurements ?? []) {
    const pom = str(m.pom ?? m.pom_code ?? '');
    const cur = byPom.get(pom) ?? { name: str(m.name ?? ''), sizes: {}, tolPlus: '', tolMinus: '', grade: '' };
    cur.name = str(m.name ?? cur.name);
    cur.sizes[str(m.size ?? '')] = str(m.value ?? '');
    cur.tolPlus = str(m.tol_plus ?? cur.tolPlus);
    cur.tolMinus = str(m.tol_minus ?? cur.tolMinus);
    cur.grade = str(m.grade ?? cur.grade);
    byPom.set(pom, cur);
  }
  repeatRows.measurements = [...byPom.entries()].map(([pom, r]) => {
    const row: Record<string, string> = {
      pom,
      description: r.name,
      tol_plus: r.tolPlus,
      tol_minus: r.tolMinus,
      grade: r.grade,
    };
    sizes.slice(0, 8).forEach((s, i) => {
      row[`s${i + 1}`] = r.sizes[s] ?? '';
    });
    return row;
  });
  // BOM (supplier mode drops the unit_cost column at render time).
  repeatRows.bom = bom.map((b, i) => ({
    no: String(i + 1),
    component: str(b.description ?? ''),
    placement: str(b.placement ?? ''),
    material_code: str(b.material_code ?? ''),
    description: str(b.description ?? ''),
    composition___gsm: str(b.composition ?? ''),
    color: str(b.color_name ?? b.color ?? ''),
    supplier: str(b.supplier_name ?? b.supplier ?? ''),
    qty: str(b.quantity ?? ''),
    uom: str(b.uom ?? ''),
    unit_cost: b.unit_cost !== undefined && b.unit_cost !== null ? str(b.unit_cost) : '',
  }));
  // Construction table + callouts.
  const construction = snapshot.construction ?? [];
  repeatRows.construction = construction.map((c, i) => ({
    no: String(c.callout_no ?? i + 1),
    area: str(c.area ?? ''),
    operation: str(c.operation ?? ''),
    'stitch_(iso_4915)': str(c.stitch_type ?? ''),
    spi: str(c.spi ?? ''),
    seam_allow_mm: str(c.seam_allowance_mm ?? ''),
    notes: str(c.notes ?? ''),
  }));
  repeatRows.construction_callouts = construction.map((c, i) => ({
    no: String(c.callout_no ?? i + 1),
    view: str(c.view ?? 'front'),
    anchor_x: str(c.anchor_x ?? ''),
    anchor_y: str(c.anchor_y ?? ''),
    label_x: str(c.label_x ?? ''),
    label_y: str(c.label_y ?? ''),
  }));
  // Measurement guide: POM arrows + guide table.
  const pomLib = new Map<string, Record<string, unknown>>();
  for (const p of snapshot.pom_library ?? []) pomLib.set(str(p.code ?? ''), p);
  repeatRows.pom_markers = (snapshot.pom_markers ?? []).map((m) => ({
    pom: str(m.pom ?? m.pom_code ?? ''),
    view: str(m.view ?? 'front'),
    x1: str(m.x1 ?? ''),
    y1: str(m.y1 ?? ''),
    x2: str(m.x2 ?? ''),
    y2: str(m.y2 ?? ''),
    label_x: str(m.label_x ?? ''),
    label_y: str(m.label_y ?? ''),
  }));
  repeatRows.pom_guide = (snapshot.pom_markers ?? []).map((m, i) => {
    const code = str(m.pom ?? m.pom_code ?? '');
    const lib = pomLib.get(code) ?? {};
    return {
      pom: code || String.fromCharCode(65 + i),
      description: str(m.description ?? lib.name ?? ''),
      how_to_measure: str(m.how_to_measure ?? lib.how_to_measure ?? ''),
    };
  });
  // Materials repeat is a card-count marker (fields are filled directly).
  repeatRows.materials = materials.map((m) => ({ name: str(m.description ?? '') }));
  // Colorway matrix: component x colorway. Snapshot colorway_components
  // carry bom_line_id; the fixture (and the editor) also carry the
  // component description, which is what the matrix prints.
  const components = repeatRows.bom.map((b) => b.component);
  const ccByComponent = new Map<string, Record<string, unknown>[]>();
  for (const c of snapshot.colorway_components ?? []) {
    const key = str((c as Record<string, unknown>).component ?? (c as Record<string, unknown>).color_name ?? '');
    if (!key) continue;
    const list = ccByComponent.get(key) ?? [];
    list.push(c as Record<string, unknown>);
    ccByComponent.set(key, list);
  }
  repeatRows.colorway_components = components.map((component) => {
    const row: Record<string, string> = { component };
    const entries = ccByComponent.get(component) ?? [];
    for (let i = 0; i < 4; i++) {
      const cw = colorways[i] as Record<string, unknown> | undefined;
      const entry = entries.find((e) => str(e.colorway_id ?? '') === str(cw?.id ?? ''));
      row[`colorway_${i + 1}`] = entry
        ? str(entry.color_name ?? entry.pantone ?? '')
        : cw
          ? str(cw.name ?? '')
          : '';
    }
    return row;
  });
  // Artwork table.
  repeatRows.artwork = (snapshot.artwork ?? []).map((a, i) => ({
    no: String(i + 1),
    artwork: str(a.placement ?? ''),
    view: str(a.view ?? ''),
    placement: str(a.placement ?? ''),
    technique: str(a.technique ?? ''),
    'w_×_h_mm': a.width_mm && a.height_mm ? `${a.width_mm} × ${a.height_mm}` : '',
    from: str(a.offset_ref ?? ''),
    'offset_x___y_mm': a.offset_x_mm !== undefined || a.offset_y_mm !== undefined
      ? `${a.offset_x_mm ?? ''} / ${a.offset_y_mm ?? ''}`
      : '',
    'pantone___thread': Array.isArray(a.pantone_codes) ? (a.pantone_codes as string[]).join(', ') : '',
    stitches: str(a.stitch_count ?? ''),
    notes: str(a.notes ?? ''),
  }));
  void mode;
  return { fields, slotFills, repeatRows };
}

// ---------------------------------------------------------------------
// SVG surgery helpers
// ---------------------------------------------------------------------
function collectFieldIds(svg: string): string[] {
  return [...svg.matchAll(/data-field="([^"]+)"/g)].map((m) => m[1]);
}
function collectSlotIds(svg: string): string[] {
  return [...svg.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]);
}
function collectRepeats(svg: string): { name: string; attrs: Record<string, string>; full: string }[] {
  const out: { name: string; attrs: Record<string, string>; full: string }[] = [];
  for (const m of svg.matchAll(/<g[^>]*data-repeat="([^"]+)"[^>]*>[\s\S]*?<\/g>/g)) {
    const tag = m[0].slice(0, m[0].indexOf('>') + 1);
    const attrs: Record<string, string> = {};
    for (const a of tag.matchAll(/data-([a-z_]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    out.push({ name: m[1], attrs, full: m[0] });
  }
  return out;
}

function fillTextFields(svg: string, fields: Record<string, string>): string {
  return svg.replace(
    /<text([^>]*data-field="([^"]+)"[^>]*)>([\s\S]*?)<\/text>/g,
    (whole, attrs, id, inner) => {
      if (!(id in fields)) return whole;
      const v = fields[id];
      if (v === '') return `<text${attrs}></text>`;
      return `<text${attrs}>${escapeXml(truncate(v, 64))}</text>`;
    },
  );
}

function fillSlotColors(svg: string, slotFills: Record<string, string>): string {
  return svg.replace(/<(rect|g)([^>]*data-slot="([^"]+)"[^>]*)(\/?)>/g, (whole, tag, attrs, id, selfClose) => {
    const hex = slotFills[id];
    if (!hex) return whole;
    const cleaned = attrs.replace(/\sfill="[^"]*"/, '');
    return `<${tag}${cleaned} fill="${hex}"${selfClose}>`;
  });
}

function slotRect(svg: string, slotId: string): { x: number; y: number; w: number; h: number } | null {
  const m = svg.match(new RegExp(`<rect[^>]*data-slot="${slotId.replace('.', '\\.')}"[^>]*>`));
  if (!m) return null;
  const num = (attr: string) => {
    const r = m[0].match(new RegExp(`${attr}="([0-9.]+)"`));
    return r ? Number(r[1]) : 0;
  };
  return { x: num('x'), y: num('y'), w: num('width'), h: num('height') };
}

const FONT = 'Space Mono, DejaVu Sans Mono, monospace';

function renderTableRows(
  rows: Record<string, string>[],
  cols: string[],
  widths: number[],
  x0: number,
  y0: number,
  rowH: number,
  sizes: string[],
  baseSize: string,
  unit: string,
): string {
  const parts: string[] = [];
  const xs: number[] = [];
  let acc = x0;
  for (const w of widths) {
    xs.push(acc);
    acc += w;
  }
  const totalW = widths.reduce((a, b) => a + b, 0);
  // NOTE: the template already carries the static column-header row
  // (plan/09 masters); the renderer only writes data rows, starting at
  // data-y just below it.
  rows.forEach((row, ri) => {
    const yTop = y0 + ri * rowH;
    const yText = yTop + rowH * 0.68;
    // Base-size shading on the measurement chart.
    const baseIdx = sizes.indexOf(baseSize);
    if (baseIdx >= 0) {
      const colIdx = cols.indexOf(`s${baseIdx + 1}`);
      if (colIdx >= 0) {
        parts.push(
          `<rect x="${xs[colIdx].toFixed(2)}" y="${yTop.toFixed(2)}" width="${widths[colIdx].toFixed(2)}" height="${rowH.toFixed(2)}" fill="#ece8df"/>`,
        );
      }
    }
    cols.forEach((c, i) => {
      const budget = Math.max(3, Math.floor(widths[i] / 1.35));
      const val = truncate(row[c] ?? '', budget);
      parts.push(
        `<text x="${(xs[i] + 1).toFixed(2)}" y="${yText.toFixed(2)}" font-family="${FONT}" font-size="2.0" font-weight="400" fill="#111111" text-anchor="start">${escapeXml(val)}</text>`,
      );
    });
    parts.push(
      `<line x1="${x0.toFixed(2)}" y1="${(yTop + rowH).toFixed(2)}" x2="${(x0 + totalW).toFixed(2)}" y2="${(yTop + rowH).toFixed(2)}" stroke="#d9d9d9" stroke-width="0.15"/>`,
    );
  });
  void unit;
  return parts.join('\n');
}

function renderCallouts(svg: string, rows: Record<string, string>[]): string {
  const front = slotRect(svg, 'construction.front');
  const back = slotRect(svg, 'construction.back');
  const parts: string[] = [];
  for (const r of rows) {
    const ax = Number(r.anchor_x);
    const ay = Number(r.anchor_y);
    const lx = Number(r.label_x);
    const ly = Number(r.label_y);
    const box = r.view === 'back' ? back : front;
    if (!box || Number.isNaN(ax) || Number.isNaN(ay) || Number.isNaN(lx) || Number.isNaN(ly)) continue;
    const px = box.x + ax * box.w;
    const py = box.y + ay * box.h;
    const qx = box.x + lx * box.w;
    const qy = box.y + ly * box.h;
    parts.push(
      `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.8" fill="#d62828"/>`,
      `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${qx.toFixed(2)}" y2="${qy.toFixed(2)}" stroke="#d62828" stroke-width="0.3"/>`,
      `<circle cx="${qx.toFixed(2)}" cy="${qy.toFixed(2)}" r="2.4" fill="#d62828"/>`,
      `<text x="${qx.toFixed(2)}" y="${(qy + 0.7).toFixed(2)}" font-family="${FONT}" font-size="2.0" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(r.no)}</text>`,
    );
  }
  return parts.join('\n');
}

function renderPomArrows(svg: string, rows: Record<string, string>[]): string {
  const front = slotRect(svg, 'measure_guide.front');
  const back = slotRect(svg, 'measure_guide.back');
  const parts: string[] = [
    `<defs><marker id="pom-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#d62828"/></marker></defs>`,
  ];
  for (const r of rows) {
    const box = r.view === 'back' ? back : front;
    if (!box) continue;
    const nums = ['x1', 'y1', 'x2', 'y2', 'label_x', 'label_y'].map((k) => Number(r[k]));
    if (nums.some((n) => Number.isNaN(n))) continue;
    const [x1, y1, x2, y2, lx, ly] = nums;
    parts.push(
      `<line x1="${(box.x + x1 * box.w).toFixed(2)}" y1="${(box.y + y1 * box.h).toFixed(2)}" x2="${(box.x + x2 * box.w).toFixed(2)}" y2="${(box.y + y2 * box.h).toFixed(2)}" stroke="#d62828" stroke-width="0.4" marker-end="url(#pom-arrow)"/>`,
      `<text x="${(box.x + lx * box.w).toFixed(2)}" y="${(box.y + ly * box.h).toFixed(2)}" font-family="${FONT}" font-size="2.2" font-weight="700" fill="#d62828" text-anchor="middle">${escapeXml(r.pom)}</text>`,
    );
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------
// fill()
// ---------------------------------------------------------------------
export function fill(
  templateSvgs: string[],
  snapshot: TechPackSnapshot,
  mode: FillMode = 'internal',
  opts: FillOptions = {},
): FillResult {
  const { fields, slotFills, repeatRows } = resolveMaps(snapshot, mode);
  const header = (snapshot.header ?? {}) as Record<string, unknown>;
  const sizeRange = (snapshot.size_range ?? {}) as Record<string, unknown>;
  const sizes: string[] = Array.isArray(header.size_range)
    ? (header.size_range as string[])
    : Array.isArray(sizeRange.sizes)
      ? (sizeRange.sizes as string[])
      : [];
  const baseSize = str(header.base_size ?? snapshot.tech_pack?.base_size ?? '');
  const unit = str(header.measure_unit ?? snapshot.tech_pack?.measure_unit ?? 'cm');

  // Pass 1 — chunk every repeat on every page, so the total page count
  // (and every footer) is known before any page is emitted.
  interface PagePlan {
    pageId: string;
    title: string;
    svg: string;
    chunks: Map<string, Record<string, string>[][]>;
    chunkCount: number;
  }
  const plans: PagePlan[] = TEMPLATE_PAGES.map((p, i) => {
    const svg = templateSvgs[i] ?? '';
    const chunks = new Map<string, Record<string, string>[][]>();
    let chunkCount = 1;
    for (const rep of collectRepeats(svg)) {
      let rows = repeatRows[rep.name] ?? [];
      if (rows.length === 0 && rep.name === 'materials') rows = repeatRows.materials ?? [];
      const perPage = Number(rep.attrs.rows ?? 0);
      if (rep.name === 'construction_callouts' || rep.name === 'pom_markers') continue; // overlays, not rows
      if (rep.name === 'bom' && mode === 'supplier') {
        // supplier copies drop the UNIT COST column (plan/09) — handled
        // at render time by filtering cols/widths, not by dropping rows.
      }
      if (perPage > 0 && rows.length > perPage) {
        const parts: Record<string, string>[][] = [];
        for (let s = 0; s < rows.length; s += perPage) parts.push(rows.slice(s, s + perPage));
        chunks.set(rep.name, parts);
        chunkCount = Math.max(chunkCount, parts.length);
      } else {
        chunks.set(rep.name, [rows]);
      }
    }
    return { pageId: p.id, title: p.title, svg, chunks, chunkCount };
  });
  const totalPages = plans.reduce((n, p) => n + p.chunkCount, 0);

  // Pass 2 — emit pages.
  const pages: FilledPage[] = [];
  let pageNo = 0;
  for (const plan of plans) {
    for (let chunkIdx = 0; chunkIdx < plan.chunkCount; chunkIdx++) {
      pageNo += 1;
      let svg = plan.svg;
      // Repeat groups.
      for (const rep of collectRepeats(svg)) {
        const rows = repeatRows[rep.name] ?? [];
        let inner = '';
        if (rep.name === 'construction_callouts') {
          inner = renderCallouts(svg, repeatRows.construction_callouts ?? []);
        } else if (rep.name === 'pom_markers') {
          inner = renderPomArrows(svg, repeatRows.pom_markers ?? []);
        } else if (rep.name === 'materials') {
          inner = ''; // card fields are filled directly; nothing to repeat
        } else {
          let cols = (rep.attrs.cols ?? '').split(',').filter(Boolean);
          let widths = (rep.attrs.widths ?? '').split(',').map(Number).filter((n) => !Number.isNaN(n));
          if (rep.name === 'bom' && mode === 'supplier') {
            const drop = cols.indexOf('unit_cost');
            if (drop >= 0) {
              cols = cols.filter((_, i) => i !== drop);
              widths = widths.filter((_, i) => i !== drop);
            }
          }
          const chunk = plan.chunks.get(rep.name)?.[chunkIdx] ?? rows;
          const x0 = Number(rep.attrs.x ?? 12);
          const y0 = Number(rep.attrs.y ?? 64);
          const rowH = Number(rep.attrs['row-h'] ?? 5.4);
          inner = renderTableRows(chunk, cols, widths, x0, y0, rowH, sizes, baseSize, unit);
        }
        const re = new RegExp(
          `<g[^>]*data-repeat="${rep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?</g>`,
        );
        svg = svg.replace(re, (whole) => {
          let open = whole.slice(0, whole.indexOf('>') + 1);
          if (rep.name === 'bom' && mode === 'supplier') {
            // The binding itself must not leak the column name either.
            open = open.replace(/data-cols="([^"]*)"/, (_m, cols: string) =>
              `data-cols="${cols.split(',').filter((c) => c !== 'unit_cost').join(',')}"`,
            );
          }
          return `${open}\n${inner}\n</g>`;
        });
      }
      // Static header adjustments (plan/09: size labels rename S1…S8 on
      // the chart; supplier copies drop the UNIT COST column entirely,
      // including its static header and the internal footnote).
      if (plan.pageId === 'measurement_chart') {
        sizes.slice(0, 8).forEach((s, i) => {
          svg = svg.replace(new RegExp(`(>\\s*)S${i + 1}(\\s*<)`), `$1${escapeXml(s)}$2`);
        });
      }
      if (plan.pageId === 'bom' && mode === 'supplier') {
        svg = svg.replace(/<text[^>]*>UNIT COST<\/text>/g, '');
        svg = svg.replace(/<text[^>]*>UNIT COST is internal[^<]*<\/text>/g, '');
      }
      // Text fields.
      const pageFields = { ...fields, 'footer.page': `PAGE ${pageNo} / ${totalPages}` };
      if (plan.chunkCount > 1) {
        pageFields['page.title'] = `${plan.title} (${chunkIdx + 1}/${plan.chunkCount})`;
      }
      svg = fillTextFields(svg, pageFields);
      // Colour chips / swatches.
      svg = fillSlotColors(svg, slotFills);
      // Supplier watermark (every page, per viewer).
      const wm = mode === 'supplier' ? opts.watermarkText ?? 'SUPPLIER PREVIEW' : '';
      if (wm) {
        const wmText = `<text x="148.5" y="105" font-family="${FONT}" font-size="7" font-weight="700" fill="#c00" opacity="0.18" text-anchor="middle" transform="rotate(-30 148.5 105)">${escapeXml(wm)}</text>`;
        svg = svg.replace(/<g([^>]*data-slot="watermark"[^>]*)>([\s\S]*?)<\/g>/, `<g$1>${wmText}</g>`);
      }
      pages.push({ pageId: plan.pageId, pageNo, totalPages, svg });
    }
  }
  return { pages, mode };
}

// ---------------------------------------------------------------------
// validateTemplate()
// ---------------------------------------------------------------------
export function validateTemplate(
  templateSvgs: string[],
  snapshot: TechPackSnapshot,
  mode: FillMode = 'internal',
): TemplateValidation {
  const { fields, slotFills, repeatRows } = resolveMaps(snapshot, mode);
  const missingFields = new Set<string>();
  const missingSlots = new Set<string>();
  const missingRepeats = new Set<string>();
  const ownedByTemplate = new Set(['page.title', 'footer.page']);
  for (const svg of templateSvgs) {
    for (const id of collectFieldIds(svg)) {
      if (ownedByTemplate.has(id)) continue;
      if (!fields[id] || fields[id] === '') missingFields.add(id);
    }
    for (const id of collectSlotIds(svg)) {
      if (id === 'watermark') continue;
      if (!(id in slotFills)) missingSlots.add(id);
    }
    for (const rep of collectRepeats(svg)) {
      const rows = repeatRows[rep.name] ?? [];
      if (rows.length === 0) missingRepeats.add(rep.name);
    }
  }
  return {
    missingFields: [...missingFields].sort(),
    missingSlots: [...missingSlots].sort(),
    missingRepeats: [...missingRepeats].sort(),
  };
}
