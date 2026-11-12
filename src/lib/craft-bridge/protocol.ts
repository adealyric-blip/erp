// protocol.ts — T11. The Craft host contract, written from
// storytold/craft-libs @ 09dcbc225b95232998498a40ca56e24716571d53
// (crates/web-host src/lib.rs + README, crates/web-api src/methods.rs +
// README). The plan's "pinned SHA" is that commit: no SHA was printed in
// plan/05, so this file pins the HEAD verified on 2026-11-12 and the
// release tags in scripts/fetch-craft.ts pin the app builds.
//
// Two channels, both same-origin only:
//  1. Host messages (craft-web-host): `?host=parent` frames the app in an
//     iframe; messages are plain objects with `type: "<app>:<kind>"` sent
//     via postMessage. `bytes` travel as a transferred ArrayBuffer.
//  2. Page command API (craft-web-api): `?control` installs
//     `window.<app>` with request/execute/commands/docInspect/uiInspect/
//     screenshot, each a Promise over the app's UI control channel
//     (default methods: engine.commands, engine.execute,
//     document.inspect, ui.inspect, ui.screenshot; 30 s timeout, rejects
//     with an Error carrying `error`).
// A host answers `saved` only for a `save` that carries an `id`; an app
// that sends none treats its save as done once posted. `version` in
// `ready` is the contract version "1"; older bridges put the app release
// there, so any unknown version is treated as "1" and the release is
// read from `appVersion` instead.
import { z } from 'zod';

/** Contract version an app reports in `ready` and a host in `host`. */
export const CRAFT_HOST_PROTOCOL_VERSION = '1' as const;

/** craft-libs commit this file is written from. */
export const CRAFT_LIBS_SHA = '09dcbc225b95232998498a40ca56e24716571d53';

/** Longest file name taken from a host or put in a message, in characters. */
export const CRAFT_MAX_NAME_CHARS = 255;

/** The eight Craft apps the studio self-hosts. */
export const CRAFT_APPS = [
  'vectorcraft',
  'photocraft',
  'texturecraft',
  'designcraft',
  'pdfcraft',
  'lightcraft',
  'effectcraft',
  'filmcraft',
] as const;
export type CraftApp = (typeof CRAFT_APPS)[number];

export const CraftAppSchema = z.enum(CRAFT_APPS);

/** Message kinds the app posts to its host (outgoing). */
export const CraftOutgoingKindSchema = z.enum(['ready', 'save', 'dirty', 'failed', 'handoff']);
export type CraftOutgoingKind = z.infer<typeof CraftOutgoingKindSchema>;

/** Message kinds a host sends to an app (incoming). */
export const CraftIncomingKindSchema = z.enum(['host', 'open', 'saved', 'handoff-done']);
export type CraftIncomingKind = z.infer<typeof CraftIncomingKindSchema>;

/** `<app>:<kind>` message type. */
export function craftMessageType(app: CraftApp, kind: string): string {
  return `${app}:${kind}`;
}

/**
 * Parse an incoming message type for one app. Returns null for another
 * app's message, an outgoing kind, or a malformed type — mirroring
 * `Incoming::parse` in craft-web-host (prefix-only app ids do not match).
 */
export function parseCraftIncomingKind(app: CraftApp, type: string): CraftIncomingKind | null {
  const kind = type.startsWith(`${app}:`) ? type.slice(app.length + 1) : null;
  if (kind === null) return null;
  const parsed = CraftIncomingKindSchema.safeParse(kind);
  return parsed.success ? parsed.data : null;
}

/** A file name from a host, made safe per craft-web-host `file_name`. */
export function cleanCraftFileName(raw: string | null | undefined, fallback: string): string {
  const base = (raw ?? '').split(/[/\\]/).pop() ?? '';
  const cleaned = [...base].filter((c) => c.codePointAt(0)! >= 0x20 && c !== '\u007f').join('');
  const trimmed = cleaned.trim();
  if (trimmed === '' || trimmed === '.' || trimmed === '..') return fallback;
  return [...trimmed].slice(0, CRAFT_MAX_NAME_CHARS).join('');
}

// --- Host messages (craft-web-host) ---------------------------------------

/** app → host: the app can take a document. */
export const CraftReadyMessageSchema = z.object({
  type: z.string(),
  version: z.string(),
  appVersion: z.string().optional(),
  /** true: the app reads a File/Blob in slices — send `file` in `open`. */
  file: z.boolean().optional(),
});
export type CraftReadyMessage = z.infer<typeof CraftReadyMessageSchema>;

/** host → app: what the host supports. */
export const CraftHostMessageSchema = z.object({
  type: z.string(),
  version: z.literal(CRAFT_HOST_PROTOCOL_VERSION),
  /** true: the host routes hand-offs to the app that edits them. */
  handoff: z.boolean().optional(),
});
export type CraftHostMessage = z.infer<typeof CraftHostMessageSchema>;

