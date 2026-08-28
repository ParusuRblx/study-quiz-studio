import { describe, expect, it } from "vitest";
import { getAdjacentChoiceIndex } from "./keyboard";

describe("getAdjacentChoiceIndex", () => {
  it("moves forward and backward with both horizontal and vertical arrows", () => {
    expect(getAdjacentChoiceIndex(0, 3, "ArrowRight")).toBe(1);
    expect(getAdjacentChoiceIndex(2, 3, "ArrowDown")).toBe(0);
    expect(getAdjacentChoiceIndex(0, 3, "ArrowLeft")).toBe(2);
    expect(getAdjacentChoiceIndex(0, 3, "ArrowUp")).toBe(2);
  });

  it("supports Home and End for quick movement", () => {
    expect(getAdjacentChoiceIndex(2, 4, "Home")).toBe(0);
    expect(getAdjacentChoiceIndex(0, 4, "End")).toBe(3);
  });

  it("ignores unrelated keys and empty choice groups", () => {
    expect(getAdjacentChoiceIndex(0, 3, "Tab")).toBeNull();
    expect(getAdjacentChoiceIndex(0, 0, "ArrowDown")).toBeNull();
  });
});
