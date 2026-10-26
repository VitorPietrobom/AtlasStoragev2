// Firebase setup from EXPO_PUBLIC_FIREBASE_* variables (see .env.example).
// A Firebase web config is not a secret: access is enforced by the security
// rules in firestore.rules and storage.rules.

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { makeAuth } from './auth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
/** "localhost" (or a LAN IP) to use the Firebase emulators instead of the real project. */
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;

export function isFirebaseConfigured(): boolean {
  return !!(config.apiKey && config.projectId && config.appId);
}

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let handles: FirebaseHandles | null = null;

export function firebase(): FirebaseHandles | null {
  if (handles) return handles;
  if (!isFirebaseConfigured()) return null;
  const app = getApps()[0] ?? initializeApp(config);
  const auth = makeAuth(app);
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const storage = getStorage(app);
  if (emulatorHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
    connectStorageEmulator(storage, emulatorHost, 9199);
  }
  handles = { app, auth, db, storage };
  return handles;
}
