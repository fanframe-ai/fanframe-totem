import { describe, expect, it } from "vitest";
import { chooseForegroundPeople } from "./personScoring";
import type { DetectedPerson } from "./personTypes";

const person = (id: string, x: number, y: number, width: number, height: number): DetectedPerson => ({
  id,
  x,
  y,
  width,
  height,
  imageWidth: 1000,
  imageHeight: 1500,
  confidence: 0.9,
});

const config = {
  enabled: true,
  maxPeople: 2,
  minAreaRatio: 0.08,
  centerWeight: 0.35,
};

describe("chooseForegroundPeople", () => {
  it("accepts one large centered person", () => {
    const result = chooseForegroundPeople([person("main", 300, 250, 400, 900)], config);
    expect(result.ok).toBe(true);
    expect(result.selectedPeople.map((item) => item.id)).toEqual(["main"]);
  });

  it("accepts two large foreground people and ignores a small background person", () => {
    const result = chooseForegroundPeople([
      person("left", 120, 300, 350, 850),
      person("right", 520, 300, 350, 850),
      person("background", 770, 200, 80, 200),
    ], config);
    expect(result.ok).toBe(true);
    expect(result.selectedPeople.map((item) => item.id).sort()).toEqual(["left", "right"]);
    expect(result.ignoredPeople.map((item) => item.id)).toEqual(["background"]);
  });

  it("blocks when three relevant foreground people are present", () => {
    const result = chooseForegroundPeople([
      person("a", 60, 350, 280, 780),
      person("b", 360, 350, 280, 780),
      person("c", 660, 350, 280, 780),
    ], config);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_many_people");
  });

  it("blocks when all people are too small", () => {
    const result = chooseForegroundPeople([person("far", 420, 400, 100, 220)], config);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_far");
  });

  it("uses custom warning text when configured", () => {
    const result = chooseForegroundPeople([], {
      ...config,
      warningText: "Fique no centro da tela com ate duas pessoas.",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Fique no centro da tela com ate duas pessoas.");
  });
});
