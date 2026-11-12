// techpack-render — fixture (T13b). A complete "Boxy Tee" snapshot used
// by the unit tests, the editor demo state, and the Playwright spec.
// 30 POMs on a 5-size range: the measurement chart must spill onto a
// second page ("MEASUREMENT CHART (2/2)").
import type { TechPackSnapshot } from './types';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const POM_NAMES: [string, string, string][] = [
  ['A', 'Body length from HPS', 'Measure from highest point of shoulder to hem, flat.'],
  ['B', 'Chest width', 'Measure across chest, 1" below armhole, flat.'],
  ['C', 'Bottom hem width', 'Measure across hem, flat.'],
  ['D', 'Shoulder width', 'Measure from HPS to HPS across back, flat.'],
  ['E', 'Sleeve length', 'Measure from shoulder seam to cuff edge.'],
  ['F', 'Sleeve opening', 'Measure across cuff, flat.'],
  ['G', 'Armhole depth', 'Measure straight from HPS to armhole base.'],
  ['H', 'Neck width', 'Measure across neck opening, flat.'],
  ['I', 'Neck drop front', 'Measure from HPS line to front neck base.'],
  ['J', 'Neck drop back', 'Measure from HPS line to back neck base.'],
  ['K', 'Shoulder slope', 'Measure drop from neck HPS to shoulder point.'],
  ['L', 'Yoke width', 'Measure across yoke seam, flat.'],
  ['M', 'Yoke depth', 'Measure from neck seam to yoke seam at centre back.'],
  ['N', 'Side seam length', 'Measure from armhole base to hem.'],
  ['O', 'Hem height', 'Measure finished hem depth.'],
  ['P', 'Cuff height', 'Measure finished cuff depth.'],
  ['Q', 'Collar stand height', 'Measure collar stand at centre back.'],
  ['R', 'Label position from hem', 'Measure from hem to label base.'],
  ['S', 'Print width', 'Measure artwork width at widest point.'],
  ['T', 'Print height', 'Measure artwork height at tallest point.'],
  ['U', 'Print from HPS', 'Measure from HPS to top of artwork.'],
  ['V', 'Print from centre front', 'Measure from centre front to artwork centre.'],
  ['W', 'Pocket width', 'Measure pocket opening, flat.'],
  ['X', 'Pocket height', 'Measure pocket from opening to base.'],
  ['Y', 'Pocket from side seam', 'Measure from side seam to pocket edge.'],
  ['Z', 'Pocket from hem', 'Measure from hem to pocket base.'],
  ['AA', 'Back print width', 'Measure back artwork width at widest point.'],
  ['AB', 'Back print height', 'Measure back artwork height at tallest point.'],
  ['AC', 'Back print from HPS', 'Measure from HPS to top of back artwork.'],
  ['AD', 'Rib height', 'Measure rib depth at neck.'],
];

const BASE_VALUES: Record<string, number> = {
  A: 68, B: 58, C: 56, D: 48, E: 22, F: 20, G: 24, H: 18, I: 9, J: 4,
  K: 3, L: 40, M: 8, N: 44, O: 3, P: 3, Q: 2, R: 12, S: 28, T: 30,
  U: 12, V: 0, W: 14, X: 16, Y: 4, Z: 8, AA: 26, AB: 28, AC: 14, AD: 2,
};

function measurements(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const [code, name] of POM_NAMES) {
    const base = BASE_VALUES[code] ?? 10;
    SIZES.forEach((size, i) => {
      rows.push({
        pom: code,
        name,
        size,
        value: base + (i - 2) * 2,
        tol_plus: 1,
        tol_minus: 1,
        grade: 2,
      });
    });
  }
  return rows;
}

