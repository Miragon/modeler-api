/**
 * Picture export from the renderer's standalone SVG snapshot (`modeler.saveSVG()`): SVG as it is,
 * PNG rasterised through a canvas at 2×, on white.
 */

import { downloadBlob, triggerDownload } from "./download";

const PNG_BACKGROUND = "#ffffff";

export function downloadSvg(svg: string, fileName: string): void {
  downloadBlob(fileName, new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

export async function downloadPng(svg: string, fileName: string): Promise<void> {
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not rasterise the map"));
    image.src = url;
  });

  const width = image.naturalWidth || 1000;
  const height = image.naturalHeight || 700;
  const scale = width * height > 4_000_000 ? 1 : 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas not supported");
  context.fillStyle = PNG_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  triggerDownload(fileName, canvas.toDataURL("image/png"));
}
