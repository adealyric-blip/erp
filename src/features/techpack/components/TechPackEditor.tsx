// Tech pack editor — TechPackEditor shell (T13/T13b): the 11 tabs map 1:1
// to the 11 template pages (plan/09). The flat is the Sketch page inside
// this view (switcher requirement, Nov 12): Construction drops numbered
// callouts ON the flat, and the old standalone Tech Pack pill-flat button
// folds in as this Sketch page.
//
// Edits update local state immediately and persist through the server
// actions; in demo mode (no live pack) edits stay local and the banner
// says so. A DB error from the measurement grid is mapped to its cell.
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TemplateValidation } from '@/lib/techpack-render/types';
import { gradeValues, mapDbErrorToCell, snapshotSizes, snapshotStatus } from '../lib/validation';
import { TECH_PACK_TABS, type TechPackEditorProps, type TechPackTabId } from '../types';
import {
  applyGradeRule as persistGradeRule,
  deleteArtwork as persistDeleteArtwork,
  deleteBomLine as persistDeleteBomLine,
  deleteConstruction as persistDeleteConstruction,
  deleteLabel as persistDeleteLabel,
  deletePomMarker as persistDeletePomMarker,
  transitionTechPack as persistTransition,
  updateTechPackHeader as persistHeader,
  upsertArtwork as persistArtwork,
  upsertBomLine as persistBomLine,
  upsertColorwayComponent as persistColorwayComponent,
  upsertConstruction as persistConstruction,
  upsertHangtag as persistHangtag,
  upsertLabel as persistLabel,
  upsertMeasurement as persistMeasurement,
  upsertPackaging as persistPackaging,
  upsertPomMarker as persistPomMarker,
} from '@/server/actions/techpacks';
import HeaderPanel from './HeaderPanel';
import StatusBar from './StatusBar';
import BomTable from './BomTable';
import MeasurementGrid from './MeasurementGrid';
import ConstructionList from './ConstructionList';
import ConstructionCallouts from './ConstructionCallouts';
import PomMarkerEditor from './PomMarkerEditor';
import ArtworkPlacements from './ArtworkPlacements';
import ColorwayMatrix from './ColorwayMatrix';
import LabelEditor from './LabelEditor';
import HangTagEditor from './HangTagEditor';
import PackagingEditor from './PackagingEditor';
import TemplatePreview from './TemplatePreview';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export default function TechPackEditor(props: TechPackEditorProps & { validation: TemplateValidation }) {
  const { designId, techPackId, initialSnapshot, lookups, previewPages, demoMode, validation } = props;
  const [snapshot, setSnapshot] = useState<TechPackSnapshot>(initialSnapshot);
  const [tab, setTab] = useState<TechPackTabId>('sketch');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cellError, setCellError] = useState<{ cell: string | null; message: string } | null>(null);
  const [preview] = useState(previewPages);

  const status = snapshotStatus(snapshot);
  const locked = status === 'approved' || status === 'released';
  const tp = (snapshot.tech_pack ?? {}) as Record<string, unknown>;
  const revision = Number(tp.revision ?? 1);

  const applyLocal = (mutate: (s: TechPackSnapshot) => void) => {
    setSnapshot((prev) => {
      const next = clone(prev);
      mutate(next);
      return next;
    });
  };

  /** Persist one edit; in demo mode the edit stays local only. */
  const persist = async (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    if (demoMode || !techPackId) return;
    const r = await fn();
    if (!r.ok) {
      const mapped = mapDbErrorToCell(r.error?.message ?? 'Save failed');
      setCellError(mapped.cell ? mapped : null);
      setSaveError(r.error?.message ?? 'Save failed');
    } else {
      setSaveError(null);
      setCellError(null);
    }
  };

  /** Re-render note: the live preview is server-rendered from the
   *  saved snapshot; each server action revalidates the page so the
   *  preview refreshes after a save. (fill() is pure, but the SVG
   *  masters live on disk — the browser never reads them directly.) */

  const pomCode = (pomId: string) => lookups.poms.find((p) => p.id === pomId)?.code ?? pomId;

  const handlers = {
    updateHeader: (patch: Record<string, unknown>) => {
      applyLocal((s) => {
        const t = (s.tech_pack ?? {}) as Record<string, unknown>;
        const h = (s.header ?? {}) as Record<string, unknown>;
        Object.assign(t, patch);
        Object.assign(h, patch);
        s.tech_pack = t;
        s.header = h;
      });
      void persist(() => persistHeader(techPackId ?? '', patch));
    },
    upsertBomLine: (line: Record<string, unknown>) => {
      const id = String(line.id ?? `tmp-${Date.now()}`);
      applyLocal((s) => {
        const bom = s.bom ?? [];
        const i = bom.findIndex((b) => String(b.id ?? '') === id);
        if (i >= 0) bom[i] = { ...bom[i], ...line, id };
        else bom.push({ ...line, id });
        s.bom = bom;
      });
      void persist(() => persistBomLine(techPackId ?? '', { ...line, id: line.id ?? undefined }));
    },
    deleteBomLine: (id: string) => {
      applyLocal((s) => { s.bom = (s.bom ?? []).filter((b) => String(b.id ?? '') !== id); });
      void persist(() => persistDeleteBomLine(techPackId ?? '', id));
    },
    upsertMeasurement: (pomId: string, size: string, value: number, tolPlus: number, tolMinus: number, grade: number | null) => {
      const code = pomCode(pomId);
      applyLocal((s) => {
        const ms = s.measurements ?? [];
        const i = ms.findIndex((m) => String(m.pom ?? '') === code && String(m.size ?? '') === size);
        const row = { pom: code, pom_id: pomId, name: lookups.poms.find((p) => p.id === pomId)?.name ?? code, size, value, tol_plus: tolPlus, tol_minus: tolMinus, grade };
        if (i >= 0) ms[i] = { ...ms[i], ...row };
        else ms.push(row);
        s.measurements = ms;
      });
      void persist(() => persistMeasurement(techPackId ?? '', pomId, size, value, tolPlus, tolMinus, grade));
    },
    applyGradeRule: (pomId: string, baseValue: number, increment: number) => {
      const code = pomCode(pomId);
      const sizes = snapshotSizes(snapshot);
      const baseSize = String(tp.base_size ?? '');
      const values = gradeValues(baseValue, increment, sizes, baseSize);
      applyLocal((s) => {
        for (const m of s.measurements ?? []) {
          if (String(m.pom ?? '') === code && values[String(m.size ?? '')] !== undefined) {
            m.value = values[String(m.size ?? '')];
            m.grade = increment;
          }
        }
      });
      void persist(() => persistGradeRule(techPackId ?? '', pomId, baseValue, increment));
    },
    upsertConstruction: (row: Record<string, unknown>) => {
      const id = String(row.id ?? `tmp-${Date.now()}`);
      applyLocal((s) => {
        const list = s.construction ?? [];
        const i = list.findIndex((c) => String(c.id ?? '') === id);
        if (i >= 0) list[i] = { ...list[i], ...row, id };
        else list.push({ ...row, id });
        s.construction = list;
      });
      void persist(() => persistConstruction(techPackId ?? '', { ...row, id: row.id ?? undefined }));
    },
    deleteConstruction: (id: string) => {
      applyLocal((s) => { s.construction = (s.construction ?? []).filter((c) => String(c.id ?? '') !== id); });
      void persist(() => persistDeleteConstruction(techPackId ?? '', id));
    },
    upsertArtwork: (row: Record<string, unknown>) => {
      const id = String(row.id ?? `tmp-${Date.now()}`);
      applyLocal((s) => {
        const list = s.artwork ?? [];
        const i = list.findIndex((a) => String(a.id ?? '') === id);
        if (i >= 0) list[i] = { ...list[i], ...row, id };
        else list.push({ ...row, id });
        s.artwork = list;
      });
      void persist(() => persistArtwork(techPackId ?? '', { ...row, id: row.id ?? undefined }));
    },
    deleteArtwork: (id: string) => {
      applyLocal((s) => { s.artwork = (s.artwork ?? []).filter((a) => String(a.id ?? '') !== id); });
      void persist(() => persistDeleteArtwork(techPackId ?? '', id));
    },
    upsertPomMarker: (row: Record<string, unknown>) => {
      const id = String(row.id ?? `tmp-${Date.now()}`);
      applyLocal((s) => {
        const list = s.pom_markers ?? [];
        const i = list.findIndex((m) => String(m.id ?? '') === id);
        if (i >= 0) list[i] = { ...list[i], ...row, id };
        else list.push({ ...row, id });
        s.pom_markers = list;
      });
      void persist(() => persistPomMarker(techPackId ?? '', { ...row, id: row.id ?? undefined }));
    },
    deletePomMarker: (id: string) => {
      applyLocal((s) => { s.pom_markers = (s.pom_markers ?? []).filter((m) => String(m.id ?? '') !== id); });
      void persist(() => persistDeletePomMarker(techPackId ?? '', id));
    },
    upsertColorwayComponent: (row: Record<string, unknown>) => {
      applyLocal((s) => {
        const list = s.colorway_components ?? [];
        const i = list.findIndex(
          (c) => String(c.bom_line_id ?? '') === String(row.bom_line_id ?? '') && String(c.colorway_id ?? '') === String(row.colorway_id ?? ''),
        );
        if (i >= 0) list[i] = { ...list[i], ...row };
        else list.push(row);
        s.colorway_components = list;
      });
      void persist(() => persistColorwayComponent(techPackId ?? '', row));
    },
    upsertLabel: (row: Record<string, unknown>) => {
      const id = String(row.id ?? `tmp-${Date.now()}`);
      applyLocal((s) => {
        const list = s.labels ?? [];
        const i = list.findIndex((l) => String(l.id ?? '') === id || String(l.kind ?? '') === String(row.kind ?? ''));
        if (i >= 0) list[i] = { ...list[i], ...row, id: list[i].id ?? id };
        else list.push({ ...row, id });
        s.labels = list;
      });
      void persist(() => persistLabel(techPackId ?? '', { ...row, id: row.id ?? undefined }));
    },
    deleteLabel: (id: string) => {
      applyLocal((s) => { s.labels = (s.labels ?? []).filter((l) => String(l.id ?? '') !== id); });
      void persist(() => persistDeleteLabel(techPackId ?? '', id));
    },
    upsertHangtag: (row: Record<string, unknown>) => {
      applyLocal((s) => { s.hangtags = [{ ...((s.hangtags ?? [])[0] ?? {}), ...row }]; });
      void persist(() => persistHangtag(techPackId ?? '', row));
    },
    upsertPackaging: (row: Record<string, unknown>) => {
      applyLocal((s) => { s.packaging = { ...((s.packaging ?? {}) as Record<string, unknown>), ...row }; });
      void persist(() => persistPackaging(techPackId ?? '', row));
    },
    transition: (to: 'in_review' | 'draft' | 'approved' | 'released' | 'archived', note?: string) => {
      applyLocal((s) => {
        const t = (s.tech_pack ?? {}) as Record<string, unknown>;
        t.status = to;
        s.tech_pack = t;
      });
      void persist(() => persistTransition(techPackId ?? '', to, note));
    },
  };

  const sketchPage = preview.find((p) => p.pageId === 'sketch');

  return (
    <div className="space-y-4" data-testid="techpack-editor" data-design-id={designId}>
      {demoMode && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="techpack-demo-banner">
          Demo data (Boxy Tee fixture) — sign in to load the live tech pack. Edits stay on this page only.
        </p>
      )}
      {saveError && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="techpack-save-error">
          Save failed: {saveError}
        </p>
      )}
      <StatusBar status={status} revision={revision} locked={locked} onTransition={handlers.transition} />
      <HeaderPanel snapshot={snapshot} lookups={lookups} locked={locked} onUpdateHeader={handlers.updateHeader} />
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Tech pack pages" data-testid="techpack-tabs">
        {TECH_PACK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === t.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white hover:bg-neutral-100'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded-md border border-neutral-300 bg-white p-4">
          {tab === 'sketch' && (
            <section data-testid="techpack-sketch">
              <h2 className="text-sm font-semibold">Sketch — front + back flat</h2>
              <p className="mt-1 text-xs text-neutral-500">
                The flat lives here, as the Sketch page of the Tech Packs view. Main fabric and Pantone chips come from the BOM and the default colorway.
              </p>
              {sketchPage ? (
                <div className="mt-2 overflow-auto rounded border border-neutral-200 bg-neutral-50" dangerouslySetInnerHTML={{ __html: sketchPage.svg }} />
              ) : (
                <div className="mt-2 flex gap-4">
                  <div className="h-64 w-48 rounded border border-dashed border-neutral-400 bg-neutral-50 p-2 text-center text-xs text-neutral-500">Front flat</div>
                  <div className="h-64 w-48 rounded border border-dashed border-neutral-400 bg-neutral-50 p-2 text-center text-xs text-neutral-500">Back flat</div>
                </div>
              )}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-neutral-500">Main fabric</dt><dd>{String(((snapshot.header as Record<string, unknown> | undefined)?.main_fabric as Record<string, unknown> | undefined)?.description ?? '')}</dd></div>
                <div><dt className="text-xs text-neutral-500">Pantone</dt><dd>{(snapshot.colorways ?? [])[0] && Array.isArray((snapshot.colorways ?? [])[0].pantone_codes) ? ((snapshot.colorways ?? [])[0].pantone_codes as string[]).join(', ') : '—'}</dd></div>
              </dl>
            </section>
          )}
          {tab === 'construction' && (
            <div className="space-y-4">
              <ConstructionCallouts snapshot={snapshot} locked={locked} onUpsertConstruction={handlers.upsertConstruction} onDeleteConstruction={handlers.deleteConstruction} />
              <ConstructionList snapshot={snapshot} locked={locked} onUpsertConstruction={handlers.upsertConstruction} onDeleteConstruction={handlers.deleteConstruction} />
            </div>
          )}
          {tab === 'measurement_guide' && (
            <PomMarkerEditor snapshot={snapshot} lookups={lookups} locked={locked} onUpsertPomMarker={handlers.upsertPomMarker} onDeletePomMarker={handlers.deletePomMarker} />
          )}
          {tab === 'measurement_chart' && (
            <MeasurementGrid snapshot={snapshot} lookups={lookups} locked={locked} cellError={cellError} onUpsertMeasurement={handlers.upsertMeasurement} onApplyGradeRule={handlers.applyGradeRule} />
          )}
          {tab === 'bom' && (
            <BomTable snapshot={snapshot} lookups={lookups} locked={locked} onUpsertBomLine={handlers.upsertBomLine} onDeleteBomLine={handlers.deleteBomLine} />
          )}
          {tab === 'materials' && (
            <section data-testid="techpack-materials">
              <h2 className="text-sm font-semibold">Materials &amp; trims</h2>
              <p className="mt-1 text-xs text-neutral-500">Distinct materials from the BOM — fabric first, then trims (rendered as swatch cards on template page 6).</p>
              <BomTable snapshot={snapshot} lookups={lookups} locked={locked} onUpsertBomLine={handlers.upsertBomLine} onDeleteBomLine={handlers.deleteBomLine} />
            </section>
          )}
          {tab === 'colorways' && (
            <ColorwayMatrix snapshot={snapshot} lookups={lookups} locked={locked} onUpsertColorwayComponent={handlers.upsertColorwayComponent} />
          )}
          {tab === 'artwork' && (
            <ArtworkPlacements snapshot={snapshot} lookups={lookups} locked={locked} onUpsertArtwork={handlers.upsertArtwork} onDeleteArtwork={handlers.deleteArtwork} />
          )}
          {tab === 'labels' && (
            <LabelEditor snapshot={snapshot} locked={locked} onUpsertLabel={handlers.upsertLabel} onDeleteLabel={handlers.deleteLabel} />
          )}
          {tab === 'hangtag' && (
            <HangTagEditor snapshot={snapshot} locked={locked} onUpsertHangtag={handlers.upsertHangtag} />
          )}
          {tab === 'packaging' && (
            <PackagingEditor snapshot={snapshot} locked={locked} onUpsertPackaging={handlers.upsertPackaging} />
          )}
        </div>
        <TemplatePreview pages={preview} validation={validation} />
      </div>
    </div>
  );
}
