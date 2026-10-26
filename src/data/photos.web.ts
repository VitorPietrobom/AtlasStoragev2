// Web: photos are kept inline as small data URLs (downscaled), so they sync
// inside their records.

const MAX_SIDE = 480;

export async function keepPhoto(sourceUri: string): Promise<string> {
  const blob = await (await fetch(sourceUri)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function photoName(): string | null {
  return null;
}

export function photoUri(ref: string | undefined): string | undefined {
  return ref;
}

export function deletePhoto(): void {}
