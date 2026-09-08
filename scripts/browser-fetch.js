/**
 * How cache/<slug>-guides.json is produced.
 *
 * IMDb refuses scripted requests — a bare curl gets an empty 202, and the
 * r.jina.ai text proxy works but rate-limits to the point of taking an hour
 * for one show. Requests made *from a browser already on imdb.com* are
 * ordinary same-origin fetches and are not blocked, and the page ships its
 * data as JSON in __NEXT_DATA__, so no HTML scraping is needed.
 *
 * Usage: open https://www.imdb.com/title/<show tconst>/parentalguide/ in a
 * browser, paste this into the devtools console with LIST filled in, and save
 * the printed JSON to cache/<slug>-guides.json under an "episodes" key.
 *
 * Get LIST from the episode skeleton after running step 1:
 *   node -e "require('./cache/boardwalk-empire-episodes.json').forEach(e=>console.log('S'+e.season+'E'+String(e.episode).padStart(2,'0')+':'+e.imdbId))"
 */

const LIST = "S1E01:tt1276201,S1E02:tt1501024".split(",").map((s) => s.split(":"));

const decode = (s) => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
};

async function one([tag, id]) {
  try {
    const res = await fetch(`/title/${id}/parentalguide/`, { credentials: "include" });
    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return { tag, err: `no __NEXT_DATA__ (${res.status})` };
    const cd = JSON.parse(m[1]).props.pageProps.contentData;
    const n = cd.categories.find((c) => c.id === "NUDITY");
    return {
      tag,
      sev: n?.severitySummary?.text ?? null,
      votes: n?.totalSeverityVotes ?? 0,
      items: (n?.items ?? []).map((i) => ({ t: decode(i.text), sp: !!i.isSpoiler })),
    };
  } catch (e) {
    return { tag, err: String(e.message || e) };
  }
}

// Four at a time with a breath in between — polite, and ~10s for a whole show.
const out = {};
for (let i = 0; i < LIST.length; i += 4) {
  for (const row of await Promise.all(LIST.slice(i, i + 4).map(one))) {
    const { tag, ...rest } = row;
    out[tag] = rest;
  }
  await new Promise((r) => setTimeout(r, 150));
}
console.log(JSON.stringify({ episodes: out }, null, 2));
