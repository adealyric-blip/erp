// T07 accept support: canvas store history, serialization, restore.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseCanvasState, useCanvasStore } from './canvasStore';

beforeEach(() => {
  useCanvasStore.getState().init({
    designId: 'd1',
    designName: 'Test',
    templateId: 'seed-boxy-tee',
    templateName: 'Boxy tee',
  });
});

describe('canvas store', () => {
  it('add/update/remove layers and select', () => {
    const s = useCanvasStore.getState();
    const id = s.addLayer({ kind: 'text', text: 'Hello', fontFamily: 'Anton', fontSize: 40 });
    expect(useCanvasStore.getState().layers).toHaveLength(1);
    expect(useCanvasStore.getState().selectedId).toBe(id);
    expect(useCanvasStore.getState().dirty).toBe(true);
    useCanvasStore.getState().updateLayer(id, { x: 10, y: 20 });
    expect(useCanvasStore.getState().layers[0]?.x).toBe(10);
    useCanvasStore.getState().removeLayer(id);
    expect(useCanvasStore.getState().layers).toHaveLength(0);
  });

  it('undo/redo walks the history (zustand history, T07)', () => {
    const s = useCanvasStore.getState();
    expect(s.canUndo()).toBe(false);
    s.addLayer({ kind: 'text', text: 'A' });
    s.addLayer({ kind: 'shape', shape: 'star' });
    expect(useCanvasStore.getState().layers).toHaveLength(2);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().layers).toHaveLength(1);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().layers).toHaveLength(0);
    expect(useCanvasStore.getState().canUndo()).toBe(false);
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().layers).toHaveLength(1);
    expect(useCanvasStore.getState().canRedo()).toBe(true);
  });

  it('serializes to canvas_state JSON and parses it back (save → reload restores)', () => {
    const s = useCanvasStore.getState();
    s.addLayer({ kind: 'text', text: 'Atelier', view: 'front' });
    s.addLayer({ kind: 'shape', shape: 'star', view: 'back' });
    const json = s.toCanvasState();
    expect(json.version).toBe(1);
    expect(json.layers).toHaveLength(2);
    expect(json.templateId).toBe('seed-boxy-tee');
    const parsed = parseCanvasState(JSON.parse(JSON.stringify(json)));
    expect(parsed?.layers.map((l) => l.text ?? l.shape)).toEqual(['Atelier', 'star']);
    expect(parseCanvasState(null)).toBeNull();
    expect(parseCanvasState({ version: 2, layers: [] })).toBeNull();
  });

  it('layersForView splits front/back', () => {
    const s = useCanvasStore.getState();
    s.addLayer({ kind: 'text', text: 'F', view: 'front' });
    s.addLayer({ kind: 'text', text: 'B', view: 'back' });
    expect(useCanvasStore.getState().layersForView('front')).toHaveLength(1);
    expect(useCanvasStore.getState().layersForView('back')).toHaveLength(1);
  });

  it('markSaved clears dirty and records the version', () => {
    const s = useCanvasStore.getState();
    s.addLayer({ kind: 'text', text: 'x' });
    expect(useCanvasStore.getState().dirty).toBe(true);
    useCanvasStore.getState().markSaved('v-1');
    expect(useCanvasStore.getState().dirty).toBe(false);
    expect(useCanvasStore.getState().lastSavedVersionId).toBe('v-1');
    expect(useCanvasStore.getState().lastSavedAt).toBeTruthy();
  });
});
