// Photos and stickers live in the app's documents folder. Records store only
// "photo:<file name>", because the absolute container path changes between
// app installs on iOS. With sync on, the same file name is used in Firebase
// Storage, and a device that lacks a photo downloads it on first view.

import { Directory, File, Paths } from 'expo-file-system';

const PREFIX = 'photo:';

function folder(): Directory {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** The file name behind a stored reference, or null for anything else. */
export function photoName(ref: string | undefined): string | null {
  return ref?.startsWith(PREFIX) ? ref.slice(PREFIX.length) : null;
}

export function photoFile(name: string): File {
  return new File(folder(), name);
}

/** Copy a picked/captured image in and return the reference to store. */
export async function keepPhoto(sourceUri: string, name: string): Promise<string> {
  const ext = sourceUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const fileName = `${name}.${ext}`;
  const dest = photoFile(fileName);
  if (dest.exists) dest.delete();
  await new File(sourceUri).copy(dest);
  return PREFIX + fileName;
}

/** A displayable URI if the photo is on this device. */
export function photoUri(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const name = photoName(ref);
  if (!name) return ref;
  const f = photoFile(name);
  return f.exists ? f.uri : undefined;
}

export function deletePhoto(ref: string | undefined): void {
  const name = photoName(ref);
  if (!name) return;
  try {
    const f = photoFile(name);
    if (f.exists) f.delete();
  } catch {}
}
