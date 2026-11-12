// flat.* command tests — plan/04 §Command list (flat.generate, flat.grade,
// flat.import). Registry membership + zod input validation (no DB in unit).
import { describe, expect, it } from 'vitest';
import { getCommand, listCommands } from '../../registry';
import { flatGenerate, flatGrade, flatImport } from './index';

describe('flat commands', () => {
  it('registers flat.generate, flat.grade, flat.import exactly once', () => {
    const ids = listCommands().map((c) => c.id);
    expect(ids.filter((id) => id.startsWith('flat.'))).toEqual([
      'flat.generate',
      'flat.grade',
      'flat.import',
    ]);
    expect(getCommand('flat.generate')).toBe(flatGenerate);
    expect(getCommand('flat.grade')).toBe(flatGrade);
    expect(getCommand('flat.import')).toBe(flatImport);
    for (const c of [flatGenerate, flatGrade, flatImport]) {
      expect(c.scope).toBe('library');
      expect(c.permission).toBe('member');
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('flat.generate rejects an unknown blank id at the schema level via run()', async () => {
    const res = await flatGenerate.run(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: {} as never, userId: 'u', tenantId: 't' },
      { blankId: 'not-a-blank', size: 'M' },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('Unknown blank');
  });

  it('flat.generate input requires a blank id and a valid size', () => {
    expect(flatGenerate.input.safeParse({ size: 'M' }).success).toBe(false);
    expect(flatGenerate.input.safeParse({ blankId: 'classic-tee' }).success).toBe(true);
  });

  it('flat.grade input requires sizes and a base size', () => {
    expect(flatGrade.input.safeParse({ templateId: 'x' }).success).toBe(false);
    expect(
      flatGrade.input.safeParse({
        templateId: '00000000-0000-4000-8000-000000000000',
        sizes: ['XS', 'S', 'M'],
        baseSize: 'M',
      }).success,
    ).toBe(true);
  });

  it('flat.import input requires a license id and an allowed mime type', () => {
    expect(
      flatImport.input.safeParse({
        fileName: 'tee.pdf',
        mimeType: 'image/png',
        storagePath: 't/x.pdf',
        licenseId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(false);
    expect(
      flatImport.input.safeParse({
        fileName: 'tee.pdf',
        mimeType: 'application/pdf',
        storagePath: 't/x.pdf',
        licenseId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
  });
});
