/**
 * Step 1 — build the episode skeleton for every show in data/shows.json.
 *
 * TVmaze (free, no key) supplies titles, runtimes, airdates and artwork.
 * IMDb's season pages supply the per-episode tconst we need in step 2, and
 * are only reachable through the proxy in markdown mode, where the links
 * survive: "#### [S1.E1 ∙ Boardwalk Empire](https://www.imdb.com/title/tt1276201/...)".
 */
import { cachedFetch, readJson, sleep, stripHtml, writeJson } from './lib.mjs';

const EPISODE_LINK = /^####\s*\[S(\d+)\.E(\d+)\s*[∙·|-]\s*(.+?)\]\(https:\/\/www\.imdb\.com\/title\/(tt\d+)\//gm;

async function tvmazeEpisodes(query) {
  const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}&embed=episodes`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`TVmaze ${res.status} for "${query}"`);
  const show = await res.json();
  return (show._embedded?.episodes ?? [])
    .filter((ep) => ep.season > 0 && ep.number > 0)
    .map((ep) => ({
      season: ep.season,
      episode: ep.number,
      title: ep.name,
      runtime: ep.runtime,
      airdate: ep.airdate,
      summary: stripHtml(ep.summary),
      image: ep.image?.medium ?? null,
    }));
}

async function imdbIds(slug, imdbId, seasons) {
  const ids = new Map();
  for (let season = 1; season <= seasons; season++) {
    const url = `https://www.imdb.com/title/${imdbId}/episodes/?season=${season}`;
    const { body, cached } = await cachedFetch(`${slug}-season-${season}.md`, url, { mode: 'markdown' });
    let found = 0;
    for (const m of body.matchAll(EPISODE_LINK)) {
      const [, s, e, , tconst] = m;
      // The page embeds "top-rated" cards from other seasons; keep only this one.
      if (Number(s) !== season) continue;
      ids.set(`${s}x${Number(e)}`, tconst);
      found++;
    }
    console.log(`  season ${season}: ${found} episode ids${cached ? ' (cached)' : ''}`);
    if (!cached) await sleep(3000);
  }
  return ids;
}

for (const show of (await readJson('data', 'shows.json')).shows) {
  console.log(`\n${show.title}`);
  const [episodes, ids] = [await tvmazeEpisodes(show.tvmazeQuery), await imdbIds(show.slug, show.imdbId, show.seasons)];

  const merged = episodes.map((ep) => ({ ...ep, imdbId: ids.get(`${ep.season}x${ep.episode}`) ?? null }));
  const missing = merged.filter((ep) => !ep.imdbId);

  const bySeason = merged.reduce((acc, ep) => ({ ...acc, [ep.season]: (acc[ep.season] ?? 0) + 1 }), {});
  console.log(`  total: ${merged.length} episodes  [${Object.entries(bySeason).map(([s, n]) => `S${s}:${n}`).join(' ')}]`);
  if (missing.length) console.warn(`  WARNING: ${missing.length} without an IMDb id: ${missing.map((e) => `S${e.season}E${e.episode}`).join(', ')}`);

  console.log(`  wrote ${await writeJson(`cache/${show.slug}-episodes.json`, merged)}`);
}
