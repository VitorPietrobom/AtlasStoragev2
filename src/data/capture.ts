import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { cutOut } from '../../modules/atlas-cutout';
import { keepPhoto } from './photos';

/** Take a photo (or pick one where there is no camera). Resolves to a temporary URI. */
export async function takePhoto(source: 'camera' | 'library' = 'camera'): Promise<string | null> {
  const useCamera = source === 'camera' && Platform.OS !== 'web';
  if (useCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, exif: false };
  const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

export interface StoredPhoto {
  photoRef: string;
  /** Present when an on-device cut-out succeeded. */
  stickerRef?: string;
}

/** Keep the original photo and, when the device can, a cut-out sticker PNG. */
export async function storeWithSticker(tempUri: string, id: string): Promise<StoredPhoto> {
  const photoRef = await keepPhoto(tempUri, id);
  if (Platform.OS === 'web') return { photoRef };
  const out = new File(Paths.cache, `${id}-sticker.png`);
  const cut = await cutOut(tempUri, out.uri);
  if (!cut) return { photoRef };
  const stickerRef = await keepPhoto(cut, `${id}-sticker`);
  return { photoRef, stickerRef };
}
