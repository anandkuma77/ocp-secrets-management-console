# Error Handling Guidelines

Conventions for error handling in the ocp-secrets-management-console dynamic plugin.

## 1. useK8sWatchResource: the [data, loaded, loadError] Tuple

Every resource table destructures the SDK hook and passes to `ResourceTable`:

```tsx
const [certificates, loaded, loadError] = useK8sWatchResource<Certificate[]>({...});
<ResourceTable loading={!loaded} error={loadError?.message} ... />
```

Rules:
- Pass `loading={!loaded}` (inverted boolean), not the raw `loaded` value.
- Pass `error={loadError?.message}` -- ResourceTable expects `string | undefined`, not an Error object.
- When watching multiple resource types, combine: `loaded = issuersLoaded && clusterIssuersLoaded`, `loadError = issuersError || clusterIssuersError`.

## 2. ResourceTable Tri-State Rendering Order

`ResourceTable` renders states in strict priority: Loading > Error > Empty > Data.

- Always provide `data-test` so tests can assert which state rendered (e.g., `certificates-table-loading`, `certificates-table-error`, `certificates-table-empty`).
- Provide both `emptyStateTitle` and `emptyStateBody`. Make the body project-aware using `selectedProject`.

## 3. Operator Detection: 404 vs Real Errors

`useOperatorDetection` checks CRD existence via `consoleFetch`:

| Response | Meaning | Stored as |
|----------|---------|-----------|
| HTTP 404 or body contains "not found" | CRD not installed | `{ installed: false, error: undefined }` |
| HTTP 500 / network error | Real failure | `{ installed: false, error: "message" }` |
| HTTP 200 + valid CRD JSON | Installed | `{ installed: true, error: undefined }` |

Each operator is checked independently so one failure does not block others.

## 4. Operator Error Display

- **OperatorStatusBadge**: red "Check failed" Badge with Tooltip showing error string.
- **renderOperatorContent()**: gates each section. On error, renders danger Alert with Retry button instead of the table.
- While loading, show Spinner. When no operators detected, render `<NoOperatorsInstalled />`.

## 5. Delete Operation Error Handling

State shape for all table components:
```tsx
const [deleteModal, setDeleteModal] = useState<{
  isOpen: boolean; resource: ResourceType | null;
  isDeleting: boolean; error: string | null;
}>({...});
```

Flow:
1. Set `isDeleting: true`, clear previous `error`.
2. Build API path from model (group/version/plural).
3. Call `consoleFetch(apiPath, { method: 'DELETE' })`.
4. Check `response.ok`. If not OK, read `response.text()` and throw.
5. On success: reset modal. On catch: `error instanceof Error ? error.message : 'Failed to delete'`.

`DeleteConfirmationModal` renders errors as inline Alert at top of modal body. Confirm button shows `isLoading={isDeleting}`.

## 6. consoleFetch Error Handling

When using `consoleFetch` for API calls:
1. Check `response.ok` or `response.status` before reading body.
2. Read `response.text()` for error details (not `.json()`, which may throw).
3. Throw an Error with status code + status text + body for debuggability.
4. In catch: `error instanceof Error ? error.message : 'fallback'`.

## 7. ResourceInspect Error Cascade

Priority order:
1. **Invalid resource type** (no matching model) -- danger Alert, blocks page.
2. **Loading** -- dot animation while `allLoaded` is false.
3. **Load error** -- danger Alert, blocks page.
4. **Resource not found** (loaded but null) -- warning Alert, blocks page.
5. **Events error** -- warning Alert within Events card, non-blocking.

Primary resource errors use `danger` variant and block; secondary data errors use `warning` and are section-scoped.

## 8. Special Error Translation

`PushSecretsTable` translates a specific K8s error into user-friendly text:
```tsx
if (loadError?.message?.includes('no matches for kind')) {
  return t('PushSecret CRDs are not available. This feature requires External Secrets Operator v0.9.0 or later.');
}
```

When a specific API error maps to a known user scenario, translate it into actionable guidance.

## 9. PatternFly Components for Errors

| Context | Component | Variant | Blocking? |
|---------|-----------|---------|-----------|
| Table load error | Alert | danger | Yes |
| Delete failure | Alert (in modal) | danger | No |
| Inspect load error | Alert | danger | Yes |
| Resource not found | Alert | warning | Yes |
| Events load error | Alert | warning | No |
| Operator detection error | Alert + Badge/Tooltip | danger | Yes |
| No operators installed | EmptyState | sm | Yes |
