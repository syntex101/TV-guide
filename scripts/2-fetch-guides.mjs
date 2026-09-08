/**
 * Step 2 — pull each episode's IMDb Parents Guide into cache/.
 *
 * IMDb 403s direct requests, so everything goes through the proxy. The page
 * only renders in 'text' mode; the default markdown mode returns an empty
 * body for this route. Sequential with a delay — we are a guest here.
 */
import { cachedFetch, readJson, sleep } from './lib.mjs';

const DELAY_MS = 7000;

for (const show of (await readJson('data', 'shows.json')).shows) {
  const episodes = await readJson('cache', `${show.slug}-episodes.json`);
  console.log(`${show.title}: ${episodes.length} episodes\n`);

  const failed = [];
  for (const [i, ep] of episodes.entries()) {
    const tag = `S${ep.season}E${String(ep.episode).padStart(2, '0')}`;
    if (!ep.imdbId) {
      failed.push(`${tag} (no imdb id)`);
      continue;
    }
    try {
      const url = `https://www.imdb.com/title/${ep.imdbId}/parentalguide/`;
      const { body, cached } = await cachedFetch(`${show.slug}-${tag}-guide.txt`, url);
      const hasSection = /Sex\s*&\s*Nudity/i.test(body);
      console.log(
        `[${String(i + 1).padStart(2)}/${episodes.length}] ${tag} ${String(body.length).padStart(6)}b` +
          `${hasSection ? '' : '  no Sex & Nudity section'}${cached ? '  (cached)' : ''}`,
      );
      if (!cached) await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[${i + 1}/${episodes.length}] ${tag} FAILED: ${err.message}`);
      failed.push(tag);
    }
  }
  console.log(failed.length ? `\n${failed.length} failed: ${failed.join(', ')}` : `\nall ${episodes.length} fetched`);
}
