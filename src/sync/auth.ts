import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
// The React Native build of firebase/auth exports this; the web typings don't list it.
// @ts-expect-error getReactNativePersistence exists in the react-native entry point
import { getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';

/** On the phone, keep the sign-in across app restarts in AsyncStorage. */
export function makeAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
