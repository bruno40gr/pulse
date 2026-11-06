export type SelectionModifiers = { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }

/** Row and checkbox gestures share one additive/range/removal policy. */
export function tableRowSelection(selected: ReadonlySet<string>, orderedIds: string[], id: string, anchor: number, modifiers: SelectionModifiers): Set<string> {
  const next = new Set(selected)
  const index = orderedIds.indexOf(id)
  const targets = modifiers.shiftKey && anchor >= 0 && index >= 0
    ? orderedIds.slice(Math.min(anchor, index), Math.max(anchor, index) + 1) : [id]
  for (const target of targets) {
    if (modifiers.altKey) next.delete(target)
    else if (modifiers.shiftKey || modifiers.ctrlKey || modifiers.metaKey) next.add(target)
    else if (next.has(target)) next.delete(target)
    else next.add(target)
  }
  return next
}