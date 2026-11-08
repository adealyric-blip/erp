import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './StudioDrawer.module.css';
import {
  SUPPLIER_CATEGORY_DATA,
  useDesignCanvas,
} from '@/lib/designCanvasStore';
import {
  appendPlacementLayer,
  applyTemplate,
  enqueue,
  generateAiArt,
  getDesignDetail,
  listAssets,
  listDesigns,
  listQueue,
  removeQueueItem,
  setDesignTemplate,
  updateQueueItem,
  uploadFile,
  type BlankDetail,
  type DesignAsset,
  type DesignListItem,
  type PlacementLayer,
  type QueueItem,
} from '@/lib/podApi';

export type StudioDrawerKind =
  | 'Upload'
  | 'AI'
  | 'Add text'
  | 'My library'
  | 'Graphics'
  | 'My templates'
  | 'Images'
  | 'Supplier'
  | 'Queue';

interface StudioDrawerProps {
  open: boolean;
  kind: string;
  onClose: () => void;
  onToast: (message: string) => void;
}

const KIND_META: Record<string, { icon: string; subtitle: string; action: string }> = {
  Upload: { icon: 'cloud_upload', subtitle: 'Bring your own art into the studio', action: 'Browse files' },
  AI: { icon: 'auto_awesome', subtitle: 'Generate art from a prompt', action: 'Generate' },
  'Add text': { icon: 'text_fields', subtitle: 'Drop a text layer on the canvas', action: 'Add to canvas' },
  'My library': { icon: 'folder_special', subtitle: 'Your saved studio assets', action: 'Upload to library' },
  Graphics: { icon: 'interests', subtitle: 'Shapes, icons, and embellishments', action: 'Add selected' },
  'My templates': { icon: 'view_quilt', subtitle: 'Reuse a design you already built', action: 'Save current as template' },
  Images: { icon: 'image', subtitle: 'Search and license imagery', action: 'Search' },
  Supplier: { icon: 'inventory_2', subtitle: 'Live API data — select a variant to begin designing', action: 'Design with this SKU' },
  Queue: { icon: 'playlist_add', subtitle: 'Products queued for batch design', action: 'Start designing' },
};

const TEXT_PRESETS = [
  { label: 'Add a heading', sample: 'Aa', size: 32 },
  { label: 'Add a subheading', sample: 'Aa', size: 22 },
  { label: 'Add a little bit of body text', sample: 'Aa', size: 15 },
];

const FONTS = ['Anton', 'Inter', 'Playfair Display', 'Bebas Neue'];

const GRAPHIC_CATEGORIES = ['Shapes', 'Badges', 'Icons', 'Symbols', 'Labels', 'Borders'];
const IMAGE_FILTERS = ['Photos', 'Illustrations', 'Vectors', 'Textures'];
const LIBRARY_FOLDERS = ['Logos', 'Seasonal', 'Mockups', 'Exports'];

const AI_STYLES = ['Illustration', 'Photo', 'Vector', 'Watercolor'];

/* ── Shared helpers ── */

function assetName(a: DesignAsset): string {
  const orig = a.metadata?.originalName;
  if (typeof orig === 'string' && orig) return orig;
  const parts = a.storagePath.split('/');
  return parts[parts.length - 1] ?? a.id.slice(0, 8);
}

function isImageAsset(a: DesignAsset): boolean {
  return (a.mimeType ?? '').startsWith('image/');
}

/** Center a w×h (inches) layer inside the current print box. */
function placementFor(
  blankDetail: BlankDetail | null,
  printArea: string,
  wIn: number,
  hIn: number,
): { view: string; xIn: number; yIn: number; wIn: number; hIn: number; rotationDeg: number } {
  const view =
    blankDetail?.views.find((v) => v.view.toLowerCase() === printArea.toLowerCase()) ??
    blankDetail?.views.find((v) => v.label.toLowerCase().includes(printArea.toLowerCase())) ??
    blankDetail?.views[0];
  const box = view?.boxIn ?? { xIn: 0, yIn: 0, wIn: 8, hIn: 10 };
  const w = Math.min(wIn, box.wIn);
  const h = Math.min(hIn, box.hIn);
  return {
    view: view?.view ?? 'FRONT',
    xIn: box.xIn + Math.max(0, (box.wIn - w) / 2),
    yIn: box.yIn + Math.max(0, (box.hIn - h) / 2),
    wIn: w,
    hIn: h,
    rotationDeg: 0,
  };
}