export function boxyTeeFixture(): TechPackSnapshot {
  return {
    tech_pack: {
      id: '00000000-0000-0000-0000-000000000001',
      style_number: 'MT-27-001',
      title: 'Boxy Tee tech pack',
      description: 'Boxy tee, dropped shoulder',
      revision: 1,
      status: 'draft',
      base_size: 'M',
      measure_unit: 'cm',
      updated_at: '2026-11-12T00:00:00.000Z',
    },
    design: { id: '00000000-0000-0000-0000-000000000002', name: 'Boxy Tee — Atelier Logo', style_number: 'MT-27-001' },
    size_range: { sizes: SIZES, base_size: 'M' },
    header: {
      brand: 'Maison Test',
      designer: 'A. Studio',
      season: 'SS27',
      category: 'tops',
      size_range: SIZES,
      base_size: 'M',
      measure_unit: 'cm',
      style_number: 'MT-27-001',
      description: 'Boxy tee, dropped shoulder',
      date: '2026-11-12T00:00:00.000Z',
      revision: 1,
      status: 'draft',
      main_fabric: { description: '240gsm jersey', material_id: 'mat-1' },
    },
    colorways: [
      { id: 'cw-1', name: 'Bone', garment_color_hex: '#E8E1D3', pantone_codes: ['11-0105 TCX', '19-4007 TCX'], sort: 0 },
      { id: 'cw-2', name: 'Ink', garment_color_hex: '#1F2430', pantone_codes: ['19-4007 TCX'], sort: 1 },
    ],
    bom: [
      { id: 'bom-1', description: '240gsm jersey', kind: 'fabric', placement: 'body', material_code: 'JER-240', composition: '100% organic cotton', weight_gsm: 240, color_name: 'Bone', color_hex: '#E8E1D3', supplier_name: 'Maison Mills', quantity: 1.2, uom: 'm', unit_cost: 2.5, supplier_note: 'internal — do not share', is_main_fabric: true, sort: 0 },
      { id: 'bom-2', description: 'Rib knit', kind: 'fabric', placement: 'neck rib', material_code: 'RIB-220', composition: '95% cotton / 5% elastane', weight_gsm: 220, color_name: 'Bone', supplier_name: 'Maison Mills', quantity: 0.3, uom: 'm', unit_cost: 1.1, sort: 1 },
      { id: 'bom-3', description: 'Neck tape', kind: 'trim', placement: 'neck', material_code: 'TAPE-10', composition: '100% cotton', color_name: 'Bone', supplier_name: 'Maison Mills', quantity: 0.4, uom: 'm', unit_cost: 0.2, sort: 2 },
    ],
    measurements: measurements(),
    construction: [
      { id: 'con-1', callout_no: 1, view: 'front', area: 'neckline', operation: 'bind neck', stitch_type: '406', spi: 12, seam_allowance_mm: 6, notes: 'Coverstitch', anchor_x: 0.5, anchor_y: 0.12, label_x: 0.8, label_y: 0.05, sort: 0 },
      { id: 'con-2', callout_no: 2, view: 'front', area: 'hem', operation: 'coverstitch hem', stitch_type: '406', spi: 12, seam_allowance_mm: 12, notes: '', anchor_x: 0.5, anchor_y: 0.92, label_x: 0.8, label_y: 0.9, sort: 1 },
      { id: 'con-3', callout_no: 3, view: 'back', area: 'shoulder', operation: 'shoulder seam', stitch_type: '401', spi: 12, seam_allowance_mm: 10, notes: '', anchor_x: 0.3, anchor_y: 0.1, label_x: 0.1, label_y: 0.05, sort: 2 },
    ],
    artwork: [
      { id: 'art-1', view: 'front', placement: 'center chest', technique: 'screen_print', width_mm: 280, height_mm: 300, offset_ref: 'HPS', offset_x_mm: 0, offset_y_mm: 120, pantone_codes: ['11-0105 TCX'], stitch_count: null, notes: '', sort: 0 },
    ],
    pom_markers: [
      { id: 'pm-1', pom: 'A', view: 'front', x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.9, label_x: 0.35, label_y: 0.5 },
      { id: 'pm-2', pom: 'B', view: 'front', x1: 0.2, y1: 0.35, x2: 0.8, y2: 0.35, label_x: 0.5, label_y: 0.3 },
    ],
    pom_library: POM_NAMES.map(([code, name, how_to_measure]) => ({ code, name, how_to_measure })),
    colorway_components: [
      { id: 'cwc-1', colorway_id: 'cw-1', bom_line_id: 'bom-1', component: '240gsm jersey', color_name: 'Bone', pantone: '11-0105 TCX', hex: '#E8E1D3' },
      { id: 'cwc-2', colorway_id: 'cw-2', bom_line_id: 'bom-1', component: '240gsm jersey', color_name: 'Ink', pantone: '19-4007 TCX', hex: '#1F2430' },
    ],
    labels: [
      { id: 'lbl-1', kind: 'main', label_type: 'woven', material_name: 'Cotton tape', width_mm: 40, height_mm: 12, color: 'Bone', attachment: 'sewn_in_seam', placement: 'neck', text: 'Maison Test', sort: 0 },
      { id: 'lbl-2', kind: 'size', label_type: 'printed', material_name: 'Cotton tape', width_mm: 20, height_mm: 10, color: 'Bone', attachment: 'sewn_in_seam', placement: 'neck', text: 'M', sort: 1 },
      { id: 'lbl-3', kind: 'care', label_type: 'satin', material_name: 'Satin', width_mm: 60, height_mm: 30, color: 'White', attachment: 'sewn_in_seam', placement: 'side seam', text: 'Made in USA', fibre_content: [{ fibre: 'cotton', pct: 60 }, { fibre: 'polyester', pct: 40 }], country_of_origin: 'US', care_symbols: ['wash_30', 'bleach_no', 'tumble_low', 'iron_low', 'dryclean_no'], sort: 2 },
    ],
    hangtags: [
      { id: 'ht-1', width_mm: 55, height_mm: 85, shape: 'rectangle', stock: '350gsm uncoated', gsm: 350, print: '1 colour', finish: 'matte', eyelet: 'brass', fastener: 'cotton string', fastener_color: 'Bone', placement: 'neck', barcode_type: 'upc_a', barcode_value: '036000291452', retail_price: 48, currency: 'USD', supplier_name: 'Maison Mills', notes: 'Attach with cotton string at neck' },
    ],
    packaging: {
      fold_steps: [{ text: 'Fold in half' }, { text: 'Fold sleeves in' }, { text: 'Fold hem up' }],
      polybag_size_mm: '300x400',
      polybag_thickness_micron: 50,
      polybag_material: 'LDPE',
      polybag_closure: 'self-seal',
      polybag_warning: 'Keep away from babies and children',
      polybag_print: 'Recycling logo',
      polybag_sticker: 'Size sticker',
      polybag_units: 1,
      carton_size_mm: '400x300x200',
      carton_ply: 5,
      carton_max_kg: 12,
      carton_units: 12,
      carton_size_ratio: { S: 4, M: 4, L: 4 },
      carton_assortment: 'ratio',
      carton_tape: 'Printed tape',
    },
    template: null,
  };
}
