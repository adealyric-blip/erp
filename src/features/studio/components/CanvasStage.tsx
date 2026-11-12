// CanvasStage — T07 Konva canvas. One stage per view (front/back/sleeves),
// dashed print areas from the template (mm ↔ px at 300 dpi preview scale
// is used for the mm label; the stage itself is a fixed 720×560 logical
// space so the store, the print-area rects and the layer coordinates agree).
// Split SVGs use an feImage filter chain and render correctly in the
// browser — canvas work is proven in the browser/studio, never with sharp.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Path,
  Rect,
  RegularPolygon,
  Stage,
  Star,
  Text as KonvaText,
  Transformer,
} from 'react-konva';
import type Konva from 'konva';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/anton';
import '@fontsource/bebas-neue';
import '@fontsource/playfair-display/700.css';
import { useCanvasStore, type CanvasLayer } from '../store/canvasStore';
import { isInsidePrintArea, printAreaPx, snapToGuides, type PrintAreaRect, type ViewId } from '../lib/printAreas';
import { iconById } from '../lib/icons';

export const STAGE_W = 720;
export const STAGE_H = 560;

export const CANVAS_FONTS = ['Inter', 'Anton', 'Bebas Neue', 'Playfair Display'];

type DragFn = (e: { target: Konva.Node }) => void;

interface NodeProps {
  layer: CanvasLayer;
  onSelect: () => void;
  onDragMove: DragFn;
  onDragEnd: DragFn;
  onTransformEnd: DragFn;
}

/** Load an image element for a layer src (react-konva v19 has no useImage export). */
function useLayerImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let cancelled = false;
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      if (!cancelled) setImg(el);
    };
    el.onerror = () => {
      if (!cancelled) setImg(null);
    };
    el.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return img;
}

