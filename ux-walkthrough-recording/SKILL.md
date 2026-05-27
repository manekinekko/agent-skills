---
name: ux-walkthrough-recording
description: >
  Produce reviewer-ready UX walkthrough videos and per-screen screenshots for a
  running web app (typically for inclusion in a PR description). Use this skill when:
  (1) a PR introduces visual or UX changes that reviewers need to evaluate without running the app,
  (2) the user asks to "record a walkthrough", "make a demo video", "capture screenshots of the new UI",
  (3) you need to attach captioned video + image evidence to a GitHub PR,
  (4) producing release notes or design-review artifacts that show before/after states.
compatibility: macOS or Linux, Node 18+, Playwright (any version available in the workspace), ffmpeg
metadata:
  version: "1.0.0"
allowed-tools: Bash(node:*) Bash(ffmpeg:*) Bash(ls:*) Bash(mkdir:*) Bash(rm:*) Read Write Edit Glob Grep
---

# UX Walkthrough Recording

Use this skill to produce a captioned MP4 walkthrough video **plus** a set of
per-screen PNG screenshots of a running web app, suitable for dropping into a
GitHub PR description.

## When to use

- The PR changes UI/UX in ways static diffs cannot convey (layout, theme, responsive, animation, interaction flow).
- Reviewers cannot run the app locally (cross-team review, contractors, async stakeholders).
- The user explicitly asks for a video, demo, walkthrough, screenshots, or "show me the new UI".

If the change is purely backend, copy-only, or a single static screen, prefer one screenshot — don't over-invest.

## Quick procedure

1. **Verify environment** — Playwright is reachable, a cached Chromium build exists, `ffmpeg` is installed, the app is running.
2. **Draft beats** — list every caption + action you want in the video before opening Playwright (one line per beat).
3. **Record** — run the walkthrough script with the caption HUD injected.
4. **Transcode** — convert the Playwright `.webm` to a web-friendly `.mp4`.
5. **Screenshot pass** — run the screenshot script to capture each key screen + variant.
6. **Embed** — write the PR body with `<!-- drop <filename> here -->` placeholders inside `<details>` blocks. The user uploads the binaries via the web UI.

## 1. Environment & tooling

### Reuse a Playwright already in the workspace
Don't install Playwright globally. Most monorepos already ship it for an existing worker or e2e suite. Import via absolute ESM path from a script in `/tmp` so the recorder doesn't pollute the repo:

```js
import { chromium } from '/abs/path/to/node_modules/playwright/index.mjs';
```

### Pin `executablePath` — never trust the default browser
Playwright's default browser version often does not match what's cached on the machine. Symptom: *"Executable doesn't exist at .../chromium_headless_shell-NNNN/..."*.

Fix: point Playwright at a full Chrome for Testing that **is** cached. On macOS:

```js
import os from 'node:os';
const executablePath = `${os.homedir()}/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
```

Discover the correct path with `ls ~/Library/Caches/ms-playwright/` (macOS) or `ls ~/.cache/ms-playwright/` (Linux) and pick a full `chromium-NNNN` (not a `chromium_headless_shell-NNNN`).

Always `headless: false` for recordings — headless renders fonts/emoji differently and skips some hover/focus styles.

### ffmpeg is required for MP4 delivery
Playwright records `.webm`. GitHub previews `.mp4` reliably; `.webm` previews are inconsistent across browsers.

```bash
ffmpeg -y -i in.webm \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  -movflags +faststart \
  out.mp4
