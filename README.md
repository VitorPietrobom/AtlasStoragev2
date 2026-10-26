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
| 1 | Where data lives | SwiftData + CloudKit | **SQLite on the device** (`expo-sqlite`) | Still on-device, free, no server. CloudKit doesn't exist on Android, so sync is an M2 choice (Supabase or a backup file) |
| 2 | Photo AI | Claude vision call | **DeepSeek** (planned, M3) | Cheaper. Behind an adapter with a configurable model name; DeepSeek's vision model id has changed during 2026, so check it at M3 |
| 3 | Cut-outs | Apple Vision masking | **Apple Vision on iOS, ML Kit subject segmentation on Android** | Same on-device approach on both platforms, in a local Expo module |
| 4–10 | Others bin, 70% cutoff, sort at 8, nudge 4/30d, stale 3 months, PDF labels, iOS 17 | as spec | as spec | Values live in `Settings` (`src/core/types.ts`) |

## Run it

```bash
npm install
npm test            # rules engine: addresses, lift steps, resize/merge, deletes, search, filing
npm run typecheck
npx expo start      # then press w for a web preview, or scan with a dev build
```

**On your iPhone.** The app uses a custom native module (cut-outs) and SQLite, so it runs in a *development build*, not in Expo Go:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios   # installs on your registered iPhone
npx expo start --dev-client
```

EAS builds in the cloud, so you don't need Xcode locally (you do need an Apple developer account to install on a device). The same command with `--platform android` will build for Android later.

**Web preview.** `npx expo start --web` runs the whole app in a browser, storing data in `localStorage`. It has no camera or cut-outs (you pick photos from disk instead). First run offers **Try with a sample house**, which loads the wardrobe and under-bed drawer from the boards.

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
src/data/          SQLite persistence (web: localStorage), Zustand store, photos, capture
src/components/    Level grid, stickers, pickers, UI kit built on the design tokens
src/app/           Screens (expo-router): level view, setup, editor, bin, item, add, search, out, history
modules/atlas-cutout/  Native cut-out module (Swift + Kotlin)
```

Every operation in `src/core/ops.ts` returns new tables without mutating its input. The store diffs old against new by reference and writes only the changed records.

## Known gaps

- **The native cut-out module hasn't been compiled yet.** It was written against the SDK 58 module API (`@ExpoModule`/`@JS`) in an environment with no Xcode or Android SDK. If it fails to build or finds nothing, the app keeps working with the plain photo in a white sticker frame. The add screen says which path it took. Please run the first development build and report any build errors.
- No live camera outline yet (D9); M1 uses the system camera.
- Not built yet (M2): the search answer card with the level locator and numbered lift steps (D2), "It wasn't there", the front-row nudge UI, QR label PDF, sync, export.
- Not built yet (M3): DeepSeek filing (Place, D8), corrections, sorting Others (D14), setup/audit from one photo (D10).
