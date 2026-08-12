# ADR-0002: CRD Type Generation Pipeline

**Status**: Accepted  
**Date**: 2024-01-01 (estimated from repo history)  
**Deciders**: Secrets Management team  
**Component**: Secrets Management Console

## Context

The plugin displays resources from four upstream projects (cert-manager, external-secrets, secrets-store-csi-driver, trust-manager). TypeScript interfaces for these CRDs need to stay in sync with upstream definitions, but upstream repos don't provide TypeScript types.

## Decision

Two-stage pipeline: `fetch-crds` downloads CRD YAML from upstream GitHub repos at pinned versions, then `generate-types` produces TypeScript interfaces and Console SDK model objects from the OpenAPI schemas embedded in the CRDs.

A hand-maintained shim layer (`src/components/crds/`) adds union types, type guards, the Events model, and re-exports.

## Rationale

- Pinned upstream versions (`crd-sources.json`) ensure reproducible builds
- Generated types guarantee field accuracy against actual CRD schemas
- Shim layer allows adding Console-SDK-specific concerns (model objects with `group`/`version`/`kind`) without polluting generated code
- `make sync-crd-types` provides AI-assisted sync when CRD usage changes

## Consequences

### Positive
- Type-safe CRD access — compiler catches field name mismatches
- Clear upgrade path: bump version in `crd-sources.json`, run `make update-types`

### Negative
- Four files must stay in sync (see AGENTS.md critical patterns)
- Generated files must never be hand-edited — edits are lost on regeneration

## References

- `crd-sources.json` — upstream repo + version + CRD file paths
- `scripts/fetch-crds.ts` — YAML download from GitHub
- `scripts/generate-types.ts` — TypeScript generation from OpenAPI schemas
- `scripts/sync-crd-types-prompt.md` — AI-assisted sync task prompt
