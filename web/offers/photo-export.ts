import type { OfferPhoto } from "../../shared/offer-draft";

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
/** Store JPEGs without recompression, preserving the chosen order in file names. */
export async function photoArchive(photos: OfferPhoto[]) {
  const files: Uint8Array[] = [],
    directory: Uint8Array[] = [];
  let offset = 0;
  for (const [index, photo] of photos.entries()) {
    const bytes = new Uint8Array(await photo.blob.arrayBuffer());
    const name = new TextEncoder().encode(
      `${String(index + 1).padStart(2, "0")}-${photo.name.replace(/[^a-z0-9_.-]/gi, "_")}`,
    );
    const header = new Uint8Array(30 + name.length),
      view = new DataView(header.buffer),
      crc = crc32(bytes);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    const central = new Uint8Array(46 + name.length),
      centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    files.push(header, bytes);
    directory.push(central);
    offset += header.length + bytes.length;
  }
  const end = new Uint8Array(22),
    endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, photos.length, true);
  endView.setUint16(10, photos.length, true);
  endView.setUint32(
    12,
    directory.reduce((size, part) => size + part.length, 0),
    true,
  );
  endView.setUint32(16, offset, true);
  return new Blob([...files, ...directory, end] as BlobPart[], {
    type: "application/zip",
  });
}
