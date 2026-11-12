// protocol.test.ts — T11. Unit tests for the craft-web-host / web-api
// contract as written from craft-libs @ 09dcbc22. These test OUR reading
// of the contract; the contract test against the real builds is
// e2e/craft-contract.spec.ts.
import { describe, expect, it } from 'vitest';
import {
  CRAFT_HOST_PROTOCOL_VERSION,
  cleanCraftFileName,
  craftAppUrl,
  craftMessageType,
  normaliseProtocolVersion,
  parseCraftIncomingKind,
  CraftAppSchema,
  CraftReadyMessageSchema,
  CraftSaveMessageSchema,
  type CraftApp,
} from './protocol';

describe('craft host protocol (craft-libs @ 09dcbc22)', () => {
  it('message types are <app>:<kind>', () => {
    expect(craftMessageType('vectorcraft', 'open')).toBe('vectorcraft:open');
    expect(craftMessageType('pdfcraft', 'handoff-done')).toBe('pdfcraft:handoff-done');
  });

  it('parses only this app\'s incoming kinds', () => {
    expect(parseCraftIncomingKind('pdfcraft', 'pdfcraft:open')).toBe('open');
    expect(parseCraftIncomingKind('pdfcraft', 'pdfcraft:handoff-done')).toBe('handoff-done');
    expect(parseCraftIncomingKind('pdfcraft', 'cadcraft:open')).toBeNull();
    expect(parseCraftIncomingKind('pdfcraft', 'pdfcraft:save')).toBeNull();
    expect(parseCraftIncomingKind('pdf' as CraftApp, 'pdfcraft:open')).toBeNull();
    expect(parseCraftIncomingKind('pdfcraft', 'pdfcraft:OPEN')).toBeNull();
    expect(parseCraftIncomingKind('pdfcraft', 'pdfcraftopen')).toBeNull();
  });

  it('treats unknown ready versions as contract "1"', () => {
    expect(normaliseProtocolVersion('1')).toBe('1');
    expect(normaliseProtocolVersion('0.24.0')).toBe(CRAFT_HOST_PROTOCOL_VERSION);
  });

  it('cleans hostile file names like the Rust file_name()', () => {
    expect(cleanCraftFileName('plan.dxf', 'Drawing.dxf')).toBe('plan.dxf');
    expect(cleanCraftFileName('  ../../etc/passwd ', 'x')).toBe('passwd');
    expect(cleanCraftFileName('C:\\Users\\sam\\notes.pdf', 'x')).toBe('notes.pdf');
    expect(cleanCraftFileName('a\u0000b\nc.txt', 'x')).toBe('abc.txt');
    expect(cleanCraftFileName('..', 'x')).toBe('x');
    expect(cleanCraftFileName(undefined, 'Document.pdf')).toBe('Document.pdf');
    expect(cleanCraftFileName('é'.repeat(300), 'x').length).toBe(255);
  });

  it('accepts a ready message with appVersion', () => {
    const parsed = CraftReadyMessageSchema.safeParse({
      type: 'vectorcraft:ready',
      version: '1',
      appVersion: '0.24.0',
      file: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a save message without bytes', () => {
    expect(CraftSaveMessageSchema.safeParse({ type: 'vectorcraft:save', name: 'a.svg' }).success).toBe(false);
    expect(
      CraftSaveMessageSchema.safeParse({ type: 'vectorcraft:save', name: 'a.svg', bytes: new ArrayBuffer(3) }).success,
    ).toBe(true);
  });

  it('rejects unknown app ids', () => {
    expect(CraftAppSchema.safeParse('wordcraft').success).toBe(false);
    expect(CraftAppSchema.safeParse('vectorcraft').success).toBe(true);
  });

  it('builds the iframe URL with host=parent and control', () => {
    const url = craftAppUrl('pdfcraft');
    expect(url).toBe('/craft/pdfcraft/index.html?host=parent&control=');
    expect(craftAppUrl('filmcraft', { renderer: 'webgl' })).toContain('webgl=');
  });
});
