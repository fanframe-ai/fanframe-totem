import type * as BodyPix from "@tensorflow-models/body-pix";
import type { DetectedPerson } from "./personTypes";

let bodyPixModulePromise: Promise<typeof BodyPix> | null = null;
let modelPromise: Promise<BodyPix.BodyPix> | null = null;

const loadBodyPixModule = async () => {
  if (!bodyPixModulePromise) {
    bodyPixModulePromise = Promise.all([
      import("@tensorflow/tfjs"),
      import("@tensorflow-models/body-pix"),
    ]).then(([, module]) => module);
  }
  return bodyPixModulePromise;
};

const loadModel = () => {
  if (!modelPromise) {
    modelPromise = loadBodyPixModule().then((bodyPix) => bodyPix.load({
      architecture: "MobileNetV1",
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    }));
  }
  return modelPromise;
};

const getMaskBounds = (segmentation: BodyPix.PersonSegmentation, imageWidth: number, imageHeight: number) => {
  let minX = segmentation.width;
  let minY = segmentation.height;
  let maxX = 0;
  let maxY = 0;
  let pixels = 0;

  for (let y = 0; y < segmentation.height; y += 1) {
    for (let x = 0; x < segmentation.width; x += 1) {
      const value = segmentation.data[y * segmentation.width + x];
      if (!value) continue;
      pixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!pixels) return null;

  const scaleX = imageWidth / segmentation.width;
  const scaleY = imageHeight / segmentation.height;

  return {
    x: minX * scaleX,
    y: minY * scaleY,
    width: Math.max(1, (maxX - minX + 1) * scaleX),
    height: Math.max(1, (maxY - minY + 1) * scaleY),
  };
};

export const detectPeopleFromImage = async (image: HTMLImageElement): Promise<DetectedPerson[]> => {
  const model = await loadModel();
  const segmentations = await model.segmentMultiPerson(image, {
    flipHorizontal: false,
    internalResolution: "medium",
    segmentationThreshold: 0.7,
    maxDetections: 5,
    scoreThreshold: 0.25,
    nmsRadius: 20,
    minKeypointScore: 0.25,
    refineSteps: 10,
  });

  return segmentations.flatMap((segmentation, index) => {
    const bounds = getMaskBounds(segmentation, image.naturalWidth, image.naturalHeight);
    if (!bounds) return [];

    return [{
      id: `person-${index + 1}`,
      ...bounds,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      confidence: segmentation.pose?.score ?? 0,
      mask: segmentation,
    }];
  });
};
