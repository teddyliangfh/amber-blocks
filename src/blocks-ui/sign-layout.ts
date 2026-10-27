import { sideShape } from '../content';
import type { SideShape, SignRound, SignSideView } from '../content';
import type { Rect } from './layout';

// Compare Island's stage (Phase 23d, design docs/mockups/compare-island-signs.html):
// two numbers standing on their plates, the slot for the sign between the
// plates (one line that reads "4 □ 1"), and below them the tray of sign
// blocks (beside them, standing, in landscape). Everything here is px in the
// stage area LevelScreen measures (the space between the card and the footer,
// or right of the side column).

// The three sizes the level screen has (chrome.ts): a tall portrait phone, a
// short one, and landscape. `sign`: a sign block's side (the biggest thing on
// the stage, so the thing to pick up); `cap`: the biggest a number's block
// gets, a size under the sign's.
export const SIGN_SIZES = {
  regular: { sign: 68, cap: 48 },
  compact: { sign: 58, cap: 44 },
  side: { sign: 56, cap: 44 },
} as const;
export type SignSize = keyof typeof SIGN_SIZES;

// The slot is the sign with a ring of room around it; the gap between a plate
// and the slot; the tray's padding and the room between its signs.
const SLOT_ROOM = 8;
const PAD = 10;
const SIGN_GAP = { row: 16, column: 12 } as const;

export interface SignGeometry {
  readonly size: SignSize;
  // A sign block's side, a plate's height and least width, a number block's cell.
  readonly sign: number;
  readonly plate: { readonly height: number; readonly minWidth: number };
  readonly cell: number;
  readonly gap: number;
  // The felt board the plates and the slot sit on.
  readonly board: Rect;
  // The tray, and where each sign block rests in it, in tray order.
  readonly tray: Rect & { readonly standing: boolean };
  readonly homes: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  // The top of the sentence line (the slot's top) and of the plates.
  readonly lineTop: number;
  readonly plateTop: number;
  // The room the line leaves for the numbers to stand in, and how wide the line can be.
  readonly row: { readonly left: number; readonly width: number };
}

export interface SidePlace {
  readonly side: SignSideView;
  readonly shape: SideShape;
  // Its plate (the number), and its blocks' box standing on the plate.
  readonly plate: Rect;
  readonly blocks: Rect;
}

export interface RoundPlace {
  readonly left: SidePlace;
  readonly right: SidePlace;
  readonly slot: Rect;
  // Where a sign block sits in the slot.
  readonly signAt: { readonly x: number; readonly y: number };
}

function sidesOf(round: SignRound): readonly [SideShape, SideShape] {
  return [sideShape(round.left), sideShape(round.right)];
}

