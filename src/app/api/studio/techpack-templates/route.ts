// GET /api/studio/techpack-templates — the 11 SVG masters for the
// browser render station (the station tab cannot read the server disk).
// Staff only; the T13b validator checks these same files.
import { NextResponse } from 'next/server';
import { requireStaff } from '@/server/auth/requireStaff';
import { loadTemplateSvgs } from '@/lib/techpack-render/loadTemplates';
import { TEMPLATE_PAGES } from '@/lib/techpack-render/types';

export async function GET() {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }
  const svgs = await loadTemplateSvgs();
  return NextResponse.json({
    pages: TEMPLATE_PAGES.map((p, i) => ({ id: p.id, file: p.file, title: p.title, svg: svgs[i] ?? '' })),
  });
}
