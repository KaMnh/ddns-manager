/** Groups records by their root domain (falling back to the full domain),
 *  sorting groups and the records within each group alphabetically. */
export function groupByRoot<T extends { rootDomain?: string; domain: string }>(
  items: T[],
): { root: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = item.rootDomain || item.domain
    const existing = map.get(key)
    if (existing) existing.push(item)
    else map.set(key, [item])
  }
  return [...map.entries()]
    .map(([root, list]) => ({
      root,
      items: [...list].sort((a, b) => a.domain.localeCompare(b.domain)),
    }))
    .sort((a, b) => a.root.localeCompare(b.root))
}
