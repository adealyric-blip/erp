'use client';
/* TEMPORARY: Marketing screen preview — renders each marketing screen directly
   so they can be verified against the HTML without the heavy app shell.
   Once all 14 screens are verified, this reverts to `<GlobalShell />`. */
import { useState, useCallback } from 'react';
import AdSetsScreen from '@/components/marketing/AdSetsScreen';

export default function Page() {
  const [toast, setToast] = useState<string | null>(null);
  const onToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2000); }, []);
  return (
    <>
      <AdSetsScreen onToast={onToast} />
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1c1e', color: '#fff', padding: '10px 16px', borderRadius: 8, font: '500 13px Inter', zIndex: 400, pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </>
  );
}
