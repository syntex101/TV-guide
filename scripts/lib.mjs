import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = path.join(ROOT, 'cache');
export const DATA = path.join(ROOT, 'data');
export const DIST = path.join(ROOT, 'dist');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read a JSON file relative to the project root. */
export async function readJson(...parts) {
  return JSON.parse(await readFile(path.join(ROOT, ...parts), 'utf8'));
}

/** Write pretty JSON relative to the project root. */
export async function writeJson(rel, value) {
  const file = path.join(ROOT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
  return file;
}

/**
 * Fetch a public page through the r.jina.ai text proxy. IMDb blocks direct
 * requests (403 / empty 202), and the proxy needs the target percent-encoded.
 * `mode` is 'text' for readable content or 'markdown' when links matter.
 */
export async function fetchViaProxy(url, { mode = 'text', retries = 3, timeout = 25_000 } = {}) {
  const target = `https://r.jina.ai/${encodeURIComponent(url)}`;
  // The proxy answers a rate limit by stalling the socket rather than
  // returning 429, so the timeout has to be short enough to fail fast.
  let delay = 15_000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(target, {
        headers: { 'x-respond-with': mode, accept: 'text/plain' },
        signal: AbortSignal.timeout(timeout),
      });
      const body = await res.text();
      if (res.ok && body.trim().length > 200) return body;
      throw new Error(`HTTP ${res.status}, ${body.length} bytes`);
    } catch (err) {
      if (attempt === retries) throw new Error(`${url}: ${err.message}`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

/** Fetch through the proxy, caching the raw response so re-runs are free. */
export async function cachedFetch(name, url, opts) {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  if (existsSync(file)) {
    const cached = await readFile(file, 'utf8');
    if (cached.trim().length > 200) return { body: cached, cached: true };
  }
  const body = await fetchViaProxy(url, opts);
  await writeFile(file, body, 'utf8');
  return { body, cached: false };
}

/** Strip HTML tags and decode the handful of entities TVmaze emits. */
export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
