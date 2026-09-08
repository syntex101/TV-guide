# Safe for the Living Room

Answers one question fast, from the couch: **does this episode have nudity or sex in it?**

Pick a show, season and episode; get a check, a caution, an X, or an explicit
"no data". Scene descriptions sit behind a spoiler veil. First show is
Boardwalk Empire (HBO, 56 episodes).

## The four verdicts

| Badge | Means |
|---|---|
| ✅ **Safe** | No nudity or sex reported |
| ⚠️ **Careful** | Brief, partial, background or implied only |
| ❌ **Not Safe** | Explicit sex or sustained nudity |
| ❓ **Unknown** | Nobody has described this episode — **treat as unsafe** |

The fourth state is the important one. IMDb's Parents Guide is written by
volunteers, so coverage is uneven. An episode with no entries has never been
described, which is not the same as being clean, and it must never render as a
green check.

## Where the data comes from

- **Episode metadata** — [TVmaze](https://www.tvmaze.com/api) (free, no key): titles, runtimes, airdates.
- **Content data** — IMDb Parents Guide: the crowd-voted Sex & Nudity severity plus the verbatim scene entries.

IMDb blocks scripted requests, so getting that second one takes a detour.
Two routes, in order of preference:

1. **From a browser** (`scripts/browser-fetch.js`) — requests made from a page
   already on imdb.com are ordinary same-origin fetches and are not blocked,
   and the page ships its data as JSON in `__NEXT_DATA__`, so there is no HTML
   to scrape. A whole show takes about ten seconds. Output lands in
   `cache/<slug>-guides.json`, which is committed and is the real source.
2. **Through the `r.jina.ai` text proxy** (`npm run fetch:guides`) — works
   unattended but rate-limits hard; budget an hour for 56 episodes. The route
   needs the target URL percent-encoded and an `x-respond-with: text` header,
   because the default markdown mode returns an empty body for this page
   specifically. Used as the per-episode fallback where the JSON has no row.

Everything is cached under `cache/`, so re-runs cost nothing and the site never
depends on either route at runtime.

### What it does not have

**Per-scene timestamps.** No free source publishes them. ClearPlay and Skipit
maintain real timecoded databases but they are commercial and closed, and
DoesTheDogDie is series-level only. Rather than invent timecodes, every scene
carries an empty `timestamps: []` and an optional `approx`, both of which the
page renders as soon as they hold anything. Filling them in is a data job, not
a code change.

## Running it

```bash
npm run all      # fetch → parse → build, roughly 4 minutes cold
```

Or step by step:

| Command | Does |
|---|---|
| `npm run fetch:episodes` | TVmaze + IMDb season pages → `cache/<slug>-episodes.json` |
| `npm run fetch:guides` | Fallback proxy route → `cache/*.txt` (slow; prefer the browser route) |
| `npm run build:data` | Parse and auto-classify → `data/<slug>.json` |
| `npm run build` | Inline the data → `dist/` |

Three outputs, one source (`src/index.html`):

- `dist/index.html` — standalone document, open it straight from disk
- `dist/artifact.html` — same page without the document wrapper, for publishing as an Artifact
- `docs/index.html` — identical to the first, but committed, because it is what GitHub Pages serves

`dist/` is ignored; `docs/` is committed. Building on Actions would keep the
built page out of the tree, but that needs a workflow file, and pushing one
requires a token with the `workflow` scope.

## Deployment

Live at **https://syntex101.github.io/TV-guide/**, served from `main` at
`/docs`. To update it: `npm run build`, then commit and push `docs/`.

GitHub Pages does not work on a private repo without a paid plan, so this
repository is public. Nothing in it is sensitive — no keys, and commits use
the GitHub noreply address rather than a personal one.

## Classification

`scripts/classify.mjs` matches the scene text against explicit and
brief/partial phrase lists and returns a tier plus the phrase that triggered
it. **This is a first pass, not the authority.** Every episode is then read by
hand in `data/review.json`, which pins the tier and carries a short
non-spoiler summary; a key's presence there is what flips `reviewed` to true.
That file is never written by the scripts, so re-running the pipeline cannot
clobber the review.

It earns its keep: on the first pass the keywords disagreed with the human
read on **21 of 56 episodes** — mostly calling brief background nudity
"explicit", and once the reverse, on an episode whose single mild-sounding
description sits under a near-unanimous Severe rating.

Ambiguity resolves toward caution in both directions: descriptions that match
no rule become `amber` rather than `green`, and a severity vote with no
descriptions behind it only earns `green` when that vote is None or Mild.

## Adding another show

Append to `data/shows.json` and re-run `npm run all`:

```json
{ "slug": "deadwood", "title": "Deadwood", "years": "2004–2006",
  "network": "HBO", "imdbId": "tt0348914", "tvmazeQuery": "deadwood", "seasons": 3 }
```

Then run `scripts/browser-fetch.js` for the new show and review the result
into `data/review.json`. The show picker, season grid and per-show sourcing
line all read from the registry, so no code needs touching.

## Boardwalk Empire, as it stands

29 explicit · 13 brief or background · 7 clean · 7 with no data at all.
Seasons 1 and 3 are the heaviest; the clean episodes are scattered
(S1E11, S1E12, S2E02, S4E02, S4E03, S4E04, S5E07).
