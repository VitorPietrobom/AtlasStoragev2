import { requireOptionalNativeModule } from 'expo';

interface AtlasCutoutNative {
  isSupported(): boolean;
  cutOutAsync(sourceUri: string, outputUri: string): Promise<string>;
}

// Missing in Expo Go and on web; callers fall back to the plain photo.
const native = requireOptionalNativeModule<AtlasCutoutNative>('AtlasCutout');

export function isCutoutAvailable(): boolean {
  try {
    return !!native?.isSupported();
  } catch {
    return false;
  }
}

/**
 * Cut the foreground object out of a photo and add a white die-cut border.
 * Resolves to the PNG's URI, or null if nothing was found or cut-outs are unavailable.
 */
export async function cutOut(sourceUri: string, outputUri: string): Promise<string | null> {
  if (!isCutoutAvailable()) return null;
  try {
    const uri = await native!.cutOutAsync(sourceUri, outputUri);
    return uri || null;
  } catch (e) {
    console.warn('Atlas: cut-out failed', e);
    return null;
  }
}
