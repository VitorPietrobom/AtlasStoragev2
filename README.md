# Atlas

A personal storage app that answers two questions: **"where is X, and what do I lift to reach it?"** and **"where should this go?"** It tracks bins in configurable storage units (a wardrobe with deep shelves, an under-bed drawer), records every take-out and return, and turns each item into a cut-out photo sticker.

Design source: the *Atlas v1* canvas, page D (boards D1–D17). Spec: *Atlas v1 — build spec*.

## Status

**M1 (model and browsing): built.** M2 and M3 are next.

| M1 acceptance | State |
| --- | --- |
| Create the wardrobe (A–E) and the under-bed drawer through the setup flow | ✅ Setup flow (D5); the sample house builds exactly this |
| Level view shows all slot states from D1, light and dark | ✅ default, wide, stale, out, stack, free; open-top, drawers, loose shelf (D4) |
| Merge two slots; resize a level and see bins go to Unplaced, numbers unchanged | ✅ Storage editor (D3) + Unplaced tray (D12): tap a bin, then a slot |
| Add items by photo with on-device cut-outs and typed names | ✅ Add screen; cut-outs need a device build (see below) |
| Bin and Item screens show slot, reach cost and history | ✅ D6, D7; take out with "how many", return, moved elsewhere |

Also in place early, because the M1 screens lean on them: local search with categories first and easiest reach first (D15), the Out list and History (D17). The rules for M2/M3 (lift-step text, front-row nudge, AI filing cutoff, Others sorting) are written and tested in `src/core`, but no screen uses them yet.

## Stack, and how it differs from the spec

| # | Decision | Spec default | Chosen | Why |
| --- | --- | --- | --- | --- |
| — | App framework | Native SwiftUI | **Expo (React Native) + TypeScript** | One codebase for iPhone now and Android later |
| 1 | Where data lives | SwiftData + CloudKit | **SQLite on the device, synced to Firebase** (Firestore + Storage) | Offline-first and free at this scale; works on iPhone, Android and web. The cloud copy is an organised database you can reuse from any other UI (see *Sync with Firebase*) |
| 2 | Photo AI | Claude vision call | **DeepSeek** (planned, M3) | Cheaper. Behind an adapter with a configurable model name; DeepSeek's vision model id has changed during 2026, so check it at M3 |
| 3 | Cut-outs | Apple Vision masking | **Apple Vision on iOS, ML Kit subject segmentation on Android** | Same on-device approach on both platforms, in a local Expo module |
| 4–10 | Others bin, 70% cutoff, sort at 8, nudge 4/30d, stale 3 months, PDF labels, iOS 17 | as spec | as spec | Values live in `Settings` (`src/core/types.ts`) |

## Run it

```bash
npm install
npm test               # rules engine + sync engine (emulator tests are skipped here)
npm run test:emulator  # sync against the Firebase emulators with the real security rules (needs Java)
npm run typecheck
```

### On your iPhone, with Expo Go (no Apple developer account needed)

