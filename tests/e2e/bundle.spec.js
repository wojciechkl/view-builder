import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const DIST = new URL('../../dist/view-builder.js', import.meta.url);

test.describe('dist bundle contract (XPages-ready)', () => {
  test('is a single dependency-free IIFE exposing window.ViewBuilder', async () => {
    const code = await fs.readFile(DIST, 'utf8');
    expect(code.length).toBeGreaterThan(10000);
    expect(code).not.toMatch(/\bimport\s*\(/);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toContain('document.currentScript.src');
    expect(code).toMatch(/ViewBuilder/);
  });

  test('does not ship a separate CSS file next to the bundle', async () => {
    const files = await fs.readdir(new URL('../../dist/', import.meta.url));
    expect(files.filter((f) => f.endsWith('.css'))).toEqual([]);
  });

  test('emits a demo page so vite preview serves a working app', async () => {
    const html = await fs.readFile(new URL('../../dist/index.html', import.meta.url), 'utf8');
    expect(html).toContain('<script src="./view-builder.js"></script>');
    expect(html).toContain("mount('#builder'");
    expect(html).not.toContain('/src/main.js');
  });

  test('ships one external language file per language', async () => {
    const files = await fs.readdir(new URL('../../dist/lang/', import.meta.url));
    expect(files.sort()).toEqual(['en.js', 'pl.js']);
    const pl = await fs.readFile(new URL('../../dist/lang/pl.js', import.meta.url), 'utf8');
    expect(pl).toContain('addLanguage("pl"');
    expect(pl).toContain('__viewBuilderLanguages');
    expect(pl).not.toMatch(/\bimport\s*\(/);
    expect(pl).not.toMatch(/\brequire\s*\(/);
  });

  test('avoids risky globals in the XPages runtime', async () => {
    const code = await fs.readFile(DIST, 'utf8');
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/\balert\s*\(/);
    expect(code).not.toMatch(/\bconfirm\s*\(/);
    expect(code).not.toMatch(/\bconsole\.(log|warn|error)\s*\(/);
    expect(code).not.toMatch(/\blocalStorage\b/);
    expect(code).not.toMatch(/\bsessionStorage\b/);
  });
});
