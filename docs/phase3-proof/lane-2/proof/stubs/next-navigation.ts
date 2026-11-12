// next/navigation stub for the component-level proof harness ONLY.
// The real RevisionsClient calls useRouter().refresh()/push() after a
// transition; in the harness there is no App Router, so these are no-ops.
// Never imported by the app.
export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: async () => {},
  };
}
export function usePathname() {
  return '/studio/techpacks/demo-boxy-tee/revisions';
}
export function useSearchParams() {
  return new URLSearchParams();
}
