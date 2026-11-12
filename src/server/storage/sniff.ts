// MIME sniffing from magic bytes (T09). The declared Content-Type of an
// upload is never trusted: the sniffed type decides the stored mime_type
// and whether the file is accepted at all.
export interface SniffedMime {
  mime: string;
  ext: string;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const PDF = [0x25, 0x50, 0x44, 0x46];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const GLB = [0x67, 0x6c, 0x54, 0x46]; // 'glTF'

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  );
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 512))
    .trimStart()
    .toLowerCase();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

/** Sniff the real MIME type of a file's first bytes. Null = not recognised. */
export function sniffMime(bytes: Uint8Array): SniffedMime | null {
  if (startsWith(bytes, PNG)) return { mime: 'image/png', ext: 'png' };
  if (startsWith(bytes, JPEG)) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) return { mime: 'image/gif', ext: 'gif' };
  if (isWebP(bytes)) return { mime: 'image/webp', ext: 'webp' };
  if (startsWith(bytes, PDF)) return { mime: 'application/pdf', ext: 'pdf' };
  if (startsWith(bytes, GLB)) return { mime: 'model/gltf-binary', ext: 'glb' };
  if (startsWith(bytes, ZIP)) return { mime: 'application/zip', ext: 'zip' };
  if (looksLikeSvg(bytes)) return { mime: 'image/svg+xml', ext: 'svg' };
  return null;
}

/** MIME types the studio upload route accepts (internal assets only). */
export const UPLOAD_MIME_ALLOWLIST = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'model/gltf-binary',
]);

/** design-private bucket limit is 500 MB; the route caps single uploads at 100 MB. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
