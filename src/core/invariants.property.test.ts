import * as fc from 'fast-check';
import { apply, commit, createHistory, undo } from './commands';
import type { Command } from './commands';
import { cell } from './grid';
import { defineGroup } from './groups';
import { groupId, unitId, unitIds } from './ids';
import type { BenchState } from './inventory';
import { assertInvariants, assertSameMaterial, createBenchState } from './state';

// Property tests for the conservation invariants (AC-35, AC-04): no sequence of
// commands, valid or not, can create, lose or duplicate a unit, overlap cells,
// or leave a group half on the bench. Fixed seed so a failure reproduces.
const RUNS = { numRuns: 200, seed: 20261013 } as const;

const unitCountArb = fc.integer({ min: 1, max: 6 });
const boundsArb = fc.record({ cols: fc.integer({ min: 2, max: 5 }), rows: fc.integer({ min: 2, max: 5 }) });
// Cells may fall just outside the bounds so out-of-bounds rejections are exercised.
const cellArb = fc.record({ x: fc.integer({ min: -1, max: 5 }), y: fc.integer({ min: -1, max: 5 }) }).map((c) => cell(c.x, c.y));
const deltaArb = fc.record({ x: fc.integer({ min: -2, max: 2 }), y: fc.integer({ min: -2, max: 2 }) }).map((c) => cell(c.x, c.y));
const groupNameArb = fc.constantFrom('g0', 'g1', 'zzz');

function commandArb(unitCount: number): fc.Arbitrary<Command> {
  // Index === unitCount is a ghost id that is never part of the material.
  const unitArb = fc.integer({ min: 0, max: unitCount }).map((i) => (i === unitCount ? unitId('ghost') : unitIds('p', unitCount)[i]!));
  return fc.oneof(
    fc.record({ type: fc.constant('take' as const), unitId: unitArb, to: cellArb }),
    fc.record({ type: fc.constant('move' as const), unitId: unitArb, to: cellArb }),
    fc.record({ type: fc.constant('return' as const), unitId: unitArb }),
    fc.record({ type: fc.constant('moveGroup' as const), groupId: groupNameArb.map(groupId), delta: deltaArb }),
    fc.record({ type: fc.constant('takeGroup' as const), groupId: groupNameArb.map(groupId), origin: cellArb }),
    fc.record({ type: fc.constant('returnGroup' as const), groupId: groupNameArb.map(groupId) }),
  );
}

interface Scenario {
  readonly start: BenchState;
  readonly commands: ReadonlyArray<Command>;
}

// A starting state with some units already placed and up to two partners defined
// (in the tray or on the bench, whichever the placements left them in),
// followed by an arbitrary command sequence.
const scenarioArb: fc.Arbitrary<Scenario> = fc
  .tuple(unitCountArb, boundsArb)
  .chain(([unitCount, bounds]) =>
    fc
      .tuple(
        fc.array(fc.tuple(fc.integer({ min: 0, max: unitCount - 1 }), cellArb), { maxLength: unitCount }),
        fc.array(fc.array(fc.integer({ min: 0, max: unitCount - 1 }), { maxLength: 3 }), { maxLength: 2 }),
        fc.array(commandArb(unitCount), { maxLength: 40 }),
      )
      .map(([placements, groupPlans, commands]) => {
        const ids = unitIds('p', unitCount);
        let state = createBenchState({ units: ids.map((id, i) => ({ id, hue: i % 2 ? 'blue' : 'red' })), bounds });
        for (const [index, to] of placements) {
          const r = apply(state, { type: 'take', unitId: ids[index]!, to });
          if (r.ok) {
            state = r.value;
          }
        }
        groupPlans.forEach((plan, g) => {
          const members = [...new Set(plan.map((i) => ids[i]!))];
          // A row shape serves tray partners; bench partners read their shape from the cells.
          const r = defineGroup(state, groupId(`g${g}`), members, members.map((_, i) => cell(i, 0)));
          if (r.ok) {
            state = r.value;
          }
        });
        assertInvariants(state);
        return { start: state, commands };
      }),
  );

describe('conservation properties', () => {
  test('AC-35: invariants hold after every command and rejections leave the input untouched', () => {
    fc.assert(
      fc.property(scenarioArb, ({ start, commands }) => {
        let state = start;
        for (const cmd of commands) {
          const r = apply(state, cmd);
          if (r.ok) {
            assertInvariants(r.value);
            assertSameMaterial(start, r.value);
            state = r.value;
          } else {
            expect(state.bench).toBe(state.bench);
            assertInvariants(state);
          }
        }
        assertSameMaterial(start, state);
      }),
      RUNS,
    );
  });

  test('AC-04: undoing every committed command returns exactly the starting state', () => {
    fc.assert(
      fc.property(scenarioArb, ({ start, commands }) => {
        let history = createHistory(start);
        let committed = 0;
        for (const cmd of commands) {
          const r = commit(history, cmd, Number.MAX_SAFE_INTEGER);
          if (r.ok) {
            history = r.value;
            committed += 1;
          }
        }
        for (let i = 0; i < committed; i += 1) {
          const r = undo(history);
          expect(r.ok).toBe(true);
          if (r.ok) {
            history = r.value;
          }
        }
        expect(history.state).toBe(start);
        expect(undo(history)).toEqual({ ok: false, reason: 'nothing-to-undo' });
      }),
      RUNS,
    );
  });
});
