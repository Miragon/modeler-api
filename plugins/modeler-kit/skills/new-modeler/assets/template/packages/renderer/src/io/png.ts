import { COLORS } from '../draw/styles.js';

export interface PngOptions {
  /** Device pixels per diagram unit (default 2). */
  scale?: number;
  /** Leave out the paper fill, for slides and documents. */
  transparent?: boolean;
}

/** Rasterises an SVG export to a PNG picture (no embedded source), in the browser. */
export async function svgToPng(svg: string, options: PngOptions = {}): Promise<Blob> {
  const scale = options.scale ?? 2;
  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 800);
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 600);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(width, height);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render the SVG.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas context.');
    if (!options.transparent) {
      context.fillStyle = COLORS.paper;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
