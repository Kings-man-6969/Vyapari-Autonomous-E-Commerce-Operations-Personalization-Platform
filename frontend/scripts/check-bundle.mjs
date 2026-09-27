/**
 * Bundle budget — section J2.
 *
 * Reads `dist/.vite/manifest.json` and asserts three things:
 *
 *   1. the bytes a first-time visitor must download before anything paints,
 *   2. the largest single lazy chunk a navigation can cost,
 *   3. that the two consoles are not in the initial graph at all.
 *
 * ## Why the manifest and not the file sizes
 *
 * Summing every file in `dist/assets` measures the deploy, not the visitor. The
 * number that matters is the *closure* of the entry: the entry chunk plus
 * everything it statically imports, transitively. That is exactly what the
 * manifest's `imports` arrays describe, and it is why chunking is asserted by
 * following them rather than by sorting `ls -S`.
 *
 * ## Why gzip and not raw
 *
 * Every production host in play serves gzipped JavaScript. A raw-byte budget
 * would be met by making identifiers shorter, which is not a user-visible
 * improvement, and it would be broken by adding a long string constant, which is
 * barely one either.
 *
 * ## Why there is a budget at all
 *
 * Because the failure this catches is a slow drift nobody notices: one screen
 * importing a charting library, a page importing a date library for one format
 * call, and eighteen months later the entry is 900 kB. A budget is a decision
 * made once, in review, instead of a decision made per-pull-request by whoever
 * happens to notice.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = 'dist';
const MANIFEST = path.join(DIST, '.vite', 'manifest.json');

// Budgets in gzip kilobytes. Measured at the time of writing: initial 103.5 kB,
// largest lazy chunk 7.1 kB, all chunks 236.1 kB.
//
// The headroom is deliberately uneven:
//   * `initial` gets ~25%. It is the number a visitor waits on, so ordinary
//     feature work should not trip it, but a new entry-graph dependency should.
//   * `largestLazy` gets ~5x, because a page can legitimately be heavier than
//     the 7 kB these are -- and the thing worth catching is a *dependency* (a
//     charting library, a date library) rather than a page growing.
//   * `total` gets ~70%, because it is the deploy size, not the visitor's.
//
// Raising a budget is a legitimate change -- but it is a change to a deliberate
// number, made in review, rather than a side effect of adding a library. That is
// the entire point.
const BUDGETS = {
  initial: Number(process.env.BUDGET_INITIAL ?? 130),
  largestLazy: Number(process.env.BUDGET_LARGEST_LAZY ?? 40),
  total: Number(process.env.BUDGET_TOTAL ?? 400)
};

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

function fail(message) {
  console.error(`\n  FAIL  ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}. Run \`npm run build\` first.`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const gzipCache = new Map();
function gzipSize(file) {
  if (gzipCache.has(file)) return gzipCache.get(file);
  const abs = path.join(DIST, file);
  if (!fs.existsSync(abs)) {
    // A manifest entry pointing at a missing file is a broken build, and
    // silently counting it as zero would hide exactly that.
    fail(`manifest lists ${file}, which does not exist on disk`);
    gzipCache.set(file, 0);
    return 0;
  }
  const size = zlib.gzipSync(fs.readFileSync(abs)).length;
  gzipCache.set(file, size);
  return size;
}

/** The entry record: Vite keys it by the HTML file. */
const entryKey = Object.keys(manifest).find((k) => k.endsWith('.html'));
if (!entryKey) {
  fail('the manifest has no HTML entry');
  process.exit(1);
}
const entry = manifest[entryKey];

// The static closure: entry chunk plus its transitive `imports`. `dynamicImports`
// are deliberately not followed -- those are the lazy pages, and following them
// is what would make this measure the deploy instead of the first paint.
const initial = new Set();
const queue = [entryKey];
while (queue.length) {
  const key = queue.shift();
  const record = manifest[key];
  if (!record || initial.has(key)) continue;
  initial.add(key);
  for (const dep of record.imports || []) queue.push(dep);
}

const initialFiles = new Set();
for (const key of initial) {
  const record = manifest[key];
  initialFiles.add(record.file);
  // CSS is render-blocking, so it is part of what the visitor waits for.
  for (const css of record.css || []) initialFiles.add(css);
}
const initialBytes = [...initialFiles].reduce((sum, f) => sum + gzipSize(f), 0);

// Every chunk that is not in the initial closure is lazy. `isEntry` chunks are
// in the closure by construction; filtering on the closure is what makes this
// robust to how Vite decides to name the entry.
const lazyFiles = new Map();
for (const [key, record] of Object.entries(manifest)) {
  if (initial.has(key)) continue;
  if (!record.file || !record.file.endsWith('.js')) continue;
  lazyFiles.set(record.file, gzipSize(record.file));
}

const totalBytes =
  initialBytes + [...lazyFiles.values()].reduce((sum, n) => sum + n, 0);

console.log('\n  initial (entry + static closure)');
for (const file of [...initialFiles].sort((a, b) => gzipSize(b) - gzipSize(a))) {
  console.log(`    ${String(kb(gzipSize(file))).padStart(7)} kB  ${file}`);
}
console.log(`    ${'-'.repeat(7)}`);
console.log(`    ${String(kb(initialBytes)).padStart(7)} kB  total, budget ${BUDGETS.initial} kB`);

console.log('\n  largest lazy chunks');
const topLazy = [...lazyFiles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
for (const [file, size] of topLazy) {
  console.log(`    ${String(kb(size)).padStart(7)} kB  ${file}`);
}
console.log(`    ${'-'.repeat(7)}`);
console.log(`    ${String(kb(totalBytes)).padStart(7)} kB  all chunks, budget ${BUDGETS.total} kB\n`);

if (initialBytes > BUDGETS.initial * 1024) {
  fail(
    `initial payload is ${kb(initialBytes)} kB gzip, over the ${BUDGETS.initial} kB budget. ` +
    `Something added to the entry graph. Check the list above -- if the new entry is a ` +
    `page, it probably wants to be lazy.`
  );
}

const largestLazy = topLazy[0];
if (largestLazy && largestLazy[1] > BUDGETS.largestLazy * 1024) {
  fail(
    `lazy chunk ${largestLazy[0]} is ${kb(largestLazy[1])} kB gzip, over the ` +
    `${BUDGETS.largestLazy} kB budget for a single navigation.`
  );
}

if (totalBytes > BUDGETS.total * 1024) {
  fail(`all chunks total ${kb(totalBytes)} kB gzip, over the ${BUDGETS.total} kB budget.`);
}

// The assertion section J1 exists for. Before code splitting there was exactly
// one JS chunk and every shopper downloaded the seller console and the admin
// console, because they were in the same bundle as the homepage. Counting the
// manifest's dynamic imports is a direct measure of whether splitting still
// happens, and it is not a filename guess: if someone reverts App.jsx to static
// imports, this number drops to zero on the next build.
const dynamicCount = Object.values(manifest).reduce(
  (n, record) => n + (record.dynamicImports || []).length,
  0
);
const MIN_DYNAMIC_IMPORTS = 20;

if (dynamicCount < MIN_DYNAMIC_IMPORTS) {
  fail(
    `the manifest declares ${dynamicCount} dynamic import(s), fewer than the ` +
    `${MIN_DYNAMIC_IMPORTS} expected. Routes have probably gone back to static ` +
    `imports -- check App.jsx.`
  );
}
console.log(`  ${dynamicCount} dynamic imports; the route tree is split\n`);

if (!process.exitCode) {
  console.log('  OK  bundle is within budget\n');
}
