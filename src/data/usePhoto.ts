import { useEffect, useState } from 'react';

import { useSync } from '../sync/controller';
import { firebase } from '../sync/firebase';
import { downloadPhoto } from '../sync/photoSync';
import { photoName, photoUri } from './photos';

/** A displayable URI for a stored photo; fetches it from the cloud if this device lacks it. */
export function usePhotoUri(ref: string | undefined): string | undefined {
  const uid = useSync((s) => s.user?.uid);
  const local = photoUri(ref);
  const name = photoName(ref);
  const [fetched, setFetched] = useState<{ name: string; uri: string } | null>(null);
  useEffect(() => {
    const fb = firebase();
    if (local || !name || !uid || !fb) return;
    let live = true;
    void downloadPhoto(fb.storage, uid, name).then((uri) => {
      if (live && uri) setFetched({ name, uri });
    });
    return () => {
      live = false;
    };
  }, [local, name, uid]);
  return local ?? (fetched && fetched.name === name ? fetched.uri : undefined);
}