// The stage for a whole stop: one cell size for every round (so the next pair
// slides in the same size) and both sides (so heights compare fairly), the
// biggest that fits the tallest side above the line and the widest pair across it.
export function signGeometry(width: number, height: number, rounds: ReadonlyArray<SignRound>, signs: number, size: SignSize): SignGeometry {
  const { sign, cap } = SIGN_SIZES[size];
  const plate = { height: Math.round(sign * 0.7), minWidth: Math.round(sign * 0.9) };
  const standing = size === 'side';
  const gap = standing ? 10 : 12;
  let tray: SignGeometry['tray'];
  let lineTop: number;
  let row: SignGeometry['row'];
  let boardRight: number;
  let top: number;
  if (!standing) {
    const w = signs * sign + (signs - 1) * SIGN_GAP.row + 2 * 14;
    const h = sign + 2 * PAD;
    tray = { x: Math.round((width - w) / 2), y: height - PAD - h, width: w, height: h, standing };
    lineTop = tray.y - 2 * PAD - (sign + SLOT_ROOM);
    row = { left: 14, width: width - 28 };
    boardRight = width - 10;
    top = 8;
  } else {
    const w = sign + 2 * PAD;
    const h = signs * sign + (signs - 1) * SIGN_GAP.column + 2 * PAD;
    tray = { x: width - PAD - w, y: Math.round((height - h) / 2), width: w, height: h, standing };
    lineTop = height - 4 - 6 - (sign + SLOT_ROOM);
    row = { left: 10, width: tray.x - 12 - 10 };
    boardRight = tray.x - 8;
    top = 4;
  }
  const homes = Array.from({ length: signs }, (_, i) => (standing ? { x: tray.x + PAD, y: tray.y + PAD + i * (sign + SIGN_GAP.column) } : { x: tray.x + 14 + i * (sign + SIGN_GAP.row), y: tray.y + PAD }));
  // The plates' middle is the sign's glyph line (38 % down a sign in the slot).
  const plateTop = Math.round(lineTop + SLOT_ROOM / 2 + 0.38 * sign - plate.height / 2);
  const tall = plateTop - top;
  const fits = (c: number, l: SideShape, r: SideShape) => Math.max(plate.minWidth, l.cols * c) + Math.max(plate.minWidth, r.cols * c) + sign + SLOT_ROOM + 2 * gap <= row.width;
  let cell: number = cap;
  for (const round of rounds) {
    const [l, r] = sidesOf(round);
    cell = Math.min(cell, Math.floor(tall / Math.max(l.rows, r.rows)));
    while (cell > 8 && !fits(cell, l, r)) {
      cell -= 1;
    }
  }
  const boardLeft = standing ? 6 : 8;
  return {
    size,
    sign,
    plate,
    cell,
    gap,
    board: { x: boardLeft, y: lineTop - 8, width: boardRight - boardLeft, height: sign + SLOT_ROOM + 16 },
    tray,
    homes,
    lineTop,
    plateTop,
    row,
  };
}

// One round on that stage: the two sides centred in equal halves around the
// slot when they fit that way, else packed together and centred as a group.
export function placeRound(geo: SignGeometry, round: SignRound): RoundPlace {
  const [l, r] = sidesOf(round);
  const c = geo.cell;
  const slotW = geo.sign + SLOT_ROOM;
  const wl = Math.max(geo.plate.minWidth, l.cols * c);
  const wr = Math.max(geo.plate.minWidth, r.cols * c);
  const even = 2 * Math.max(wl, wr) + slotW + 2 * geo.gap <= geo.row.width;
  const hl = even ? Math.max(wl, wr) : wl;
  const hr = even ? Math.max(wl, wr) : wr;
  const x0 = geo.row.left + (geo.row.width - (hl + slotW + 2 * geo.gap + hr)) / 2;
  const place = (side: SignSideView, shape: SideShape, halfX: number, half: number, plateW: number): SidePlace => {
    const px = halfX + (half - plateW) / 2;
    const bw = shape.cols * c;
    const bh = shape.rows * c;
    return { side, shape, plate: { x: px, y: geo.plateTop, width: plateW, height: geo.plate.height }, blocks: { x: px + (plateW - bw) / 2, y: geo.plateTop - bh, width: bw, height: bh } };
  };
  const slot = { x: x0 + hl + geo.gap, y: geo.lineTop, width: slotW, height: slotW };
  return {
    left: place(round.left, l, x0, hl, wl),
    right: place(round.right, r, x0 + hl + slotW + 2 * geo.gap, hr, wr),
    slot,
    signAt: { x: slot.x + SLOT_ROOM / 2, y: slot.y + SLOT_ROOM / 2 },
  };
}

// Is a sign block whose top-left is at (x, y) close enough to the slot to drop in?
export function overSlot(place: RoundPlace, sign: number, x: number, y: number): boolean {
  const cx = place.slot.x + place.slot.width / 2;
  const cy = place.slot.y + place.slot.height / 2;
  return Math.hypot(x + sign / 2 - cx, y + sign / 2 - cy) < sign * 0.95;
}
