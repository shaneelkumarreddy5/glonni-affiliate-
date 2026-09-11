export type CategoryTreeBase = {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
};

export type OrderedCategory<T> = T & {
  treeDepth: number;
  treePath: string;
};

export function orderCategoryTree<T extends CategoryTreeBase>(items: T[]) {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    const parent =
      item.parent_id && ids.has(item.parent_id) ? item.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), item]);
  }
  for (const branch of children.values())
    branch.sort(
      (a, b) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.name.localeCompare(b.name),
    );

  const ordered: OrderedCategory<T>[] = [];
  const visited = new Set<string>();
  const visit = (
    parentId: string | null,
    depth: number,
    ancestors: string[],
  ) => {
    for (const item of children.get(parentId) ?? []) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      const path = [...ancestors, item.name];
      ordered.push({ ...item, treeDepth: depth, treePath: path.join(" › ") });
      visit(item.id, depth + 1, path);
    }
  };
  visit(null, 0, []);

  for (const item of items) {
    if (visited.has(item.id)) continue;
    visited.add(item.id);
    ordered.push({ ...item, treeDepth: 0, treePath: item.name });
    visit(item.id, 1, [item.name]);
  }
  return ordered;
}

export function categoryOptionLabel(category: {
  name: string;
  treeDepth: number;
}) {
  return `${"\u00a0\u00a0\u00a0".repeat(category.treeDepth)}${
    category.treeDepth ? "↳ " : ""
  }${category.name}`;
}

export function categoryBranchIds<
  T extends Pick<CategoryTreeBase, "id" | "parent_id">,
>(items: T[], rootId: string) {
  const children = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parent_id) continue;
    children.set(item.parent_id, [
      ...(children.get(item.parent_id) ?? []),
      item.id,
    ]);
  }
  const result = new Set<string>();
  const visit = (id: string) => {
    if (result.has(id)) return;
    result.add(id);
    for (const child of children.get(id) ?? []) visit(child);
  };
  visit(rootId);
  return result;
}
