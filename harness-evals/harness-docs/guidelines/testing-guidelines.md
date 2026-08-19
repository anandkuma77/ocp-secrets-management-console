# Testing Guidelines

Rules and conventions for writing tests in the OCP Secrets Management Console plugin.

## Test Layers

| Layer | Framework | File Pattern | Command |
|---|---|---|---|
| Unit | Jest + @testing-library/react | `src/**/*.spec.{ts,tsx}` | `yarn test` |
| Integration (Jest) | Jest + userEvent | `src/**/*.integration.spec.{ts,tsx}` | `yarn test` |
| E2E pre-merge | Playwright (mock-based) | `integration-tests/tests/*.premerge.spec.ts` | `yarn test-e2e-premerge` |
| E2E post-merge | Playwright (live cluster) | `integration-tests/tests/*.spec.ts` | `yarn test-e2e` |

## File Naming and Placement

- Unit tests: colocate as `ComponentName.spec.tsx` next to source.
- Integration tests: colocate as `ComponentName.integration.spec.tsx`.
- E2E pre-merge: `integration-tests/tests/<feature>.premerge.spec.ts`.
- E2E post-merge: `integration-tests/tests/<feature>.spec.ts`.
- Do NOT add Cypress tests. Legacy `integration-tests/cypress.config.js` exists but Playwright is active.

## Test Selector Convention: `data-test`

This project uses `data-test` (not `data-testid`). Configured in:
- `setup-tests.ts`: `configure({ testIdAttribute: 'data-test' })`
- `playwright.config.ts`: `use: { testIdAttribute: 'data-test' }`

Use suffixes for states: `certificates-table`, `certificates-table-loading`, `certificates-table-error`, `certificates-table-empty`.

## Coverage Thresholds

Jest enforces 50% minimum for branches, functions, lines, and statements.

## Unit Test Conventions

### Global Mocks (`__mocks__/`)

Auto-resolved by Jest -- do NOT re-declare in individual tests:
- `@openshift-console/dynamic-plugin-sdk.tsx` -- stubs SDK components
- `react-i18next.ts` -- `useTranslation` returns key unchanged
- `fileMock.ts` / `styleMock.ts` -- static asset and CSS imports

### Per-Test Mocking

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

### Mocking Child Components

Use `data-test` in mocks so parent tests can verify presence:
```typescript
jest.mock('./components/CertificatesTable', () => ({
  CertificatesTable: ({ selectedProject }: { selectedProject: string }) => (
    <div data-test="certificates-table">Certificates - {selectedProject}</div>
  ),
}));
```

### User Interactions

Use `@testing-library/user-event` (not `fireEvent`):
```typescript
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /Project/i }));
```

## E2E Test Conventions (Playwright)

### Pre-merge (no cluster)

Use Playwright route interception. Import helpers from `integration-tests/support/mock-api.ts`:
```typescript
await mockOperatorDetection(page, { certManager: true, externalSecrets: true });
await mockK8sResourceList(page, 'cert-manager.io', 'v1', 'certificates', items);
await mockNamespaces(page, ['default', 'my-namespace']);
```

### Post-merge (live cluster)

Requires `BRIDGE_BASE_ADDRESS` and `BRIDGE_KUBEADMIN_PASSWORD`. Auth setup in `integration-tests/tests/auth.setup.ts`. Call `checkErrors(page)` in `afterEach`.

### Fixtures

Store mock data in `integration-tests/fixtures/mock-<resource-plural>.json`.

### Locators (priority order)

1. Roles: `page.getByRole('heading', { name: 'Secrets Management' })`
2. Test IDs: `page.locator('[data-test="certificates-table"]')`
3. Text: `page.getByText('No certificates found')`
4. CSS (last resort): prefix with both PF5 and PF6 selectors for compatibility.

## Checklist for New Features

1. Add unit test (`*.spec.tsx`) colocated with component.
2. Add integration test (`*.integration.spec.tsx`) if component has user interactions.
3. Add pre-merge E2E test (`*.premerge.spec.ts`) with mocked API responses.
4. Add fixture JSON if introducing a new K8s resource type.
5. Update `mock-api.ts` if new API route intercepts needed.
6. Add `data-test` attributes to key DOM elements.
7. Run `yarn test -- --coverage` and verify thresholds pass.
8. Run `yarn test-e2e-premerge` to validate locally.
