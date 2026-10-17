import { createBenchState, unitIds } from '../core';
import type { BenchState, Bounds } from '../core';
import { hueFor } from './material';

// Free play (2026-10-15 review O, D-051): one fixed box of blocks to build with,
// no question and no answer. Ten single blocks and no partners, because the
// sandbox's own rewards are the ones single blocks give: a cluster takes the
// colour of its count, one face per cluster, and counting ends on the total
// (PRD §3.2: free taking, placing and counting). Ten covers every number
// colour once; 6 × 5 holds ten as two rows of five with room around it, and
// keeps the blocks as big as a level's on a phone.
//
// One line to change, with one consequence: a saved sandbox made from other
// material no longer matches (progress/sanitize drops it as damage). If this
// ever changes, teach progress/migrate to set the old one aside quietly first.
export const SANDBOX: { readonly blocks: number; readonly bounds: Bounds } = { blocks: 10, bounds: { cols: 6, rows: 5 } };

// Every block waits in the tray in the colour of one, as a lone block on the mat is.
export function sandboxMaterial(): BenchState {
  return createBenchState({ units: unitIds('sandbox', SANDBOX.blocks).map((id) => ({ id, hue: hueFor(1) })), bounds: SANDBOX.bounds });
}
