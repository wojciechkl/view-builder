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
