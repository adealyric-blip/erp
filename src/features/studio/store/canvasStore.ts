// Konva canvas store — T07 (canvas editor) + T08 (autosave/realtime).
// Client-only Zustand store. The scene serializes to the JSON stored by
// ds_create_design_version (canvas_state) — see toCanvasState/fromCanvasState.
import { create } from 'zustand';
import type { ViewId } from '../lib/printAreas';

export type LayerKind = 'text' | 'image' | 'shape' | 'icon';

export interface CanvasLayer {
  id: string;
  kind: LayerKind;
  /** View this layer belongs to (front/back/sleeves/…). */
  view: ViewId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  /** Image / icon source (data URI, /api/stock URL, or asset URL). */
  src?: string;
  /** Shape key for kind=shape (rect, ellipse, star, …) or icon id for kind=icon. */
  shape?: string;
  name: string;
}

export interface CanvasSceneJson {
  version: 1;
  templateId: string | null;
  templateName: string | null;
  activeView: ViewId;
  colorwayFill: string;
  layers: CanvasLayer[];
}

interface Snapshot {
  layers: CanvasLayer[];
  colorwayFill: string;
}

export interface PeerCursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  view: ViewId;
}

interface CanvasStoreState {
  designId: string | null;
  designName: string;
  templateId: string | null;
  templateName: string | null;
  activeView: ViewId;
  layers: CanvasLayer[];
  selectedId: string | null;
  colorwayFill: string;
  dirty: boolean;
  lastSavedAt: string | null;
  lastSavedVersionId: string | null;
  /** Outside-print-area warning for the current selection (T07 accept). */
  outsidePrintArea: boolean;
  past: Snapshot[];
  future: Snapshot[];
  peers: PeerCursor[];

