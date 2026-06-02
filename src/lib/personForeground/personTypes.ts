export type DetectedPerson = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  confidence: number;
  mask?: unknown;
};

export type ForegroundFilterConfig = {
  enabled: boolean;
  maxPeople: number;
  minAreaRatio: number;
  centerWeight: number;
  warningText?: string | null;
};

export type ForegroundDecision =
  | {
      ok: true;
      selectedPeople: DetectedPerson[];
      ignoredPeople: DetectedPerson[];
      reason: "valid";
    }
  | {
      ok: false;
      selectedPeople: DetectedPerson[];
      ignoredPeople: DetectedPerson[];
      reason: "no_person" | "too_many_people" | "too_far";
      message: string;
    };
