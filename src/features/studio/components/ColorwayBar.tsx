// ColorwayBar — T07: garment color swatches; recolor runs through the
// colorway.recolor command (clientOnly) so the palette and the command
// registry stay the same path.
'use client';

import { useState } from 'react';
import { SUPPLIER_COLORS } from '@/lib/designCanvasStore';
import { useCanvasStore } from '../store/canvasStore';
import { useCommand } from '../hooks/useCommand';

export default function ColorwayBar() {
  const colorwayFill = useCanvasStore((s) => s.colorwayFill);
  const [custom, setCustom] = useState('#7c3aed');
  const { run } = useCommand();

  const pick = (hex: string) => {
    void run('colorway.recolor', { fill: hex });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="colorway-bar">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Colorway</span>
      {SUPPLIER_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          aria-label={`Colorway ${c.name}`}
          aria-pressed={colorwayFill === c.hex}
          onClick={() => pick(c.hex)}
          className={`h-7 w-7 rounded-full border ${colorwayFill === c.hex ? 'ring-2 ring-blue-600 ring-offset-1' : 'border-neutral-300'}`}
          style={{ background: c.hex }}
        />
      ))}
      <label className="flex items-center gap-1 text-xs text-neutral-500">
        Custom
        <input
          type="color"
          value={custom}
          aria-label="Custom colorway color"
          onChange={(e) => {
            setCustom(e.target.value);
            pick(e.target.value);
          }}
          className="h-7 w-8 cursor-pointer"
        />
      </label>
    </div>
  );
}
