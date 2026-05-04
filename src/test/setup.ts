import { beforeEach } from 'vitest';

// Clean slate for every test — no state leaks between tests
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Polyfill crypto.randomUUID if jsdom doesn't provide it
if (!globalThis.crypto?.randomUUID) {
  const nodeCrypto = await import('node:crypto');
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => nodeCrypto.randomUUID(),
    writable: true,
    configurable: true,
  });
}
