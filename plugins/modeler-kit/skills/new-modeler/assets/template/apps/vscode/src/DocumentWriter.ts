import * as vscode from 'vscode';
import { minimalLineEdit } from './textLines.js';

/** Echo keys ignore the line break style: VS Code writes an inserted '\n' as the document's EOL. */
function echoKey(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/**
 * Writes texts into one document, each as ONE minimal WorkspaceEdit, one at a time and each
 * diffed against the document as it is by then. The webview's own writes come back as change
 * events; those echoes are recognised and never re-imported.
 */
export class DocumentWriter {
  // A set: for edits A, B in quick succession EVERY echo is suppressed, in any arrival order.
  private readonly pendingEchoes = new Set<string>();
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly document: vscode.TextDocument) {}

  /** True (once) when the document's current text is the echo of an own write. */
  consumeEcho(): boolean {
    return this.pendingEchoes.delete(echoKey(this.document.getText()));
  }

  write(
    nextText: (current: string) => string,
    options: { suppressEcho: boolean },
  ): Promise<boolean> {
    const written = this.writes.then(() => this.apply(nextText(this.document.getText()), options));
    this.writes = written.catch(() => undefined);
    return written;
  }

  private async apply(text: string, options: { suppressEcho: boolean }): Promise<boolean> {
    const change = minimalLineEdit(this.document.getText(), text);
    if (!change) return true;
    const key = echoKey(text);
    if (options.suppressEcho) this.pendingEchoes.add(key);
    const edit = new vscode.WorkspaceEdit();
    const { start, end } = change;
    edit.replace(
      this.document.uri,
      new vscode.Range(start.line, start.character, end.line, end.character),
      change.text,
    );
    const applied = await vscode.workspace.applyEdit(edit).then(
      (accepted) => accepted,
      () => false,
    );
    if (!applied && options.suppressEcho) this.pendingEchoes.delete(key);
    return applied;
  }
}
