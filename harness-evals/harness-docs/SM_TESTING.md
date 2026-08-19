# Secrets Management Console - Testing Guide

> **Generic Testing Practices**: See [Platform Testing Practices](https://github.com/openshift/enhancements/tree/master/ai-docs/practices/testing) for test pyramid philosophy and E2E framework patterns.

This guide covers **Secrets Management Console-specific** test suites.

## Test Organization

| Layer | Framework | Location | Runner |
|-------|-----------|----------|--------|
| Unit | Jest 30 + @testing-library/react + SWC | `src/**/*.spec.{ts,tsx}` | `yarn test` / `make plugin-test` |
| Integration | Jest (same config) | `src/**/*.integration.spec.{ts,tsx}` | `yarn test` |
| E2E pre-merge | Playwright (mock-based) | `integration-tests/tests/*.premerge.spec.ts` | `make test-e2e-premerge` |
| E2E post-merge | Playwright (live cluster) | `integration-tests/tests/*.spec.ts` | `make test-e2e` |

## Unit Tests

### Configuration

- Config: `jest.config.ts` — jsdom environment, SWC transform via `@swc/jest`
- Setup: `setup-tests.ts` — imports `@testing-library/jest-dom`, sets `testIdAttribute: 'data-test'`
- Coverage thresholds: **50%** branches, functions, lines, statements

### Mocks

| Mock | Path | Purpose |
|------|------|---------|
| Console SDK | `__mocks__/@openshift-console/dynamic-plugin-sdk.tsx` | `useK8sWatchResource`, `consoleFetch`, etc. |
| react-i18next | `__mocks__/react-i18next.ts` | `useTranslation` returns key as-is |
| Files | `__mocks__/fileMock.ts` | Static file imports |
| Styles | `__mocks__/styleMock.ts` | CSS module imports |

### Key Test Files

| File | Lines | Covers |
|------|-------|--------|
| `SecretsManagement.spec.tsx` | ~870 | Dashboard structure, loading, filtering, error handling, a11y, i18n |
| `SecretsManagement.integration.spec.tsx` | ~450 | User interactions with `userEvent` |
| `ResourceTable.spec.tsx` | — | Pagination, loading/error/empty states |
| `BundlesTable.spec.tsx` | — | Cluster-scoped resource rendering |
| `OperatorNotInstalled.spec.tsx` | — | Empty state display |
| `useOperatorDetection.spec.ts` | — | CRD existence checking logic |
| `plugin-metadata.spec.ts` | — | Plugin name consistency (package.json ↔ locale file) |

### Running

```bash
yarn test                          # all unit + integration tests
yarn test -- --watch               # watch mode
yarn test -- --coverage            # with coverage report
make plugin-test                   # containerized
```

### Test Selector Convention

Use `data-test` attribute (not `data-testid`). Configured in `setup-tests.ts`:
```typescript
configure({ testIdAttribute: 'data-test' });
```

Query with `getByTestId` / `queryByTestId` from @testing-library.

Use suffixes for state variants: `certificates-table`, `certificates-table-loading`, `certificates-table-error`, `certificates-table-empty`.

### Per-Test Mocking Pattern

```typescript
jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: jest.fn(),
  consoleFetch: jest.fn(),
}));
const mockUseK8sWatchResource = useK8sWatchResource as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  mockUseK8sWatchResource.mockReturnValue([mockData, true, undefined]);
});
```

Mock child components with `data-test` so parent tests can verify presence:
```typescript
jest.mock('./components/CertificatesTable', () => ({
  CertificatesTable: ({ selectedProject }: { selectedProject: string }) => (
    <div data-test="certificates-table">Certificates - {selectedProject}</div>
  ),
}));
```

Use `@testing-library/user-event` (not `fireEvent`) for user interactions:
```typescript
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /Project/i }));
```

## E2E Tests (Playwright)

### Configuration

- Config: `playwright.config.ts`
- Two Playwright projects:
  - `pre-merge` — matches `*.premerge.spec.ts`, mock-based, no cluster
  - `chromium` — post-merge, requires live cluster + `setup` auth project

### Pre-merge Tests (no cluster required)

Use Playwright route interception to mock K8s API responses:

```typescript
// integration-tests/support/mock-api.ts
mockOperatorDetection(page, { certManager: true, externalSecrets: true, ... })
mockK8sResourceList(page, model, items)
mockNamespaces(page, namespaces)
mockDeleteResource(page, model)
```

| Test File | Covers |
|-----------|--------|
| `dashboard-resources.premerge.spec.ts` | Dashboard renders with mocked data |
| `empty-state.premerge.spec.ts` | Empty state when no resources |
| `plugin-hidden.premerge.spec.ts` | Plugin hidden when no operators installed |

### Post-merge Tests (live cluster required)

**Environment variables**:
- `BRIDGE_BASE_ADDRESS` — Console URL
- `BRIDGE_KUBEADMIN_PASSWORD` — kubeadmin password

**Auth setup**: `integration-tests/tests/auth.setup.ts` — kubeadmin login, storage state saved to `integration-tests/.auth/user.json`

| Test File | Covers |
|-----------|--------|
| `inspect-pane.spec.ts` | Resource detail/inspect view |
| `cert-expiry-warning.spec.ts` | Certificate expiry badge colors |
| `csi-secret-provider.spec.ts` | CSI SecretProviderClass display |
| `delete-resource.spec.ts` | Delete via UI (uses `oc` CLI for setup/teardown) |

### Running

```bash
yarn test-e2e-premerge             # pre-merge only (no cluster)
yarn test-e2e                      # post-merge (needs cluster)
yarn test-e2e-headless             # post-merge headless
make test-e2e-premerge             # containerized pre-merge
make test-e2e                      # containerized post-merge
make test-e2e-all                  # all E2E tests
```

### Fixtures

Mock data in `integration-tests/fixtures/`:
- `mock-certificates.json`
- `mock-external-secrets.json`
- `mock-issuers.json`
- `mock-secret-provider-classes.json`

## CI/CD Testing

- **OpenShift CI**: `.ci-operator.yaml`
- **Konflux**: `.tekton/` pipelines
- **Prow E2E**: `test-prow-e2e.sh` runner script
- **Coverage**: `images/ci/Dockerfile.coverage` for CI coverage reporting, `.codecov.yml` config

### Playwright Locator Priority

1. Roles: `page.getByRole('heading', { name: 'Secrets Management' })`
2. Test IDs: `page.locator('[data-test="certificates-table"]')`
3. Text: `page.getByText('No certificates found')`
4. CSS (last resort): prefix with both PF5 and PF6 selectors for compatibility

### Checklist for New Features

1. Add unit test (`*.spec.tsx`) colocated with component
2. Add integration test (`*.integration.spec.tsx`) if component has user interactions
3. Add pre-merge E2E test (`*.premerge.spec.ts`) with mocked API responses
4. Add fixture JSON in `integration-tests/fixtures/` if introducing a new K8s resource type
5. Update `mock-api.ts` if new API route intercepts needed
6. Add `data-test` attributes to key DOM elements (with state suffixes)
7. Run `yarn test -- --coverage` and verify 50% thresholds pass
8. Run `yarn test-e2e-premerge` to validate locally

## Legacy

Cypress config exists at `integration-tests/cypress.config.js` — being replaced by Playwright. Do not add new Cypress tests.

## See Also

- [Development Guide](./SM_DEVELOPMENT.md)
- [Architecture](./architecture/components.md)
- [Testing Guidelines](./guidelines/testing-guidelines.md) — full mock patterns, E2E conventions, new feature checklist
