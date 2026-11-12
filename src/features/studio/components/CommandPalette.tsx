// CommandPalette — T06: ⌘K palette listing all registered commands.
// Server commands run via runCommand; clientOnly commands run against the
// canvas and are marked "Canvas". design.create is reachable here (T06 accept).
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command as Cmdk } from 'cmdk';
import { listCommands } from '@/lib/commands/registry';
import { useCommand } from '../hooks/useCommand';

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('atelier:open-palette'));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { run } = useCommand();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('atelier:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('atelier:open-palette', onOpen);
    };
  }, []);

  if (!open) return null;

  const commands = listCommands().filter(
    (c) => !query || `${c.id} ${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );

  const runDesignCreate = async () => {
    setOpen(false);
    const name = `Untitled design ${new Date().toLocaleDateString()}`;
    const res = await run('design.create', { name });
    if (res.ok) {
      const id = (res.data as { designId: string }).designId;
      router.push(`/studio/designs/${id}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
      data-testid="command-palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Cmdk label="Commands">
          <Cmdk.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Type a command…"
            className="w-full border-b border-neutral-200 px-4 py-3 text-base outline-none"
          />
          <Cmdk.List className="max-h-80 overflow-y-auto p-2">
            {commands.map((c) => (
              <Cmdk.Item
                key={c.id}
                value={c.id}
                onSelect={() => {
                  if (c.id === 'design.create') void runDesignCreate();
                  else setOpen(false);
                }}
                className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm aria-selected:bg-blue-50"
              >
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="ml-2 text-neutral-400">{c.id}</span>
                </span>
                <span className="text-xs text-neutral-400">
                  {c.clientOnly ? 'Canvas' : c.scope} · {c.permission}
                </span>
              </Cmdk.Item>
            ))}
            {commands.length === 0 && (
              <Cmdk.Empty className="px-3 py-6 text-center text-sm text-neutral-500">
                No commands match “{query}”.
              </Cmdk.Empty>
            )}
          </Cmdk.List>
        </Cmdk>
      </div>
    </div>
  );
}
