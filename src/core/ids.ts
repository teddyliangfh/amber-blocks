// Branded identifiers. Every mathematical fact in the core is derived from
// counting these identities, never from colour, label or screen position.

export type UnitId = string & { readonly __brand: 'UnitId' };
export type GroupId = string & { readonly __brand: 'GroupId' };
export type QuestionId = string & { readonly __brand: 'QuestionId' };

export function unitId(raw: string): UnitId {
  return raw as UnitId;
}

export function groupId(raw: string): GroupId {
  return raw as GroupId;
}

export function questionId(raw: string): QuestionId {
  return raw as QuestionId;
}

// Sequential ids for one question's material, e.g. unitIds('q1', 3) -> q1-u0, q1-u1, q1-u2.
// Deterministic so that content generation and tests never depend on randomness.
export function unitIds(prefix: string, count: number): ReadonlyArray<UnitId> {
  const ids: UnitId[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(unitId(`${prefix}-u${i}`));
  }
  return ids;
}
