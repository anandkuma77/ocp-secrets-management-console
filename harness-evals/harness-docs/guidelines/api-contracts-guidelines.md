# API Contracts Guidelines

Rules for working with CRD models, TypeScript interfaces, and Kubernetes API access patterns.

## 1. CRD Model Definitions

### Model Object Shape

Every CRD kind requires a model constant with exactly three fields:

```ts
export const CertificateModel = { group: 'cert-manager.io', version: 'v1', kind: 'Certificate' };
```

Do not add `apiVersion`, `apiGroup`, `plural`, or `namespaced` to hand-written shim models -- those belong only in generated models.

### One Model per CRD Kind

Cluster-scoped variants get their own model. Never reuse a namespaced model for its cluster counterpart.

### Naming Convention

Model constants: `{Kind}Model` (e.g., `BundleModel`, `ClusterIssuerModel`).
Interfaces: match the CRD kind exactly (e.g., `Certificate`, `ClusterExternalSecret`).

## 2. Operator and CRD Groups

| Operator | API Group | Versions | Kinds |
|---|---|---|---|
| cert-manager | `cert-manager.io` | `v1` | Certificate, Issuer, ClusterIssuer |
| trust-manager | `trust.cert-manager.io` | `v1alpha1` | Bundle |
| external-secrets | `external-secrets.io` | `v1` | ExternalSecret, ClusterExternalSecret, SecretStore, ClusterSecretStore |
| external-secrets | `external-secrets.io` | `v1alpha1` | PushSecret, ClusterPushSecret |
| external-secrets | `generators.external-secrets.io` | `v1alpha1` | ClusterGenerator + namespaced generator kinds (Password, UUID, Fake, ...) |
| secrets-store-csi | `secrets-store.csi.x-k8s.io` | `v1` | SecretProviderClass, SecretProviderClassPodStatus |

Never hard-code a group or version string inline. Reference `{Kind}Model.group` and `{Kind}Model.version`.

## 3. TypeScript Interface Conventions

### Namespaced vs Cluster-Scoped

- Namespaced: `metadata.namespace` should be required (`string`).
- Cluster-scoped: `metadata.namespace` should be optional (`string?`).
- Always include `metadata.creationTimestamp: string`.

**Note:** When a single interface is shared by both namespaced and cluster-scoped variants (e.g., `Issuer`, `SecretStore`), use `namespace?: string` and rely on separate models to distinguish scope.

### Union Types and Type Guards

When namespaced and cluster-scoped variants share a table:

```ts
export type ExternalSecretResource = ExternalSecret | ClusterExternalSecret;
export const isClusterExternalSecret = (resource: ExternalSecretResource): resource is ClusterExternalSecret => {
  return 'externalSecretSpec' in resource.spec;
};
```

Type guards should use structural checks (property presence or `kind` field) when possible. Prefer checking for a unique spec field (e.g., `'externalSecretSpec' in resource.spec` for ClusterExternalSecret) over namespace presence.

### Condition Status Pattern

All CRDs follow the same shape:
```ts
status?: { conditions?: Array<{ type: string; status: string; reason?: string; message?: string }> };
```

### Core Event Type

Events use the core API (empty group): `{ group: '', version: 'v1', kind: 'Event' }` in `Events.ts`.

## 4. Kubernetes API Access Patterns

### Watching Resources -- useK8sWatchResource

```ts
const [certs, loaded, error] = useK8sWatchResource<Certificate[]>({
  groupVersionKind: CertificateModel,
  namespace: selectedProject === 'all' ? undefined : selectedProject,
  isList: true,
});
```

- **Namespaced list**: pass `namespace` (or `undefined` for all). Use the `selectedProject === 'all' ? undefined : selectedProject` pattern.
- **Cluster-scoped list**: omit `namespace` entirely.
- **Dual watch**: issue two separate calls and combine results in `useMemo`.

### Mutating Resources -- consoleFetch

Path templates (lowercase plural resource names):
```
Namespaced:      /api/kubernetes/apis/{group}/{version}/namespaces/{namespace}/{plural}/{name}
Cluster-scoped:  /api/kubernetes/apis/{group}/{version}/{plural}/{name}
CRD existence:   /api/kubernetes/apis/apiextensions.k8s.io/v1/customresourcedefinitions/{crd-fqdn}
```

Always derive `group` and `version` from the model constant.

### Operator Detection

CRD existence is checked via apiextensions API. CRD fully-qualified name: `{plural}.{group}` (e.g., `certificates.cert-manager.io`).

## 5. CRD Type Definitions

This project uses hand-written CRD type definitions in `src/components/crds/`, not auto-generated types.

Each CRD kind requires:
1. A model constant in `src/components/crds/{Kind}.ts` (e.g., `CertificateModel`).
2. A TypeScript interface matching the CRD structure.
3. Export from `src/components/crds/index.ts`.
4. Entry in `crd-sources.json` for documentation and potential future generation.
5. Mapping in `Events.ts` `getInvolvedObjectKind()` if the resource appears in inspect URLs.

After any CRD usage change:
1. Ensure `crd-sources.json` has an entry for every kind referenced in source.
2. Update or create the model and interface in `src/components/crds/{Kind}.ts`.
3. Export from `src/components/crds/index.ts`.
4. Update `Events.ts` `getInvolvedObjectKind()` if adding a new inspect-able resource.
5. Run `make verify`.

## 6. URL Routing for Resources

```
Namespaced:      /secrets-management/inspect/{resourceType}/{namespace}/{name}
Cluster-scoped:  /secrets-management/inspect/{resourceType}/{name}
```

`resourceType` is the lowercase plural. When adding a new CRD, update both `getResourceModel` in `ResourceInspect.tsx` and `getInvolvedObjectKind` in `Events.ts`.

## 7. Cluster-Scoped Resource Checklist

When working with a cluster-scoped resource:
- Model: no `namespace` in `useK8sWatchResource` call
- Interface: `metadata.namespace` is optional
- consoleFetch path: no `/namespaces/{ns}/` segment
- Inspect URL: two-segment path (no namespace)
- Add `resourceType` to `isClusterScoped` check in `ResourceInspect.tsx`
