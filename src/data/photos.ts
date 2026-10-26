// Photos and stickers live in the app's documents folder. Records store only
// "photo:<file name>", because the absolute container path changes between
// app installs on iOS.

import { Directory, File, Paths } from 'expo-file-system';

const PREFIX = 'photo:';

function folder(): Directory {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Copy a picked/captured image in and return the reference to store. */
export async function keepPhoto(sourceUri: string, name: string): Promise<string> {
  const ext = sourceUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const fileName = `${name}.${ext}`;
  const dest = new File(folder(), fileName);
  if (dest.exists) dest.delete();
  await new File(sourceUri).copy(dest);
  return PREFIX + fileName;
}

/** A displayable URI for a stored reference. */
export function photoUri(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  if (!ref.startsWith(PREFIX)) return ref;
  return new File(folder(), ref.slice(PREFIX.length)).uri;
}

export function deletePhoto(ref: string | undefined): void {
  if (!ref?.startsWith(PREFIX)) return;
  try {
    const f = new File(folder(), ref.slice(PREFIX.length));
    if (f.exists) f.delete();
  } catch {}
}
