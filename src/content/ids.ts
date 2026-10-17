// Branded identifiers for content. Node ids are stable across content versions
// only when the node keeps the same meaning; renumbering is a version bump.

export type ChapterId = string & { readonly __brand: 'ChapterId' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type CopyKey = string & { readonly __brand: 'CopyKey' };

export function chapterId(raw: string): ChapterId {
  return raw as ChapterId;
}

export function nodeId(raw: string): NodeId {
  return raw as NodeId;
}
