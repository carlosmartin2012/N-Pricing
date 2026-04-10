#!/usr/bin/env node
/**
 * Re-captures every slide of N-Pricing-Brochure.html as a JPEG,
 * base64-encodes them, and replaces the _PRECAPTURED array in the
 * brochure so the PDF/IMG/PPTX exports match the current HTML.
 *
 * Usage:
 *   node scripts/recapture-brochure.mjs
 *
 * Expects a static server on http://localhost:8080/ serving the repo root.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const BROCHURE = join(REPO, 'N-Pricing-Brochure.html');
const URL = 'http://localhost:8080/N-Pricing-Brochure.html';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2, // 2x for retina crispness
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

// Hide nav bar + keyboard hint + gradient overlays so the capture is clean
await page.evaluate(() => {
  const hide = (sel) => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  };
  hide('.nav-bar');
  hide('#kb-hint');
});

// Force dark theme (matches the original PRECAPTURED aesthetic)
await page.evaluate(() => document.querySelector('[data-theme="dark"]')?.click());

// Count total slides
const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`Capturing ${total} slides…`);

// Go to slide 1
await page.evaluate(() => {
  // Click prev until we're at slide 1
  const prev = document.getElementById('btn-prev');
  for (let i = 0; i < 30; i++) prev.click();
});
await page.waitForTimeout(200);

const captures = [];

for (let i = 0; i < total; i++) {
  // Capture current slide as JPEG
  const buf = await page.screenshot({
    type: 'jpeg',
    quality: 85,
    fullPage: false,
    omitBackground: false,
    scale: 'device',
  });
  const b64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
  const counter = await page.evaluate(() => document.getElementById('counter')?.textContent);
  console.log(`  slide ${i + 1}/${total} (${counter}) — ${(buf.length / 1024).toFixed(0)} KB`);
  captures.push(b64);

  // Go to next slide (unless it's the last)
  if (i < total - 1) {
    await page.evaluate(() => document.getElementById('btn-next').click());
    await page.waitForTimeout(250);
  }
}

await browser.close();
console.log(`\nTotal capture size: ${(captures.reduce((a, b) => a + b.length, 0) / 1024 / 1024).toFixed(1)} MB`);

// Replace _PRECAPTURED array in the brochure
const html = readFileSync(BROCHURE, 'utf8');

// Find the array. It starts with `var _PRECAPTURED = [` and ends with `];`
const startMarker = 'var _PRECAPTURED = [';
const startIdx = html.indexOf(startMarker);
if (startIdx === -1) throw new Error('Could not find _PRECAPTURED start');
const arrayBodyStart = startIdx + startMarker.length;
// Find the matching `];` by looking for the first `];` after startIdx that's followed by `\n  var _PRECAPTURED_EN`
const endMarker = '];';
const enMarker = '_PRECAPTURED_EN';
const enIdx = html.indexOf(enMarker, startIdx);
if (enIdx === -1) throw new Error('Could not find _PRECAPTURED_EN marker');
// endIdx = last `];` before enIdx
const searchEnd = html.lastIndexOf(endMarker, enIdx);
if (searchEnd === -1) throw new Error('Could not find _PRECAPTURED end');

const before = html.slice(0, arrayBodyStart);
const after = html.slice(searchEnd); // starts at `];`

const newArrayBody = '\n' + captures.map((c) => `    ${JSON.stringify(c)},`).join('\n') + '\n  ';
const newHtml = before + newArrayBody + after;

writeFileSync(BROCHURE, newHtml);
console.log(`\n✓ Brochure updated (${(newHtml.length / 1024 / 1024).toFixed(1)} MB)`);