interface PanelProps {
  onToast: (message: string) => void;
  designId: string | null;
  blankDetail: BlankDetail | null;
  printArea: string;
  /** Lets the panel set the footer's primary button for this kind. */
  onPrimary: (label: string, run: () => void) => void;
}

/** Save one layer into the draft design's placement_spec via PATCH. */
async function addLayer(
  designId: string | null,
  layer: PlacementLayer,
  onToast: (message: string) => void,
): Promise<boolean> {
  if (!designId) {
    onToast('No design draft loaded — start designing from a product first.');
    return false;
  }
  try {
    await appendPlacementLayer(designId, layer);
    onToast('Layer saved to the design.');
    return true;
  } catch (e) {
    onToast(`Could not save the layer: ${e instanceof Error ? e.message : 'failed'}`);
    return false;
  }
}

function imageLayer(
  asset: DesignAsset,
  blankDetail: BlankDetail | null,
  printArea: string,
): PlacementLayer {
  const wIn = asset.width ? asset.width / 300 : 4;
  const hIn = asset.height ? asset.height / 300 : 4;
  return {
    kind: 'image',
    assetId: asset.id,
    ...placementFor(blankDetail, printArea, wIn, hIn),
    z: 0,
  };
}

function shapeLayer(
  asset: DesignAsset,
  blankDetail: BlankDetail | null,
  printArea: string,
): PlacementLayer {
  return {
    kind: 'shape',
    assetId: asset.id,
    ...placementFor(blankDetail, printArea, 3, 3),
    z: 0,
  };
}

/* ── B1 Upload ── */

