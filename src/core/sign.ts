// Compare Island (Phase 23d, D-129): two numbers and the sign between them.
// The child judges by moving a sign block into the slot, not by changing the
// mat, so this is the whole judge: the sign is right when it is signOf(left, right).
export type Sign = '>' | '<' | '=';

// Tray order of the sign blocks.
export const SIGNS: ReadonlyArray<Sign> = ['>', '<', '='];

export function signOf(left: number, right: number): Sign {
  return left > right ? '>' : left < right ? '<' : '=';
}
