# External Secrets Operator Resources

**API Group**: `external-secrets.io/v1` (PushSecret: `v1alpha1`)  
**Upstream**: [external-secrets/external-secrets](https://github.com/external-secrets/external-secrets) (pinned: v0.20.4)  
**CRD source config**: `crd-sources.json`

## Resources Displayed

| Kind | Scope | Model | Dashboard Table |
|------|-------|-------|----------------|
| ExternalSecret | Namespaced | `ExternalSecretModel` | `ExternalSecretsTable.tsx` |
| ClusterExternalSecret | Cluster | `ClusterExternalSecretModel` | `ExternalSecretsTable.tsx` |
| SecretStore | Namespaced | `SecretStoreModel` | `SecretStoresTable.tsx` |
| ClusterSecretStore | Cluster | `ClusterSecretStoreModel` | `SecretStoresTable.tsx` |
| PushSecret | Namespaced | `PushSecretModel` | `PushSecretsTable.tsx` |
| ClusterPushSecret | Cluster | `ClusterPushSecretModel` | `PushSecretsTable.tsx` |

**Type definitions**: `src/components/crds/ExternalSecret.ts`, `SecretStore.ts`, `PushSecret.ts`

## Union Types and Type Guards

Namespaced + cluster-scoped variants use union types with type guards:

```typescript
// ExternalSecret.ts
type ExternalSecretResource = ExternalSecret | ClusterExternalSecret;
function isClusterExternalSecret(r: ExternalSecretResource): r is ClusterExternalSecret

// PushSecret.ts
type PushSecretResource = PushSecret | ClusterPushSecret;
function isClusterPushSecret(r: PushSecretResource): r is ClusterPushSecret
```

Tables render both variants together, using type guards for conditional namespace display.

## ExternalSecret / ClusterExternalSecret

Syncs secrets from external providers (AWS Secrets Manager, Vault, etc.) into Kubernetes Secrets.

**Key fields displayed**: `metadata.name`, `metadata.namespace`, `status.conditions`

## SecretStore / ClusterSecretStore

Configures the backend secret provider connection.

**Key fields displayed**: `metadata.name`, `metadata.namespace`, `status.conditions`

## PushSecret / ClusterPushSecret

Pushes Kubernetes Secrets to external providers (reverse of ExternalSecret).

**API version**: `external-secrets.io/v1alpha1` (alpha — may change)

## Operator Detection

Detected via CRD existence check for `externalsecrets.external-secrets.io` in `useOperatorDetection.ts`.