1. Install **Expo Go** from the App Store on the iPhone.
2. On your computer (Mac, Windows or Linux, with [Node.js](https://nodejs.org) 20+), clone this repo and run:
   ```bash
   npm install
   npm run go        # starts Metro in Expo Go mode and prints a QR code
   ```
3. Scan the QR code with the iPhone camera. Atlas opens inside Expo Go.

The phone and computer must be on the same Wi-Fi. If they aren't, use `npx expo start --go --tunnel`. The computer has to be running while you use the app this way. Your data is stored on the phone, though, and with sync on it's also in Firebase.

**What's missing in Expo Go:** only the automatic cut-out stickers (that needs a custom build). Photos show in a white sticker frame instead. Everything else works: camera, SQLite, sync.

**Later:** an installable Android app is free (`npx eas-cli@latest build --profile preview --platform android` gives you an APK) and includes the cut-outs. A standalone iPhone install needs the $99/year Apple Developer Program: `npx eas-cli@latest build --profile development --platform ios`.

### In a browser

`npx expo start --web` runs the whole app in a browser, storing data in `localStorage` (and syncing too, if configured). It has no camera or cut-outs; you pick photos from disk instead. First run offers **Try with a sample house**, which loads the wardrobe and under-bed drawer from the boards.

## Sync with Firebase

Atlas works fully offline without an account. Sync is optional: sign in from **Settings → Sync**.

### Set up your Firebase project (once, about 10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** (e.g. `atlas`). Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database.** Start in **production mode** and pick the location nearest to you.
4. **Build → Storage → Get started** (for photos). New Storage buckets need the **Blaze** pay-as-you-go plan. You add a card, but a personal app stays inside the free allowance (5 GB stored). If you skip this step, everything except photos still syncs, and photos stay on the phone that took them.
5. **Project settings (gear) → Your apps → Web (`</>`)**: register an app called `atlas`, then copy the `firebaseConfig` values into a new file `.env.local` (start from `.env.example`).
6. Apply the security rules so only you can read your data. Either paste `firestore.rules` and `storage.rules` into the **Rules** tabs in the console, or run:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules,storage --project <your-project-id>
   ```
7. Restart `npm run go`, open **Settings → Sync** in the app and **Create account**. On another device, **Sign in** with the same email.

### How the data is organised

Each entity has its own collection under your user, and documents are plain fields, so another app (a different UI, a script, the future Android station) can read and write them directly:

```
users/{uid}/units/{id}        name, room, kind, order
users/{uid}/levels/{id}       unitId, code, name, type, reach, across, deep, high, frontLabel, backLabel
users/{uid}/slots/{id}        levelId, column, depth, span, stackIndex
users/{uid}/zones/{id}        levelId, code, name, order
users/{uid}/bins/{id}         number, categoryId, nickname, size, fillEstimate, slotId, lastConfirmedAt, isOthers
users/{uid}/categories/{id}   name, description, binOrder[]
users/{uid}/items/{id}        name, binId, zoneId, quantityTotal, quantityOut, outSince, photoUri, stickerUri
users/{uid}/events/{id}       type, itemId, binId, quantity, fromSlot, toSlot, at
users/{uid}/corrections/{id}  itemName, aiCategoryId, userCategoryId, at
users/{uid}/settings/settings aiCutoff, othersSortAt, nudgeTakeouts, …
Storage: users/{uid}/photos/{file}   (photoUri "photo:abc.jpg" → photos/abc.jpg)
```

Every document also has three sync fields: `_v` (version; the latest wins), `_deleted` (`true` = deleted; keep these as tombstones so other devices learn about it) and `_at` (server time of the write). Another client should write `_v: Date.now()`, `_deleted: false` and `_at: serverTimestamp()`, and Atlas will pick its changes up.

**How sync behaves:** the phone works from its own SQLite copy, so it's instant and works offline. Changes are pushed about a second after you make them; changes from other devices arrive live. If two devices edit the same record, the later edit wins. On a fresh phone, sign in *before* loading the sample house, otherwise both copies end up in your account.

## Layout

```
src/core/          Pure TypeScript domain: the rules are the product
  types.ts         Units, levels, slots, zones, bins, categories, items, events, corrections
  grid.ts          Slot codes (B3·F, B1–2·B, E3), slot generation, resize, merge/split
  reach.ts         Lift steps (front first, a stack counts as one step), answers, reach cost
  naming.ts        "Cables · 1 of 2", stale, the Out list
  ops.ts           Every change: create/move/delete, take out/return; deleting never loses things
  filing.ts        Best bin by room → use frequency → fill order; front-row nudge (M3/M2)
  search.ts        Local fuzzy search: names, nicknames, categories and descriptions
  sample.ts        The house from the design boards
src/data/          SQLite persistence with versions and tombstones (web: localStorage), Zustand store, photos, capture
src/sync/          Sync engine (last writer wins, offline queue), Firestore mapping, Firebase setup, photo upload
src/components/    Level grid, stickers, pickers, UI kit built on the design tokens
src/app/           Screens (expo-router): level view, setup, editor, bin, item, add, search, out, history
modules/atlas-cutout/  Native cut-out module (Swift + Kotlin)
```

Every operation in `src/core/ops.ts` returns new tables without mutating its input. The store diffs old against new by reference and writes only the changed records.

## Known gaps

- **The native cut-out module hasn't been compiled yet.** It was written against the SDK 58 module API (`@ExpoModule`/`@JS`) in an environment with no Xcode or Android SDK. If it fails to build or finds nothing, the app keeps working with the plain photo in a white sticker frame. The add screen says which path it took. Please run the first development build and report any build errors.
- No live camera outline yet (D9); M1 uses the system camera.
- Not built yet (M2): the search answer card with the level locator and numbered lift steps (D2), "It wasn't there", the front-row nudge UI, QR label PDF, export.
- Sync is tested in code (sync engine with two simulated phones; Firestore emulator with the real rules; two browser sessions end to end), but not yet on a real phone or a real Firebase project.
- Bin numbers come from a counter in `settings`. If two devices create bins at the same moment while offline, they could issue the same number. That's unlikely for one person, and fixable later by giving each device its own number range.
- Not built yet (M3): DeepSeek filing (Place, D8), corrections, sorting Others (D14), setup/audit from one photo (D10).
