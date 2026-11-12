// host.ts — T11. The host side of the craft-web-host contract: one class
// drives any Craft web build framed in a same-origin iframe
// (`?host=parent`). The app answers only the same-origin parent window, so
// a cross-origin frame can never receive a document or a save — the bridge
// additionally checks `event.origin === window.location.origin` and
// `event.source === iframe.contentWindow` on every message.
//
// The page command API (craft-web-api, `?control`) is reached through the
// iframe's `window.<app>` object: request/execute/commands/docInspect/
// uiInspect/screenshot. Those functions are installed only after the app
// posts `<app>:ready`, so every call waits for ready first.
import {
  CRAFT_HOST_PROTOCOL_VERSION,
  cleanCraftFileName,
  craftAppUrl,
  craftMessageType,
  parseCraftIncomingKind,
  type CraftApp,
  type CraftReadyMessage,
} from './protocol';

export interface CraftSave {
  name: string;
  bytes: ArrayBuffer;
  /** true when the file becomes the document's file (Save As / first Save). */
  saveAs: boolean;
  /** Present when the app expects a `<app>:saved` answer with this id. */
  id?: string;
}

export interface CraftHostEvents {
  onReady?: (msg: CraftReadyMessage) => void;
  onSave?: (save: CraftSave) => void | Promise<void>;
  onDirty?: (dirty: boolean) => void;
  onFailed?: (error: string) => void;
  onHandoff?: (name: string, bytes: ArrayBuffer | null) => void;
}

export interface CraftPageApi {
  request: (method: string, params?: unknown) => Promise<unknown>;
  execute: (command: string, params?: unknown) => Promise<unknown>;
  commands: () => Promise<unknown>;
  docInspect: (params?: unknown) => Promise<unknown>;
  uiInspect: (params?: unknown) => Promise<unknown>;
  screenshot: (params?: unknown) => Promise<unknown>;
}

const READY_TIMEOUT_MS = 60_000;

/**
 * CraftHost — owns one iframe + one app. Lifecycle: `mount(iframe)` →
 * await `ready()` → `open(bytes, name)` → user edits → `save` messages
 * arrive via onSave → host stores the bytes and, when the save carried an
 * id, answers `<app>:saved`. `execute` / `export` go through `window.<app>`.
 *
 * Never construct this for a `/supplier/**` page: Craft WASM and master
 * files are staff-only (plan Muse.md rule 8). The T12 page enforces
 * requireStaff before rendering the iframe.
 */
