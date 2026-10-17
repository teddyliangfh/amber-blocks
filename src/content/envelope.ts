import type { ShapeTemplate } from '../core';
import type { Rng } from './rng';

// Picks a target from the node's pool while avoiding the last two stops' targets,
// so the map does not feel like 1, 2, 3 (D-018). Tiny pools relax the rule.
export function pickTarget(pool: ReadonlyArray<number>, rng: Rng, recent: ReadonlyArray<number> = []): number {
  if (pool.length === 0) {
    throw new Error('content: empty target pool');
  }
  const avoid = new Set(recent.slice(-2));
  const candidates = pool.length <= 2 ? pool : pool.filter((t) => !avoid.has(t));
  return rng.pick(candidates.length > 0 ? candidates : pool);
}

export function pickTemplate(templates: ReadonlyArray<ShapeTemplate>, rng: Rng): ShapeTemplate {
  if (templates.length === 0) {
    throw new Error('content: empty template pool');
  }
  return rng.pick(templates);
}

export function pickPair(pairs: ReadonlyArray<readonly [number, number]>, rng: Rng): readonly [number, number] {
  if (pairs.length === 0) {
    throw new Error('content: empty pair pool');
  }
  return rng.pick(pairs);
}
