// The level screen's fixed chrome around the stage, in px. LevelScreen and
// AnswerFeedback size themselves from these and the device layout tests
// subtract them, so the stage the tests check is the stage a phone gets
// (2026-10-14 review: the tests still assumed a 24px prompt line after it had
// become an 84px feedback card, and overstated the stage by 50–64px).
export const LEVEL_CHROME = {
  // Portrait windows shorter than this use the compact sizes.
  compactBelow: 700,
  // Landscape: the target, feedback and buttons live in a side column.
  sideColumn: 168,
  // Phase 23-0 (A-lite, PRD §3.3): the cloud holds the shape picture too, so
  // the header grew 104 → 120 and the card 84 → 88 (a bigger symbol disc); the
  // button row gave 8 back (76 → 68: a 48 button and its lip still fit). Net +12,
  // which costs a 375 × 812 phone no cell anywhere (header-ux §1.4).
  regular: { header: 120, feedback: 88, feedbackGap: 4, footer: 68 },
  // Short phones give 26px more to the stage (2026-10-16 review #7: 17 on a
  // 375 × 553 phone had 34px blocks): a one-line card and a smaller button row.
  // Phase 23-0: header 80 → 88, button row 52 → 48 (net +4, the budget's top).
  compact: { header: 88, feedback: 56, feedbackGap: 4, footer: 48 },
  // Amber, the hint girl (D-098), drawn over the chrome and adding none to it:
  // in portrait at the header's bottom left, her chin `over` px down onto the
  // feedback card's top edge and clear of its symbol disc; in landscape in the
  // side column's count slot (minHeight 48). The count takes that corner while
  // it runs, so she steps out then.
  guide: { regular: { size: 48, over: 10 }, compact: { size: 40, over: 8 }, side: 44 },
} as const;

// The cloud the number to make sits on, and the shape picture inside it
// (Phase 23-0, PRD §3.3): `regular` and `compact` portrait, `side` the
// landscape column; the number and the picture side by side on all three.
// The picture's cell is the largest that keeps it inside `picture` (width ×
// height, without its PICTURE_PAD border) and no more than `cell`: a 2 × 2
// square is 28px a cell, a rocket or a standing ten goes by its height.
export const CLOUD = {
  regular: { height: 100, minWidth: 180, shadow: 6, number: 72, picture: { cell: 28, width: 112, height: 56 } },
  compact: { height: 76, minWidth: 140, shadow: 5, number: 52, picture: { cell: 22, width: 88, height: 44 } },
  side: { height: 76, minWidth: 140, shadow: 5, number: 52, picture: { cell: 18, width: 72, height: 36 } },
} as const;
export type CloudSize = keyof typeof CLOUD;
export const PICTURE_PAD = 4;

// The shape picture's cell and box for a template `cols` × `rows` cells big.
export function pictureBox(cols: number, rows: number, size: CloudSize): { readonly cell: number; readonly width: number; readonly height: number } {
  const p = CLOUD[size].picture;
  const cell = Math.min(p.cell, Math.floor(p.height / rows), Math.floor(p.width / cols));
  return { cell, width: cell * cols + 2 * PICTURE_PAD, height: cell * rows + 2 * PICTURE_PAD };
}

// Height a portrait level screen spends on everything but the stage.
export function portraitChrome(compact: boolean): number {
  const c = compact ? LEVEL_CHROME.compact : LEVEL_CHROME.regular;
  return c.header + c.feedback + c.feedbackGap + c.footer;
}

// The free-play page's chrome (2026-10-15 review O). No question and no
// feedback card: a small sign on top, and a row of three labelled buttons
// below (back to the map, put everything back, undo). Landscape moves them
// into a side column so the stage keeps its height.
export const SANDBOX_CHROME = {
  compactBelow: 700,
  sideColumn: 152,
  regular: { header: 76, footer: 96 },
  compact: { header: 64, footer: 84 },
} as const;
