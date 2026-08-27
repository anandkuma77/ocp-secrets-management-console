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
| Password, UUID, Fake, Webhook, SSHKey, MFA, Grafana, ACRAccessToken, CloudsmithAccessToken, ECRAuthorizationToken, GCRAccessToken, GithubAccessToken, QuayAccessToken, STSSessionToken, VaultDynamicSecret | Namespaced | `getGeneratorModel(kind)` | `GeneratorsTable.tsx` |
| ClusterGenerator | Cluster | `ClusterGeneratorModel` | `GeneratorsTable.tsx` |

**Type definitions**: `src/components/crds/ExternalSecret.ts`, `SecretStore.ts`, `PushSecret.ts`, `Generator.ts`

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

## Generators / ClusterGenerator

Creates secret values (passwords, UUIDs, cloud access tokens, Vault dynamic secrets, etc.) instead of fetching them from a backend. Namespaced generator kinds live in `generators.external-secrets.io/v1alpha1`. `ClusterGenerator` is the cluster-scoped wrapper that embeds any generator spec.

**Key fields displayed**: `metadata.name`, `metadata.namespace`, `kind`, wrapped generator kind (`spec.kind` for ClusterGenerator), a non-sensitive spec summary, and Ready/Configured status.

`GeneratorState` is operator-internal and is not listed.

## Operator Detection

Detected via CRD existence check for `externalsecrets.external-secrets.io` in `useOperatorDetection.ts`.
