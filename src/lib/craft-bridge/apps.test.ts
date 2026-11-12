// apps.test.ts — T11. The app table: eight apps, pinned versions match
// scripts/fetch-craft.ts, every wanted format has a spike verdict.
import { describe, expect, it } from 'vitest';
import { CRAFT_APPS } from './protocol';
import { CRAFT_APP_TABLE, CRAFT_APP_VERSIONS, craftRunnerFor } from './apps';
import { CRAFT_BUILDS } from '../../../scripts/fetch-craft';

describe('craft app table', () => {
  it('covers all eight apps', () => {
    expect(Object.keys(CRAFT_APP_TABLE).sort()).toEqual([...CRAFT_APPS].sort());
  });

  it('pinned versions match scripts/fetch-craft.ts', () => {
    for (const build of CRAFT_BUILDS) {
      expect(CRAFT_APP_VERSIONS[build.app as keyof typeof CRAFT_APP_VERSIONS]).toBe(build.version);
      expect(CRAFT_APP_TABLE[build.app as keyof typeof CRAFT_APP_TABLE].version).toBe(build.version);
    }
  });

  it('every wanted format has a runner verdict', () => {
    for (const cap of Object.values(CRAFT_APP_TABLE)) {
      for (const format of cap.wantedFormats) {
        const verdict = cap.exportVerdict[format];
        expect(verdict, `${cap.app} ${format}`).toBeDefined();
        expect(['browser', 'server']).toContain(verdict.runner);
        expect(verdict.note.length).toBeGreaterThan(0);
      }
    }
  });

  it('craftRunnerFor falls back to server for unknown pairs', () => {
    expect(craftRunnerFor('vectorcraft', 'mp4')).toBe('server');
  });
});
