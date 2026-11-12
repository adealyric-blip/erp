// Tech pack editor — shared types (T13/T13b).
import type { TechPackSnapshot } from '@/lib/techpack-render/types';

/** The 11 editor tabs map 1:1 to the 11 template pages (plan/09). */
export const TECH_PACK_TABS = [
  { id: 'sketch', label: 'Sketch', page: 'Technical sketch' },
  { id: 'construction', label: 'Construction', page: 'Construction details' },
  { id: 'measurement_guide', label: 'Measurement guide', page: 'Measurement guide' },
  { id: 'measurement_chart', label: 'Measurement chart', page: 'Measurement chart' },
  { id: 'bom', label: 'BOM', page: 'Bill of materials' },
  { id: 'materials', label: 'Materials', page: 'Material and trims' },
  { id: 'colorways', label: 'Colorways', page: 'Colorways' },
  { id: 'artwork', label: 'Artwork', page: 'Artwork details' },
  { id: 'labels', label: 'Labels', page: 'Label details' },
  { id: 'hangtag', label: 'Hang tag', page: 'Hang tag' },
  { id: 'packaging', label: 'Packaging', page: 'Packaging' },
] as const;

export type TechPackTabId = (typeof TECH_PACK_TABS)[number]['id'];

/** Lookup lists the editor needs (library tables). */
export interface TechPackLookups {
  materials: { id: string; code: string; name: string; kind: string; composition: string | null; weight_gsm: number | null }[];
  poms: { id: string; code: string; name: string; how_to_measure: string | null }[];
  seasons: { id: string; code: string; name: string }[];
  sizeRanges: { id: string; name: string; sizes: string[]; base_size: string | null }[];
  colorways: { id: string; name: string; garment_color_hex: string | null; pantone_codes: string[] }[];
  assets: { id: string; name: string | null }[];
}

export interface TechPackEditorProps {
  designId: string;
  techPackId: string | null;
  initialSnapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  /** Filled SVG pages for the live preview (server-rendered). */
  previewPages: { pageId: string; pageNo: number; totalPages: number; svg: string }[];
  /** True when the demo fixture is shown because no live pack loaded. */
  demoMode: boolean;
}
