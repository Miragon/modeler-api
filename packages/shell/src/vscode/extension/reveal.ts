/**
 * The label VS Code itself uses for revealing a file, for the action on the export notification:
 * `darwin` "Reveal in Finder", `win32` "Reveal in File Explorer", otherwise "Open Containing Folder".
 */
export function revealFileLabel(platform: string): string {
  throw new Error("@miragon/modeler-shell: revealFileLabel is not implemented yet");
}
