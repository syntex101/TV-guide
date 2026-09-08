/**
 * Step 3 — parse the cached Parents Guide pages into the shipped dataset.
 *
 * Two signals per episode: the crowd-voted "Sex & Nudity" severity, and the
 * free-text scene entries beneath the section heading. Both are optional —
 * IMDb's coverage is patchy, and an episode with neither must land on
 * "unknown", never "safe". A false green is the one failure that would make
 * the whole tool untrustworthy.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE, ROOT, readJson, writeJson } from './lib.mjs';
import { classify } from './classify.mjs';

const SEVERITIES = ['None', 'Mild', 'Moderate', 'Severe'];

// Chrome IMDb renders inside the section that is never a scene description.
const CHROME = [
  /^Add an item$/i, /^Vote$/i, /^Spoilers?$/i, /^Edit$/i, /^None$/i,
  /^\d+ of \d+ found this/i, /^(NONE|MILD|MODERATE|SEVERE)$/,
  /^Sex & Nudity$/i, /^Be the first to /i, /^Suggest an edit/i,
];

function parseGuide(text) {
  const lines = text.split('\n').map((l) => l.trim());

  // "Sex & Nudity:" in the summary block is followed by the severity word.
  const summaryAt = lines.findIndex((l) => /^Sex\s*&\s*Nudity:$/i.test(l));
  const severity = summaryAt >= 0
    ? SEVERITIES.find((s) => s.toLowerCase() === lines[summaryAt + 1]?.toLowerCase()) ?? null
    : null;

  // The bare "Sex & Nudity" heading opens the entry list; the next category closes it.
  const start = lines.findIndex((l, i) => i > summaryAt && /^Sex\s*&\s*Nudity$/i.test(l));
  const scenes = [];
  if (start >= 0) {
    for (const line of lines.slice(start + 1)) {
      if (/^(Violence & Gore|Profanity|Alcohol, Drugs & Smoking|Frightening & Intense Scenes|Certifications)/i.test(line)) break;
      if (!line || CHROME.some((re) => re.test(line))) continue;
      scenes.push(line);
    }
  }
  return { severity, scenes };
}

/**
 * data/review.json is the human layer and is never written by this script.
 * A key's presence means "a person has read this episode"; an optional `tier`
 * overrides the keyword guess, and an optional `note` explains why.
 */
const review = existsSync(path.join(ROOT, 'data', 'review.json'))
  ? await readJson('data', 'review.json')
  : {};

for (const show of (await readJson('data', 'shows.json')).shows) {
  const episodes = await readJson('cache', `${show.slug}-episodes.json`);

  /**
   * Preferred source: the structured pull from IMDb's own __NEXT_DATA__ (see
   * scripts/browser-fetch.js), which gives the severity and entries as fields
   * rather than as scraped text. Falls back to the proxy's text dump per
   * episode where that JSON has no row.
   */
  const structuredFile = path.join(CACHE, `${show.slug}-guides.json`);
  const structured = existsSync(structuredFile)
    ? JSON.parse(await readFile(structuredFile, 'utf8')).episodes
    : {};

  const out = [];
  const missing = [];

  for (const ep of episodes) {
    const tag = `S${ep.season}E${String(ep.episode).padStart(2, '0')}`;
    const file = path.join(CACHE, `${show.slug}-${tag}-guide.txt`);
    let guide;
    if (structured[tag]) {
      const row = structured[tag];
      guide = { severity: row.sev, scenes: row.items.map((i) => i.t) };
    } else if (existsSync(file)) {
      guide = parseGuide(await readFile(file, 'utf8'));
    } else {
      missing.push(tag);
      continue;
    }
    const auto = classify(guide);
    const human = review[`${show.slug}/${tag}`];
    const tier = human?.tier ?? auto.tier;
    const reason = human?.note ?? auto.reason;
    // A human note always wins the reason line; the keyword evidence is only
    // shown for episodes nobody has written a summary for yet.
    const evidence = human?.note ? null : auto.evidence;

    out.push({
      season: ep.season,
      episode: ep.episode,
      title: ep.title,
      runtime: ep.runtime,
      airdate: ep.airdate,
      imdbId: ep.imdbId,
      tier,
      reviewed: Boolean(human),
      reason,
      evidence,
      autoTier: auto.tier,
      imdbSeverity: guide.severity,
      severityVotes: structured[tag]?.votes ?? null,
      scenes: guide.scenes.map((description) => ({ description, approx: null, timestamps: [] })),
      sourceUrl: `https://www.imdb.com/title/${ep.imdbId}/parentalguide/`,
    });
  }

  const counts = out.reduce((acc, e) => ({ ...acc, [e.tier]: (acc[e.tier] ?? 0) + 1 }), {});
  console.log(`\n${show.title}: ${out.length} episodes parsed${missing.length ? `, ${missing.length} missing (${missing.join(', ')})` : ''}`);
  console.log(`  tiers: ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join('  ')}`);

  const overridden = out.filter((e) => e.tier !== e.autoTier);
  if (overridden.length) console.log(`  hand-corrected: ${overridden.map((e) => `S${e.season}E${e.episode} ${e.autoTier}->${e.tier}`).join(', ')}`);
  console.log(`  reviewed: ${out.filter((e) => e.reviewed).length}/${out.length}`);

  const noData = out.filter((e) => e.tier === 'unknown');
  if (noData.length) console.log(`  no data: ${noData.map((e) => `S${e.season}E${e.episode}`).join(', ')}`);
  const green = out.filter((e) => e.tier === 'green');
  if (green.length) console.log(`  proposed safe: ${green.map((e) => `S${e.season}E${e.episode}`).join(', ')}`);

  await writeJson(`data/${show.slug}.json`, {
    slug: show.slug, title: show.title, years: show.years, network: show.network,
    imdbId: show.imdbId,
    source: 'IMDb Parents Guide (community-contributed)',
    fetchedAt: new Date().toISOString().slice(0, 10),
    episodes: out,
  });
}
