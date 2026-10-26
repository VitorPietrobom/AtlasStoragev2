// Web preview: keep the image as a data URL so it survives a reload.

export async function keepPhoto(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith('data:')) return sourceUri;
  const blob = await (await fetch(sourceUri)).blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function photoUri(ref: string | undefined): string | undefined {
  return ref;
}

export function deletePhoto(): void {}
