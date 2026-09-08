/**
 * Tier rules for the "safe in the living room?" question.
 *
 * These produce a *proposal* plus the phrase that triggered it. Every episode
 * is then reviewed by hand before shipping — the keywords are a first pass,
 * not the authority. Order matters: explicit wins over brief, brief over bare
 * mention, and anything unmatched with no source data stays unknown.
 */

// Explicit sex or sustained/full nudity — not for the living room.
const EXPLICIT = [
  /\bsex scene/i, /\bhaving sex\b/i, /\bintercourse\b/i, /\bmaking love\b/i,
  /\bstraddl/i, /\briding\b/i, /\bthrust/i, /\bhumping\b/i, /\bpenetrat/i,
  /\bfull[- ]?frontal\b/i, /\bfully nude\b/i, /\bcompletely nude\b/i, /\bstark naked\b/i,
  /\boral sex\b/i, /\bfellatio\b/i, /\bcunnilingus\b/i, /\bgoing down on\b/i,
  /\bmasturbat/i, /\borgasm/i, /\bclimax(?:es|ing)?\b/i, /\bmoaning\b/i,
  /\bpenis\b/i, /\bvulva\b/i, /\bvagina\b/i, /\btestic/i, /\bejaculat/i,
  /\bpubic (?:hair|region|area)\b/i, /\bgenital/i, /\berection\b/i,
  /\bnude (?:woman|women|man|men|girl|dancer)/i, /\bnaked (?:woman|women|man|men|girl|body|couple)/i,
  /\bbreasts?(?:[^.]{0,40})(?:exposed|visible|shown|seen|bare)/i,
  /\bbare breasts?\b/i, /\btopless\b/i, /\bprostitut/i, /\bbrothel\b/i, /\borgy\b/i,
];

// Nudity or sexuality present, but brief, partial, distant or implied.
const BRIEF = [
  /\bbrief/i, /\bpartial/i, /\bmomentar/i, /\bglimpse/i, /\bbackground\b/i,
  /\bfrom a distance\b/i, /\bsilhouett/i, /\bobscured\b/i, /\bshadow/i,
  /\bimplied\b/i, /\bno nudity\b/i, /\bnon[- ]?graphic/i, /\bnothing is shown\b/i,
  /\bcleavage\b/i, /\blingerie\b/i, /\bunderwear\b/i, /\bkiss/i,
  /\bsuggestive\b/i, /\bsexual (?:references?|dialogue|innuendo)\b/i,
  /\bbuttocks\b/i, /\bbare back\b/i, /\bcovered\b/i,
];

const firstMatch = (patterns, text) => {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
};

/**
 * @param {{severity: string|null, scenes: string[]}} guide
 * @returns {{tier: 'green'|'amber'|'red'|'unknown', reason: string, evidence: string|null}}
 */
export function classify({ severity, scenes }) {
  const text = scenes.join('\n');
  const hasSource = Boolean(severity) || scenes.length > 0;

  if (!hasSource) {
    return { tier: 'unknown', reason: 'No Sex & Nudity data on IMDb for this episode.', evidence: null };
  }

  const explicit = firstMatch(EXPLICIT, text);
  if (explicit) {
    return { tier: 'red', reason: 'Explicit sex or sustained nudity described.', evidence: explicit };
  }

  const brief = firstMatch(BRIEF, text);
  if (brief) {
    return { tier: 'amber', reason: 'Brief, partial or implied content described.', evidence: brief };
  }

  // Descriptions exist but matched nothing — too ambiguous to call clean.
  if (scenes.length > 0) {
    return { tier: 'amber', reason: 'Content listed but not matched by any rule — needs a human read.', evidence: null };
  }

  // A severity vote with zero descriptions: trust only the low end.
  if (/^(none|mild)$/i.test(severity)) {
    return { tier: 'green', reason: `IMDb rates Sex & Nudity "${severity}" with nothing listed.`, evidence: null };
  }

  return { tier: 'unknown', reason: `IMDb rates Sex & Nudity "${severity}" but lists no scenes.`, evidence: null };
}