function UploadPanel({ onToast, designId, blankDetail, printArea, onPrimary }: PanelProps) {
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { assets: rows } = await listAssets({ kind: 'upload' });
      setAssets(rows);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load uploads.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);
  useEffect(() => {
    onPrimary('Browse files', openPicker);
  }, [onPrimary, openPicker]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { asset } = await uploadFile(file, { designId: designId ?? undefined });
      setAssets((prev) => [asset, ...prev]);
      onToast(`Uploaded ${assetName(asset)}.`);
    } catch (e) {
      onToast(`Upload failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        className={styles.dropzone}
        data-studio-dropzone
        onClick={openPicker}
        disabled={uploading}
      >
        <span className={`material-symbols-outlined ${styles.dropzoneIcon}`}>cloud_upload</span>
        <span className={styles.dropzoneTitle}>
          {uploading ? 'Uploading…' : 'Drag & drop or browse'}
        </span>
        <span className={styles.dropzoneHint}>PNG, JPG, SVG, PDF — up to 25 MB</span>
      </button>
      <div className={styles.sectionHeading}>Recent uploads</div>
      {status === 'loading' && <p className={styles.subtitle}>Loading uploads…</p>}
      {status === 'error' && <p className={styles.subtitle}>{error}</p>}
      {status === 'ready' && assets.length === 0 && (
        <p className={styles.subtitle}>No uploads yet — browse a file to add your first asset.</p>
      )}
      <ul className={styles.listRows}>
        {assets.map((a) => (
          <li
            key={a.id}
            draggable
            className={styles.draggable}
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-asset', a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => void addLayer(designId, imageLayer(a, blankDetail, printArea), onToast)}
            title="Click to add to the canvas"
          >
            {isImageAsset(a) && a.url ? (
              <img src={a.url} alt={assetName(a)} style={{ width: 32, height: 32, objectFit: 'cover' }} />
            ) : (
              <span className={`material-symbols-outlined ${styles.rowIcon}`}>image</span>
            )}
            <span className={styles.rowLabel}>{assetName(a)}</span>
            <span className={styles.rowMeta}>
              {a.mimeType?.replace('image/', '').toUpperCase() ?? 'FILE'} ·{' '}
              {new Date(a.createdAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── B2 AI ── */

function AiPanel({ onToast, designId, blankDetail, printArea, onPrimary }: PanelProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(AI_STYLES[0]);
  const [generations, setGenerations] = useState<DesignAsset[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { assets } = await listAssets({ kind: 'ai' });
      setGenerations(assets);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const { asset } = await generateAiArt({
        prompt: prompt.trim(),
        style,
        designId: designId ?? undefined,
      });
      setGenerations((prev) => [asset, ...prev]);
      onToast('Art generated and saved to your assets.');
    } catch (e) {
      onToast(`Generation failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }, [prompt, style, busy, designId, onToast]);

  useEffect(() => {
    onPrimary('Generate', () => void generate());
  }, [onPrimary, generate]);

  return (
    <>
      <label className={styles.fieldLabel}>Describe the art you need</label>
      <textarea
        className={styles.promptArea}
        placeholder="e.g. retro mountain sunset with bold outline, 3-color screen print…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className={styles.fieldLabel}>Style</div>
      <div className={styles.chipRow}>
        {AI_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${s === style ? styles.chipActive : ''}`}
            onClick={() => setStyle(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.primaryBtn}
        data-ai-generate
        onClick={() => void generate()}
        disabled={!prompt.trim() || busy}
      >
        <span className={`material-symbols-outlined ${styles.icon16}`}>auto_awesome</span>
        {busy ? 'Generating…' : 'Generate 4 variations'}
      </button>
      <div className={styles.sectionHeading}>Recent generations</div>
      {status === 'loading' && <p className={styles.subtitle}>Loading generations…</p>}
      {status === 'error' && <p className={styles.subtitle}>Could not load generations.</p>}
      {status === 'ready' && generations.length === 0 && (
        <p className={styles.subtitle}>No generations yet — describe the art and generate.</p>
      )}
      <div className={styles.tileGrid}>
        {generations.map((a, i) => (
          <div
            key={a.id}
            className={styles.tile}
            data-ai-variation={i}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-asset', a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => void addLayer(designId, imageLayer(a, blankDetail, printArea), onToast)}
            title={a.prompt ?? assetName(a)}
          >
            {a.url ? <img src={a.url} alt={a.prompt ?? assetName(a)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── B3 Add text ── */

function TextPanel({ onToast, designId, blankDetail, printArea, onPrimary }: PanelProps) {
  const [value, setValue] = useState('');
  const [font, setFont] = useState('Inter');
  const [size, setSize] = useState(TEXT_PRESETS[0].size);

  const addText = useCallback(
    async (presetSize?: number) => {
      const text = value.trim() || 'Your text';
      const pt = presetSize ?? size;
      const sizeIn = pt / 72;
      const box = placementFor(blankDetail, printArea, 8, sizeIn * 2);
      await addLayer(
        designId,
        {
          kind: 'text',
          text: { value: text, fontId: font, sizeIn, fill: '#111111' },
          ...box,
          z: 0,
        },
        onToast,
      );
    },
    [value, font, size, designId, blankDetail, printArea, onToast],
  );

  useEffect(() => {
    onPrimary('Add to canvas', () => void addText());
  }, [onPrimary, addText]);

  return (
    <>
      <label className={styles.fieldLabel}>Your text</label>
      <textarea
        className={styles.promptArea}
        placeholder="Type your text…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className={styles.sectionHeading}>Text presets</div>
      <div className={styles.textPresets}>
        {TEXT_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={styles.textPresetBtn}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-text', p.label);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              setSize(p.size);
              void addText(p.size);
            }}
          >
            <span className={styles.textPresetSample} style={{ fontSize: p.size }}>
              {p.sample}
            </span>
            <span className={styles.textPresetLabel}>{p.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.sectionHeading}>Fonts</div>
      <ul className={styles.listRows}>
        {FONTS.map((f) => (
          <li
            key={f}
            draggable
            className={styles.draggable}
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-font', f);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => setFont(f)}
          >
            <span className={styles.fontSample}>{f}</span>
            <span className={styles.rowMeta}>{f === font ? 'Selected' : 'Font'}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── B4 My library ── */

function LibraryPanel({ onToast, designId, blankDetail, printArea, onPrimary }: PanelProps) {
  const [folder, setFolder] = useState('All');
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [designs, setDesigns] = useState<DesignListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [{ assets: rows }, { items }] = await Promise.all([
        listAssets({ limit: 50 }),
        listDesigns({ limit: 20 }),
      ]);
      setAssets(rows);
      setDesigns(items);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);
  useEffect(() => {
    onPrimary('Upload to library', openPicker);
  }, [onPrimary, openPicker]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const { asset } = await uploadFile(file, {
        designId: designId ?? undefined,
        folder: folder === 'All' ? undefined : folder,
      });
      setAssets((prev) => [asset, ...prev]);
      onToast(`Uploaded ${assetName(asset)} to the library.`);
    } catch (e) {
      onToast(`Upload failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  };

  const visible =
    folder === 'All'
      ? assets
      : assets.filter((a) => (a.metadata?.folder as string | undefined) === folder);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className={styles.sectionHeading}>Folders</div>
      <div className={styles.chipRow}>
        {['All', ...LIBRARY_FOLDERS].map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.chip} ${f === folder ? styles.chipActive : ''}`}
            onClick={() => setFolder(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {status === 'loading' && <p className={styles.subtitle}>Loading your library…</p>}
      {status === 'error' && <p className={styles.subtitle}>Could not load your library.</p>}
      {status === 'ready' && visible.length === 0 && (
        <p className={styles.subtitle}>
          No assets in this folder yet — upload one to the library.
        </p>
      )}
      <div className={styles.tileGrid}>
        {visible.map((a) => (
          <div
            key={a.id}
            className={styles.tile}
            data-library-asset={a.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-asset', a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => void addLayer(designId, imageLayer(a, blankDetail, printArea), onToast)}
            title={assetName(a)}
          >
            {isImageAsset(a) && a.url ? (
              <img src={a.url} alt={assetName(a)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className={`material-symbols-outlined ${styles.rowIcon}`}>image</span>
            )}
          </div>
        ))}
      </div>
      <div className={styles.sectionHeading}>Saved designs — click to apply to this draft</div>
      {designs.length === 0 && status === 'ready' && (
        <p className={styles.subtitle}>No saved designs yet.</p>
      )}
      <ul className={styles.listRows}>
        {designs.map((d) => (
          <li
            key={d.id}
            className={styles.draggable}
            onClick={async () => {
              if (!designId) {
                onToast('No design draft loaded — start designing from a product first.');
                return;
              }
              try {
                await applyTemplate(d.id, designId);
                onToast(`Applied "${d.name}" to this draft.`);
              } catch (e) {
                onToast(e instanceof Error ? e.message : 'Could not apply that design.');
              }
            }}
          >
            <span className={`material-symbols-outlined ${styles.rowIcon}`}>design_services</span>
            <span className={styles.rowLabel}>
              {d.name}
              <span className={styles.rowSub}>{d.product_type ?? 'Design'}</span>
            </span>
            <span className={styles.rowMeta}>{d.status}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── B5 Graphics ── */

function GraphicsPanel({ onToast, designId, blankDetail, printArea, onPrimary }: PanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(GRAPHIC_CATEGORIES[0]);
  const [shapes, setShapes] = useState<DesignAsset[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState<DesignAsset | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { assets } = await listAssets({ kind: 'shape', limit: 100 });
      setShapes(assets);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onPrimary('Add selected', () => {
      if (selected) void addLayer(designId, shapeLayer(selected, blankDetail, printArea), onToast);
      else onToast('Select a graphic first.');
    });
  }, [onPrimary, selected, designId, blankDetail, printArea, onToast]);

  const shapeName = (a: DesignAsset): string =>
    (a.metadata?.shape as string | undefined) ?? assetName(a).replace(/\.svg$/i, '');

  const visible = shapes.filter((a) => {
    const name = shapeName(a).toLowerCase();
    if (query && !name.includes(query.toLowerCase())) return false;
    if (category === 'Shapes') return true;
    if (category === 'Badges') return name === 'badge';
    return false;
  });

  return (
    <>
      <div className={styles.searchRow}>
        <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search graphics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.chipRow}>
        {GRAPHIC_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.chip} ${c === category ? styles.chipActive : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {status === 'loading' && <p className={styles.subtitle}>Loading graphics…</p>}
      {status === 'error' && <p className={styles.subtitle}>Could not load graphics.</p>}
      {status === 'ready' && visible.length === 0 && (
        <p className={styles.subtitle}>
          No {category.toLowerCase()} yet — upload shape files to the library to grow this set.
        </p>
      )}
      <div className={styles.tileGrid}>
        {visible.map((a) => (
          <div
            key={a.id}
            className={styles.tile}
            data-graphic-tile={a.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-graphic', a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              setSelected(a);
              void addLayer(designId, shapeLayer(a, blankDetail, printArea), onToast);
            }}
            title={shapeName(a)}
          >
            {a.url ? (
              <img src={a.url} alt={shapeName(a)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span className={`material-symbols-outlined ${styles.rowIcon}`}>interests</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── B6 My templates ── */

function TemplatesPanel({ onToast, designId, onPrimary }: PanelProps) {
  const [templates, setTemplates] = useState<DesignListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { items } = await listDesigns({ template: true, limit: 50 });
      setTemplates(items);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCurrent = useCallback(async () => {
    if (!designId) {
      onToast('No design draft loaded — start designing from a product first.');
      return;
    }
    try {
      await setDesignTemplate(designId, true);
      await load();
      onToast('Current design saved as a template.');
    } catch (e) {
      onToast(`Could not save the template: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }, [designId, load, onToast]);

  useEffect(() => {
    onPrimary('Save current as template', () => void saveCurrent());
  }, [onPrimary, saveCurrent]);

  return (
    <>
      {status === 'loading' && <p className={styles.subtitle}>Loading templates…</p>}
      {status === 'error' && <p className={styles.subtitle}>Could not load templates.</p>}
      {status === 'ready' && templates.length === 0 && (
        <p className={styles.subtitle}>
          No templates yet — save a design as a template to reuse it.
        </p>
      )}
      <ul className={styles.listRows}>
        {templates.map((t) => (
          <li
            key={t.id}
            draggable
            className={styles.draggable}
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-template', t.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <span className={`material-symbols-outlined ${styles.rowIcon}`}>view_quilt</span>
            <span className={styles.rowLabel}>
              {t.name}
              <span className={styles.rowSub}>{t.product_type ?? 'Design'}</span>
            </span>
            <span className={styles.rowMeta}>
              {new Date(t.updated_at).toLocaleDateString()}
            </span>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={async () => {
                if (!designId) {
                  onToast('No design draft loaded — start designing from a product first.');
                  return;
                }
                try {
                  await applyTemplate(t.id, designId);
                  onToast(`Template "${t.name}" applied to this draft.`);
                } catch (e) {
                  onToast(e instanceof Error ? e.message : 'Could not use that template.');
                }
              }}
            >
              Use template
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── B7 Images ── */

function ImagesPanel({ onToast, designId, blankDetail, printArea, onPrimary }: PanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(IMAGE_FILTERS[0]);
  const [results, setResults] = useState<DesignAsset[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const search = useCallback(async (q: string) => {
    setStatus('loading');
    try {
      const { assets } = await listAssets({ q: q || undefined, limit: 50 });
      setResults(assets.filter((a) => ['image', 'upload', 'ai'].includes(a.kind)));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void search('');
  }, [search]);

  useEffect(() => {
    onPrimary('Search', () => void search(query));
  }, [onPrimary, search, query]);

  const visible = results.filter((a) => {
    if (filter === 'Photos') return (a.mimeType ?? '').startsWith('image/') && a.mimeType !== 'image/svg+xml';
    if (filter === 'Illustrations') return a.kind === 'ai';
    if (filter === 'Vectors') return a.mimeType === 'image/svg+xml';
    if (filter === 'Textures') return (a.metadata?.texture as boolean | undefined) === true;
    return true;
  });

  return (
    <>
      <p className={styles.subtitle}>
        No licensed stock library is connected — searching your own assets.
        A licensed image becomes an asset row with its license recorded, then a canvas layer.
      </p>
      <div className={styles.searchRow}>
        <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search images…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            void search(e.target.value);
          }}
        />
      </div>
      <div className={styles.chipRow}>
        {IMAGE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.chip} ${f === filter ? styles.chipActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {status === 'loading' && <p className={styles.subtitle}>Searching…</p>}
      {status === 'error' && <p className={styles.subtitle}>Search failed.</p>}
      {status === 'ready' && visible.length === 0 && (
        <p className={styles.subtitle}>No images match — upload images to your library first.</p>
      )}
      <div className={styles.tileGrid}>
        {visible.map((a) => (
          <div
            key={a.id}
            className={styles.tile}
            data-image-tile={a.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('studio-asset', a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => void addLayer(designId, imageLayer(a, blankDetail, printArea), onToast)}
            title={`${assetName(a)} — ${typeof a.metadata?.license === 'string' ? a.metadata.license : 'no license recorded'}`}
          >
            {a.url ? (
              <img src={a.url} alt={assetName(a)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className={`material-symbols-outlined ${styles.rowIcon}`}>image</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function StudioDrawer({ open, kind, onClose, onToast }: StudioDrawerProps) {
  const meta = KIND_META[kind] || KIND_META.Upload;
  const designId = useDesignCanvas((s) => s.designId);
  const blankDetail = useDesignCanvas((s) => s.blankDetail);
  const printArea = useDesignCanvas((s) => s.printArea);

  const [primary, setPrimary] = useState<{ label: string; run: () => void }>({
    label: meta.action,
    run: () => onToast(`${meta.action} — ${kind}`),
  });
  const onPrimary = useCallback((label: string, run: () => void) => {
    setPrimary({ label, run });
  }, []);

  const panelProps: PanelProps = { onToast, designId, blankDetail, printArea, onPrimary };

  return (
    <>
      <div
        id="studio-scrim"
        className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
        onClick={onClose}
      />
      <div
        id="studio-drawer"
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-label={`${kind} panel`}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={`material-symbols-outlined ${styles.icon20Primary}`}>{meta.icon}</span>
            <div>
              <div id="studio-drawer-title" className={styles.title}>
                {kind}
              </div>
              <div className={styles.subtitle}>{meta.subtitle}</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button type="button" className={styles.iconBtn} title="Maximize">
              <span className={`material-symbols-outlined ${styles.icon18}`}>open_in_full</span>
            </button>
            <button
              id="studio-drawer-close"
              type="button"
              className={styles.iconBtn}
              title="Close"
              onClick={onClose}
            >
              <span className={`material-symbols-outlined ${styles.icon18}`}>close</span>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {kind === 'Upload' && <UploadPanel {...panelProps} />}
          {kind === 'AI' && <AiPanel {...panelProps} />}
          {kind === 'Add text' && <TextPanel {...panelProps} />}
          {kind === 'My library' && <LibraryPanel {...panelProps} />}
          {kind === 'Graphics' && <GraphicsPanel {...panelProps} />}
          {kind === 'My templates' && <TemplatesPanel {...panelProps} />}
          {kind === 'Images' && <ImagesPanel {...panelProps} />}
          {kind === 'Supplier' && <SupplierInspector onToast={onToast} />}
          {kind === 'Queue' && <QueueInspector onToast={onToast} />}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.primaryBtn} onClick={() => primary.run()}>
            {kind === 'Queue' ? `Start designing` : primary.label}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Supplier inspector — shown when a top-bar category is clicked.
function SupplierInspector({ onToast }: { onToast: (msg: string) => void }) {
  const supplierCategory = useDesignCanvas((s) => s.supplierCategory);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const data = SUPPLIER_CATEGORY_DATA;

  if (!supplierCategory) {
    return (
      <div className={styles.supplierEmpty}>
        <span className={`material-symbols-outlined ${styles.supplierEmptyIcon}`}>
          inventory_2
        </span>
        <p className={styles.supplierEmptyText}>
          Select a category from the top bar to view supplier data.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb header */}
      <div className={styles.supplierHero}>
        <div className={styles.supplierBreadcrumb}>
          {supplierCategory.category} / {supplierCategory.subcategory}
        </div>
        <h2 className={styles.supplierProductName}>{data.productName}</h2>
        <div className={styles.supplierTags}>
          <span className={styles.supplierTag}>Supplier: {data.supplier}</span>
          <span className={styles.supplierTag}>SKU: {data.sku}</span>
        </div>
        <p className={styles.supplierHint}>
          Live API data. Select a variant to begin designing.
        </p>
      </div>

      {/* Available Colors */}
      <h4 className={styles.supplierSectionTitle}>
        Available Colors ({data.colors.length})
      </h4>
      <div className={styles.supplierColorGrid}>
        {data.colors.map((c, i) => (
          <button
            key={c.sku}
            type="button"
            className={`${styles.supplierColorBtn} ${i === 0 ? styles.supplierColorBtnActive : ''}`}
            onClick={() => {
              useDesignCanvas.getState().selectColor({ name: c.name, hex: c.hex, sku: c.sku });
              onToast(`Selected color: ${c.name} (${c.sku})`);
            }}
          >
            <div
              className={styles.supplierColorSwatch}
              style={{ background: c.hex }}
            />
            <span className={styles.supplierColorName}>{c.name}</span>
            <span className={styles.supplierColorSku}>{c.sku}</span>
          </button>
        ))}
      </div>

      {/* Available Sizes */}
      <h4 className={styles.supplierSectionTitleSpaced}>Available Sizes</h4>
      <div className={styles.supplierSizes}>
        {data.sizes.map((s) => (
          <span
            key={s}
            className={styles.supplierSizeTag}
            onClick={() => onToast(`Size ${s} selected`)}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Available Models (Mockups) */}
      <h4 className={styles.supplierSectionTitleSpaced}>
        Available Models (Mockups)
      </h4>
      <div className={styles.supplierModels}>
        {data.models.map((m, i) => (
          <div
            key={m}
            className={`${styles.supplierModelThumb} ${i === 0 ? styles.supplierModelThumbActive : ''}`}
            onClick={() => onToast(`Model: ${m}`)}
          >
            <span className={`material-symbols-outlined ${styles.supplierModelIcon}`}>
              image
            </span>
          </div>
        ))}
      </div>

      {/* Design with this SKU + View product page link */}
      <button
        type="button"
        className={styles.supplierDesignBtn}
        onClick={() => {
          loadBlank('tee');
          onToast(`${data.productName} loaded onto canvas.`);
        }}
      >
        Design with this SKU
      </button>
      <button
        type="button"
        className={styles.supplierProductPageLink}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('navigate-product-page'));
          }
        }}
      >
        View product page →
      </button>
    </>
  );
}

// ── B9 Queue inspector — persisted per user in design_queue.
// "Start designing" opens each queued blank in turn in the Studio;
// finishing one marks it done and advances to the next.
function QueueInspector({ onToast }: { onToast: (msg: string) => void }) {
  const localQueue = useDesignCanvas((s) => s.designQueue);
  const addToQueue = useDesignCanvas((s) => s.addToQueue);
  const removeFromQueue = useDesignCanvas((s) => s.removeFromQueue);
  const loadBlankDetail = useDesignCanvas((s) => s.loadBlankDetail);
  const startDesign = useDesignCanvas((s) => s.startDesign);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const syncedRef = useRef(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { queue: rows } = await listQueue();
      setQueue(rows);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Persist anything the flyout queued locally but never saved to the DB.
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    void (async () => {
      try {
        const { queue: rows } = await listQueue();
        const queuedIds = new Set(rows.map((r) => r.supplierCatalogProductId));
        for (const q of localQueue) {
          if (!queuedIds.has(q.id)) {
            try {
              await enqueue({ supplierCatalogProductId: q.id });
            } catch {
              /* already queued (409) — skip */
            }
          }
        }
        // And mirror the persisted queue into the local list so the
        // canvas screen and the inspector show the same items.
        const localIds = new Set(localQueue.map((q) => q.id));
        for (const r of rows) {
          if (r.supplierCatalogProductId && !localIds.has(r.supplierCatalogProductId)) {
            addToQueue({
              id: r.supplierCatalogProductId,
              name: r.name ?? 'Queued product',
              brand: r.brand ?? '',
              price: 0,
              blankKey: r.supplierCatalogProductId,
              img: r.imageUrl ?? '',
            });
          }
        }
      } catch {
        /* queue persistence unavailable — the inspector shows the error */
      }
      await load();
    })();
  }, [localQueue, addToQueue, load]);

  const startNext = useCallback(async () => {
    if (busy) return;
    const first = queue[0];
    if (!first) return;
    setBusy(true);
    try {
      let productId = first.supplierCatalogProductId;
      if (!productId && first.designId) {
        const { design } = await getDesignDetail(first.designId);
        productId = design.blankId as string | null;
      }
      if (!productId) throw new Error('Queued item has no blank attached.');
      await updateQueueItem(first.id, 'active');
      const detail = await loadBlankDetail(productId);
      if (!detail) throw new Error('Could not load that blank.');
      await startDesign(detail);
      await updateQueueItem(first.id, 'done');
      const remaining = queue.length - 1;
      setQueue((prev) => prev.filter((q) => q.id !== first.id));
      onToast(
        remaining > 0
          ? `Loaded "${detail.name}" onto canvas. ${remaining} remaining in the queue.`
          : `Loaded "${detail.name}" onto canvas. Queue complete.`,
      );
    } catch (e) {
      await updateQueueItem(first.id, 'queued').catch(() => undefined);
      onToast(`Could not start that item: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setBusy(false);
    }
  }, [busy, queue, loadBlankDetail, startDesign, onToast]);

  if (status === 'loading') {
    return <p className={styles.queueEmptyText}>Loading the queue…</p>;
  }
  if (status === 'error') {
    return (
      <div className={styles.queueEmpty}>
        <span className={`material-symbols-outlined ${styles.queueEmptyIcon}`}>
          playlist_add
        </span>
        <p className={styles.queueEmptyText}>Could not load the queue.</p>
      </div>
    );
  }
  if (queue.length === 0) {
    return (
      <div className={styles.queueEmpty}>
        <span className={`material-symbols-outlined ${styles.queueEmptyIcon}`}>
          playlist_add
        </span>
        <p className={styles.queueEmptyText}>
          No items in queue. Add products from the category flyout.
        </p>
      </div>
    );
  }

  return (
    <>
      {queue.map((q) => (
        <div key={q.id} className={styles.queueItem}>
          {q.imageUrl ? (
            <img src={q.imageUrl} alt={q.name ?? 'Queued product'} className={styles.queueItemImg} />
          ) : (
            <span className={`material-symbols-outlined ${styles.queueItemImg}`}>image</span>
          )}
          <div className={styles.queueItemInfo}>
            <b className={styles.queueItemName}>{q.name ?? 'Queued product'}</b>
            <span className={styles.queueItemMeta}>{q.brand ?? ''}</span>
          </div>
          <button
            type="button"
            className={styles.queueItemRemove}
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await removeQueueItem(q.id);
                if (q.supplierCatalogProductId) removeFromQueue(q.supplierCatalogProductId);
                setQueue((prev) => prev.filter((x) => x.id !== q.id));
                onToast(`Removed "${q.name ?? 'item'}" from queue.`);
              } catch (err) {
                onToast(`Could not remove it: ${err instanceof Error ? err.message : 'failed'}`);
              }
            }}
          >
            <span className={`material-symbols-outlined ${styles.queueItemRemoveIcon}`}>
              close
            </span>
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.queueStartBtn}
        onClick={() => void startNext()}
        disabled={busy}
      >
        {busy ? 'Loading…' : `Start designing (${queue.length})`}
      </button>
    </>
  );
}
