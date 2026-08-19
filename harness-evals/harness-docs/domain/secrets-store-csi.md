# Secrets Store CSI Driver Resources

**API Group**: `secrets-store.csi.x-k8s.io/v1`  
**Upstream**: [kubernetes-sigs/secrets-store-csi-driver](https://github.com/kubernetes-sigs/secrets-store-csi-driver) (pinned: v1.4.0)  
**CRD source config**: `crd-sources.json`

## Resources Displayed

| Kind | Scope | Model | Dashboard Table |
|------|-------|-------|----------------|
| SecretProviderClass | Namespaced | `SecretProviderClassModel` | `SecretProviderClassTable.tsx` |
| SecretProviderClassPodStatus | Namespaced | `SecretProviderClassPodStatusModel` | ResourceInspect Pod Statuses tab |

**Type definitions**: `src/components/crds/SecretProviderClass.ts`

## SecretProviderClass

Defines how secrets are mounted into pods via CSI volumes. Specifies the provider (e.g., Azure, AWS, Vault) and parameters for secret retrieval.

**Key fields displayed**: `metadata.name`, `metadata.namespace`, provider type

## SecretProviderClassPodStatus

Tracks which pods have mounted a given SecretProviderClass. Displayed in the ResourceInspect detail view under the "Pod Statuses" tab — only visible for SecretProviderClass resources.

## Operator Detection

Detected via CRD existence check for `secretproviderclasses.secrets-store.csi.x-k8s.io` in `useOperatorDetection.ts`.
