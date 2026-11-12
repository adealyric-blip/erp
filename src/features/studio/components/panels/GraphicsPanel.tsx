// GraphicsPanel — T07 Graphics drawer panel (Konva editor).
// Curated icon set (src/features/studio/lib/icons.ts, Iconify-style ids);
// the full @iconify/json self-hosted subset is an open item — the panel
// reads the same { id, label, path } shape, so it is a data-only swap.
'use client';

import { useState } from 'react';
import { STUDIO_ICONS, iconDataUri } from '../../lib/icons';
import { useCommand } from '../../hooks/useCommand';

export default function GraphicsPanel({ onToast }: { onToast: (m: string) => void }) {
  const [query, setQuery] = useState('');
  const { run } = useCommand();
  const visible = STUDIO_ICONS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  const addIcon = (id: string, label: string) => {
    void run('layer.add_shape', { kind: 'icon', shape: id, width: 90, height: 90, fill: '#111111' }).then((res) => {
      if (res.ok) onToast(`Added ${label} to the canvas.`);
    });
  };

  return (
    <div data-testid="graphics-panel">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search graphics…"
        aria-label="Search graphics"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <p className="mt-2 text-xs text-neutral-500">
        Curated icon set (studio:*). The full Iconify subset ships as a data-only swap — see the open items in the
        Lane A gate report.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {visible.map((icon) => (
          <button
            key={icon.id}
            type="button"
            title={icon.label}
            aria-label={`Add ${icon.label} icon`}
            onClick={() => addIcon(icon.id, icon.label)}
            className="flex aspect-square items-center justify-center rounded-md border border-neutral-200 bg-white hover:border-blue-500"
          >
            <img src={iconDataUri(icon)} alt={icon.label} className="h-8 w-8" />
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="mt-3 text-sm text-neutral-500">No graphics match “{query}”.</p>}
    </div>
  );
}
