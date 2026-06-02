import type { DetectedPerson } from "./personTypes";

const drawMaskToCanvas = (
  ctx: CanvasRenderingContext2D,
  person: DetectedPerson,
  outputWidth: number,
  outputHeight: number,
) => {
  const mask = person.mask as { data?: Uint8Array; width?: number; height?: number } | undefined;
  if (!mask?.data || !mask.width || !mask.height) return;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return;

  const imageData = maskCtx.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index += 1) {
    const alphaIndex = index * 4 + 3;
    imageData.data[alphaIndex] = mask.data[index] ? 255 : 0;
  }

  maskCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0, outputWidth, outputHeight);
};

export const renderForegroundOnlyImage = (image: HTMLImageElement, selectedPeople: DetectedPerson[]) => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) throw new Error("Canvas indisponivel para preparar a foto.");
  sourceCtx.drawImage(image, 0, 0, width, height);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Canvas indisponivel para preparar a foto.");

  selectedPeople.forEach((person) => drawMaskToCanvas(maskCtx, person, width, height));

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("Canvas indisponivel para preparar a foto.");

  outputCtx.fillStyle = "#f4f4f4";
  outputCtx.fillRect(0, 0, width, height);

  outputCtx.save();
  outputCtx.drawImage(sourceCanvas, 0, 0);
  outputCtx.globalCompositeOperation = "destination-in";
  outputCtx.drawImage(maskCanvas, 0, 0);
  outputCtx.restore();

  outputCtx.globalCompositeOperation = "destination-over";
  outputCtx.fillStyle = "#f4f4f4";
  outputCtx.fillRect(0, 0, width, height);
  outputCtx.globalCompositeOperation = "source-over";

  return outputCanvas.toDataURL("image/png");
};