function StageImage({ layer, onSelect, onDragMove, onDragEnd, onTransformEnd }: NodeProps) {
  const img = useLayerImage(layer.src ?? '');
  if (!img) return null;
  return (
    <KonvaImage
      image={img}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
}

/** Garment silhouette path per view, in the 720×560 stage space. */
function silhouetteFor(view: ViewId): string {
  switch (view) {
    case 'front':
    case 'back':
      return 'M250 70 L180 95 L140 150 L170 190 L185 165 L185 480 L535 480 L535 165 L550 190 L580 150 L540 95 L470 70 Q360 105 250 70 Z';
    case 'left_sleeve':
    case 'right_sleeve':
      return 'M180 120 L540 120 L540 460 L180 460 Z';
    case 'hood':
      return 'M200 90 Q360 20 520 90 Q560 250 520 420 L200 420 Q160 250 200 90 Z';
    default:
      return 'M210 300 Q210 130 360 130 Q510 130 510 300 L510 360 Q360 410 210 360 Z';
  }
}

function ShapeNode({ layer, onSelect, onDragMove, onDragEnd, onTransformEnd }: NodeProps) {
  const common = {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragMove,
    onDragEnd,
    onTransformEnd,
  };
  switch (layer.shape) {
    case 'ellipse':
      return <Ellipse {...common} width={layer.width} height={layer.height} fill={layer.fill} />;
    case 'triangle':
      return <RegularPolygon {...common} sides={3} radius={Math.max(layer.width, layer.height) / 2} fill={layer.fill} />;
    case 'star':
      return (
        <Star
          {...common}
          numPoints={5}
          innerRadius={Math.max(layer.width, layer.height) / 4}
          outerRadius={Math.max(layer.width, layer.height) / 2}
          fill={layer.fill}
        />
      );
    case 'diamond':
      return <RegularPolygon {...common} sides={4} radius={Math.max(layer.width, layer.height) / 2} fill={layer.fill} />;
    case 'heart': {
      const icon = iconById('studio:heart');
      return icon ? (
        <Path {...common} data={icon.path} scaleX={layer.width / 24} scaleY={layer.height / 24} fill={layer.fill} />
      ) : null;
    }
    case 'ring':
      return (
        <RegularPolygon
          {...common}
          sides={32}
          radius={Math.max(layer.width, layer.height) / 2}
          fill="transparent"
          stroke={layer.fill}
          strokeWidth={8}
        />
      );
    case 'line':
      return <Line {...common} points={[0, layer.height / 2, layer.width, layer.height / 2]} stroke={layer.fill} strokeWidth={6} lineCap="round" />;
    case 'arrow':
      return (
        <Line
          {...common}
          points={[0, layer.height / 2, layer.width - 14, layer.height / 2, layer.width - 14, layer.height / 2 - 10, layer.width, layer.height / 2, layer.width - 14, layer.height / 2 + 10]}
          stroke={layer.fill}
          strokeWidth={6}
          lineCap="round"
          fill={layer.fill}
          closed
        />
      );
    case 'rect-round':
      return <Rect {...common} width={layer.width} height={layer.height} cornerRadius={12} fill={layer.fill} />;
    case 'rect':
    default:
      return <Rect {...common} width={layer.width} height={layer.height} fill={layer.fill} />;
  }
}

function IconNode({ layer, onSelect, onDragMove, onDragEnd, onTransformEnd }: NodeProps) {
  const icon = iconById(layer.shape ?? '');
  if (!icon) return null;
  return (
    <Path
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      data={icon.path}
      scaleX={layer.width / 24}
      scaleY={layer.height / 24}
      fill={layer.fill}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
}

export interface CanvasStageProps {
  view: ViewId;
  printArea: PrintAreaRect | null;
  colorwayFill: string;
  readOnly?: boolean;
}

export default function CanvasStage({ view, printArea, colorwayFill, readOnly }: CanvasStageProps) {
  // NOTE: never select a derived array from the store (filter/map) — the
  // new reference on every getSnapshot call loops React's
  // useSyncExternalStore ("Maximum update depth exceeded"). Select the raw
  // array and memoize the derivation instead.
  const allLayers = useCanvasStore((s) => s.layers);
  const layers = useMemo(() => allLayers.filter((l) => l.view === view), [allLayers, view]);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectLayer = useCanvasStore((s) => s.selectLayer);
  const updateLayer = useCanvasStore((s) => s.updateLayer);
  const setOutsidePrintArea = useCanvasStore((s) => s.setOutsidePrintArea);
  const peers = useCanvasStore((s) => s.peers);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [fontsReady, setFontsReady] = useState(false);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRefs = useRef(new Map<string, Konva.Node>());

  const areaPx = useMemo(() => (printArea ? printAreaPx(printArea, STAGE_W, STAGE_H) : null), [printArea]);

  // Load the Fontsource fonts so Konva canvas text uses them; re-render
  // once loaded (canvas text drawn before the font arrives stays fallback).
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let cancelled = false;
    void Promise.all(CANVAS_FONTS.map((f) => document.fonts.load(`32px "${f}"`).catch(() => undefined))).then(
      () => {
        if (!cancelled) setFontsReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / STAGE_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Attach the transformer to the selected node.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? layerRefs.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers]);

  const checkContainment = (box: { x: number; y: number; width: number; height: number }) => {
    if (!areaPx) return;
    setOutsidePrintArea(!isInsidePrintArea(box, areaPx));
  };

  const handleDragMove = (layer: CanvasLayer): DragFn => (e) => {
    const node = e.target;
    const guides = areaPx
      ? [areaPx.x, areaPx.x + areaPx.width / 2, areaPx.x + areaPx.width, STAGE_W / 2]
      : [STAGE_W / 2];
    const snappedX = snapToGuides(node.x(), guides);
    if (snappedX !== node.x()) node.x(snappedX);
    checkContainment({ x: node.x(), y: node.y(), width: layer.width, height: layer.height });
  };

  const handleDragEnd = (layer: CanvasLayer): DragFn => (e) => {
    const node = e.target;
    updateLayer(layer.id, { x: node.x(), y: node.y() });
    checkContainment({ x: node.x(), y: node.y(), width: layer.width, height: layer.height });
  };

  const handleTransformEnd = (layer: CanvasLayer): DragFn => (e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const patch: Partial<CanvasLayer> = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(8, layer.width * scaleX),
      height: Math.max(8, layer.height * scaleY),
    };
    updateLayer(layer.id, patch);
    checkContainment({ x: node.x(), y: node.y(), width: patch.width ?? layer.width, height: patch.height ?? layer.height });
  };

  const refFor = (id: string) => (n: Konva.Node | null) => {
    if (n) layerRefs.current.set(id, n);
    else layerRefs.current.delete(id);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-neutral-200 bg-white"
      data-testid="canvas-stage"
      data-view={view}
    >
      <Stage
        width={STAGE_W * scale}
        height={STAGE_H * scale}
        scaleX={scale}
        scaleY={scale}
        // fontsReady is read here so the stage re-renders once fonts load.
        key={fontsReady ? 'fonts-ready' : 'fonts-pending'}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) selectLayer(null);
        }}
      >
        <Layer>
          <Path data={silhouetteFor(view)} fill={colorwayFill} stroke="#d4d4d4" strokeWidth={1.5} />
          {areaPx && (
            <>
              <Rect
                x={areaPx.x}
                y={areaPx.y}
                width={areaPx.width}
                height={areaPx.height}
                stroke="#2563eb"
                strokeWidth={1.5}
                dash={[8, 6]}
                fill="rgba(37, 99, 235, 0.04)"
              />
              <KonvaText
                x={areaPx.x + 6}
                y={areaPx.y - 20}
                text={printArea ? `${view} · ${printArea.width_mm}×${printArea.height_mm} mm` : view}
                fontSize={12}
                fontFamily="Inter"
                fill="#2563eb"
              />
            </>
          )}
          {layers.map((layer) => {
            const onSelect = () => selectLayer(layer.id);
            const dragMove = handleDragMove(layer);
            const dragEnd = handleDragEnd(layer);
            const transformEnd = handleTransformEnd(layer);
            const ref = refFor(layer.id);
            if (layer.kind === 'text') {
              return (
                <KonvaText
                  key={layer.id}
                  ref={ref}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  rotation={layer.rotation}
                  text={layer.text ?? ''}
                  fontSize={layer.fontSize ?? 32}
                  fontFamily={layer.fontFamily ?? 'Inter'}
                  fill={layer.fill}
                  draggable={!readOnly}
                  onClick={onSelect}
                  onTap={onSelect}
                  onDragMove={dragMove}
                  onDragEnd={dragEnd}
                  onTransformEnd={transformEnd}
                />
              );
            }
            if (layer.kind === 'image') {
              return (
                <StageImage key={layer.id} layer={layer} onSelect={onSelect} onDragMove={dragMove} onDragEnd={dragEnd} onTransformEnd={transformEnd} />
              );
            }
            if (layer.kind === 'icon') {
              return (
                <IconNode key={layer.id} layer={layer} onSelect={onSelect} onDragMove={dragMove} onDragEnd={dragEnd} onTransformEnd={transformEnd} />
              );
            }
            return (
              <ShapeNode key={layer.id} layer={layer} onSelect={onSelect} onDragMove={dragMove} onDragEnd={dragEnd} onTransformEnd={transformEnd} />
            );
          })}
          {!readOnly && (
            <Transformer
              ref={trRef}
              rotateEnabled
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
            />
          )}
        </Layer>
      </Stage>
      {/* Presence cursors (T08): peers' cursors at their viewport position. */}
      {peers
        .filter((p) => p.view === view)
        .map((p) => (
          <div
            key={p.id}
            data-peer-cursor={p.id}
            className="pointer-events-none fixed z-50 flex items-center gap-1"
            style={{ left: p.x + 12, top: p.y + 12 }}
            title={p.name}
          >
            <span className="inline-block h-3 w-3 rounded-full border border-white" style={{ background: p.color }} />
            <span className="rounded px-1 py-0.5 text-[10px] font-medium text-white" style={{ background: p.color }}>
              {p.name}
            </span>
          </div>
        ))}
    </div>
  );
}
