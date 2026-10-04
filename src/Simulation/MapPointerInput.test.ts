import { describe, expect, it } from "vitest";
import {
  beginMapPointerSequence,
  finishMapPointerSequence,
  inspectMapPointerTarget,
} from "./MapPointerInput";

describe("map pointer DOM isolation", () => {
  const canvas = { tagName: "CANVAS" };
  const button = { tagName: "BUTTON" };
  const dialogPaper = { tagName: "DIV" };
  const body = { tagName: "BODY" };
  const documentTarget = { nodeType: 9 };

  it("accepts only the current Phaser canvas as the native target", () => {
    expect(inspectMapPointerTarget({ event: { target: canvas }, downElement: canvas }, canvas, "down").accepted).toBe(true);
    expect(inspectMapPointerTarget({ event: { target: dialogPaper }, downElement: canvas }, canvas, "down")).toMatchObject({ accepted: false, target: "DIV", reason: "NON_CANVAS_TARGET" });
    expect(inspectMapPointerTarget({ event: { target: button }, downElement: button }, canvas, "down")).toMatchObject({ accepted: false, target: "BUTTON", reason: "NON_CANVAS_TARGET" });
    expect(inspectMapPointerTarget({ event: { target: dialogPaper }, upElement: dialogPaper }, canvas, "up")).toMatchObject({ accepted: false, target: "DIV", reason: "NON_CANVAS_TARGET" });
    expect(inspectMapPointerTarget({ event: { target: body }, upElement: body }, canvas, "up")).toMatchObject({ accepted: false, target: "BODY", reason: "NON_CANVAS_TARGET" });
    expect(inspectMapPointerTarget({ event: { target: documentTarget } }, canvas, "move")).toMatchObject({ accepted: false, target: "DOCUMENT", reason: "NON_CANVAS_TARGET" });
  });

  it("requires a complete canvas down/up sequence from the same pointer", () => {
    expect(finishMapPointerSequence(undefined, true, 1)).toEqual({ accepted: false, reason: "NO_VALID_POINTER_DOWN" });

    const canvasDown = beginMapPointerSequence(true, 1, { x: 12, y: 18 });
    expect(finishMapPointerSequence(canvasDown, true, 1)).toEqual({ accepted: true, reason: "CANVAS_SEQUENCE" });
    expect(finishMapPointerSequence(canvasDown, false, 1)).toEqual({ accepted: false, reason: "NON_CANVAS_TARGET" });
    expect(finishMapPointerSequence(undefined, true, 1)).toEqual({ accepted: false, reason: "NO_VALID_POINTER_DOWN" });

    const rejectedUiDown = beginMapPointerSequence(false, 1, { x: 12, y: 18 });
    expect(rejectedUiDown).toBeUndefined();
    expect(finishMapPointerSequence(rejectedUiDown, true, 1)).toEqual({ accepted: false, reason: "NO_VALID_POINTER_DOWN" });
  });
});
