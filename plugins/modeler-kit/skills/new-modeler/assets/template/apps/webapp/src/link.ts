/*
 * The share link: the document travels in the URL fragment, which never reaches a server.
 * Replace the plain base64url with compression once documents grow (Event Storming's `#mz=`).
 */

const KEY = 'd';

export function linkedText(hash: string): string | undefined {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(KEY);
  if (!value) return undefined;
  try {
    const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
      char.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

export function linkHash(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text));
  return `#${KEY}=${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
