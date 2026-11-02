// Generates roadmaps for several profiles from the LIVE Codeforces problemset
// and checks them: 90 days, no duplicates, metadata matching the catalog,
// official URLs, ratings inside the planned ranges. With --check-links it also
// requests a sample of problem pages to confirm the links resolve.
//
//   npm run verify:problemset -w server [-- --check-links]
import { CodeforcesClient } from '../src/services/codeforces.service.js';
import { fetchProblemset, problemUrl } from '../src/services/problemSelector/fetchProblemset.js';
import { generateRoadmap } from '../src/services/roadmapGenerator.service.js';

const profiles = [
  { label: 'New competitor 0 → 400', startingRating: 0, targetRating: 400, hoursPerDay: 1, daysPerWeek: 5 },
  { label: 'Newbie 900 → 1200', startingRating: 900, targetRating: 1200, hoursPerDay: 2, daysPerWeek: 6 },
  { label: 'Pupil 1200 → 1600', startingRating: 1200, targetRating: 1600, hoursPerDay: 2, daysPerWeek: 6 },
  { label: 'Specialist 1450 → 1650', startingRating: 1450, targetRating: 1650, hoursPerDay: 3, daysPerWeek: 7 },
  { label: 'Expert 1700 → 1900', startingRating: 1700, targetRating: 1900, hoursPerDay: 4, daysPerWeek: 5 },
  { label: 'Candidate Master 2000 → 2150', startingRating: 2000, targetRating: 2150, hoursPerDay: 3, daysPerWeek: 6 },
];

const client = new CodeforcesClient({ baseUrl: 'https://codeforces.com/api' });
console.log('Fetching the live problemset…');
const catalog = await fetchProblemset(client);
const byId = new Map(catalog.map((p) => [p.problemId, p]));
console.log(`Catalog: ${catalog.length} problems, ${catalog.filter((p) => p.rating !== null).length} rated\n`);

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const sampleUrls: string[] = [];

for (const profile of profiles) {
  const t0 = Date.now();
  const r = generateRoadmap(catalog, { ...profile, contestParticipation: true, startDate: '2026-11-02', seed: profile.label });
  const ms = Date.now() - t0;
  const problems = r.days.flatMap((d) => d.problems.map((p) => ({ p, d })));
  const ids = problems.map(({ p }) => p.problemId);
  const missing = r.days.flatMap((d) => d.notes.filter((n) => n.startsWith('No suitable')));

  console.log(`${profile.label}: ${problems.length} problems, ${missing.length} unfilled slots, generated in ${ms} ms`);
  console.log(`  practice ${r.practiceStart} → ${r.practiceEnd}, benchmark ${r.benchmark}`);
  console.log(`  topics: ${r.topics.join(' → ')}`);

  if (r.days.length !== 90) fail('roadmap is not 90 days');
  if (new Set(ids).size !== ids.length) fail('duplicate problems');
  for (const { p, d } of problems) {
    const src = byId.get(p.problemId);
    if (!src) fail(`${p.problemId} not in catalog`);
    else if (src.name !== p.name || src.rating !== p.rating) fail(`${p.problemId} metadata mismatch`);
    if (p.url !== problemUrl(p.contestId, p.index)) fail(`${p.problemId} bad url`);
    if (p.role !== 'stretch' && (p.rating < d.difficulty.min - 200 || p.rating > d.difficulty.max + 200)) fail(`${p.problemId} (${p.rating}) outside day ${d.dayNumber} range`);
    // Benchmarks below 800 are unreachable: 800 is the easiest Codeforces rating.
    if (p.rating > Math.max(r.benchmark, 800)) fail(`${p.problemId} above benchmark`);
  }
  const first = r.days.find((d) => d.type === 'learn')!;
  console.log(`  day ${first.dayNumber}: ${first.topic} / ${first.subtopic} [${first.difficulty.min}–${first.difficulty.max}]`);
  for (const p of first.problems) console.log(`    ${p.role.padEnd(13)} ${p.problemId.padEnd(7)} ${p.rating}  ${p.name}  ${p.url}`);
  sampleUrls.push(...problems.filter((_, i) => i % 40 === 0).map(({ p }) => p.url));
  console.log();
}

if (process.argv.includes('--check-links')) {
  console.log(`Checking ${sampleUrls.length} sample links…`);
  for (const url of sampleUrls) {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const ok = res.status === 200;
    console.log(`  ${ok ? '✓' : '✗'} ${res.status} ${url}`);
    // Codeforces answers automated requests with 403 (bot protection); only other errors count.
    if (!ok && res.status !== 403) failures++;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
