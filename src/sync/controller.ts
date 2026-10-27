// Ties sync to the signed-in Firebase user: start on sign-in, stop on sign-out,
// push shortly after every local change.

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { create } from 'zustand';

import { syncStore } from '../data/persistence';
import { onLocalWrite, useAtlas } from '../data/store';
import { SyncEngine, type SyncStatus } from './engine';
import { firebase, isFirebaseConfigured } from './firebase';
import { FirestoreRemote } from './firestoreRemote';
import { uploadPhotos } from './photoSync';

interface SyncState {
  configured: boolean;
  user: { uid: string; email: string | null } | null;
  status: SyncStatus | null;
  start(): void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
}

let engine: SyncEngine | null = null;
let started = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export const useSync = create<SyncState>((set, get) => ({
  configured: isFirebaseConfigured(),
  user: null,
  status: null,

  start() {
    if (started) return;
    started = true;
    const fb = firebase();
    if (!fb) return;

    onLocalWrite(() => {
      if (!engine) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void get().syncNow(), 800);
    });

    onAuthStateChanged(fb.auth, (user) => {
      engine?.stop();
      engine = null;
      set({ user: user ? { uid: user.uid, email: user.email } : null, status: null });
      if (!user) return;
      engine = new SyncEngine(
        syncStore,
        new FirestoreRemote(fb.db, user.uid),
        (records) => useAtlas.getState().applyRemote(records),
        (status) => set({ status }),
      );
      void engine.start().then(() => uploadPhotos(fb.storage, user.uid, useAtlas.getState().tables).catch(() => {}));
    });
  },

  async signIn(email, password) {
    const fb = firebase();
    if (!fb) throw new Error('Firebase is not configured');
    await signInWithEmailAndPassword(fb.auth, email.trim(), password);
  },

  async signUp(email, password) {
    const fb = firebase();
    if (!fb) throw new Error('Firebase is not configured');
    await createUserWithEmailAndPassword(fb.auth, email.trim(), password);
  },

  async resetPassword(email) {
    const fb = firebase();
    if (!fb) throw new Error('Firebase is not configured');
    await sendPasswordResetEmail(fb.auth, email.trim());
  },

  async signOut() {
    const fb = firebase();
    if (fb) await fbSignOut(fb.auth);
  },

  async syncNow() {
    const fb = firebase();
    const user = get().user;
    if (!engine || !fb || !user) return;
    await engine.push();
    await uploadPhotos(fb.storage, user.uid, useAtlas.getState().tables).catch((e) => console.warn('Atlas: photo upload failed', e));
  },
}));

/** Human words for Firebase auth errors. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'That email and password don’t match an account.';
  if (code.includes('email-already-in-use')) return 'There is already an account with that email. Sign in instead.';
  if (code.includes('weak-password')) return 'Use at least 6 characters for the password.';
  if (code.includes('invalid-email')) return 'That doesn’t look like an email address.';
  if (code.includes('network')) return 'No connection. Try again when you’re online.';
  if (code.includes('operation-not-allowed')) return 'Email sign-in is off in the Firebase console (Authentication → Sign-in method).';
  return e instanceof Error ? e.message : 'Something went wrong.';
}