  init: (opts: {
    designId: string | null;
    designName: string;
    templateId: string | null;
    templateName: string | null;
    initialView?: ViewId;
    scene?: CanvasSceneJson | null;
  }) => void;
  addLayer: (layer: Partial<CanvasLayer> & { kind: LayerKind }) => string;
  addLayerFromCommand: (layer: Record<string, unknown>) => string;
  updateLayer: (id: string, patch: Partial<CanvasLayer>) => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  setActiveView: (view: ViewId) => void;
  setColorwayFill: (fill: string) => void;
  /** CanvasApi: align the selection within the current print area. */
  alignSelection: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  /** CanvasApi: scale/center the selection into the print area. */
  fitSelectionToPrintArea: () => void;
  /** Stage informs the store of the selection's containment (drives the warning). */
  setOutsidePrintArea: (outside: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  markSaved: (versionId: string | null) => void;
  setPeers: (peers: PeerCursor[]) => void;
  toCanvasState: () => CanvasSceneJson;
  getScene: () => Record<string, unknown>;
  layersForView: (view: ViewId) => CanvasLayer[];
}

let counter = 0;
function nextId(kind: string): string {
  counter += 1;
  return `${kind}-${Date.now().toString(36)}-${counter}`;
}

const DEFAULT_FILL = '#111111';

export const useCanvasStore = create<CanvasStoreState>((set, get) => {
  const pushHistory = () => {
    const s = get();
    set({
      past: [...s.past.slice(-49), { layers: s.layers, colorwayFill: s.colorwayFill }],
      future: [],
    });
  };

  return {
    designId: null,
    designName: 'Untitled design',
    templateId: null,
    templateName: null,
    activeView: 'front',
    layers: [],
    selectedId: null,
    colorwayFill: '#ffffff',
    dirty: false,
    lastSavedAt: null,
    lastSavedVersionId: null,
    outsidePrintArea: false,
    past: [],
    future: [],
    peers: [],

    init: ({ designId, designName, templateId, templateName, initialView, scene }) => {
      set({
        designId,
        designName,
        templateId,
        templateName,
        activeView: scene?.activeView ?? initialView ?? 'front',
        colorwayFill: scene?.colorwayFill ?? '#ffffff',
        layers: scene?.layers ?? [],
        selectedId: null,
        dirty: false,
        lastSavedAt: null,
        lastSavedVersionId: null,
        outsidePrintArea: false,
        past: [],
        future: [],
        peers: [],
      });
    },

    addLayer: (partial) => {
      pushHistory();
      const s = get();
      const id = nextId(partial.kind);
      const layer: CanvasLayer = {
        id,
        kind: partial.kind,
        view: partial.view ?? s.activeView,
        x: partial.x ?? 220,
        y: partial.y ?? 180,
        width: partial.width ?? (partial.kind === 'text' ? 240 : 120),
        height: partial.height ?? (partial.kind === 'text' ? 48 : 120),
        rotation: partial.rotation ?? 0,
        fill: partial.fill ?? DEFAULT_FILL,
        text: partial.text,
        fontFamily: partial.fontFamily ?? 'Inter',
        fontSize: partial.fontSize ?? 32,
        src: partial.src,
        shape: partial.shape,
        name: partial.name ?? `${partial.kind} ${s.layers.length + 1}`,
      };
      set({ layers: [...s.layers, layer], selectedId: id, dirty: true });
      return id;
    },

    addLayerFromCommand: (raw) => {
      const kind = (raw.kind as LayerKind) ?? 'shape';
      return get().addLayer({
        kind,
        view: raw.view as ViewId | undefined,
        x: raw.x as number | undefined,
        y: raw.y as number | undefined,
        width: raw.width as number | undefined,
        height: raw.height as number | undefined,
        rotation: raw.rotation as number | undefined,
        fill: raw.fill as string | undefined,
        text: raw.text as string | undefined,
        fontFamily: raw.fontFamily as string | undefined,
        fontSize: raw.fontSize as number | undefined,
        src: raw.src as string | undefined,
        shape: raw.shape as string | undefined,
      });
    },

    updateLayer: (id, patch) => {
      const s = get();
      set({
        layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        dirty: true,
      });
    },

    removeLayer: (id) => {
      pushHistory();
      const s = get();
      set({
        layers: s.layers.filter((l) => l.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        dirty: true,
      });
    },

    selectLayer: (id) => set({ selectedId: id }),
    setActiveView: (view) => set({ activeView: view, selectedId: null }),
    setColorwayFill: (fill) => {
      pushHistory();
      set({ colorwayFill: fill, dirty: true });
    },

    alignSelection: (mode) => {
      const s = get();
      const sel = s.layers.find((l) => l.id === s.selectedId);
      if (!sel) return;
      pushHistory();
      // Align within a 720×560 stage box (the stage coordinate space);
      // the stage re-derives the same numbers from its own size, so the
      // store keeps the canonical 720-wide space.
      const STAGE_W = 720;
      const STAGE_H = 560;
      const patch: Partial<CanvasLayer> = {};
      if (mode === 'left') patch.x = 40;
      if (mode === 'right') patch.x = STAGE_W - 40 - sel.width;
      if (mode === 'center') patch.x = (STAGE_W - sel.width) / 2;
      if (mode === 'top') patch.y = 40;
      if (mode === 'bottom') patch.y = STAGE_H - 40 - sel.height;
      if (mode === 'middle') patch.y = (STAGE_H - sel.height) / 2;
      set({ layers: s.layers.map((l) => (l.id === sel.id ? { ...l, ...patch } : l)), dirty: true });
    },

    fitSelectionToPrintArea: () => {
      const s = get();
      const sel = s.layers.find((l) => l.id === s.selectedId);
      if (!sel) return;
      pushHistory();
      // Center the selection in the stage; the exact print-area rect is
      // applied by CanvasStage (it knows the template), which then calls
      // updateLayer with the fitted box. This keeps the store template-free.
      set({
        layers: s.layers.map((l) =>
          l.id === sel.id ? { ...l, x: (720 - l.width) / 2, y: (560 - l.height) / 2 } : l,
        ),
        dirty: true,
      });
    },

    setOutsidePrintArea: (outside) => {
      if (get().outsidePrintArea !== outside) set({ outsidePrintArea: outside });
    },

    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        past: s.past.slice(0, -1),
        future: [{ layers: s.layers, colorwayFill: s.colorwayFill }, ...s.future],
        layers: prev.layers,
        colorwayFill: prev.colorwayFill,
        dirty: true,
      });
    },

    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        future: s.future.slice(1),
        past: [...s.past, { layers: s.layers, colorwayFill: s.colorwayFill }],
        layers: next.layers,
        colorwayFill: next.colorwayFill,
        dirty: true,
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    markSaved: (versionId) =>
      set({ dirty: false, lastSavedAt: new Date().toISOString(), lastSavedVersionId: versionId }),

    setPeers: (peers) => set({ peers }),

    toCanvasState: (): CanvasSceneJson => {
      const s = get();
      return {
        version: 1,
        templateId: s.templateId,
        templateName: s.templateName,
        activeView: s.activeView,
        colorwayFill: s.colorwayFill,
        layers: s.layers,
      };
    },

    getScene: () => get().toCanvasState() as unknown as Record<string, unknown>,

    layersForView: (view) => get().layers.filter((l) => l.view === view),
  };
});

/** Parse stored canvas_state JSON back into a scene (null when absent/invalid). */
export function parseCanvasState(raw: unknown): CanvasSceneJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<CanvasSceneJson>;
  if (s.version !== 1 || !Array.isArray(s.layers)) return null;
  return {
    version: 1,
    templateId: typeof s.templateId === 'string' ? s.templateId : null,
    templateName: typeof s.templateName === 'string' ? s.templateName : null,
    activeView: (s.activeView as ViewId) ?? 'front',
    colorwayFill: typeof s.colorwayFill === 'string' ? s.colorwayFill : '#ffffff',
    layers: s.layers as CanvasLayer[],
  };
}
