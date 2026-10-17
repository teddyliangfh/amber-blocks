import { apply } from '../core';
import type { BenchState, Command, GroupId, UnitId } from '../core';
import { CHAPTERS, CONTENT_VERSION, materialize } from '../content';
import type { Puzzle } from '../content';
import { computeGeometry } from './layout';
import { planTray, trayObjects, trayView } from './tray';
import type { TrayPlan, TrayView } from './tray';

function puzzleOf(nodeId: string, attemptVariant = 0): Puzzle {
  const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === nodeId));
  if (chapter === undefined) {
    throw new Error(`no node ${nodeId}`);
  }
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: chapter.nodes.find((n) => n.id === nodeId)!.id, attemptVariant, seed: 5 });
}

function run(state: BenchState, cmd: Command): BenchState {
  const r = apply(state, cmd);
  if (!r.ok) {
    throw new Error(`${cmd.type}: ${r.reason}`);
  }
  return r.value;
}

function setup(puzzle: Puzzle): TrayPlan {
  const objects = trayObjects(puzzle.initial);
  const geo = computeGeometry(390, 520, puzzle.initial.bounds, objects.map((o) => o.footprint));
  return planTray(geo, objects);
}

// Every object of the plan, keyed by what it shows: the thing in it or its gap.
function spots(view: TrayView): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of view.partners) {
    out.set(`partner:${p.group.id}`, `${p.spot.x},${p.spot.y},${p.spot.scale}`);
  }
  for (const u of view.units) {
    out.set(`unit:${u.unitId}`, `${u.spot.x},${u.spot.y},${u.spot.scale}`);
  }
  return out;
}

function shown(view: TrayView): number {
  return view.partners.length + view.emptyPartners.length + view.units.length + view.emptySlots.length;
}

const partnerNodes = ['ch1-n10', 'ch1-n11', 'ch1-n12', ...CHAPTERS[1]!.nodes.map((n) => n.id as string)];

