import { describe, expect, it } from "vitest";
import { WorldRandom } from "../Simulation/WorldRandom";
import type { Ruler } from "./Dynasty";
import {
  getCandidateParentsToReplenish,
  buildPoliticalGenealogy,
  formatRecordedKinship,
  getSuccessionBackground,
  MAX_DYNASTIC_SUCCESSION_CANDIDATES,
  selectRecordedDynasticSuccessor,
} from "./DynasticCandidateRules";

function ruler(id: string, parentId: string | undefined, status: Ruler["status"] = "heir"): Ruler {
  return { id, houseName: "姬氏", givenName: id, bornYear: 0, parentId, status };
}

function choose(predecessor: Ruler, candidates: Ruler[], rulers: Ruler[]) {
  return selectRecordedDynasticSuccessor({
    predecessor,
    candidates,
    rulers,
    houseName: "姬氏",
    month: 1200,
    isAlive: (candidate) => candidate.status !== "dead",
    pickIndex: () => 0,
  });
}

describe("recorded dynastic succession candidates", () => {
  it("prioritizes an available direct child", () => {
    const predecessor = ruler("r", undefined, "ruling");
    const son = ruler("son", "r");
    const grandson = ruler("grandson", "son");
    expect(choose(predecessor, [grandson, son], [predecessor, son, grandson])).toMatchObject({
      ruler: son,
      relationType: "DIRECT_CHILD",
    });
  });

  it("uses a living grandchild when the child has died", () => {
    const predecessor = ruler("r", undefined, "ruling");
    const deadChild = ruler("child", "r", "dead");
    const grandson = ruler("grandson", "child");
    expect(choose(predecessor, [grandson], [predecessor, deadChild, grandson])).toMatchObject({
      ruler: grandson,
      relationType: "GRANDCHILD",
    });
  });

  it("uses a sibling when there are no living descendants", () => {
    const father = ruler("father", undefined, "dead");
    const predecessor = ruler("r", "father", "ruling");
    const sibling = ruler("sibling", "father");
    expect(choose(predecessor, [sibling], [father, predecessor, sibling])).toMatchObject({
      ruler: sibling,
      relationType: "SIBLING",
    });
  });

  it("keeps exactly one designated heir choice and replaces it when that candidate is no longer eligible", () => {
    const father = ruler("father", undefined, "dead");
    const predecessor = ruler("r", "father", "ruling");
    const brother = ruler("brother", "father");
    const otherBrother = ruler("other-brother", "father");
    const rulers = [father, predecessor, brother, otherBrother];
    const chooseWithPreference = (candidateIds: string[], preferredCandidateId?: string) =>
      selectRecordedDynasticSuccessor({
        predecessor,
        candidates: candidateIds.map((id) => rulers.find((item) => item.id === id)!),
        rulers,
        houseName: "姬氏",
        month: 1200,
        isAlive: (candidate) => candidate.status !== "dead",
        preferredCandidateId,
        pickIndex: () => 0,
      });
    expect(chooseWithPreference([brother.id, otherBrother.id], otherBrother.id)?.ruler.id).toBe(otherBrother.id);
    otherBrother.status = "dead";
    expect(chooseWithPreference([brother.id, otherBrother.id], otherBrother.id)?.ruler.id).toBe(brother.id);
  });

  it("chooses one designated person from a full six-candidate pool", () => {
    const father = ruler("father", undefined, "dead");
    const predecessor = ruler("r", "father", "ruling");
    const candidates = Array.from({ length: MAX_DYNASTIC_SUCCESSION_CANDIDATES }, (_, index) =>
      ruler(`candidate-${index}`, "father")
    );
    const designated = selectRecordedDynasticSuccessor({
      predecessor,
      candidates,
      rulers: [father, predecessor, ...candidates],
      houseName: "姬氏",
      month: 1200,
      isAlive: () => true,
      pickIndex: () => 4,
    });
    expect(candidates).toHaveLength(6);
    expect(designated?.ruler.id).toBe("candidate-4");
  });

  it("derives candidate labels, succession background, and political genealogy from parent links", () => {
    const father = ruler("father", undefined, "dead");
    const rulerNow = { ...ruler("r", "father", "ruling"), reignOrdinal: 2 };
    const brother = ruler("brother", "father");
    const nephew = ruler("nephew", "brother");
    const unrelated = { ...ruler("unrelated", undefined), reignOrdinal: 1 };
    const rulers = [father, rulerNow, brother, nephew, unrelated];
    expect(formatRecordedKinship(brother, rulerNow, rulers)).toBe("当今君主之兄弟");
    expect(formatRecordedKinship(nephew, rulerNow, rulers)).toBe("宗室旁支");
    expect(getSuccessionBackground({ ...rulerNow, relationType: "SIBLING", predecessorId: "father" }, rulers))
      .toBe("前君无可继的直系候选，由其兄弟承统");
    expect(getSuccessionBackground({ ...rulerNow, relationType: "NEW_HOUSE", predecessorId: "father" }, rulers))
      .toBe("记录中的宗室候选已无可继者，遂易姓续统");
    const tree = buildPoliticalGenealogy(rulers, rulerNow.id, brother.id, [brother.id, nephew.id]);
    expect(tree.map((root) => root.ruler.id)).toContain(unrelated.id);
    const root = tree.find((node) => node.ruler.id === father.id)!;
    expect(root.children.map((node) => node.ruler.id)).toEqual(["brother", "r"]);
    expect(root.children.find((node) => node.ruler.id === "brother")?.children[0].ruler.id).toBe("nephew");
  });

  it("uses recorded collateral kin and leaves the existing fallback when no valid kin remains", () => {
    const grandparent = ruler("grandparent", undefined, "dead");
    const predecessorParent = ruler("p1", "grandparent", "dead");
    const collateralParent = ruler("p2", "grandparent", "dead");
    const predecessor = ruler("r", "p1", "ruling");
    const collateral = ruler("cousin", "p2");
    expect(choose(predecessor, [collateral], [grandparent, predecessorParent, collateralParent, predecessor, collateral]))
      .toMatchObject({ ruler: collateral, relationType: "COLLATERAL_KIN" });
    expect(choose(predecessor, [ruler("unrelated", undefined)], [predecessor])).toBeUndefined();
    expect(choose(predecessor, [ruler("dead", "p1", "dead")], [predecessor])).toBeUndefined();
  });

  it("makes a multi-generation succession projection reproducible for the same seed", () => {
    const father = ruler("father", undefined, "dead");
    const initial = ruler("r", "father", "ruling");
    const siblings = [ruler("a", "father"), ruler("b", "father"), ruler("c", "father")];
    const project = (seed: string) => {
      const random = new WorldRandom();
      random.initialize(seed);
      let predecessor = initial;
      const remaining = [...siblings];
      const succession: string[] = [];
      for (let generation = 0; generation < 3; generation += 1) {
        const selection = selectRecordedDynasticSuccessor({
          predecessor,
          candidates: remaining,
          rulers: [father, initial, ...siblings],
          houseName: "姬氏",
          month: 100 + generation,
          isAlive: () => true,
          pickIndex: (length) => random.pickIndex(length),
        });
        if (!selection) break;
        succession.push(`${selection.relationType}:${selection.ruler.id}`);
        predecessor = selection.ruler;
        remaining.splice(remaining.findIndex((item) => item.id === selection.ruler.id), 1);
      }
      return { succession, state: random.exportState() };
    };
    expect(project("123")).toEqual(project("123"));
  });

  it("keeps the candidate set bounded and stops replenishing at its cap", () => {
    const current = { ...ruler("current", undefined, "ruling"), bornYear: 0 };
    expect(getCandidateParentsToReplenish({
      currentRuler: current,
      rulers: [current],
      candidateIds: Array.from({ length: MAX_DYNASTIC_SUCCESSION_CANDIDATES }, (_, index) => `h${index}`),
      month: 1000,
      minimumParentAgeMonths: 180,
    })).toEqual([]);
  });
});
