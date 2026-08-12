@AGENTS.md

# Claude Code instructions

This project uses generated CRD types and a shim at `src/components/crds/`. When you or a developer changes code that imports from `./crds` or `./components/crds` (or adds new CRD kinds), the following must stay in sync:

- **crd-sources.json** – every CRD kind used in the code must have an entry
- **scripts/generate-types.ts** – emits models with `version` and `group` for the Console SDK
- **src/components/crds/index.ts** – re-exports from generated types and Events, plus union types and type guards
- **src/components/crds/Events.ts** – `EventModel`, `K8sEvent`, `getInvolvedObjectKind`

**After changing CRD/crds usage:** Run `make sync-crd-types` (uses Cursor agent or this Claude CLI if available; otherwise prints a prompt to paste into Claude or Cursor). Then run `make update-types` if needed and `make verify`.

**Full sync task:** Follow the steps in **scripts/sync-crd-types-prompt.md** (same prompt is used by `make sync-crd-types` for both Cursor and Claude).

**Before opening a PR:** Run `make update` then `make verify`.