describe('tray plan (review P1: tray identity is fixed at the start of a stop)', () => {
  test.each(partnerNodes)('%s: taking any one partner out leaves one outline, everything else stays put', (nodeId) => {
    const puzzle = puzzleOf(nodeId);
    const plan = setup(puzzle);
    // A stop that starts with a partner on the mat (Phase 19) shows its outline
    // from the start; with that partner put back, the tray is full like any other.
    const opening = trayView(plan, puzzle.initial);
    expect(opening.emptyPartners.map((e) => e.spot.id)).toEqual(puzzle.given === undefined ? [] : [puzzle.given]);
    const start = puzzle.given === undefined ? puzzle.initial : run(puzzle.initial, { type: 'returnGroup', groupId: puzzle.given });
    const before = trayView(plan, start);
    const objectCount = plan.objects.length;
    expect(shown(opening)).toBe(objectCount);
    expect(shown(before)).toBe(objectCount);
    expect(before.emptySlots).toHaveLength(0);
    expect(before.emptyPartners).toHaveLength(0);
    for (const group of puzzle.initial.groups.values()) {
      const out = run(start, { type: 'takeGroup', groupId: group.id, origin: { x: 0, y: 0 } });
      const view = trayView(plan, out);
      // The partner's member slots never come back as loose gaps.
      expect(view.emptySlots).toHaveLength(0);
      expect(view.emptyPartners).toHaveLength(1);
      expect(shown(view)).toBe(objectCount);
      // Every other object keeps its exact spot and scale.
      const rest = spots(view);
      for (const [key, where] of spots(before)) {
        if (key === `partner:${group.id}`) {
          expect(rest.has(key)).toBe(false);
        } else {
          expect(rest.get(key)).toBe(where);
        }
      }
      // Putting it back restores the starting picture exactly.
      const back = run(out, { type: 'returnGroup', groupId: group.id });
      expect(spots(trayView(plan, back))).toEqual(spots(before));
      expect(trayView(plan, back).emptyPartners).toHaveLength(0);
    }
  });

  test.each(['ch1-n10', 'ch1-n11', 'ch1-n12'])('%s: a loose spare taken out leaves its own gap only', (nodeId) => {
    const puzzle = puzzleOf(nodeId);
    const plan = setup(puzzle);
    const before = spots(trayView(plan, puzzle.initial));
    const spare = trayView(plan, puzzle.initial).units[0]!.unitId;
    // The mat's far corner (mats are fitted per stop since 2026-10-15).
    const out = run(puzzle.initial, { type: 'take', unitId: spare, to: { x: puzzle.initial.bounds.cols - 1, y: puzzle.initial.bounds.rows - 1 } });
    const view = trayView(plan, out);
    expect(view.emptySlots).toHaveLength(1);
    expect(view.emptyPartners).toHaveLength(0);
    for (const [key, where] of spots(view)) {
      expect(where).toBe(before.get(key));
    }
  });

  test.each(partnerNodes)('%s: after the reference solution the tray still shows the same objects', (nodeId) => {
    const puzzle = puzzleOf(nodeId);
    const plan = setup(puzzle);
    const before = spots(trayView(plan, puzzle.initial));
    const solved = puzzle.solution.reduce(run, puzzle.initial);
    const view = trayView(plan, solved);
    expect(shown(view)).toBe(plan.objects.length);
    expect(view.emptyPartners.length).toBe([...puzzle.initial.groups.values()].filter((g) => g.unitIds.every((u) => solved.bench.has(u))).length);
    for (const [key, where] of spots(view)) {
      expect(where).toBe(before.get(key));
    }
  });

  test('ch1-n10 (review repro): taking one partner out keeps every object and the others in place', () => {
    const puzzle = puzzleOf('ch1-n10');
    const plan = setup(puzzle);
    // Two 5s, the decoy 4 and two spares.
    expect(plan.objects).toHaveLength(5);
    const [first, second] = [...puzzle.initial.groups.keys()] as [GroupId, GroupId];
    const before = trayView(plan, puzzle.initial).partners.find((p) => p.group.id === second)!.spot;
    const out = run(puzzle.initial, { type: 'takeGroup', groupId: first, origin: { x: 0, y: 0 } });
    const after = trayView(plan, out).partners.find((p) => p.group.id === second)!.spot;
    expect(after).toEqual(before);
  });

  test('a unit sitting in a partner slot on its own is shown at that slot, not dropped', () => {
    const puzzle = puzzleOf('ch2-n1');
    const plan = setup(puzzle);
    const group = [...puzzle.initial.groups.values()].find((g) => g.unitIds.length === 3)!;
    let state = run(puzzle.initial, { type: 'takeGroup', groupId: group.id, origin: { x: 0, y: 0 } });
    // A single member leaves the partner on the bench and is sent home alone.
    const member = group.unitIds[2] as UnitId;
    state = run(state, { type: 'move', unitId: member, to: { x: puzzle.initial.bounds.cols - 1, y: puzzle.initial.bounds.rows - 1 } });
    state = run(state, { type: 'return', unitId: member });
    const view = trayView(plan, state);
    expect(view.units.map((u) => u.unitId)).toContain(member);
    expect(view.emptyPartners).toHaveLength(1);
  });

  test('objects: partners in content order first, then loose slots; footprints from the partner body', () => {
    const puzzle = puzzleOf('ch1-n12');
    const objects = trayObjects(puzzle.initial);
    // Partners come in the (seeded, shuffled) content order: 10, 5, 2 and the decoy 4.
    expect(objects.slice(0, 4).map((o) => o.groupId)).toEqual(puzzle.display.partnerIds);
    expect(objects.slice(0, 4).map((o) => `${o.footprint.w}x${o.footprint.h}`).sort()).toEqual(['2x1', '4x1', '5x1', '5x2']);
    expect(objects.slice(4).map((o) => o.footprint)).toEqual([{ w: 1, h: 1 }, { w: 1, h: 1 }]);
    expect(objects.slice(4).every((o) => o.groupId === null)).toBe(true);
    // 5: a 3 to carry and five singles, enough to make 5 from singles alone (2026-10-16 review A-6).
    expect(trayObjects(puzzleOf('ch1-n5').initial).map((o) => o.footprint.w)).toEqual([3, 1, 1, 1, 1, 1]);
  });
});
