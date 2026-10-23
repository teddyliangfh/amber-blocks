import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { cell as gridCell, clusters, groupSize } from '../core';
import type { BenchState, Cell, Command, Group, GroupId, UnitId } from '../core';
import { hueFor } from '../content';
import { cellToPx, countTarget, footprintOf, labelSpot, resolveDrop, settleOrigin } from './layout';
import type { Footprint, Rect, StageGeometry } from './layout';
import type { CheerMove } from './cheer';
import { BossOutline } from './BossOutline';
import { ShadowOutline } from './ShadowOutline';
import { DemoHand } from './DemoHand';
import type { Mood } from './Face';
import { CompareRail } from './CompareRail';
import { Spotlight } from './Spotlight';
import { planTray, trayView } from './tray';
import type { TrayObject } from './tray';
import { useCheer, useWheels } from './juice';
import { MERGE_BLINK_MS, MERGE_ON, MERGE_SEAM_MS, mergedClusters } from './merge';
import type { MergedCluster } from './merge';
import { THEME, colorsFor } from './palette';
import { NumberBadge, PartnerView } from './PartnerView';
import type { Badge } from './PartnerView';
import { UnitView } from './UnitView';
import type { DropResult, Translation } from './use-draggable';

export interface StageProps {
  readonly state: BenchState;
  readonly geometry: StageGeometry;
  // The tray's fixed objects, decided from the puzzle's starting material.
  readonly trayObjects: ReadonlyArray<TrayObject>;
  readonly enabled: boolean;
  // Counting numbers of the current round, by block.
  readonly countOrder: ReadonlyMap<UnitId, number>;
  // The stop is solved: faces smile and blocks hop once per tick.
  readonly matched: boolean;
  // How the faces on the mat feel about the answer (happy when solved,
  // puzzled when it needs a change). Left out: happy when matched, else calm.
  // Blocks waiting in the tray always doze.
  readonly mood?: Mood;
  readonly celebrateTick: number;
  // Commit a command; true when the core accepted it.
  readonly onCommand: (cmd: Command) => boolean;
  // Would the core accept it? Drives the snap preview only.
  readonly onPreview: (cmd: Command) => boolean;
  readonly onTapUnit: (unitId: UnitId) => void;
  // A block or partner waiting in the tray was tapped: it hops, and this hears
  // its number (1 for a block) to say (Phase 20 Q11). Never a count, never a move.
  readonly onTapTray?: (n: number) => void;
  // A finger is dragging something (true), or let go (false).
  readonly onDragActive?: (active: boolean) => void;
  // What a hand just felt, for sound: lifted something, set it on the bench,
  // put it back (or it flew back), or it would not fit there.
  readonly onFeel?: (feel: Feel) => void;
  // Partners (group ids) and single blocks (unit ids) a hint is about, ringed where they are.
  readonly spotlight?: ReadonlyArray<string>;
  // A new number shows the "like this" hand once (0: none).
  readonly demo?: number;
  // What the hand carries: a partner (group id) or block (unit id) waiting in
  // the tray, normally the first piece of the reference answer. Left out, or
  // not in the tray: the first block, else the first partner.
  readonly demoPiece?: string;
  // Where on the mat the hand puts it down (its top-left cell). Left out: the
  // middle of the mat. A stop that starts with a partner on the mat (Phase 19)
  // puts the other half right beside it instead of on top of it.
  readonly demoTo?: Cell;
  // The hand carries `demoPiece`, a partner on the mat, back to its outline in
  // the tray instead (Phase 21: send the extra away), or a single block on the
  // mat back to its bed (Phase 22: take away). A block on the mat with
  // `demoTo` and no `demoBack` is pulled from where it sits to that cell (a split).
  readonly demoBack?: boolean;
  // A counting round just finished (0: none): the counted blocks blink together once.
  readonly wink?: number;
  // Only the mat: no sandbox (finished work on show; pass no tray objects either).
  readonly trayHidden?: boolean;
  // What the blocks on the mat do on a solve (cheer.ts). 'tall-wave' is 17's
  // big partner's alone; the others hop beside it. 'car' puts wheels under the lot.
  readonly cheer?: CheerMove;
  // Joined pieces show as one number character (merge.ts): the screen says
  // when (MERGE_ON). A finger pulling a piece away splits its character at once.
  readonly merge?: boolean;
  // Sets of units that join only among themselves (merge.ts; D-097: each way
  // made of a sum asked several ways is its own character).
  readonly apart?: ReadonlyArray<ReadonlyArray<UnitId>>;
  // A character is joining: the parts it is made of and its total, for the join sound.
  readonly onJoin?: (parts: ReadonlyArray<number>, total: number) => void;
  // A boss's entrance (Phase 21): a dashed outline of the answer, `n` cells in
  // a row across the middle of the mat, its first `lit` cells lit. Scenery
  // under the pieces: no touch, no judging, no snapping (BossOutline).
  // `made`: the cells of ways already made that stand aside (D-097).
  readonly outline?: { readonly n: number; readonly lit: number; readonly made?: ReadonlyArray<Cell> };
  // A picture's shadow (Phase 23b, Shape Island): its cells on the mat, which
  // are lit (one flag a cell) and which glow for help, in the colour of `n`.
  // Scenery as the boss's outline is (ShadowOutline).
  readonly shadow?: { readonly n: number; readonly cells: ReadonlyArray<Cell>; readonly lit: ReadonlyArray<boolean>; readonly glow?: ReadonlyArray<Cell> };
  // Numbers that pop up above a block for a moment (free play: a group of blocks
  // just changed size). `tick` makes each one new.
  readonly bubbles?: ReadonlyArray<{ readonly at: Cell; readonly n: number; readonly tick: number }>;
  // A compare's partner on the rail above the mat (Phase 23c, CompareRail):
  // its number, and the id a spotlight names it by. The geometry must leave a
  // row above the bench for it (computeGeometry's `rail`).
  readonly rail?: { readonly n: number; readonly id: string };
}

