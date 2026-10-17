import { cell, groupSize } from '../core';
import type { BenchState, Bounds, Cell, Command, Group, Question, UnitId } from '../core';

// A reference solution written in core commands. It exists so that validate()
// can prove every generated puzzle is solvable; it is never shown to a child.

function looseUnitsInTray(state: BenchState): ReadonlyArray<UnitId> {
  const grouped = new Set<UnitId>();
  for (const group of state.groups.values()) {
    for (const u of group.unitIds) {
      grouped.add(u);
    }
  }
  const out: UnitId[] = [];
  for (const slot of state.tray) {
    if (slot.unitId !== null && !grouped.has(slot.unitId)) {
      out.push(slot.unitId);
    }
  }
  return out;
}

function rowMajorCells(bounds: Bounds, count: number): ReadonlyArray<Cell> {
  const cells: Cell[] = [];
  for (let i = 0; i < count; i += 1) {
    cells.push(cell(i % bounds.cols, Math.floor(i / bounds.cols)));
  }
  return cells;
}

function bodyWidth(group: Group): number {
  return Math.max(...group.shape.map((c) => c.x)) + 1;
}

function bodyHeight(group: Group): number {
  return Math.max(...group.shape.map((c) => c.y)) + 1;
}

// Lays partners out left to right, wrapping to a new row when the bench is too
// narrow. Consecutive partners share an edge, which is what joining needs.
function packPartners(groups: ReadonlyArray<Group>, bounds: Bounds): ReadonlyArray<Command> {
  const commands: Command[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const group of groups) {
    const width = bodyWidth(group);
    if (x + width > bounds.cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    commands.push({ type: 'takeGroup', groupId: group.id, origin: cell(x, y) });
    x += width;
    rowHeight = Math.max(rowHeight, bodyHeight(group));
  }
  return commands;
}

function partnersWithSizes(state: BenchState, sizes: ReadonlyArray<number>): ReadonlyArray<Group> | undefined {
  const available = [...state.groups.values()];
  const chosen: Group[] = [];
  for (const size of sizes) {
    const match = available.find((g) => groupSize(g) === size && !chosen.includes(g));
    if (match === undefined) {
      return undefined;
    }
    chosen.push(match);
  }
  return chosen;
}

// Partners whose sizes add up to exactly `target`; decoys are left in the tray.
function partnersAddingUpTo(groups: ReadonlyArray<Group>, target: number): ReadonlyArray<Group> | undefined {
  if (target === 0) {
    return [];
  }
  for (const [i, g] of groups.entries()) {
    if (groupSize(g) <= target) {
      const rest = partnersAddingUpTo(groups.slice(i + 1), target - groupSize(g));
      if (rest !== undefined) {
        return [g, ...rest];
      }
    }
  }
  return undefined;
}

// Partners for a target that single blocks may top up: exactly the target if
// some partners make it, else the most the partners can give with enough
// singles for the rest (5 = a 3 + two singles).
function partnersTowards(groups: ReadonlyArray<Group>, target: number, loose: number): ReadonlyArray<Group> | undefined {
  for (let s = target; s >= Math.max(0, target - loose); s -= 1) {
    const found = partnersAddingUpTo(groups, s);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function taken(commands: ReadonlyArray<Command>, groups: ReadonlyArray<Group>): ReadonlySet<string> {
  const out = new Set<string>();
  for (const cmd of commands) {
    if (cmd.type === 'takeGroup') {
      const g = groups.find((x) => x.id === cmd.groupId)!;
      g.shape.forEach((c) => out.add(`${c.x + cmd.origin.x},${c.y + cmd.origin.y}`));
    }
  }
  return out;
}

// Moves that turn the blocks on `cells` into `next`: whatever already sits on a
// cell of the new shape stays; the rest go to the free cells of it.
function reshape(placed: ReadonlyArray<{ readonly unitId: UnitId; readonly at: Cell }>, next: ReadonlyArray<Cell>): ReadonlyArray<Command> {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const wanted = new Set(next.map(key));
  const occupied = new Set(placed.map((p) => key(p.at)));
  const free = next.filter((c) => !occupied.has(key(c)));
  return placed.filter((p) => !wanted.has(key(p.at))).map((p, i) => ({ type: 'move', unitId: p.unitId, to: free[i] as Cell }));
}

// "Who's missing?": the one partner the stop starts with on the mat stays where
// it is; the other half comes from the tray and sits right beside it.
function besideGiven(question: Extract<Question, { kind: 'sum_composition' }>, initial: BenchState, given: Group): ReadonlyArray<Command> {
  const missing = [...initial.groups.values()].find((g) => g.id !== given.id && groupSize(g) === question.sum - groupSize(given));
  if (missing === undefined) {
    throw new Error(`content: no partner in the tray finishes ${groupSize(given)} + ? = ${question.sum}`);
  }
  const cells = given.unitIds.map((u) => initial.bench.get(u)!);
  const x = Math.max(...cells.map((c) => c.x)) + 1;
  const y = Math.min(...cells.map((c) => c.y));
  return [{ type: 'takeGroup', groupId: missing.id, origin: cell(x, y) }];
}

// A sum asked several ways: one allowed pair after another, each joined up,
// then sent back to make room for the next.
function everyWay(question: Extract<Question, { kind: 'sum_composition' }>, initial: BenchState, ways: number): ReadonlyArray<Command> {
  const chosen: ReadonlyArray<Group>[] = [];
  for (const pair of question.allowed) {
    const groups = partnersWithSizes(initial, pair);
    if (groups !== undefined && chosen.length < ways) {
      chosen.push(groups);
    }
  }
  if (chosen.length < ways) {
    throw new Error(`content: only ${chosen.length} of ${ways} ways to make ${question.sum} are in the tray`);
  }
  return chosen.flatMap((groups, i) => [
    ...(chosen[i - 1] ?? []).map((g): Command => ({ type: 'returnGroup', groupId: g.id })),
    ...packPartners(groups, initial.bounds),
  ]);
}

export function buildSolution(question: Question, initial: BenchState, steps: ReadonlyArray<Question> = [], ways = 1): ReadonlyArray<Command> {
  switch (question.kind) {
    case 'quantity': {
      const loose = looseUnitsInTray(initial);
      if (initial.groups.size > 0) {
        const groups = partnersTowards([...initial.groups.values()], question.target, loose.length);
        if (groups === undefined) {
          throw new Error(`content: no partners add up to ${question.target}`);
        }
        const packed = packPartners(groups, initial.bounds);
        const used = taken(packed, groups);
        const rest = question.target - groups.reduce((a, g) => a + groupSize(g), 0);
        const free = rowMajorCells(initial.bounds, initial.bounds.cols * initial.bounds.rows).filter((c) => !used.has(`${c.x},${c.y}`));
        return [...packed, ...loose.slice(0, rest).map((unitId, i): Command => ({ type: 'take', unitId, to: free[i] as Cell }))];
      }
      const units = loose.slice(0, question.target);
      const cells = rowMajorCells(initial.bounds, units.length);
      return units.map((unitId, i) => ({ type: 'take', unitId, to: cells[i] as Cell }));
    }
    case 'quantity_shape': {
      const template = question.template.cells;
      let first: ReadonlyArray<Command>;
      if (initial.groups.size > 0) {
        // Partners laid in rows as wide as the picture, so they fill it.
        const groups = partnersAddingUpTo([...initial.groups.values()], question.target);
        if (groups === undefined) {
          throw new Error(`content: no partners add up to ${question.target}`);
        }
        first = packPartners(groups, { cols: Math.max(...template.map((c) => c.x)) + 1, rows: initial.bounds.rows });
      } else {
        const units = looseUnitsInTray(initial).slice(0, question.target);
        first = units.map((unitId, i) => ({ type: 'take', unitId, to: template[i] as Cell }));
      }
      // A sequence: the same blocks, moved into each next picture in turn.
      let placed = first.flatMap((cmd) => (cmd.type === 'take' ? [{ unitId: cmd.unitId, at: cmd.to }] : []));
      const moves: Command[] = [];
      for (const step of steps.slice(1)) {
        if (step.kind !== 'quantity_shape') {
          throw new Error('content: a sequence step must be a shape');
        }
        const next = reshape(placed, step.template.cells);
        moves.push(...next);
        placed = placed.map((p) => {
          const m = next.find((c) => c.type === 'move' && c.unitId === p.unitId);
          return m !== undefined && m.type === 'move' ? { unitId: p.unitId, at: m.to } : p;
        });
      }
      return [...first, ...moves];
    }
    case 'addition_exact': {
      const groups = partnersWithSizes(initial, question.operands);
      if (groups === undefined) {
        throw new Error(`content: no partners of sizes ${question.operands.join(' + ')} in the tray`);
      }
      return packPartners(groups, initial.bounds);
    }
    case 'sum_composition': {
      const given = [...initial.groups.values()].find((g) => g.unitIds.every((u) => initial.bench.has(u)));
      if (given !== undefined) {
        return besideGiven(question, initial, given);
      }
      if (ways > 1) {
        return everyWay(question, initial, ways);
      }
      for (const pair of question.allowed) {
        const groups = partnersWithSizes(initial, pair);
        if (groups !== undefined) {
          return packPartners(groups, initial.bounds);
        }
      }
      throw new Error(`content: no allowed pair for ${question.sum} is available in the tray`);
    }
  }
}
