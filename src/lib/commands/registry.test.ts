// T06 accept: unit tests for registry + zod → JSON Schema.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getCommand, listCommands, listServerCommands } from './registry';
import { zodToJsonSchema } from './define';
import { defineCommand } from './define';
import { designCreate, designSave } from './design';

describe('command registry', () => {
  it('registers every Lane A command exactly once', () => {
    const ids = listCommands().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'design.create',
      'design.save',
      'design.duplicate',
      'colorway.create',
      'colorway.recolor',
      'asset.remove_bg',
      'asset.upscale',
      'mockup.render',
      'layer.add_text',
      'layer.add_image',
      'layer.add_shape',
      'layer.align',
      'layer.delete',
      'print_area.fit',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('every command has an id, title, description, scope and permission', () => {
    for (const c of listCommands()) {
      expect(c.id).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect(['studio', 'techpack', 'rfq', 'media', 'library']).toContain(c.scope);
      expect(['member', 'admin']).toContain(c.permission);
    }
  });

  it('clientOnly commands are excluded from the server list', () => {
    const serverIds = listServerCommands().map((c) => c.id);
    expect(serverIds).not.toContain('layer.add_text');
    expect(serverIds).not.toContain('print_area.fit');
    expect(serverIds).toContain('design.create');
    expect(serverIds).toContain('design.save');
    expect(getCommand('layer.add_text')?.clientOnly).toBe(true);
    expect(getCommand('design.create')?.clientOnly).toBeFalsy();
  });

  it('unknown command id resolves to undefined', () => {
    expect(getCommand('nope.nope')).toBeUndefined();
  });

  it('design.create rejects a bad payload at the zod boundary', () => {
    expect(designCreate.input.safeParse({ name: '' }).success).toBe(false);
    expect(designCreate.input.safeParse({ name: 'Tee' }).success).toBe(true);
    expect(
      designCreate.input.safeParse({ name: 'Tee', garmentTemplateId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('design.save requires a uuid design id and an object canvas state', () => {
    expect(
      designSave.input.safeParse({ designId: 'x', canvasState: {} }).success,
    ).toBe(false);
    expect(
      designSave.input.safeParse({
        designId: '11111111-1111-4111-8111-111111111111',
        canvasState: { views: {} },
      }).success,
    ).toBe(true);
  });
});

describe('zod → JSON Schema', () => {
  it('converts an object schema with required + optional fields', () => {
    const schema = zodToJsonSchema(
      z.object({
        designId: z.string().uuid(),
        message: z.string().max(500).optional(),
      }),
    );
    expect(schema.type).toBe('object');
    const props = schema.properties as Record<string, unknown>;
    expect(props.designId).toBeDefined();
    expect(props.message).toBeDefined();
    expect(schema.required).toContain('designId');
    expect(schema.required).not.toContain('message');
  });

  it('defineCommand preserves the schema so the palette can render it', () => {
    const cmd = defineCommand({
      id: 'test.echo',
      title: 'Echo',
      scope: 'studio',
      permission: 'member',
      description: 'test',
      input: z.object({ q: z.string() }),
      async run() {
        return { ok: true, data: null };
      },
    });
    const schema = zodToJsonSchema(cmd.input);
    expect((schema.properties as Record<string, unknown>).q).toBeDefined();
  });
});
