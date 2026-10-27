// Photos ride along with sync: uploaded to Firebase Storage under the same
// file name (users/{uid}/photos/{name}), downloaded when a device lacks one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import type { Tables } from '../core/types';
import { photoFile, photoName } from '../data/photos';

const UPLOADED_KEY = 'atlas.photos.uploaded';

function refsIn(t: Tables): string[] {
  const out: string[] = [];
  for (const i of Object.values(t.items)) out.push(i.photoUri ?? '', i.stickerUri ?? '');
  for (const b of Object.values(t.bins)) out.push(b.photoUri ?? '');
  return out.map(photoName).filter((n): n is string => !!n);
}

let running: Promise<void> | null = null;

/** Upload every local photo the cloud doesn't have yet. */
export function uploadPhotos(storage: FirebaseStorage, uid: string, t: Tables): Promise<void> {
  running ??= (async () => {
    try {
      const done = new Set<string>(JSON.parse((await AsyncStorage.getItem(UPLOADED_KEY)) ?? '[]'));
      for (const name of refsIn(t)) {
        if (done.has(name)) continue;
        const f = photoFile(name);
        if (!f.exists) continue;
        await uploadBytes(ref(storage, `users/${uid}/photos/${name}`), await f.bytes(), {
          contentType: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
        });
        done.add(name);
        await AsyncStorage.setItem(UPLOADED_KEY, JSON.stringify([...done]));
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

const downloading = new Map<string, Promise<string | undefined>>();

/** Fetch a photo this device doesn't have; resolves to its local URI. */
export function downloadPhoto(storage: FirebaseStorage, uid: string, name: string): Promise<string | undefined> {
  let p = downloading.get(name);
  if (!p) {
    p = (async () => {
      try {
        const url = await getDownloadURL(ref(storage, `users/${uid}/photos/${name}`));
        const dest = photoFile(name);
        if (!dest.exists) await File.downloadFileAsync(url, dest);
        return dest.uri;
      } catch {
        downloading.delete(name);
        return undefined;
      }
    })();
    downloading.set(name, p);
  }
  return p;
}
