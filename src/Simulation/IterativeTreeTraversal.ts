export interface TreeTraversalResult<T> {
  nodes: Array<{ node: T; depth: number }>;
  childEdgeCount: number;
  maxDepth: number;
  revisitCount: number;
}

/** Iterative pre-order DFS for runtime trees which may be malformed or very deep. */
export function traverseTree<T>(roots: readonly T[], getChildren: (node: T) => readonly T[]): TreeTraversalResult<T> {
  const stack: Array<{ node: T; depth: number }> = [];
  for (let index = roots.length - 1; index >= 0; index -= 1) stack.push({ node: roots[index], depth: 0 });
  const visited = new Set<T>();
  const nodes: Array<{ node: T; depth: number }> = [];
  let childEdgeCount = 0;
  let maxDepth = 0;
  let revisitCount = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (visited.has(current.node)) {
      revisitCount += 1;
      continue;
    }
    visited.add(current.node);
    nodes.push(current);
    maxDepth = Math.max(maxDepth, current.depth);
    const children = getChildren(current.node);
    childEdgeCount += children.length;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], depth: current.depth + 1 });
    }
  }
  return { nodes, childEdgeCount, maxDepth, revisitCount };
}
