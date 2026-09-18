/**
 * The Info.plist a bare executable carries in its __TEXT,__info_plist section, which is where
 * the helper's identity and version live (native/Package.swift). The code signature covers the
 * section, so once a helper file meets the code requirement, what this reads is what was signed.
 *
 * Only the Mach-O layouts the helper is built as are read: a 64-bit executable, alone or inside a
 * universal file. Anything else reads as no Info.plist at all.
 */

const fatMagic = 0xcafebabe;
const fatMagic64 = 0xcafebabf;
const machOMagic64 = 0xfeedfacf;
const segmentCommand64 = 0x19;

const machHeader64Size = 32;
const segmentCommand64Size = 72;
const section64Size = 80;

/** A fixed-width name in a Mach-O header, which is padded with NULs rather than terminated. */
const nameAt = (file: Buffer, offset: number): string =>
  file.toString("latin1", offset, offset + 16).replace(/\0+$/u, "");

/** Where the first executable of a universal file starts; every slice carries the same plist. */
const firstSliceOf = (file: Buffer): number | undefined => {
  if (file.length < 8) return undefined;

  const magic = file.readUInt32BE(0);
  if (magic !== fatMagic && magic !== fatMagic64) return 0;
  if (file.readUInt32BE(4) === 0) return undefined;

  return magic === fatMagic ? file.readUInt32BE(8 + 8) : Number(file.readBigUInt64BE(8 + 8));
};

const infoPlistSectionIn = (file: Buffer, slice: number): Buffer | undefined => {
  if (file.length < slice + machHeader64Size) return undefined;
  if (file.readUInt32LE(slice) !== machOMagic64) return undefined;

  const commands = file.readUInt32LE(slice + 16);
  let command = slice + machHeader64Size;

  for (let index = 0; index < commands; index += 1) {
    if (file.length < command + 8) return undefined;
    const kind = file.readUInt32LE(command);
    const size = file.readUInt32LE(command + 4);

    if (kind === segmentCommand64 && nameAt(file, command + 8) === "__TEXT") {
      const sections = file.readUInt32LE(command + 64);

      for (let at = 0; at < sections; at += 1) {
        const section = command + segmentCommand64Size + at * section64Size;
        if (nameAt(file, section) !== "__info_plist") continue;

        const length = Number(file.readBigUInt64LE(section + 40));
        const start = slice + file.readUInt32LE(section + 48);
        return start + length <= file.length ? file.subarray(start, start + length) : undefined;
      }
    }

    if (size === 0) return undefined;
    command += size;
  }

  return undefined;
};

/** The text of the Info.plist the executable carries, or nothing when it carries none. */
export const embeddedInfoPlist = (file: Buffer): string | undefined => {
  try {
    const slice = firstSliceOf(file);
    if (slice === undefined) return undefined;

    return infoPlistSectionIn(file, slice)?.toString("utf8");
  } catch {
    // A read past the end of a truncated or hostile file is the same answer as no Info.plist.
    return undefined;
  }
};

/** One string value from an XML Info.plist, by its key. */
export const infoPlistString = (infoPlist: string, key: string): string | undefined =>
  new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`, "u").exec(infoPlist)?.[1];
