/**
 * Step 4 — inline the dataset into the page.
 *
 * Two outputs from one source: dist/index.html is a full standalone document
 * you can open from disk, and dist/artifact.html is the same page without the
 * document wrapper, which is what the Artifact publisher expects.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DIST, ROOT, readJson } from './lib.mjs';

const registry = await readJson('data', 'shows.json');
const shows = [];
for (const show of registry.shows) {
  const data = await readJson('data', `${show.slug}.json`);
  shows.push(data);
  const tiers = data.episodes.reduce((acc, e) => ({ ...acc, [e.tier]: (acc[e.tier] ?? 0) + 1 }), {});
  const unreviewed = data.episodes.filter((e) => !e.reviewed).length;
  console.log(`${data.title}: ${data.episodes.length} episodes  ${JSON.stringify(tiers)}` +
    (unreviewed ? `  (${unreviewed} not hand-reviewed)` : '  (all hand-reviewed)'));
}

const source = await readFile(path.join(ROOT, 'src', 'index.html'), 'utf8');

// JSON is safe to inline as long as nothing can close the script element.
const payload = JSON.stringify({ shows }).replace(/</g, '\u003c');
const body = source.replace('/*__DATA__*/ null', payload);
if (body === source) throw new Error('data placeholder not found in src/index.html');

// Split the head-ish prelude (title/fonts/styles) from the page markup so the
// standalone document nests them correctly; the artifact form needs neither.
const split = body.indexOf('<div class="page">');
if (split < 0) throw new Error('page markup not found in src/index.html');
const head = body.slice(0, split).trimEnd();
const markup = body.slice(split);

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="Check whether a TV episode contains nudity or sex before watching it in the living room.">
${head}
</head>
<body>
${markup}
</body>
</html>
`;

await mkdir(DIST, { recursive: true });
await writeFile(path.join(DIST, 'index.html'), standalone, 'utf8');
await writeFile(path.join(DIST, 'artifact.html'), body, 'utf8');

// docs/ is what GitHub Pages serves, so unlike dist/ it is committed. The
// token available here has no `workflow` scope, which rules out building on
// Actions — the built page has to be in the tree.
const DOCS = path.join(ROOT, 'docs');
await mkdir(DOCS, { recursive: true });
await writeFile(path.join(DOCS, 'index.html'), standalone, 'utf8');
await writeFile(path.join(DOCS, '.nojekyll'), '', 'utf8');

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
console.log(`\ndist/index.html     ${kb(standalone)}  (open from disk)`);
console.log(`dist/artifact.html  ${kb(body)}  (publish as an Artifact)`);
console.log(`docs/index.html     ${kb(standalone)}  (served by GitHub Pages)`);
