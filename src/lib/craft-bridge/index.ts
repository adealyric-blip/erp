// craft-bridge — T11. The only way the studio drives Craft apps: the
// self-hosted WASM web builds under /craft/<app>/, spoken to through the
// craft-web-host postMessage contract + the craft-web-api window.<app>
// control channel. Never forked, never loaded on /supplier/**.
export * from './protocol';
export * from './apps';
export { CraftHost, type CraftSave, type CraftHostEvents, type CraftPageApi } from './host';
export { useCraftApp, type UseCraftAppResult } from './useCraftApp';
export { runHeadless, type HeadlessCraft } from './runHeadless';
