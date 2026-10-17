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
  regular: { header: 104, feedback: 84, feedbackGap: 4, footer: 76 },
  // Short phones give 26px more to the stage (2026-10-16 review #7: 17 on a
  // 375 × 553 phone had 34px blocks): a one-line card and a smaller button row.
  compact: { header: 80, feedback: 56, feedbackGap: 4, footer: 52 },
} as const;

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