/** host → app: open a document as File › Open would. `bytes` or `file`. */
export const CraftOpenMessageSchema = z.object({
  type: z.string(),
  name: z.string().min(1).max(CRAFT_MAX_NAME_CHARS),
  bytes: z.instanceof(ArrayBuffer).optional(),
  file: z.instanceof(Blob).optional(),
  size: z.number().int().nonnegative().optional(),
});
export type CraftOpenMessage = z.infer<typeof CraftOpenMessageSchema>;

/** app → host: Save, Save As or Export — the host stores the file. */
export const CraftSaveMessageSchema = z.object({
  type: z.string(),
  name: z.string().min(1).max(CRAFT_MAX_NAME_CHARS),
  bytes: z.instanceof(ArrayBuffer),
  id: z.string().optional(),
  saveAs: z.boolean().optional(),
});
export type CraftSaveMessage = z.infer<typeof CraftSaveMessageSchema>;

/** host → app: the save with that `id` is stored; the app clears dirty. */
export const CraftSavedMessageSchema = z.object({
  type: z.string(),
  id: z.string().min(1),
});
export type CraftSavedMessage = z.infer<typeof CraftSavedMessageSchema>;

/** app → host: unsaved changes appeared or went away. */
export const CraftDirtyMessageSchema = z.object({
  type: z.string(),
  dirty: z.boolean(),
});
export type CraftDirtyMessage = z.infer<typeof CraftDirtyMessageSchema>;

/** app → host: a document or a save could not be taken. */
export const CraftFailedMessageSchema = z.object({
  type: z.string(),
  error: z.string().min(1),
  id: z.string().optional(),
});
export type CraftFailedMessage = z.infer<typeof CraftFailedMessageSchema>;

/** app → host: this file belongs to another app. */
export const CraftHandoffMessageSchema = z.object({
  type: z.string(),
  name: z.string().min(1).max(CRAFT_MAX_NAME_CHARS),
  bytes: z.instanceof(ArrayBuffer).optional(),
  file: z.instanceof(Blob).optional(),
  size: z.number().int().nonnegative().optional(),
});
export type CraftHandoffMessage = z.infer<typeof CraftHandoffMessageSchema>;

/** host → app: the host gave the handoff to the app that edits it. */
export const CraftHandoffDoneMessageSchema = z.object({
  type: z.string(),
  name: z.string().min(1).max(CRAFT_MAX_NAME_CHARS),
  app: CraftAppSchema,
});
export type CraftHandoffDoneMessage = z.infer<typeof CraftHandoffDoneMessageSchema>;

/** Any host message, keyed off its `<app>:<kind>` type. */
export const CraftMessageSchema = z.union([
  CraftReadyMessageSchema,
  CraftHostMessageSchema,
  CraftOpenMessageSchema,
  CraftSaveMessageSchema,
  CraftSavedMessageSchema,
  CraftDirtyMessageSchema,
  CraftFailedMessageSchema,
  CraftHandoffMessageSchema,
  CraftHandoffDoneMessageSchema,
]);
export type CraftMessage = z.infer<typeof CraftMessageSchema>;

/** Normalise a `ready.version`: unknown versions mean contract "1". */
export function normaliseProtocolVersion(version: string): string {
  return version === CRAFT_HOST_PROTOCOL_VERSION ? version : CRAFT_HOST_PROTOCOL_VERSION;
}

// --- Page command API (craft-web-api) -------------------------------------
// Default method table (Methods::default in crates/web-api/src/methods.rs).

export const CraftControlMethods = {
  commands: 'engine.commands',
  execute: 'engine.execute',
  docInspect: 'document.inspect',
  uiInspect: 'ui.inspect',
  screenshot: 'ui.screenshot',
} as const;

/** The control reply shape: {ok, result} / {ok:false, error}. */
export const CraftControlReplySchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type CraftControlReply = z.infer<typeof CraftControlReplySchema>;

/** `commands()` entries: the app's command registry. */
export const CraftCommandEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
});
export type CraftCommandEntry = z.infer<typeof CraftCommandEntrySchema>;

/** `screenshot()` resolves with the reply plus `data` (base64 PNG) when inline. */
export const CraftScreenshotResultSchema = z.object({
  data: z.string().optional(),
  result: z.unknown().optional(),
});
export type CraftScreenshotResult = z.infer<typeof CraftScreenshotResultSchema>;

/** Default control-call timeout (craft-web-api PageApi::with_timeout). */
export const CRAFT_CONTROL_TIMEOUT_MS = 30_000;

/** Query flags the bridge puts on the iframe src. */
export function craftAppUrl(app: CraftApp, opts: { control?: boolean; renderer?: 'webgl' | 'cpu' } = {}): string {
  const params = new URLSearchParams({ host: 'parent' });
  if (opts.control !== false) params.set('control', '');
  if (opts.renderer) params.set(opts.renderer, '');
  return `/craft/${app}/index.html?${params.toString()}`;
}