// A seam between two joining pieces, lit for a moment (merge.ts MERGE_SEAM_MS).
function SeamGlow({ rect }: { readonly rect: Rect }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withSequence(withTiming(1, { duration: MERGE_SEAM_MS * 0.45 }), withTiming(0.3, { duration: MERGE_SEAM_MS * 0.55 })));
  }, [o]);
  const lit = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View pointerEvents="none" testID="merge-seam" style={[styles.seam, { left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: Math.min(rect.width, rect.height) / 2 }, lit]} />;
}

// How long a free-play number bubble stays up.
export const BUBBLE_MS = 800;

// A number popping up above a block for BUBBLE_MS, in the partner badge's look.
// Reduced motion: it only fades in and out.
function NumberBubble({ x, y, size, n, color }: { readonly x: number; readonly y: number; readonly size: number; readonly n: number; readonly color: string }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  const rise = useSharedValue(0);
  useEffect(() => {
    o.set(withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: BUBBLE_MS - 320 }), withTiming(0, { duration: 200 })));
    if (!reduced) {
      rise.set(withTiming(-size * 0.4, { duration: 240 }));
    }
  }, [o, rise, reduced, size]);
  const shown = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: rise.get() }] }));
  return (
    <Animated.View pointerEvents="none" testID="number-bubble" style={[{ position: 'absolute', left: x, top: y, width: size * 2, height: size }, shown]}>
      <NumberBadge badge={{ left: 0, top: 0, size, n }} color={color} testID={`number-bubble-${n}`} />
    </Animated.View>
  );
}

// How a piece looks: as itself, or as part of a joined character.
interface Look {
  readonly colors?: ReturnType<typeof colorsFor>;
  // Face on this cell of the mat, or none (null); left out: its own.
  readonly faceCell?: Cell | null;
  readonly badge?: Badge | null;
  readonly plateAround?: ReadonlyArray<Cell>;
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly index?: number;
  readonly look?: number;
  readonly wink?: number;
  // The solve's move waits while the character is still joining.
  readonly hold?: boolean;
}

type Intro = { readonly keys: ReadonlySet<string>; readonly phase: 'seam' | 'blink'; readonly tick: number };

// The 8 brick's wheels, under whatever sits on the mat, along for the drive.
function CarWheels({ box, cell, tick }: { readonly box: Rect; readonly cell: number; readonly tick: number }) {
  const ride = useCheer('car', tick, 0);
  const out = useWheels(tick);
  const shown = useAnimatedStyle(() => ({ opacity: out.get() }));
  const d = Math.round(cell * 0.5);
  return (
    <Animated.View pointerEvents="none" testID="car-wheels" style={[styles.wheels, { left: box.x, top: box.y + box.height - d * 0.45, width: box.width, height: d }, ride, shown]}>
      {[0.22, 0.78].map((f) => (
        <View key={f} style={[styles.wheel, { left: box.width * f - d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: Math.max(3, d * 0.22) }]} />
      ))}
    </Animated.View>
  );
}

export type Feel = 'pickup' | 'drop' | 'return' | 'blocked';

// A release that stayed on the bench lands; one that would not fit bonks; any other flies back.
function feelOf(result: DropResult, landing: 'bench' | 'tray' | 'none'): Feel {
  if (result === 'blocked') {
    return 'blocked';
  }
  return landing === 'bench' && (result === 'moved' || result === 'same') ? 'drop' : 'return';
}

interface Preview {
  readonly cells: ReadonlyArray<Cell>;
}

function allOnBench(state: BenchState, group: Group): boolean {
  return group.unitIds.every((u) => state.bench.has(u));
}

function headOf(cells: ReadonlyArray<Cell>): Cell {
  return cells.reduce((best, c) => (c.y < best.y || (c.y === best.y && c.x < best.x) ? c : best));
}

