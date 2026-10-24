/** Small DOM helpers to trigger a client-side file download from a URL or a Blob. */

export function triggerDownload(fileName: string, url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(fileName, url);
  } finally {
    // Revoked on a later task so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function downloadText(fileName: string, text: string, type: string): void {
  downloadBlob(fileName, new Blob([text], { type }));
}

/** Turns a map title into a safe file name stem. */
export function slugify(title: string, fallback = "context-map"): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

/** The file a download of the map gets: the title's slug and the format's extension. */
export function mapFileName(title: string, extension: string): string {
  return `${slugify(title)}${extension}`;
}
