# Secrets Management Console - Agentic Documentation

**Component**: OCP Secrets Management Console Plugin  
**Repository**: openshift/ocp-secrets-management-console  
**Stack**: React 18 + TypeScript 5 + PatternFly 6 + Console Dynamic Plugin SDK  

> **Generic Platform Patterns**: See Platform documentation (openshift/enhancements/ai-docs/) for operator patterns, testing practices, security guidelines, and cross-repo ADRs.

## What is Secrets Management Console?

OpenShift Console dynamic plugin providing a unified dashboard for viewing and inspecting resources from cert-manager, External Secrets Operator (ESO), Secrets Store CSI Driver (SSCSID), and trust-manager operators. Display-only — reads and deletes resources, never creates or modifies them.

## Core Components

| Component | Role | Source |
|-----------|------|--------|
| `SecretsManagement` | Main dashboard: operator/resource/project filters + 7 resource tables | `src/SecretsManagement.tsx` |
| `ResourceInspect` | Detail view: metadata, spec YAML, status, events, pod statuses | `src/ResourceInspect.tsx` |
| `useOperatorDetection` | CRD-existence check hook — drives conditional rendering | `src/hooks/useOperatorDetection.ts` |
| `ResourceTable` | Reusable paginated table with loading/error/empty states | `src/components/ResourceTable.tsx` |
| `crds/*` | CRD model definitions + TypeScript interfaces (13 kinds, 4 operators) | `src/components/crds/` |

## Operators & CRDs (13 kinds)

| Operator | Kinds | API Group |
|----------|-------|-----------|
| cert-manager (v1.19.2) | Certificate, Issuer, ClusterIssuer, CertificateRequest | `cert-manager.io/v1` |
| trust-manager (v0.20.3) | Bundle | `trust.cert-manager.io/v1alpha1` |
| ESO (v0.20.4) | ExternalSecret, ClusterExternalSecret, SecretStore, ClusterSecretStore, PushSecret, ClusterPushSecret | `external-secrets.io/v1` / `v1alpha1` |
| SSCSID (v1.4.0) | SecretProviderClass, SecretProviderClassPodStatus | `secrets-store.csi.x-k8s.io/v1` |

## Critical Patterns

| Rule | Detail |
|------|--------|
| **CRD type sync** | 4 files must stay in sync: `crd-sources.json`, `scripts/generate-types.ts`, `src/components/crds/index.ts`, `src/components/crds/Events.ts`. Run `make sync-crd-types` → `make update-types` → `make verify` |
| **Never hand-edit generated types** | Files with "Auto-generated from CRD" header are output of `yarn generate-types`. Edit `scripts/generate-types.ts` instead |
| **URL routing is manual** | `useParams()` does NOT work in Console plugin. Parse `window.location.pathname.split('/')`. Navigate via `window.location.href`, back via `window.history.back()` |

## Documentation Structure

```text
ai-docs/
├── domain/                           # CRD types: cert-manager, ESO, SSCSID, trust-manager
├── architecture/components.md        # Plugin internals, data flow, extension points
├── decisions/                        # Component ADRs (2 accepted + template)
├── exec-plans/                       # Feature planning
├── references/
│   ├── ecosystem.md                  # Platform links
│   └── enhancements.md               # Design docs + upstream project versions
├── SM_DEVELOPMENT.md                 # Dev workflows, common tasks, make targets
└── SM_TESTING.md                     # Jest unit + Playwright E2E (pre-merge/post-merge)
```

## Deep-Dive Guidelines

Domain-specific rules and conventions in `docs/`:

| Guideline | Scope |
|-----------|-------|
| [Security](docs/security-guidelines.md) | Auth/authz, RBAC tiers, delete confirmation, sensitive data masking, container security, supply chain |
| [Performance](docs/performance-guidelines.md) | WebSocket watch budget (~13 watches), conditional rendering gates, pagination, operator detection sequencing |
| [Error Handling](docs/error-handling-guidelines.md) | useK8sWatchResource tuple, ResourceTable tri-state, operator detection 404 vs errors, delete error flow, ResourceInspect error cascade |
| [API Contracts](docs/api-contracts-guidelines.md) | CRD model shape, operator/CRD groups, TypeScript interface conventions, K8s API access patterns, URL routing |
| [Testing](docs/testing-guidelines.md) | Test layers, `data-test` convention, coverage thresholds, mock patterns, E2E conventions, new feature checklist |
| [Integration](docs/integration-guidelines.md) | Console plugin registration, SDK usage, operator detection, CRD version pinning, adding new operator/CRD checklists |

**Before opening a PR**: `make update` then `make verify`

**Testing**: `make plugin-test` (unit) | `make test-e2e-premerge` (mock E2E) | `make test-e2e` (live cluster E2E)

**AI Agent Path**: domain/ → architecture/ → decisions/ → SM_DEVELOPMENT.md

## External References

- [Console Plugin SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk) | [PatternFly 6](https://www.patternfly.org/)
- [cert-manager](https://github.com/cert-manager/cert-manager) | [external-secrets](https://github.com/external-secrets/external-secrets)
- [secrets-store-csi-driver](https://github.com/kubernetes-sigs/secrets-store-csi-driver) | [trust-manager](https://github.com/cert-manager/trust-manager)

---

**Platform Documentation**: openshift/enhancements/ai-docs/
