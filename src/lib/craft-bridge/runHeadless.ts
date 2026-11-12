// runHeadless.ts — T11. Loads a Craft app in a hidden iframe for the
// render station (plan/04): the station tab claims a job with
// ds_claim_browser_jobs, runs it through the headless app, heartbeats,
// then POSTs the output. The hidden iframe lives under the same
// COOP/COEP-isolated page as the interactive editor (the top-level page
// must itself be cross-origin isolated — see next.config.ts headers —
// because a cross-origin-isolated iframe needs an isolated parent).
//
// A headless run never touches the DOM visibly: the iframe is 1×1 px,
// positioned off-screen, and removed when the job finishes. Headless
// renderers force `?webgl` (the render station has no WebGPU guarantee in
// headless Chrome) unless the caller passes another renderer.
import { CraftHost, type CraftSave } from './host';
import type { CraftApp } from './protocol';

export interface HeadlessCraft {
  host: CraftHost;
  app: CraftApp;
  /** Run one registry command and await its reply. */
  execute: (command: string, params?: Record<string, unknown>) => Promise<unknown>;
  /** Open the job input document. */
  open: (bytes: ArrayBuffer, name: string) => void;
  /**
   * Trigger the app's export command and await the bytes it hands back
   * as an `<app>:save` message.
   */
  exportViaCommand: (command: string, params?: Record<string, unknown>, timeoutMs?: number) => Promise<CraftSave>;
  /** Remove the hidden iframe. */
  dispose: () => void;
}

/**
 * Load `app` in a hidden iframe and resolve once it posts `<app>:ready`.
 * The caller owns the job lifecycle (claim / heartbeat / finish) — this
 * only owns the iframe.
 */
export async function runHeadless(
  app: CraftApp,
  opts: { renderer?: 'webgl' | 'cpu'; readyTimeoutMs?: number } = {},
): Promise<HeadlessCraft> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:800px;border:0;';
  iframe.title = `${app} (headless render)`;
  iframe.allow = 'clipboard-read; clipboard-write';
  document.body.appendChild(iframe);

  const host = new CraftHost(app, {
    onFailed: (error) => {
      throw new Error(`${app} failed headless: ${error}`);
    },
  });
  host.mount(iframe, { renderer: opts.renderer ?? 'webgl' });
  await host.ready();
  return {
    host,
    app,
    execute: (command, params) => host.execute(command, params),
    open: (bytes, name) => host.open(bytes, name),
    exportViaCommand: (command, params, timeoutMs) => host.exportViaCommand(command, params, timeoutMs),
    dispose: () => {
      host.destroy();
      iframe.remove();
    },
  };
}
