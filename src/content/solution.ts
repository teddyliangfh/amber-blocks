import { areTouching, cell, groupSize } from '../core';
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

// "Send the extra away": the allowed pair on the mat (the one that sits
// joined, if any) stays where it is; every other partner on the mat goes back
// to the tray. validate() refuses a pair that is not joined.
function sendAway(question: Extract<Question, { kind: 'sum_composition' }>, initial: BenchState, placed: ReadonlyArray<Group>): ReadonlyArray<Command> {
  for (const joined of [true, false]) {
    for (const [a, b] of question.allowed) {
      for (const x of placed) {
        const y = placed.find((g) => g !== x && groupSize(x) === a && groupSize(g) === b && (!joined || areTouching(initial, x, g)));
        if (y !== undefined) {
          return placed.filter((g) => g !== x && g !== y).map((g): Command => ({ type: 'returnGroup', groupId: g.id }));
        }
      }
    }
  }
  throw new Error(`content: no allowed pair for ${question.sum} is on the mat`);
}

// Partners that cover a picture exactly, each put down whole as it is: from the
// top-left cell not covered yet, a partner whose first block fits there and
// whose body stays inside the picture, then the next. Rows as wide as the
// picture fill a rectangle (the 8 brick, the ten); stairs need one partner a
// step (Phase 21: 2 + 4 makes 6 but no stairs, 1 + 2 + 3 does).
function cover(groups: ReadonlyArray<Group>, picture: ReadonlyArray<Cell>): ReadonlyArray<Command> | undefined {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const inside = new Set(picture.map(key));
  const order = [...picture].sort((a, b) => a.y - b.y || a.x - b.x);
  const place = (left: ReadonlyArray<Group>, covered: ReadonlySet<string>): ReadonlyArray<Command> | undefined => {
    const next = order.find((c) => !covered.has(key(c)));
    if (next === undefined) {
      return left.length === 0 ? [] : undefined;
    }
    for (const g of left) {
      const head = [...g.shape].sort((a, b) => a.y - b.y || a.x - b.x)[0]!;
      const origin = cell(next.x - head.x, next.y - head.y);
      const mine = g.shape.map((c) => key(cell(c.x + origin.x, c.y + origin.y)));
      if (mine.every((k) => inside.has(k) && !covered.has(k))) {
        const rest = place(left.filter((x) => x !== g), new Set([...covered, ...mine]));
        if (rest !== undefined) {
          return [{ type: 'takeGroup', groupId: g.id, origin }, ...rest];
        }
      }
    }
    return undefined;
  };
  return place(groups, new Set());
}

// Every set of partners adding up to exactly `target`, in tray order (the
// order partnersAddingUpTo tries them in).
function setsAddingUpTo(groups: ReadonlyArray<Group>, target: number): ReadonlyArray<ReadonlyArray<Group>> {
  if (target === 0) {
    return [[]];
  }
  return groups.flatMap((g, i) => (groupSize(g) <= target ? setsAddingUpTo(groups.slice(i + 1), target - groupSize(g)).map((rest) => [g, ...rest]) : []));
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

// Take away (Phase 22): what is on the mat goes home until the count is the
// target: single blocks from the right end of the row (the last one first), or
// the partners whose sizes add up to what has to go (validate() makes sure
// there is one such set). One block or partner a move, so a countdown passes
// each count on the way down.
function sendHome(target: number, initial: BenchState): ReadonlyArray<Command> {
  const gone = initial.bench.size - target;
  const placed = [...initial.groups.values()].filter((g) => g.unitIds.every((u) => initial.bench.has(u)));
  if (placed.length > 0) {
    const groups = partnersAddingUpTo(placed, gone);
    if (groups === undefined) {
      throw new Error(`content: no partners on the mat add up to the ${gone} to take away`);
    }
    return groups.map((g): Command => ({ type: 'returnGroup', groupId: g.id }));
  }
  const fromRight = [...initial.bench.entries()].sort(([, a], [, b]) => b.x - a.x || b.y - a.y).map(([unitId]) => unitId);
  return fromRight.slice(0, gone).map((unitId): Command => ({ type: 'return', unitId }));
}

// Pull apart (Phase 22): the row's last block moves one cell to the right,
// leaving a gap: 1 and the rest. Asked again (`ways`), the next block from the
// right moves up against it: 2 and the rest, then 3 and the rest. Each is a new
// split while k < total − k (validate() refuses more ways than that). The mat
// is one column wider than the row (bench.ts), so the first move always fits.
function pullApart(initial: BenchState, ways: number): ReadonlyArray<Command> {
  const row = [...initial.bench.entries()].sort(([, a], [, b]) => a.x - b.x || a.y - b.y);
  const commands: Command[] = [];
  for (let k = 1; k <= ways; k += 1) {
    const last = row[row.length - k];
    if (last === undefined) {
      throw new Error(`content: ${row.length} blocks cannot be split ${ways} ways`);
    }
    const [unitId, at] = last;
    commands.push({ type: 'move', unitId, to: cell(at.x + 1, at.y) });
  }
  return commands;
}

export function buildSolution(question: Question, initial: BenchState, steps: ReadonlyArray<Question> = [], ways = 1): ReadonlyArray<Command> {
  switch (question.kind) {
    case 'quantity': {
      // Blocks on the mat from the start: a take-away, down to the last count asked.
      if (initial.bench.size > 0) {
        const last = steps[steps.length - 1] ?? question;
        return sendHome(last.kind === 'quantity' ? last.target : question.target, initial);
      }
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
        // The first partners adding up to the target that cover the picture.
        const sets = setsAddingUpTo([...initial.groups.values()], question.target);
        if (sets.length === 0) {
          throw new Error(`content: no partners add up to ${question.target}`);
        }
        const covered = sets.map((groups) => cover(groups, template)).find((c) => c !== undefined);
        if (covered === undefined) {
          throw new Error(`content: no partners adding up to ${question.target} cover the picture`);
        }
        first = covered;
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
      const placed = [...initial.groups.values()].filter((g) => g.unitIds.every((u) => initial.bench.has(u)));
      if (placed.length > 1) {
        return sendAway(question, initial, placed);
      }
      const given = placed[0];
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
    case 'split':
      return pullApart(initial, ways);
  }
}