```

- `+faststart` puts the moov atom up front → instant streaming playback.
- `yuv420p` is the only pixel format every player accepts.
- `crf 22` is a sweet spot for UI captures (sharp text, small file).

## 2. Recording setup

### Viewport & DPR
Record at **1440 × 900 @ devicePixelRatio 2**. Crisp screenshots, 16:10 video that fits GitHub PR width without scrollbars.

For responsive demos, **don't open a new context** — resize in place so the transition is part of the video:

```js
await page.setViewportSize({ width: 720, height: 900 });
```

### Hide noise
- Fresh browser context (no auth, no theme persistence).
- Pre-seed `localStorage` to dismiss banners and onboarding toasts before navigating.
- Wait for `domcontentloaded` → short `networkidle` (with timeout) before each step.

### Determinism over realism
- If the app reads from a DB/API, seed it so row counts and IDs don't drift between takes.
- Hard-code `waitForTimeout` between beats (~600–900 ms) rather than chasing events — that's how long viewers need to process visual changes.

## 3. The caption HUD (biggest UX win)

A floating caption overlay turns a silent walkthrough into a self-explanatory video. See `scripts/walkthrough.template.mjs` for the full implementation. The pattern:

```js
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
    el.textContent = t;
    el.style.opacity = '1';
  }, [text]);
  await page.waitForTimeout(ms);
}
```

Why each property matters:

| Property | Why |
|----------|-----|
| `z-index: 2147483647` | Sits above every dialog, dropdown, drawer. |
| `pointer-events: none` | Never blocks the clicks you're trying to record. |
| `backdrop-filter: blur(6px)` + dark translucent bg | Legible on **both** light and dark themes. |
| `transition: opacity` (not remove/add node) | No re-layout flicker on each caption swap. |

## 4. Pacing the 90-second cut

Aim for **17–20 beats at ~4–5s each**.

| Beat type        | Dwell time |
|------------------|------------|
| Title / intro card | 1.5 s    |
| Static screen    | 2.5 s      |
| Caption + action | 3–4 s      |
| Interaction climax (drawer opens, theme flips) | 1.5–2 s |
| Outro frame      | 1.0 s      |

Rules of thumb:
- Never let a captioned frame stay >2 s after the caption fades. Either change the caption or change the view.
- Move the mouse to the target **before** clicking — viewers need a half-second to anticipate.
- End with a 1-second "outro" frame (final dashboard state) so the loop point looks intentional.

## 5. Screenshot best practices

### What to capture
For a typical CRUD app, the full coverage set is:

- **Lists** — empty / populated / bulk-selected / column-customized
- **Detail panels** — opened with sticky header visible
- **Forms / wizards** — collapsed default + expanded "advanced" + filled-in sticky action bar
- **Theme variants** — light + dark for the highest-traffic screens
- **Responsive** — one compact-viewport (≤720 px) shot per major view

### Naming
`NN-screen-state.png` — zero-padded prefix sorts naturally and matches the order they appear in the PR body. Example: `01-dashboard-light.png`, `02-list-bulk-selection.png`, …

### Capture settings
- `page.screenshot({ path, fullPage: false })` for above-the-fold consistency.
- `page.emulateMedia({ colorScheme: 'dark' })` is the cleanest theme swap if the app respects `prefers-color-scheme`. Otherwise click the toggle and `waitForTimeout(400)` for CSS transitions.
- For dropdowns/menus: screenshot right after opening, but `waitForTimeout(250)` so transitions finish.
- For hover states: `page.hover(selector)` then `waitForTimeout(150)` before shooting.

## 6. Embedding in a GitHub PR

### What CLI cannot do
`gh pr create --body-file` only writes markdown. It **cannot** upload binary attachments. The `https://github.com/user-attachments/assets/...` URLs are minted only when files are dragged into the **web** editor.

### What works
Leave drop-zones in the markdown so the user knows exactly where each asset goes:

```md
### 🎥 Walkthrough video (90 sec)

<!-- drop walkthrough.mp4 here -->

### 🖼 Screenshots

<details><summary>1 — Dashboard (light)</summary>

<!-- drop 01-dashboard-light.png here -->

</details>
```

After PR creation, the uploader drags the file onto the placeholder line and GitHub replaces the comment with the CDN URL. Collapsible `<details>` blocks keep the PR scannable when there are >5 images.

### Asset sizing
- Videos under ~10 MB embed/preview inline. Above that, GitHub serves a download link.
- 1440-wide PNGs at `crf 22` weigh ~150–350 KB each — 15 fit comfortably in one PR.

## 7. Scripts

Two ready-to-adapt templates live in this skill's `scripts/` directory:

- `scripts/walkthrough.template.mjs` — captioned 90-sec recorder with HUD.
- `scripts/screenshots.template.mjs` — sequential per-screen capture.

Copy them to `/tmp/`, edit the constants block at the top (URL, viewport, output dir, executablePath fallback), then run with `node /tmp/your-walkthrough.mjs`.

Both templates:
- Are idempotent (delete `out/` before running).
- Print progress (`▶ recording beat 12/17 — opening detail panel`).
- Fail fast on a missing selector instead of producing a half-recorded video.

## 8. Pre-flight checklist

- [ ] App is running locally at a known URL with a known-good seed loaded.
- [ ] Browser cache cleared (or fresh Playwright context).
- [ ] `executablePath` confirmed against `ls ~/Library/Caches/ms-playwright` (or Linux equivalent).
- [ ] `ffmpeg -version` returns OK.
- [ ] HUD captions drafted (one line per beat) in a text file *before* recording.
- [ ] Two takes minimum — keep the second one.
- [ ] Transcode → MP4 → check it plays in QuickTime **and** in a browser tab.
- [ ] PR body contains `<!-- drop X here -->` placeholders, not raw filenames.
- [ ] Reminded the user that they must drag the binaries into the PR via the web UI.

## Anti-patterns

- ❌ Recording in headless mode "to save time" — fonts and hover states differ.
- ❌ Letting Playwright auto-download a browser at recording time — flaky and slow.
- ❌ Capturing 30+ near-duplicate screenshots — pick one canonical state per screen.
- ❌ Uploading raw `.webm` to GitHub — preview is inconsistent; always transcode.
- ❌ Skipping captions because "the video is short" — silent demos require viewers to guess intent.
- ❌ Re-recording the same beat without a script — drift and inconsistency compound across takes.
