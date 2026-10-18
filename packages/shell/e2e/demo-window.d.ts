// The demo's debug handle, as far as the e2e specs read it.
export {};

declare global {
  interface Window {
    __demo?: { ready: boolean; destroy(): void };
  }
}
