import type { Exercise } from "./types";

/** Process-wide exercise registry. Fixtures and the Convex loader both register into it. */
const registry = new Map<string, Exercise>();

export function registerExercises(list: Exercise[]) {
  for (const e of list) registry.set(e.id, e);
}

export function exerciseById(id: string): Exercise | undefined {
  return registry.get(id);
}
