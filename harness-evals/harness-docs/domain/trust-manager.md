# trust-manager Resources

**API Group**: `trust.cert-manager.io/v1alpha1`  
**Upstream**: [cert-manager/trust-manager](https://github.com/cert-manager/trust-manager) (pinned: v0.20.3)  
**CRD source config**: `crd-sources.json`

## Resources Displayed

| Kind | Scope | Model | Dashboard Table |
|------|-------|-------|----------------|
| Bundle | Cluster | `BundleModel` | `BundlesTable.tsx` |

**Type definitions**: `src/components/crds/Bundle.ts`

## Bundle

Distributes CA trust bundles across namespaces. Cluster-scoped — always visible regardless of project filter.

**Key interfaces** (`Bundle.ts`):
- `Bundle` — main resource with `spec.sources` and `spec.target`
- `BundleSource` — source of trust data (configMap, secret, inLine, useDefaultCAs)
- `BundleTarget` — where to write the bundle (configMap, secret with key name)

**Key fields displayed**: `metadata.name`, `status.conditions`

**API version**: `v1alpha1` — may change in future trust-manager releases.

## Operator Detection

Detected via CRD existence check for `bundles.trust.cert-manager.io` in `useOperatorDetection.ts`. Tracked as part of `trustManager` in the detection hook, separate from `certManager`.
