import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { cell as gridCell, clusters, groupSize } from '../core';
import type { BenchState, Cell, Command, Group, GroupId, UnitId } from '../core';
import { hueFor } from '../content';
import { cellToPx, countTarget, footprintOf, resolveDrop } from './layout';
import type { Rect, StageGeometry } from './layout';
import type { CheerMove } from './cheer';
import { DemoHand } from './DemoHand';
import type { Mood } from './Face';
import { Spotlight } from './Spotlight';
import { planTray, trayView } from './tray';
import type { TrayObject } from './tray';
import { useCheer, useWheels } from './juice';
import { THEME, colorsFor } from './palette';
import { PartnerView } from './PartnerView';
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
  // A counting round just finished (0: none): the counted blocks blink together once.
  readonly wink?: number;
  // Only the mat: no sandbox (finished work on show; pass no tray objects either).
  readonly trayHidden?: boolean;
  // What the blocks on the mat do on a solve (cheer.ts). 'tall-wave' is 17's
  // big partner's alone; the others hop beside it. 'car' puts wheels under the lot.
  readonly cheer?: CheerMove;
}

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

export function Stage({ state, geometry, trayObjects, enabled, countOrder, matched, mood: moodOf, celebrateTick, onCommand, onPreview, onTapUnit, onDragActive, onFeel, spotlight = [], demo = 0, demoPiece, demoTo: demoCell, wink = 0, trayHidden = false, cheer = 'hop' }: StageProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
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
      if (current !== undefined && current.x === target.origin.x && current.y === target.origin.y) {
        return felt('same', 'bench');
      }
      const cmd: Command = onBench ? { type: 'move', unitId, to: target.origin } : { type: 'take', unitId, to: target.origin };
      return felt(onCommand(cmd) ? 'moved' : 'blocked', 'bench');
    },
    [geometry, onCommand, state.bench, felt],
  );

  const previewUnit = useCallback(
    (unitId: UnitId, rest: { x: number; y: number }, onBench: boolean, t: Translation) => {
      const target = resolveDrop(geometry, { x: rest.x + t.dx, y: rest.y + t.dy }, { w: 1, h: 1 });
      if (target.kind !== 'bench') {
        setPreview(null);
        return;
      }
      const cmd: Command = onBench ? { type: 'move', unitId, to: target.origin } : { type: 'take', unitId, to: target.origin };
      setPreview(onPreview(cmd) ? { cells: [target.origin] } : null);
    },
    [geometry, onPreview],
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
      if (!onBench) {
        return felt(onCommand({ type: 'takeGroup', groupId: group.id, origin: target.origin }) ? 'moved' : 'blocked', 'bench');
      }
      const delta = { x: target.origin.x - offsets.origin.x, y: target.origin.y - offsets.origin.y };
      if (delta.x === 0 && delta.y === 0) {
        return felt('same', 'bench');
      }
      return felt(onCommand({ type: 'moveGroup', groupId: group.id, delta }) ? 'moved' : 'blocked', 'bench');
    },
    [geometry, onCommand, state.bench, felt],
  );

  const previewPartner = useCallback(
    (group: Group, rest: { x: number; y: number }, onBench: boolean, t: Translation) => {
      const offsets = onBench ? footprintOf(group.unitIds.map((u) => state.bench.get(u) as Cell)) : footprintOf(group.shape);
      const target = resolveDrop(geometry, { x: rest.x + t.dx, y: rest.y + t.dy }, offsets.footprint);
      if (target.kind !== 'bench') {
        setPreview(null);
        return;
      }
      const cmd: Command = onBench
        ? { type: 'moveGroup', groupId: group.id, delta: { x: target.origin.x - offsets.origin.x, y: target.origin.y - offsets.origin.y } }
        : { type: 'takeGroup', groupId: group.id, origin: target.origin };
      setPreview(onPreview(cmd) ? { cells: offsets.offsets.map((o) => ({ x: target.origin.x + o.x, y: target.origin.y + o.y })) } : null);
    },
    [geometry, onPreview, state.bench],
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
      if (inTray !== undefined) {
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
  }, [spotlight, tray, model, state.bench, cell, geometry]);
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
          celebrateTick={0}
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
      return (
        <UnitView
          key={unitId as string}
          size={cell}
          colors={colorsFor(hueFor(size))}
          face={isHead}
          mood={mood}
          countIndex={countOrder.get(unitId) ?? null}
          celebrateTick={celebrateTick}
          cheer={cheer === 'tall-wave' ? 'hop' : cheer}
          wink={countOrder.has(unitId) ? wink : 0}
          index={order}
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
            onActive,
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
          celebrateTick={0}
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
            onActive,
          }}
        />
      );
    }),
    ...model.benchPartners.map((group) => {
      const fp = footprintOf(group.unitIds.map((u) => state.bench.get(u) as Cell));
      const rest = cellToPx(geometry, fp.origin);
      const order = model.order.get(group.id as string) ?? 0;
      return (
        <PartnerView
          key={partnerKey(group.id)}
          cell={cell}
          offsets={fp.offsets}
          counts={group.unitIds.map((u) => countOrder.get(u) ?? null)}
          wink={group.unitIds.some((u) => countOrder.has(u)) ? wink : 0}
          onTapBlock={(i, point) => tapAt(group.unitIds[i] ?? null, rest, point)}
          colors={colorsFor(hueFor(groupSize(group)))}
          label={groupSize(group)}
          mood={mood}
          celebrateTick={celebrateTick}
          cheer={cheer === 'tall-wave' && groupSize(group) < 10 ? 'hop' : cheer}
          index={order}
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
            onActive,
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
  const givenPartner = tray.partners.find((p) => p.group.id === demoPiece);
  const givenUnit = tray.units.find((u) => u.unitId === demoPiece);
  const demoFrom =
    givenPartner !== undefined
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
      {preview?.cells.map((c) => {
        const p = cellToPx(geometry, c);
        return <View key={`p${c.x},${c.y}`} style={[styles.preview, { left: p.x + 3, top: p.y + 3, width: cell - 6, height: cell - 6, borderRadius: slotRadius(cell - 6) }]} />;
      })}

      {cheer === 'car' && celebrateTick > 0 && state.bench.size > 0 ? (
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

      {demo > 0 && demoFrom !== null && demoTo !== null ? (
        <DemoHand key={demo} from={demoFrom.at} to={demoTo} cell={cell} colors={demoFrom.colors} cells={demoFrom.cells} fromScale={demoFrom.scale} />
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
  wheel: { position: 'absolute', top: 0, backgroundColor: '#5A5F6B', borderColor: '#2E323B' },
});
