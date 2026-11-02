import type { CatalogProblem } from './fetchProblemset.js';

/**
 * Stage 1, topic relevance. 0 means unrelated. A problem whose tags are mostly
 * the topic's tags scores close to 1; one where the topic tag is one of many
 * scores lower, since tags describe possible approaches, not the only one.
 * An empty topic tag list means a mixed-topic day where every problem counts.
 */
export function topicRelevance(problem: CatalogProblem, topicTags: readonly string[]): number {
  if (topicTags.length === 0) return 0.5;
  const matched = problem.tags.filter((tag) => topicTags.includes(tag)).length;
  if (matched === 0) return 0;
  const focus = matched / problem.tags.length;
  return 0.5 + 0.5 * focus;
}

export function filterByTopic(problems: readonly CatalogProblem[], topicTags: readonly string[]): CatalogProblem[] {
  if (topicTags.length === 0) return problems.slice();
  return problems.filter((p) => p.tags.some((tag) => topicTags.includes(tag)));
}
