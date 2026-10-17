// What the voice says without being asked (D-036, 2026-10-14). Ted, after
// playing: "语音提示太多 太诡异了" — too much speech, and a synthesized voice
// talking on its own is odd. Sounds now carry pick-up, drop, right and wrong;
// the voice speaks when the child asks (the number badge, the feedback card,
// help), says each counting number, and the total once the count is done.
// Flip a line back to true to restore that automatic line.
export const AUTO_SPEECH = {
  // The task, when a stop opens or starts over.
  prompt: false,
  // The next step, when the answer turns right.
  success: false,
  // The correction, after the child stops on a wrong answer. The quiet nudge
  // (help level 1, which lights the shape picture) still happens.
  correction: false,
  // "5 in all" after the last counting number: the one line that turns the
  // count into a total (2026-10-15, D-038). Said once per finished count.
  countTotal: true,
  // One number word per counting tap.
  countNumbers: true,
} as const;
