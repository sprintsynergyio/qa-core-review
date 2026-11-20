// A minimal reader for .tgz files made by `npm pack`. No dependency.
import fs from 'node:fs';
import zlib from 'node:zlib';

/** The regular files in a .tgz, as a Map from path ('package/README.md') to content. */
export function readTarball(tarball) {
  const buf = zlib.gunzipSync(fs.readFileSync(tarball));
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    let name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(header.subarray(124, 136).toString('utf8').trim(), 8) || 0;
    const type = String.fromCharCode(header[156]);
    if (name && (type === '0' || type === '\0')) files.set(name, buf.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
