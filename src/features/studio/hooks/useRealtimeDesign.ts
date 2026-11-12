// useRealtimeDesign — T08: presence + broadcast on `design:{designId}`
// (plan/04 §Realtime channels). Cursor + selection broadcast; `version_saved`
// broadcast refreshes the version timeline. When no Supabase client is
// configured the hook is a no-op (returns empty peers) — it never throws.
'use client';

import { useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/server/supabase/browser';
import { useCanvasStore, type PeerCursor } from '../store/canvasStore';
import type { ViewId } from '../lib/printAreas';

const PEER_COLORS = ['#db2777', '#2563eb', '#059669', '#d97706', '#7c3aed'];

export function useRealtimeDesign(opts: { designId: string | null; displayName?: string }) {
  const { designId, displayName } = opts;
  const channelRef = useRef<ReturnType<ReturnType<typeof createBrowserSupabaseClient>['channel']> | null>(null);
  const cursorRef = useRef({ x: 0, y: 0 });

  // Broadcast our cursor on pointer move (throttled by rAF).
  useEffect(() => {
    if (!designId) return;
    let raf = 0;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        cursorRef.current = { x: e.clientX, y: e.clientY };
        void channelRef.current?.track({
          name: displayName ?? 'Designer',
          x: e.clientX,
          y: e.clientY,
          view: useCanvasStore.getState().activeView,
        });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [designId, displayName]);

  useEffect(() => {
    if (!designId) return;
    let supabase: ReturnType<typeof createBrowserSupabaseClient>;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      return;
    }
    const myColor = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
    const channel = supabase.channel(`design:${designId}`, {
      config: { broadcast: { self: false }, presence: { key: `peer-${Date.now().toString(36)}` } },
    });
    channelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name?: string; x?: number; y?: number; view?: string }>>;
        const peers: PeerCursor[] = [];
        Object.entries(state).forEach(([key, metas], i) => {
          const m = metas[0];
          if (!m || typeof m.x !== 'number') return;
          peers.push({
            id: key,
            name: m.name ?? 'Designer',
            color: PEER_COLORS[i % PEER_COLORS.length] ?? '#2563eb',
            x: m.x,
            y: m.y ?? 0,
            view: (m.view as ViewId) ?? 'front',
          });
        });
        useCanvasStore.getState().setPeers(peers);
      })
      .on('broadcast', { event: 'version_saved' }, () => {
        window.dispatchEvent(new CustomEvent('atelier:version-saved', { detail: { designId } }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ name: displayName ?? 'Designer', x: 0, y: 0, view: 'front' });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
      useCanvasStore.getState().setPeers([]);
    };
  }, [designId]);

  const broadcastVersionSaved = () => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'version_saved',
      payload: { designId, at: new Date().toISOString() },
    });
  };

  return { broadcastVersionSaved, myColor: PEER_COLORS[0] };
}