export class CraftHost {
  readonly app: CraftApp;
  private iframe: HTMLIFrameElement | null = null;
  private readonly events: CraftHostEvents;
  private readyPromise: Promise<CraftReadyMessage> | null = null;
  private readyResolve: ((m: CraftReadyMessage) => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  private readyResolved = false;
  private dirty = false;
  private destroyed = false;
  private readonly saveListeners = new Set<(s: CraftSave) => void>();
  private onMessage = (event: MessageEvent): void => {
    if (this.destroyed || !this.iframe) return;
    if (event.origin !== window.location.origin) return;
    if (event.source !== this.iframe.contentWindow) return;
    const data = event.data as { type?: unknown } | null;
    if (!data || typeof data.type !== 'string') return;
    const kind = parseCraftIncomingKind(this.app, data.type);
    // Outgoing kinds (ready/save/dirty/failed/handoff) arrive as
    // postMessage from the app — they are NOT parseable as incoming.
    // Handle them by suffix instead; parseCraftIncomingKind only accepts
    // the four host→app kinds, so everything else falls through here.
    if (kind === null) this.handleAppMessage(data as { type: string });
  };

  constructor(app: CraftApp, events: CraftHostEvents = {}) {
    this.app = app;
    this.events = events;
  }

  /** Attach to an iframe element and start listening. Call once. */
  mount(iframe: HTMLIFrameElement, opts: { control?: boolean; renderer?: 'webgl' | 'cpu' } = {}): void {
    if (this.iframe) throw new Error('CraftHost already mounted');
    this.iframe = iframe;
    this.readyPromise = new Promise<CraftReadyMessage>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    window.addEventListener('message', this.onMessage);
    iframe.src = craftAppUrl(this.app, opts);
    window.setTimeout(() => {
      this.readyReject?.(new Error(`${this.app} did not post ${craftMessageType(this.app, 'ready')} in ${READY_TIMEOUT_MS} ms`));
    }, READY_TIMEOUT_MS);
  }

  /** Resolves with the app's `ready` message (version + appVersion). */
  ready(): Promise<CraftReadyMessage> {
    if (!this.readyPromise) throw new Error('CraftHost not mounted');
    return this.readyPromise;
  }

  /**
   * Resolves when the app can take control calls — either it posted
   * `<app>:ready` (host-bridge apps) or `window.<app>.request` is
   * installed (control-only apps: VectorCraft/EffectCraft never post
   * ready, per the T11 spike). Polls the iframe; rejects on timeout.
   */
  async waitForApi(timeoutMs = READY_TIMEOUT_MS): Promise<void> {
    const t0 = Date.now();
    for (;;) {
      if (this.readyResolved) return;
      try {
        this.api();
        return;
      } catch {
        // Not installed yet.
      }
      if (Date.now() - t0 > timeoutMs) {
        throw new Error(`${this.app} control API did not install in ${timeoutMs} ms`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  /** Open a document as File › Open would. Transfers the bytes. */
  open(bytes: ArrayBuffer, name: string): void {
    const frame = this.requireFrame();
    const safeName = cleanCraftFileName(name, 'Document');
    const buf = bytes.slice(0);
    frame.postMessage({ type: craftMessageType(this.app, 'open'), name: safeName, bytes: buf }, window.location.origin, [buf]);
  }

  /** Answer a save that carried an `id`: the app clears dirty for it. */
  saved(id: string): void {
    this.requireFrame().postMessage({ type: craftMessageType(this.app, 'saved'), id }, window.location.origin);
  }

  /** Tell the app whether this host routes hand-offs. Sent after ready. */
  announceHandoffSupport(): void {
    this.requireFrame().postMessage(
      { type: craftMessageType(this.app, 'host'), version: CRAFT_HOST_PROTOCOL_VERSION, handoff: true },
      window.location.origin,
    );
  }

  /** The iframe's `window.<app>` page API. Throws until ready installed it. */
  api(): CraftPageApi {
    const win = this.requireFrame();
    const api = (win as unknown as Record<string, unknown>)[this.app] as Record<string, unknown> | undefined;
    if (!api || typeof api.request !== 'function') {
      throw new Error(`window.${this.app} control API is not installed yet (await ready() first, and load with ?control)`);
    }
    const call = (fn: string) => async (a?: unknown, b?: unknown) => {
      const f = api[fn] as (x?: unknown, y?: unknown) => Promise<unknown>;
      return f.call(api, a, b);
    };
    return {
      request: call('request') as CraftPageApi['request'],
      execute: call('execute') as CraftPageApi['execute'],
      commands: call('commands') as CraftPageApi['commands'],
      docInspect: call('docInspect') as CraftPageApi['docInspect'],
      uiInspect: call('uiInspect') as CraftPageApi['uiInspect'],
      screenshot: call('screenshot') as CraftPageApi['screenshot'],
    };
  }

  /** Run one command from the app's registry (filtered by the caller). */
  async execute(command: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.waitForApi();
    return this.api().execute(command, params ?? {});
  }

  /**
   * Export the open document. Exports surface as `<app>:save` messages
   * (the app's Export becomes a save under the host bridge), so this
   * triggers the app's export command and resolves with the bytes the
   * app hands back. `command` must be an export command from `commands()`.
   */
  async exportViaCommand(command: string, params: Record<string, unknown> | undefined, timeoutMs = 120_000): Promise<CraftSave> {
    const saved = new Promise<CraftSave>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.saveListeners.delete(onSave);
        reject(new Error(`export command ${command} produced no save in ${timeoutMs} ms`));
      }, timeoutMs);
      const onSave = (s: CraftSave): void => {
        window.clearTimeout(timer);
        this.saveListeners.delete(onSave);
        resolve(s);
      };
      this.saveListeners.add(onSave);
    });
    await this.execute(command, params);
    return saved;
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('message', this.onMessage);
    this.iframe = null;
  }

  private requireFrame(): Window {
    const win = this.iframe?.contentWindow;
    if (!win) throw new Error('CraftHost not mounted');
    return win;
  }

  private handleAppMessage(data: { type: string; [k: string]: unknown }): void {
    const suffix = data.type.slice(this.app.length + 1);
    switch (suffix) {
      case 'ready': {
        const msg = data as unknown as CraftReadyMessage;
        this.readyResolved = true;
        this.announceHandoffSupport();
        this.readyResolve?.(msg);
        this.events.onReady?.(msg);
        break;
      }
      case 'save': {
        const bytes = data.bytes as ArrayBuffer | undefined;
        if (!bytes) break;
        const save: CraftSave = {
          name: cleanCraftFileName(typeof data.name === 'string' ? data.name : null, 'Document'),
          bytes,
          saveAs: data.saveAs === true,
          id: typeof data.id === 'string' ? data.id : undefined,
        };
        void this.events.onSave?.(save);
        for (const listener of [...this.saveListeners]) listener(save);
        break;
      }
      case 'dirty': {
        this.dirty = data.dirty === true;
        this.events.onDirty?.(this.dirty);
        break;
      }
      case 'failed': {
        const error = typeof data.error === 'string' ? data.error : 'Craft app failed';
        this.readyReject?.(new Error(error));
        this.events.onFailed?.(error);
        break;
      }
      case 'handoff': {
        const bytes = (data.bytes as ArrayBuffer | undefined) ?? null;
        this.events.onHandoff?.(
          cleanCraftFileName(typeof data.name === 'string' ? data.name : null, 'Document'),
          bytes,
        );
        break;
      }
      default:
        break;
    }
  }
}
