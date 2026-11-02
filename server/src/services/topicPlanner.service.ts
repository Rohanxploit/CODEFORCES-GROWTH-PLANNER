import { TOPICS, type TopicDefinition } from '../config/heuristics/topics.js';

// Chooses which topics a user studies and in what order. Topics far below the
// starting rating are treated as known and only revised; topics far above the
// end of the difficulty ramp are left for a later plan. Prerequisites always
// come first.

/** Topics with entryRating below start − this are assumed known (revision only). */
export const KNOWN_TOPIC_MARGIN = 300;
/** Topics up to rampEnd + this are included. */
export const UPCOMING_TOPIC_MARGIN = 200;

export interface TopicBlock {
  topic: TopicDefinition;
  days: number;
}

export interface TopicPlan {
  blocks: TopicBlock[];
  /** Assumed-known topics, used for revision and mixed practice. */
  revisionTopics: TopicDefinition[];
  /** Topics that did not fit into the available learning days. */
  deferredTopics: TopicDefinition[];
}

export interface TopicPlanInput {
  startingRating: number;
  rampEnd: number;
  learnDays: number;
  library?: readonly TopicDefinition[];
}

/** Kahn's algorithm, always taking the available topic with the lowest entry rating. */
export function orderByPrerequisites(topics: readonly TopicDefinition[]): TopicDefinition[] {
  const ids = new Set(topics.map((t) => t.id));
  const remaining = new Map(topics.map((t) => [t.id, t.prerequisites.filter((p) => ids.has(p))]));
  const ordered: TopicDefinition[] = [];
  const done = new Set<string>();

  while (ordered.length < topics.length) {
    const ready = topics
      .filter((t) => !done.has(t.id) && remaining.get(t.id)!.every((p) => done.has(p)))
      .sort((a, b) => a.entryRating - b.entryRating || a.phase - b.phase || a.id.localeCompare(b.id));
    if (ready.length === 0) throw new Error('Topic library has a prerequisite cycle');
    ordered.push(ready[0]!);
    done.add(ready[0]!.id);
  }
  return ordered;
}

export function planTopics({ startingRating, rampEnd, learnDays, library = TOPICS }: TopicPlanInput): TopicPlan {
  const knownBelow = startingRating - KNOWN_TOPIC_MARGIN;
  const upper = Math.max(rampEnd, startingRating) + UPCOMING_TOPIC_MARGIN;
  const byId = new Map(library.map((t) => [t.id, t]));

  const selected = new Map<string, TopicDefinition>();
  const addWithPrerequisites = (topic: TopicDefinition) => {
    if (selected.has(topic.id) || topic.entryRating < knownBelow) return;
    selected.set(topic.id, topic);
    for (const id of topic.prerequisites) {
      const pre = byId.get(id);
      if (pre) addWithPrerequisites(pre);
    }
  };
  for (const topic of library) {
    if (topic.entryRating >= knownBelow && topic.entryRating <= upper) addWithPrerequisites(topic);
  }

  let ordered = orderByPrerequisites([...selected.values()]);
  const revisionTopics = library.filter((t) => t.entryRating < knownBelow);
  const deferredTopics: TopicDefinition[] = [];

  // More topics than days: drop the most advanced ones (never a prerequisite of a kept one).
  while (ordered.length > learnDays && ordered.length > 0) {
    const keptPrereqs = new Set(ordered.flatMap((t) => t.prerequisites));
    const candidates = ordered.filter((t) => !keptPrereqs.has(t.id));
    const drop = candidates.reduce((a, b) => (b.entryRating > a.entryRating ? b : a));
    deferredTopics.unshift(drop);
    ordered = ordered.filter((t) => t !== drop);
  }

  // Fit subtopic days into the available learning days.
  const wanted = ordered.map((t) => t.subtopics.length);
  const totalWanted = wanted.reduce((a, b) => a + b, 0);
  let days = wanted.slice();
  if (totalWanted > learnDays) {
    const scale = learnDays / totalWanted;
    days = wanted.map((w) => Math.max(1, Math.floor(w * scale)));
    let used = days.reduce((a, b) => a + b, 0);
    // Hand out leftover days to topics that lost the most, earliest first.
    for (let i = 0; used < learnDays && i < days.length * 4; i++) {
      const idx = i % days.length;
      if (days[idx]! < wanted[idx]!) {
        days[idx]!++;
        used++;
      }
    }
    // Floor rounding with min 1 can overshoot; trim from the largest blocks.
    while (used > learnDays) {
      const idx = days.indexOf(Math.max(...days));
      days[idx]!--;
      used--;
    }
  }

  return {
    blocks: ordered.map((topic, i) => ({ topic, days: days[i]! })).filter((b) => b.days > 0),
    revisionTopics,
    deferredTopics,
  };
}
