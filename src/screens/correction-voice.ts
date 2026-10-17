import type { Line } from './hints';

// When a correction is spoken without being asked for. One rule set, so the
// timing can be tested on its own:
//
// - Only a committed answer that needs adjusting has a correction; building
//   towards the answer, an empty bench and a right answer have none.
// - It waits until the child has been still for QUIET_MS. Every commit, count
//   tap or menu visit starts the wait again, and nothing is said while a finger
//   is dragging (however slowly) or the menu is open, so it never lands mid-move.
// - It queues behind whatever is already being said (counting words, the
//   prompt) instead of cutting it off.
// - Each correction is said once while the answer stays that way. Hearing it
//   by asking (the feedback card, the help button) counts as said; so does
//   switching language (the line is the same, only the words differ).
// - When the answer changes after a correction was spoken, a correction that
//   may still be queued is stopped: it no longer describes the bench.

export const CORRECTION_QUIET_MS = 900;

export interface CorrectionVoice {
  // The committed answer changed (or was re-committed): its correction, or null.
  readonly answer: (line: Line | null) => void;
  // The child did something that is not a commit, such as counting a block.
  readonly activity: () => void;
  // The child asked for this line and heard it.
  readonly heard: (line: Line) => void;
  // A menu covers the stage, or a finger is dragging: nothing is said until
  // every reason is over, then the quiet wait starts again.
  readonly pause: (paused: boolean, reason?: PauseReason) => void;
  // How a correction is said (the screen's current language). Until set, nothing is.
  readonly setSpeaker: (speak: (line: Line) => void) => void;
  readonly dispose: () => void;
}

export type PauseReason = 'menu' | 'drag';

function signature(line: Line | null): string | null {
  return line === null ? null : JSON.stringify([line.key, line.params]);
}

export function createCorrectionVoice({ stop, quietMs = CORRECTION_QUIET_MS }: {
  readonly stop: () => void;
  readonly quietMs?: number;
}): CorrectionVoice {
  let speak: (line: Line) => void = () => undefined;
  let current: Line | null = null;
  let heardSig: string | null = null;
  let spokenSig: string | null = null;
  const pauses = new Set<PauseReason>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const arm = () => {
    cancel();
    const line = current;
    if (line === null || pauses.size > 0 || signature(line) === heardSig) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      heardSig = signature(line);
      spokenSig = heardSig;
      speak(line);
    }, quietMs);
  };

  return {
    answer: (line) => {
      const sig = signature(line);
      if (spokenSig !== null && sig !== spokenSig) {
        stop();
        spokenSig = null;
      }
      if (line === null) {
        heardSig = null;
      }
      current = line;
      arm();
    },
    activity: () => {
      if (timer !== null) {
        arm();
      }
    },
    heard: (line) => {
      if (signature(line) === signature(current)) {
        heardSig = signature(line);
        cancel();
      }
    },
    pause: (value, reason = 'menu') => {
      if (value) {
        pauses.add(reason);
        cancel();
      } else if (pauses.delete(reason)) {
        arm();
      }
    },
    setSpeaker: (next) => {
      speak = next;
    },
    dispose: cancel,
  };
}