export function Stage({ state, geometry, trayObjects, enabled, countOrder, matched, mood: moodOf, celebrateTick, onCommand, onPreview, onTapUnit, onTapTray, onDragActive, onFeel, spotlight = [], demo = 0, demoPiece, demoTo: demoCell, demoBack = false, wink = 0, trayHidden = false, cheer = 'hop', merge = false, apart, onJoin, bubbles = [], outline, shadow, rail }: StageProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  // The last thing tapped in the tray, and its hop. Ticks count down from -1
  // so they never match a solve's (useCheer plays each tick once).
  const [poke, setPoke] = useState<{ readonly id: string; readonly tick: number } | null>(null);
  const pokeTray = useCallback(
    (id: string, n: number) => {
      setPoke((p) => ({ id, tick: (p?.tick ?? 0) - 1 }));
      onTapTray?.(n);
    },
    [onTapTray],
  );
  const clearPreview = useCallback(() => setPreview(null), []);
  // The first moments of a stop: everything drops in. Later mounts (a block
  // leaving a partner) just appear where they are.
  const [arriving, setArriving] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setArriving(false), 900);
    return () => clearTimeout(t);
  }, []);
  const enter = (i: number) => (arriving ? 80 + Math.min(i, 14) * 35 : undefined);
  const onActive = useCallback(
    (active: boolean) => {
      if (active) {
        onFeel?.('pickup');
      }
      onDragActive?.(active);
    },
    [onFeel, onDragActive],
  );

  // Joined characters (merge.ts). The piece a finger holds splits its own
  // character at once. `view` is what is drawn joined, and the one joining now
  // (its seams lit, then its faces turned to each other, blinking); `truth`
  // holds the same, ahead of the drawing, so the timers never act twice.
  const reduced = useReducedMotion();
  const [lifted, setLifted] = useState<string | null>(null);
  const merged = useMemo(() => (merge ? mergedClusters(state, apart) : []), [merge, state, apart]);
  const wanted = useMemo(() => merged.filter((c) => lifted === null || !c.pieces.some((p) => p.id === lifted)), [merged, lifted]);
  const [view, setView] = useState<{ readonly joined: ReadonlySet<string>; readonly intro: Intro | null }>(() => ({ joined: new Set(wanted.map((c) => c.key)), intro: null }));
  const truth = useRef(view);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The solve whose joining has played (each solve plays it once; the
  // character joining again after a drag just changes colour).
  const playedFor = useRef(celebrateTick);
  const introTicks = useRef(0);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const now = truth.current;
    const keys = new Set(wanted.map((c) => c.key));
    const broken = now.intro !== null && [...now.intro.keys].some((k) => !keys.has(k));
    const joined = new Set([...now.joined].filter((k) => keys.has(k)));
    const intro = broken ? null : now.intro;
    const pending = wanted.filter((c) => !joined.has(c.key) && !(intro?.keys.has(c.key) ?? false));
    if (!broken && joined.size === now.joined.size && pending.length === 0) {
      return;
    }
    const later = (ms: number, next: () => typeof now) => {
      timers.current.push(
        setTimeout(() => {
          truth.current = next();
          setView(truth.current);
        }, ms),
      );
    };
    if (broken) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    }
    const fresh = pending.length > 0 && (MERGE_ON === 'touch' || (celebrateTick > 0 && celebrateTick !== playedFor.current));
    if (fresh) {
      playedFor.current = celebrateTick;
    }
    if (!fresh || reduced) {
      // Joining again (or no motion): straight to one character.
      pending.forEach((c) => joined.add(c.key));
      truth.current = { joined, intro };
      later(0, () => truth.current);
      if (fresh) {
        onJoin?.(pending[0]!.parts, pending[0]!.total);
      }
      return;
    }
    const keysJoining = new Set(pending.map((c) => c.key));
    introTicks.current -= 1;
    const seam: Intro = { keys: keysJoining, phase: 'seam', tick: introTicks.current };
    truth.current = { joined, intro: seam };
    later(0, () => truth.current);
    later(MERGE_SEAM_MS, () => {
      // The join sound runs with the faces: its last, total note lands as the colours run into one.
      onJoin?.(pending[0]!.parts, pending[0]!.total);
      return { ...truth.current, intro: truth.current.intro === null ? null : { ...truth.current.intro, phase: 'blink' } };
    });
    later(MERGE_SEAM_MS + MERGE_BLINK_MS, () => ({ joined: new Set([...truth.current.joined, ...keysJoining]), intro: null }));
  }, [wanted, celebrateTick, reduced, onJoin]);
  const felt = useCallback(
    (result: DropResult, landing: 'bench' | 'tray' | 'none'): DropResult => {
      onFeel?.(feelOf(result, landing));
      return result;
    },
    [onFeel],
  );
  const mood: Mood = moodOf ?? (matched ? 'happy' : 'calm');

  // The tray layout is fixed for the stop; only who sits in it changes.
  const plan = useMemo(() => planTray(geometry, trayObjects), [geometry, trayObjects]);
  const tray = useMemo(() => trayView(plan, state), [plan, state]);

  // Partners and loose units on the bench, with where they rest right now.
  const model = useMemo(() => {
    const grouped = new Set<UnitId>();
    for (const g of state.groups.values()) {
      for (const u of g.unitIds) {
        grouped.add(u);
      }
    }
    const benchPartners = [...state.groups.values()].filter((g) => allOnBench(state, g));
    const looseOnBench = [...state.bench.keys()].filter((u) => !grouped.has(u));

    // Colour and face per cluster for loose blocks (AC-37: colour follows the real count).
    const clusterOf = new Map<UnitId, { size: number; head: Cell }>();
    for (const c of clusters(state)) {
      const loose = c.unitIds.filter((u) => !grouped.has(u));
      if (loose.length === 0) {
        continue;
      }
      const cells = loose.map((u) => state.bench.get(u) as Cell);
      const head = headOf(cells);
      for (const u of loose) {
        clusterOf.set(u, { size: loose.length, head });
      }
    }
    // Hop order on a solve: row by row, left to right.
    const order = new Map<string, number>();
    const benchThings: { id: string; cell: Cell }[] = [
      ...looseOnBench.map((u) => ({ id: u as string, cell: state.bench.get(u) as Cell })),
      ...benchPartners.map((g) => ({ id: g.id as string, cell: footprintOf(g.unitIds.map((u) => state.bench.get(u) as Cell)).origin })),
    ];
    benchThings.sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x).forEach((t, i) => order.set(t.id, i));
    return { benchPartners, looseOnBench, clusterOf, order };
  }, [state]);

  // Where a piece let go comes to rest (layout settleOrigin): there, else the
  // nearest free spot within a cell, a partner preferring one beside another.
  const settleAt = useCallback(
    (origin: Cell, footprint: Footprint, accepts: (o: Cell) => boolean, beside?: (o: Cell) => boolean): Cell | null =>
      settleOrigin(origin, footprint, geometry.bench.cols, geometry.bench.rows, accepts, beside),
    [geometry],
  );
  // Would the partner's cells at `origin` touch another partner on the bench?
  const besidePartner = useCallback(
    (group: Group, offsets: ReadonlyArray<Cell>) => (origin: Cell) => {
      const mine = offsets.map((o) => ({ x: origin.x + o.x, y: origin.y + o.y }));
      return [...state.groups.values()].some(
        (g) => g.id !== group.id && allOnBench(state, g) && g.unitIds.some((u) => {
          const c = state.bench.get(u)!;
          return mine.some((m) => Math.abs(m.x - c.x) + Math.abs(m.y - c.y) === 1);
        }),
      );
    },
    [state],
  );

  const unitCommand = (unitId: UnitId, onBench: boolean, to: Cell): Command => (onBench ? { type: 'move', unitId, to } : { type: 'take', unitId, to });

  const dropUnit = useCallback(
    (unitId: UnitId, rest: { x: number; y: number }, onBench: boolean, t: Translation): DropResult => {
      setPreview(null);
      const target = resolveDrop(geometry, { x: rest.x + t.dx, y: rest.y + t.dy }, { w: 1, h: 1 });
      if (target.kind === 'none') {
        return felt('rejected', 'none');
      }
      if (target.kind === 'tray') {
        return felt(onBench ? (onCommand({ type: 'return', unitId }) ? 'moved' : 'rejected') : 'same', 'tray');
      }
      const current = state.bench.get(unitId);
      const same = (c: Cell) => current !== undefined && current.x === c.x && current.y === c.y;
      if (same(target.origin)) {
        return felt('same', 'bench');
      }
      const at = settleAt(target.origin, { w: 1, h: 1 }, (o) => onPreview(unitCommand(unitId, onBench, o)));
      if (at === null) {
        return felt('blocked', 'bench');
      }
      if (same(at)) {
        return felt('same', 'bench');
      }
      return felt(onCommand(unitCommand(unitId, onBench, at)) ? 'moved' : 'blocked', 'bench');
    },
    [geometry, onCommand, onPreview, state.bench, felt, settleAt],
  );

  const previewUnit = useCallback(
    (unitId: UnitId, rest: { x: number; y: number }, onBench: boolean, t: Translation) => {
      const target = resolveDrop(geometry, { x: rest.x + t.dx, y: rest.y + t.dy }, { w: 1, h: 1 });
      if (target.kind !== 'bench') {
        setPreview(null);
        return;
      }
      const at = settleAt(target.origin, { w: 1, h: 1 }, (o) => onPreview(unitCommand(unitId, onBench, o)));
      setPreview(at === null ? null : { cells: [at] });
    },
    [geometry, onPreview, settleAt],
  );

  const dropPartner = useCallback(
    (group: Group, rest: { x: number; y: number }, onBench: boolean, t: Translation): DropResult => {
      setPreview(null);
      const offsets = onBench ? footprintOf(group.unitIds.map((u) => state.bench.get(u) as Cell)) : footprintOf(group.shape);
      const target = resolveDrop(geometry, { x: rest.x + t.dx, y: rest.y + t.dy }, offsets.footprint);
      if (target.kind === 'none') {
        return felt('rejected', 'none');
      }
      if (target.kind === 'tray') {
        return felt(onBench ? (onCommand({ type: 'returnGroup', groupId: group.id }) ? 'moved' : 'rejected') : 'same', 'tray');
      }
      const command = (o: Cell): Command =>
        onBench ? { type: 'moveGroup', groupId: group.id, delta: { x: o.x - offsets.origin.x, y: o.y - offsets.origin.y } } : { type: 'takeGroup', groupId: group.id, origin: o };
      const same = (o: Cell) => onBench && o.x === offsets.origin.x && o.y === offsets.origin.y;
      if (same(target.origin)) {
        return felt('same', 'bench');
      }
      const at = settleAt(target.origin, offsets.footprint, (o) => onPreview(command(o)), besidePartner(group, offsets.offsets));
      if (at === null) {
        return felt('blocked', 'bench');
      }
      if (same(at)) {
        return felt('same', 'bench');
      }
      return felt(onCommand(command(at)) ? 'moved' : 'blocked', 'bench');
    },
    [geometry, onCommand, onPreview, state.bench, felt, settleAt, besidePartner],
  );

  const previewPartner = useCallback(
    (group: Group, rest: { x: number; y: number }, onBench: boolean, t: Translation) => {
      const offsets = onBench ? footprintOf(group.unitIds.map((u) => state.bench.get(u) as Cell)) : footprintOf(group.shape);
      const target = resolveDrop(geometry, { x: rest.x + t.dx, y: rest.y + t.dy }, offsets.footprint);
      if (target.kind !== 'bench') {
        setPreview(null);
        return;
      }
      const command = (o: Cell): Command =>
        onBench ? { type: 'moveGroup', groupId: group.id, delta: { x: o.x - offsets.origin.x, y: o.y - offsets.origin.y } } : { type: 'takeGroup', groupId: group.id, origin: o };
      const at = settleAt(target.origin, offsets.footprint, (o) => onPreview(command(o)), besidePartner(group, offsets.offsets));
      setPreview(at === null ? null : { cells: offsets.offsets.map((o) => ({ x: at.x + o.x, y: at.y + o.y })) });
    },
    [geometry, onPreview, state.bench, settleAt, besidePartner],
  );

  const { cell, bench, tray: trayRect } = geometry;
  // Where each lit thing rests right now, in the tray or on the bench.
  const rings = useMemo(() => {
    const out: { id: string; rect: Rect }[] = [];
    for (const id of spotlight) {
      const inTray = tray.partners.find((p) => p.group.id === id);
      const onBench = model.benchPartners.find((g) => g.id === id);
      const unitInTray = tray.units.find((u) => u.unitId === id);
      const unitOnBench = state.bench.get(id as UnitId);
      if (rail !== undefined && id === rail.id) {
        out.push({ id, rect: { x: geometry.bench.x, y: geometry.bench.y - cell, width: rail.n * cell, height: cell } });
      } else if (inTray !== undefined) {
        const fp = footprintOf(inTray.group.shape).footprint;
        const unit = cell * inTray.spot.scale;
        out.push({ id, rect: { x: inTray.spot.x, y: inTray.spot.y, width: fp.w * unit, height: fp.h * unit } });
      } else if (onBench !== undefined) {
        const fp = footprintOf(onBench.unitIds.map((u) => state.bench.get(u) as Cell));
        const at = cellToPx(geometry, fp.origin);
        out.push({ id, rect: { x: at.x, y: at.y, width: fp.footprint.w * cell, height: fp.footprint.h * cell } });
      } else if (unitInTray !== undefined) {
        const unit = cell * unitInTray.spot.scale;
        out.push({ id, rect: { x: unitInTray.spot.x, y: unitInTray.spot.y, width: unit, height: unit } });
      } else if (unitOnBench !== undefined) {
        const at = cellToPx(geometry, unitOnBench);
        out.push({ id, rect: { x: at.x, y: at.y, width: cell, height: cell } });
      }
    }
    return out;
  }, [spotlight, tray, model, state.bench, cell, geometry, rail]);
  const gridDots = useMemo(() => {
    const dots: { key: string; x: number; y: number }[] = [];
    for (let i = 1; i < bench.cols; i += 1) {
      for (let j = 1; j < bench.rows; j += 1) {
        dots.push({ key: `d${i},${j}`, x: bench.x + i * cell, y: bench.y + j * cell });
      }
    }
    return dots;
  }, [bench, cell]);

  const partnerKey = (id: GroupId) => id as string;
  // Counting taps forgive a finger that lands a little off (countTarget).
  const tapAt = (hit: UnitId | null, rest: { x: number; y: number }, point: { readonly x: number; readonly y: number }) => {
    const target = countTarget(geometry, state.bench, countOrder, hit, { x: rest.x + point.x, y: rest.y + point.y });
    if (target !== null) {
      onTapUnit(target);
    }
  };

  // One array per kind, keyed by identity, so a block keeps its view (and its
  // momentum) when it moves between the tray and the bench: it flies and lands
  // instead of vanishing from one list and appearing in the other.
  // Each piece on the mat as part of a joined character: one colour, one face,
  // one badge, one plate, moving as one about the character's middle.
  const { looks, seams } = useMemo(() => {
    const out = new Map<string, Look>();
    const lit: { key: string; rect: Rect }[] = [];
    wanted.forEach((c: MergedCluster) => {
      const joined = view.joined.has(c.key);
      const intro = view.intro !== null && view.intro.keys.has(c.key) ? view.intro : null;
      const index = Math.min(...c.pieces.map((p) => model.order.get(p.id) ?? 0));
      const centre = { x: c.origin.x + c.width / 2, y: c.origin.y + c.height / 2 };
      const cluster = c.cells.map((x) => ({ x: x.x - c.origin.x, y: x.y - c.origin.y }));
      const spot = labelSpot(cluster, cell);
      const top = Math.min(...c.cells.map((x) => x.y));
      const tail = c.cells.filter((x) => x.y === top).reduce((a, b) => (b.x > a.x ? b : a));
      for (const piece of c.pieces) {
        const at = footprintOf(piece.units.map((u) => state.bench.get(u)!)).origin;
        const holdsTail = piece.units.some((u) => {
          const x = state.bench.get(u)!;
          return x.x === tail.x && x.y === tail.y;
        });
        if (joined) {
          out.set(piece.id, {
            colors: colorsFor(hueFor(c.total)),
            faceCell: c.head,
            badge: holdsTail ? { left: spot.left - (at.x - c.origin.x) * cell, top: spot.top - (at.y - c.origin.y) * cell, size: spot.size, n: c.total } : null,
            plateAround: c.cells.map((x) => ({ x: x.x - at.x, y: x.y - at.y })),
            pivot: { x: (centre.x - at.x) * cell, y: (centre.y - at.y) * cell },
            index,
          });
        } else if (intro !== null) {
          const mid = footprintOf(piece.units.map((u) => state.bench.get(u)!));
          const pieceCentre = mid.origin.x + mid.footprint.w / 2;
          out.set(piece.id, { hold: true, look: intro.phase === 'blink' ? Math.sign(centre.x - pieceCentre) : 0, wink: intro.phase === 'blink' ? intro.tick : undefined });
        }
      }
      if (intro !== null && intro.phase === 'seam') {
        const bar = Math.max(4, Math.round(cell * 0.14));
        c.seams.forEach(([a, b], i) => {
          const p = cellToPx(geometry, b);
          lit.push({
            key: `${c.key}#${i}`,
            rect: a.x !== b.x ? { x: p.x - bar / 2, y: p.y + cell * 0.14, width: bar, height: cell * 0.72 } : { x: p.x + cell * 0.14, y: p.y - bar / 2, width: cell * 0.72, height: bar },
          });
        });
      }
    });
    return { looks: out, seams: lit };
  }, [wanted, view, model, state, cell, geometry]);
  // The piece a finger holds, for its character to split.
  const holding = (id: string) => (active: boolean) => {
    setLifted(active ? id : null);
    onActive(active);
  };

  const units = [
    ...tray.units.map(({ unitId, spot: p }, i) => {
      const rest = { x: p.x, y: p.y };
      return (
        <UnitView
          key={unitId as string}
          size={cell}
          colors={colorsFor(state.units.get(unitId)?.hue ?? 'n10')}
          // A single block dozes in the tray and wakes when it is picked up.
          face
          mood="sleepy"
          countIndex={null}
          celebrateTick={poke?.id === unitId ? poke.tick : 0}
          index={0}
          drag={{
            rest,
            restScale: p.scale,
            liftScale: 1.08,
            cellSize: cell,
            enabled,
            enterDelay: enter(i),
            onDrop: (t) => dropUnit(unitId, rest, false, t),
            onMove: (t) => previewUnit(unitId, rest, false, t),
            onCancel: clearPreview,
            onTap: () => pokeTray(unitId, 1),
            onActive,
          }}
        />
      );
    }),
    ...model.looseOnBench.map((unitId) => {
      const c = state.bench.get(unitId) as Cell;
      const rest = cellToPx(geometry, c);
      const info = model.clusterOf.get(unitId);
      const size = info?.size ?? 1;
      const isHead = info !== undefined && info.head.x === c.x && info.head.y === c.y;
      const order = model.order.get(unitId as string) ?? 0;
      const look = looks.get(unitId as string);
      const joined = look?.colors !== undefined;
      return (
        <UnitView
          key={unitId as string}
          size={cell}
          colors={look?.colors ?? colorsFor(hueFor(size))}
          face={look?.faceCell === undefined ? isHead : look.faceCell !== null && look.faceCell.x === c.x && look.faceCell.y === c.y}
          mood={mood}
          countIndex={countOrder.get(unitId) ?? null}
          celebrateTick={look?.hold === true ? 0 : celebrateTick}
          cheer={cheer === 'tall-wave' && !joined ? 'hop' : cheer}
          wink={look?.wink ?? (countOrder.has(unitId) ? wink : 0)}
          index={look?.index ?? order}
          badge={look?.badge ?? null}
          plateAround={look?.plateAround}
          look={look?.look ?? 0}
          pivot={look?.pivot}
          drag={{
            rest,
            restScale: 1,
            liftScale: 1.08,
            cellSize: cell,
            enabled,
            enterDelay: enter(order),
            onDrop: (t) => dropUnit(unitId, rest, true, t),
            onMove: (t) => previewUnit(unitId, rest, true, t),
            onCancel: clearPreview,
            onTap: (point) => tapAt(unitId, rest, point),
            onActive: holding(unitId as string),
          }}
        />
      );
    }),
  ];
  const partners = [
    ...tray.partners.map(({ group, spot: p }, i) => {
      const rest = { x: p.x, y: p.y };
      return (
        <PartnerView
          key={partnerKey(group.id)}
          cell={cell}
          offsets={footprintOf(group.shape).offsets}
          colors={colorsFor(hueFor(groupSize(group)))}
          label={groupSize(group)}
          mood="calm"
          celebrateTick={poke?.id === group.id ? poke.tick : 0}
          index={0}
          drag={{
            rest,
            restScale: p.scale,
            liftScale: 1,
            cellSize: cell,
            enabled,
            enterDelay: enter(tray.units.length + i),
            onDrop: (t) => dropPartner(group, rest, false, t),
            onMove: (t) => previewPartner(group, rest, false, t),
            onCancel: clearPreview,
            onTap: () => pokeTray(group.id, groupSize(group)),
            onActive,
          }}
        />
      );
    }),
    ...model.benchPartners.map((group) => {
      const fp = footprintOf(group.unitIds.map((u) => state.bench.get(u) as Cell));
      const rest = cellToPx(geometry, fp.origin);
      const order = model.order.get(group.id as string) ?? 0;
      const look = looks.get(group.id as string);
      const joined = look?.colors !== undefined;
      const cells = group.unitIds.map((u) => state.bench.get(u) as Cell);
      return (
        <PartnerView
          key={partnerKey(group.id)}
          cell={cell}
          offsets={fp.offsets}
          counts={group.unitIds.map((u) => countOrder.get(u) ?? null)}
          wink={look?.wink ?? (group.unitIds.some((u) => countOrder.has(u)) ? wink : 0)}
          onTapBlock={(i, point) => tapAt(group.unitIds[i] ?? null, rest, point)}
          colors={look?.colors ?? colorsFor(hueFor(groupSize(group)))}
          label={groupSize(group)}
          mood={mood}
          celebrateTick={look?.hold === true ? 0 : celebrateTick}
          cheer={cheer === 'tall-wave' && groupSize(group) < 10 && !joined ? 'hop' : cheer}
          index={look?.index ?? order}
          faceAt={look?.faceCell === undefined ? undefined : look.faceCell === null ? -1 : cells.findIndex((x) => x.x === look.faceCell!.x && x.y === look.faceCell!.y)}
          badge={look?.badge}
          plateAround={look?.plateAround}
          look={look?.look ?? 0}
          pivot={look?.pivot}
          drag={{
            rest,
            restScale: 1,
            liftScale: 1.04,
            cellSize: cell,
            enabled,
            enterDelay: enter(order),
            onDrop: (t) => dropPartner(group, rest, true, t),
            onMove: (t) => previewPartner(group, rest, true, t),
            onCancel: clearPreview,
            onActive: holding(group.id as string),
          }}
        />
      );
    }),
  ];
  const slotRadius = (side: number) => Math.round(side * 0.28);
  // The demo carries the piece it was given, whole, from where it waits in the
  // tray to the middle of the mat; else whatever waits first.
  const asPartner = (p: (typeof tray.partners)[number]) => ({
    at: { x: p.spot.x, y: p.spot.y },
    colors: colorsFor(hueFor(groupSize(p.group))),
    cells: footprintOf(p.group.shape).offsets,
    scale: p.spot.scale,
  });
  const asUnit = (u: (typeof tray.units)[number]) => ({ at: { x: u.spot.x, y: u.spot.y }, colors: colorsFor(state.units.get(u.unitId)?.hue ?? 'n10'), cells: [gridCell(0, 0)], scale: u.spot.scale });
  // Back to the tray: from where the partner sits on the mat, full size, to its outline.
  const backGroup = demoBack && demoPiece !== undefined ? state.groups.get(demoPiece as GroupId) : undefined;
  const backHome = backGroup !== undefined && allOnBench(state, backGroup) ? plan.spots.get(backGroup.id) : undefined;
  // A single block on the mat (Phase 22): back to its bed, or pulled to `demoTo`.
  const benchUnitCell = demoPiece !== undefined && !model.looseOnBench.includes(demoPiece as UnitId) ? undefined : state.bench.get(demoPiece as UnitId);
  const unitHome = demoPiece === undefined ? undefined : state.home.get(demoPiece as UnitId);
  const benchUnitHome = demoBack && benchUnitCell !== undefined && unitHome !== undefined ? plan.slotSpots.get(unitHome) : undefined;
  const benchUnit =
    benchUnitCell !== undefined
      ? {
          at: cellToPx(geometry, benchUnitCell),
          colors: colorsFor(hueFor(model.clusterOf.get(demoPiece as UnitId)?.size ?? 1)),
          cells: [gridCell(0, 0)],
          scale: 1,
        }
      : null;
  const back =
    backGroup !== undefined && backHome !== undefined
      ? {
          at: cellToPx(geometry, footprintOf(backGroup.unitIds.map((u) => state.bench.get(u)!)).origin),
          colors: colorsFor(hueFor(groupSize(backGroup))),
          cells: footprintOf(backGroup.shape).offsets,
          scale: 1,
          home: backHome,
        }
      : benchUnit !== null && benchUnitHome !== undefined
        ? { ...benchUnit, home: benchUnitHome }
        : null;
  const givenPartner = tray.partners.find((p) => p.group.id === demoPiece);
  const givenUnit = tray.units.find((u) => u.unitId === demoPiece);
  const demoFrom =
    back !== null
      ? back
      : benchUnit !== null && demoCell !== undefined
        ? benchUnit
        : givenPartner !== undefined
          ? asPartner(givenPartner)
          : givenUnit !== undefined
            ? asUnit(givenUnit)
            : tray.units[0] !== undefined
              ? asUnit(tray.units[0])
              : tray.partners[0] !== undefined
                ? asPartner(tray.partners[0])
                : null;
  const demoTo = (() => {
    if (demoFrom === null) {
      return null;
    }
    if (back !== null) {
      return { x: back.home.x, y: back.home.y };
    }
    if (demoCell !== undefined) {
      return cellToPx(geometry, demoCell);
    }
    const fp = footprintOf(demoFrom.cells);
    return cellToPx(geometry, gridCell(Math.floor((bench.cols - fp.footprint.w) / 2), Math.floor((bench.rows - fp.footprint.h) / 2)));
  })();

  return (
    <View style={styles.stage} pointerEvents="box-none">
      {/* A felt mat in a wooden frame, with a stitched edge. */}
      <View style={[styles.benchFrame, { left: bench.x - FRAME, top: bench.y - FRAME, width: bench.width + 2 * FRAME, height: bench.height + 2 * FRAME }]} />
      <View testID="bench" style={[styles.bench, { left: bench.x, top: bench.y, width: bench.width, height: bench.height }]} />
      <View style={[styles.stitch, { left: bench.x + 5, top: bench.y + 5, width: bench.width - 10, height: bench.height - 10 }]} />
      {gridDots.map((d) => (
        <View key={d.key} style={[styles.gridDot, { left: d.x - 2.5, top: d.y - 2.5 }]} />
      ))}
      {/* A sandbox with a few specks of sand in its lower part. */}
      {trayHidden ? null : (
        <View testID="tray" style={[styles.tray, { left: trayRect.x, top: trayRect.y, width: trayRect.width, height: trayRect.height }]}>
          {trayRect.height > 90
            ? SPECKS.map(([fx, fy, w, h], i) => (
                <View key={i} style={[styles.speck, { left: fx * trayRect.width - w / 2, top: fy * trayRect.height - h / 2, width: w, height: h, borderRadius: h / 2 }]} />
              ))
            : null}
        </View>
      )}
      {tray.emptySlots.map((p) => {
        const side = cell * p.scale - 8;
        return <View key={`e${p.id}`} style={[styles.emptySlot, { left: p.x + 4, top: p.y + 4, width: side, height: side, borderRadius: slotRadius(side) }]} />;
      })}
      {tray.emptyPartners.flatMap(({ spot, cells }) =>
        cells.map((c) => {
          const unit = cell * spot.scale;
          return <View key={`e${spot.id}-${c.x},${c.y}`} style={[styles.emptySlot, { left: spot.x + c.x * unit + 4, top: spot.y + c.y * unit + 4, width: unit - 8, height: unit - 8, borderRadius: slotRadius(unit - 8) }]} />;
        }),
      )}
      {outline !== undefined ? <BossOutline geometry={geometry} n={outline.n} lit={outline.lit} made={outline.made} colors={colorsFor(hueFor(outline.n))} /> : null}
      {rail !== undefined ? <CompareRail geometry={geometry} n={rail.n} colors={colorsFor(hueFor(rail.n))} celebrateTick={celebrateTick} onTap={onTapTray} /> : null}
      {shadow !== undefined ? <ShadowOutline geometry={geometry} cells={shadow.cells} lit={shadow.lit} glow={shadow.glow} colors={colorsFor(hueFor(shadow.n))} /> : null}
      {preview?.cells.map((c) => {
        const p = cellToPx(geometry, c);
        return <View key={`p${c.x},${c.y}`} style={[styles.preview, { left: p.x + 3, top: p.y + 3, width: cell - 6, height: cell - 6, borderRadius: slotRadius(cell - 6) }]} />;
      })}

      {/* The wheels wait for the brick to finish joining, then drive with it. */}
      {cheer === 'car' && celebrateTick > 0 && state.bench.size > 0 && view.intro === null ? (
        <CarWheels
          key={celebrateTick}
          tick={celebrateTick}
          cell={cell}
          box={(() => {
            const fp = footprintOf([...state.bench.values()]);
            const at = cellToPx(geometry, fp.origin);
            return { x: at.x, y: at.y, width: fp.footprint.w * cell, height: fp.footprint.h * cell };
          })()}
        />
      ) : null}
      {units}
      {partners}
      {seams.map((x) => (
        <SeamGlow key={x.key} rect={x.rect} />
      ))}
      {bubbles.map((b) => {
        const at = cellToPx(geometry, b.at);
        const size = Math.max(18, Math.round(cell * 0.5));
        return <NumberBubble key={`b${b.tick}-${b.at.x},${b.at.y}`} x={at.x + (cell - size) / 2} y={at.y - size * 0.8} size={size} n={b.n} color={colorsFor(hueFor(b.n)).deep} />;
      })}

      {demo > 0 && demoFrom !== null && demoTo !== null ? (
        <DemoHand key={demo} from={demoFrom.at} to={demoTo} cell={cell} colors={demoFrom.colors} cells={demoFrom.cells} fromScale={demoFrom.scale} toScale={back !== null ? back.home.scale : 1} />
      ) : null}
      {rings.map((r) => (
        <Spotlight key={`s${r.id}`} rect={r.rect} />
      ))}
    </View>
  );
}

