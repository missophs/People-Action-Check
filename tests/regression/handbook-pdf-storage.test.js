// Regression: uploaded handbook PDFs must be stored as raw bytes
// (ArrayBuffer), not as a File/Blob object. Safari's IndexedDB has silently
// failed to structured-clone File objects, which left savePdfBlob() throwing
// unseen and the app quietly falling back to the plain-text viewer instead
// of rendering real pages. This exercises the actual src/web/app-utils.js
// source (loaded as browser-global script, not an ES module) against a
// minimal fake IndexedDB, so a future edit that goes back to storing a
// Blob/File fails here instead of silently regressing in Safari only.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(__dirname, '../../src/web/app-utils.js'), 'utf8');

function installFakeIndexedDb(store) {
  globalThis.indexedDB = {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = {
          createObjectStore() {},
          transaction() {
            const tx = {};
            tx.objectStore = () => ({
              put(value, key) { store.set(key, value); },
              get(key) {
                const r = {};
                queueMicrotask(() => { r.result = store.has(key) ? store.get(key) : null; r.onsuccess && r.onsuccess(); });
                return r;
              },
              delete(key) { store.delete(key); },
              clear() { store.clear(); },
            });
            queueMicrotask(() => { tx.oncomplete && tx.oncomplete(); });
            return tx;
          },
        };
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };
}

describe('Handbook PDF storage (Safari IndexedDB regression)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    installFakeIndexedDb(store);
    // Load the real production source into global scope so the test
    // exercises the actual code, not a re-implementation of it.
    (0, eval)(source);
  });

  it('stores an ArrayBuffer, not a File/Blob', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'test.pdf', { type: 'application/pdf' });
    await globalThis.savePdfBlob('doc-1', file);
    const stored = store.get('doc-1');
    expect(stored).toBeInstanceOf(ArrayBuffer);
    expect(stored).not.toBeInstanceOf(Blob);
  });

  it('round-trips the exact bytes through save and load', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]); // "%PDF"
    const file = new File([bytes], 'test.pdf', { type: 'application/pdf' });
    await globalThis.savePdfBlob('doc-2', file);
    const loaded = await globalThis.loadPdfBlob('doc-2');
    expect(new Uint8Array(loaded)).toEqual(bytes);
  });

  it('loadPdfBlob returns null for a document that was never stored', async () => {
    const loaded = await globalThis.loadPdfBlob('missing');
    expect(loaded).toBeNull();
  });
});
