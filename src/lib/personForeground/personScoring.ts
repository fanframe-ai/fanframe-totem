import type { DetectedPerson, ForegroundDecision, ForegroundFilterConfig } from "./personTypes";

const areaRatio = (person: DetectedPerson) => {
  const imageArea = person.imageWidth * person.imageHeight;
  if (imageArea <= 0) return 0;
  return (person.width * person.height) / imageArea;
};

const centerDistance = (person: DetectedPerson) => {
  const imageCenterX = person.imageWidth / 2;
  if (imageCenterX <= 0) return 1;
  const personCenterX = person.x + person.width / 2;
  return Math.abs(personCenterX - imageCenterX) / imageCenterX;
};

const scorePerson = (person: DetectedPerson, config: ForegroundFilterConfig) => {
  const areaScore = areaRatio(person);
  const centerScore = Math.max(0, 1 - centerDistance(person)) * config.centerWeight;
  return areaScore + centerScore;
};

const safeMaxPeople = (value: number) => Math.min(2, Math.max(1, Math.round(value || 2)));
const safeMinAreaRatio = (value: number) => Math.min(0.4, Math.max(0.01, Number(value) || 0.08));

export const chooseForegroundPeople = (
  people: DetectedPerson[],
  config: ForegroundFilterConfig,
): ForegroundDecision => {
  const maxPeople = safeMaxPeople(config.maxPeople);
  const minAreaRatio = safeMinAreaRatio(config.minAreaRatio);

  if (!people.length) {
    return {
      ok: false,
      selectedPeople: [],
      ignoredPeople: [],
      reason: "no_person",
      message: config.warningText || "Nao encontramos uma pessoa na foto. Tente novamente.",
    };
  }

  const relevantPeople = people.filter((person) => areaRatio(person) >= minAreaRatio);
  const ignoredPeople = people.filter((person) => areaRatio(person) < minAreaRatio);

  if (!relevantPeople.length) {
    return {
      ok: false,
      selectedPeople: [],
      ignoredPeople,
      reason: "too_far",
      message: config.warningText || "Chegue mais perto da camera e tire outra foto.",
    };
  }

  const sorted = [...relevantPeople].sort((a, b) => scorePerson(b, config) - scorePerson(a, config));
  const selectedPeople = sorted.slice(0, maxPeople);

  if (relevantPeople.length > maxPeople) {
    return {
      ok: false,
      selectedPeople,
      ignoredPeople,
      reason: "too_many_people",
      message: config.warningText || `Use no maximo ${maxPeople} pessoas na foto.`,
    };
  }

  return {
    ok: true,
    selectedPeople,
    ignoredPeople,
    reason: "valid",
  };
};
