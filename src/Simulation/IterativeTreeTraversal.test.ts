import { describe, expect, it } from "vitest";
import { traverseTree } from "./IterativeTreeTraversal";

describe("iterative runtime tree traversal", () => {
  it("visits a 20,000-node chain without using the JavaScript call stack", () => {
    const nodes = Array.from({ length: 20_000 }, (_, id) => ({ id, children: [] as number[] }));
    for (let index = 0; index < nodes.length - 1; index += 1) nodes[index].children.push(index + 1);
    const result = traverseTree([0], (id) => nodes[id].children);
    expect(result.nodes).toHaveLength(20_000);
    expect(result.childEdgeCount).toBe(19_999);
    expect(result.maxDepth).toBe(19_999);
    expect(result.revisitCount).toBe(0);
  });

  it("terminates cycles and counts repeated edges", () => {
    const graph = [[1], [2], [0, 1]];
    const result = traverseTree([0], (node) => graph[node]);
    expect(result.nodes.map(({ node }) => node)).toEqual([0, 1, 2]);
    expect(result.childEdgeCount).toBe(4);
    expect(result.maxDepth).toBe(2);
    expect(result.revisitCount).toBe(2);
  });
});
