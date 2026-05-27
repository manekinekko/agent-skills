// Captioned UX walkthrough recorder.
//
// Usage:
//   1. Copy this file to /tmp/your-walkthrough.mjs
//   2. Edit the CONFIG block below.
//   3. Edit the BEATS array — each entry is { caption, action }.
//   4. Run:  node /tmp/your-walkthrough.mjs
//   5. Transcode the resulting .webm to .mp4:
//        ffmpeg -y -i out/*.webm -c:v libx264 -pix_fmt yuv420p \
//               -crf 22 -preset medium -movflags +faststart out.mp4

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  url: 'http://localhost:3000',
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  outDir: '/tmp/walkthrough-out',
  // Absolute path to a Playwright shipped inside the repo. Adjust per workspace.
  playwrightImport: '/abs/path/to/node_modules/playwright/index.mjs',
  // Cached full Chromium (NOT the headless_shell). Discover with:
  //   ls ~/Library/Caches/ms-playwright/    (macOS)
  //   ls ~/.cache/ms-playwright/            (Linux)
  executablePath: `${os.homedir()}/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
};

// ─── HUD ─────────────────────────────────────────────────────────────────────
async function installHud(page) {
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = '__hud';
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '32px',
      transform: 'translateX(-50%)',
      padding: '10px 18px',
      background: 'rgba(15,15,17,0.78)',
      color: '#fff',
      font: '500 14px/1.4 -apple-system,BlinkMacSystemFont,Inter,sans-serif',
      borderRadius: '999px',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
      zIndex: '2147483647',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 220ms ease',
      maxWidth: '70vw',
      textAlign: 'center',
    });
    document.body.appendChild(el);
  });
}

async function caption(page, text, ms = 1800) {
  await page.evaluate(([t]) => {
    const el = document.getElementById('__hud');
    if (!el) return;
    el.textContent = t;
    el.style.opacity = '1';
  }, [text]);
  await page.waitForTimeout(ms);
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById('__hud');
    if (el) el.style.opacity = '0';
  });
  await page.waitForTimeout(220);
}

// ─── BEATS ───────────────────────────────────────────────────────────────────
// Define your walkthrough. Each beat has a caption and an action.
// The action receives `page` and can await any Playwright call.
const BEATS = [
  {
    caption: 'Welcome to the app',
    action: async (page) => {
      await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    },
  },
  {
    caption: 'Consistent master/detail layout across every list',
    action: async (page) => {
      await page.goto(`${CONFIG.url}/items`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
    },
  },
  // Add more beats here...
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
    recordVideo: { dir: CONFIG.outDir, size: CONFIG.viewport },
  });

  const page = await context.newPage();

  // Run first beat manually so the HUD has a DOM to attach to.
  console.log(`▶ beat 1/${BEATS.length} — ${BEATS[0].caption}`);
  await BEATS[0].action(page);
  await installHud(page);
  await caption(page, BEATS[0].caption);

  for (let i = 1; i < BEATS.length; i++) {
    const b = BEATS[i];
    console.log(`▶ beat ${i + 1}/${BEATS.length} — ${b.caption}`);
    await hideCaption(page);
    await b.action(page);
    await installHud(page).catch(() => {}); // re-install in case of full navigation
    await caption(page, b.caption);
  }

  // Outro
  await hideCaption(page);
  await page.waitForTimeout(1000);

  await context.close();
  await browser.close();
  console.log(`✓ video written to ${CONFIG.outDir}`);
  console.log('Next: ffmpeg -y -i ' + CONFIG.outDir + '/*.webm -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium -movflags +faststart out.mp4');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
