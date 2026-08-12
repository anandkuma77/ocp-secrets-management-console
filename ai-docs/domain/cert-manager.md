# cert-manager Resources

**API Group**: `cert-manager.io/v1`  
**Upstream**: [cert-manager/cert-manager](https://github.com/cert-manager/cert-manager) (pinned: v1.19.2)  
**CRD source config**: `crd-sources.json`

## Resources Displayed

| Kind | Scope | Model | Dashboard Table |
|------|-------|-------|----------------|
| Certificate | Namespaced | `CertificateModel` | `CertificatesTable.tsx` |
| Issuer | Namespaced | `IssuerModel` | `IssuersTable.tsx` |
| ClusterIssuer | Cluster | `ClusterIssuerModel` | `IssuersTable.tsx` |
| CertificateRequest | Namespaced | — | Not displayed (tracked in CRD sources only) |

**Type definitions**: `src/components/crds/Certificate.ts`, `src/components/crds/Issuer.ts`

## Certificate

Represents a TLS certificate managed by cert-manager.

**Key fields displayed in dashboard**:
- `metadata.name`, `metadata.namespace`
- `status.conditions` → Ready condition status
- `status.notAfter` → Expiry date, drives expiry badge color logic

**Expiry badge logic** (`CertificatesTable.tsx`):
- Expired → red badge
- Expiring within 30 days → yellow badge
- Valid → green badge

**Actions**: Inspect (navigate to ResourceInspect), Delete (with name confirmation)

## Issuer / ClusterIssuer

Certificate issuers — namespace-scoped (`Issuer`) or cluster-scoped (`ClusterIssuer`).

**Key fields displayed**:
- `metadata.name`, `metadata.namespace` (Issuer only)
- `status.conditions` → Ready condition

`IssuersTable.tsx` renders both kinds in a single table, distinguishing by `kind` field.

## Operator Detection

Detected via CRD existence check for `certificates.cert-manager.io` in `useOperatorDetection.ts`. When not installed, cert-manager section is hidden from the dashboard.