// Sand specks in the tray's lower part: [x, y] as fractions of the tray, then w, h in px.
const SPECKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.12, 0.8, 12, 7],
  [0.3, 0.92, 8, 5],
  [0.5, 0.84, 10, 6],
  [0.68, 0.93, 7, 4],
  [0.86, 0.82, 12, 7],
  [0.2, 0.7, 6, 4],
  [0.78, 0.7, 7, 4],
];
const FRAME = 7;

const styles = StyleSheet.create({
  stage: { flex: 1, position: 'relative', overflow: 'visible' },
  benchFrame: { position: 'absolute', backgroundColor: THEME.wood, borderRadius: 24, boxShadow: `0 5px 0 ${THEME.woodDeep}` },
  bench: { position: 'absolute', backgroundColor: THEME.felt, borderRadius: 18, boxShadow: 'inset 0 3px 0 rgba(176,122,69,0.16)' },
  stitch: { position: 'absolute', borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: THEME.stitch },
  gridDot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: THEME.stitch },
  tray: {
    position: 'absolute',
    backgroundColor: THEME.sand,
    borderRadius: 22,
    borderWidth: 5,
    borderColor: THEME.wood,
    boxShadow: `0 5px 0 ${THEME.woodDeep}, inset 0 5px 0 rgba(176,122,69,0.22)`,
    overflow: 'hidden',
  },
  speck: { position: 'absolute', backgroundColor: THEME.sandSpeck },
  // Where something came from stays pressed into the sand, so the child can put it back.
  emptySlot: { position: 'absolute', backgroundColor: 'rgba(201,148,79,0.22)', borderWidth: 1.5, borderColor: 'rgba(201,148,79,0.35)', boxShadow: 'inset 0 3px 0 rgba(120,80,30,0.16)' },
  preview: { position: 'absolute', backgroundColor: THEME.previewFill, borderWidth: 2, borderColor: THEME.preview, borderStyle: 'dashed' },
  wheels: { position: 'absolute' },
  // A seam lighting up as two pieces join: a soft white bar.
  seam: { position: 'absolute', backgroundColor: '#FFFFFF', boxShadow: '0 0 8px 3px rgba(255,255,255,0.9)' },
  wheel: { position: 'absolute', top: 0, backgroundColor: '#5A5F6B', borderColor: '#2E323B' },
});
