// Studio layout — T06: the shell for /studio/*. Auth is enforced by
// src/proxy.ts (aal2) and requireStaff here (tenant member or 404).
import type { ReactNode } from 'react';
import { requireStaff } from '@/server/auth/requireStaff';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
