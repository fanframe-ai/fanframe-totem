import { renderForegroundOnlyImage } from "./personCanvas";
import { detectPeopleFromImage } from "./personDetector";
import { chooseForegroundPeople } from "./personScoring";
import type { ForegroundFilterConfig } from "./personTypes";

export const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel analisar a foto."));
    image.src = dataUrl;
  });

export const processForegroundPhoto = async (dataUrl: string, config: ForegroundFilterConfig) => {
  if (!config.enabled) {
    return {
      ok: true as const,
      processedImage: dataUrl,
      peopleCount: null,
      filterApplied: false,
    };
  }

  const image = await loadImageFromDataUrl(dataUrl);
  const people = await detectPeopleFromImage(image);
  const decision = chooseForegroundPeople(people, config);

  if (!decision.ok) {
    return {
      ok: false as const,
      message: decision.message,
      reason: decision.reason,
      peopleCount: people.length,
      filterApplied: true,
    };
  }

  return {
    ok: true as const,
    processedImage: renderForegroundOnlyImage(image, decision.selectedPeople),
    peopleCount: decision.selectedPeople.length,
    filterApplied: true,
  };
};
