// Local-demo history reader — versions live in localStorage for demo drafts.
'use client';

import { useEffect, useState } from 'react';
import VersionTimeline from '@/features/studio/components/VersionTimeline';
import type { DesignVersionRow } from '@/server/actions/designs';
import { loadLocalDraftVersions } from '@/features/studio/hooks/useAutosave';

export default function HistoryClient({ designId }: { designId: string }) {
  const [versions, setVersions] = useState<DesignVersionRow[]>([]);
  useEffect(() => {
    setVersions(
      loadLocalDraftVersions(designId).map((v) => ({
        id: v.id,
        version_no: v.version_no,
        is_locked: false,
        message: v.message,
        canvas_state: v.canvas_state,
        source_app: 'konva',
        created_at: v.created_at,
        created_by: null,
      })),
    );
  }, [designId]);
  return <VersionTimeline designId={designId} versions={versions} isDemo />;
}
