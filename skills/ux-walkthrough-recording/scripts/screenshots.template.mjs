// Per-screen screenshot capture for PR descriptions.
//
// Usage:
//   1. Copy this file to /tmp/your-screenshots.mjs
//   2. Edit the CONFIG block.
//   3. Edit the SHOTS array — each entry is { name, take }.
//   4. Run:  node /tmp/your-screenshots.mjs
//   5. Drag the PNGs into the PR description (replacing the
//      "<!-- drop NN-name.png here -->" placeholders).

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  url: 'http://localhost:3000',
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  outDir: '/tmp/screenshots-out',
  playwrightImport: '/abs/path/to/node_modules/playwright/index.mjs',
  executablePath: `${os.homedir()}/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
};

// ─── SHOTS ───────────────────────────────────────────────────────────────────
// Each shot defines a target file name and an async function that prepares
// the page and saves a screenshot.
const SHOTS = [
  {
    name: '01-dashboard-light',
    take: async (page, out) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: out, fullPage: false });
    },
  },
  {
    name: '02-dashboard-dark',
    take: async (page, out) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: out, fullPage: false });
    },
  },
  // Add more shots here...
];

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  await fs.rm(CONFIG.outDir, { recursive: true, force: true });
  await fs.mkdir(CONFIG.outDir, { recursive: true });

  const { chromium } = await import(CONFIG.playwrightImport);

  const browser = await chromium.launch({
    headless: false,
    executablePath: CONFIG.executablePath,
  });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    deviceScaleFactor: CONFIG.deviceScaleFactor,
  });

  const page = await context.newPage();

  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    const out = path.join(CONFIG.outDir, `${s.name}.png`);
    console.log(`▶ shot ${i + 1}/${SHOTS.length} — ${s.name}`);
    try {
      await s.take(page, out);
    } catch (err) {
      console.error(`  ✗ failed: ${err.message}`);
      process.exit(1);
    }
  }

  await context.close();
  await browser.close();
  console.log(`✓ ${SHOTS.length} screenshots written to ${CONFIG.outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
