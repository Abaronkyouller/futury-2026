import { PRIORITIES } from "../types/review";
import type { GeneratedTestCase, Priority } from "../types/review";

export const RANDOM_PRIORITY_REASON = "Für den Prototyp bei der Erstellung zufällig zugewiesen.";

/** Selects one of the three prototype priorities with equal probability. */
export function randomPriority(): Priority {
  return PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)] ?? "Mittel";
}

/**
 * Randomly redistributes existing cases while ensuring that all priorities are
 * represented when at least three cases exist.
 */
export function redistributePriorities(cases: GeneratedTestCase[]): GeneratedTestCase[] {
  const shuffled = cases.map((_, index) => index);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const target = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[target]] = [shuffled[target]!, shuffled[i]!];
  }
  const assigned = new Map(shuffled.map((caseIndex, index) => [caseIndex, PRIORITIES[index % PRIORITIES.length]]));
  return cases.map((item, index) => ({
    ...item,
    priority: assigned.get(index) ?? randomPriority(),
    priorityReason: RANDOM_PRIORITY_REASON,
  }));
}
