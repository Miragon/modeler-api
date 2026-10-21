/** An entry of a VS Code log file: `2026-10-21 19:33:09.226 [error] message`. */
const LOG_ENTRY = /^\d[^[]*\[\w+\] (.*)$/;

/**
 * The activation failures of `extensionId` in the text of an extension host log
 * (`<user data>/logs/<session>/window1/exthost/exthost.log`). VS Code logs "Activating extension <id>
 * failed due to an error:" and the error as the next entry; each failure comes back as one line with
 * the error's first line appended. The extension id is compared case-insensitively.
 */
export function extensionActivationFailures(log: string, extensionId: string): string[] {
  const lines = log.split(/\r?\n/);
  const headline = `activating extension ${extensionId.toLowerCase()} failed`;
  const failures: string[] = [];
  lines.forEach((line, index) => {
    const message = LOG_ENTRY.exec(line)?.[1]?.trim();
    if (!message?.toLowerCase().startsWith(headline)) return;
    const next = lines[index + 1];
    const cause = next === undefined ? "" : (LOG_ENTRY.exec(next)?.[1] ?? next).trim();
    failures.push(cause ? `${message} ${cause}` : message);
  });
  return failures;
}
