# Platform Ecosystem References

This document links to generic OpenShift/Kubernetes patterns in the Platform ecosystem hub. The plugin inherits platform-wide patterns and practices.

## Console Plugin Patterns

**Component Usage**:
- Dynamic plugin via `@openshift-console/dynamic-plugin-sdk` (module federation)
- PatternFly 6 for UI components (`@patternfly/react-core` ^6.4.3)
- Console SDK hooks for K8s API access (`useK8sWatchResource`, `consoleFetch`)

## Testing Practices

**Location**: [ai-docs/practices/testing/](https://github.com/openshift/enhancements/tree/master/ai-docs/practices/testing)

**Component Usage**:
- Jest 30 + @testing-library/react for unit tests
- Playwright for E2E (pre-merge mock-based + post-merge live cluster)
- See `SM_TESTING.md` for component-specific test suites

## Security Practices

**Location**: [ai-docs/practices/security/](https://github.com/openshift/enhancements/tree/master/ai-docs/practices/security)

**Component Usage**:
- RBAC ClusterRoles for view/delete/admin access levels
- Plugin is display-only (read + delete, no create/modify)
- Delete requires name confirmation dialog

## Kubernetes Fundamentals

**Location**: [ai-docs/domain/kubernetes/](https://github.com/openshift/enhancements/tree/master/ai-docs/domain/kubernetes)

**Component Usage**:
- Watches 13 CRD kinds across 4 operator domains
- Uses CRD existence checks for operator detection
- Event resources for resource detail view

## OpenShift Fundamentals

**Location**: [ai-docs/domain/openshift/](https://github.com/openshift/enhancements/tree/master/ai-docs/domain/openshift)

**Component Usage**:
- ConsolePlugin CR for plugin registration
- Admin perspective navigation integration
- Deploys via Helm chart or OLM operator

## Cross-Repository ADRs

**Location**: [ai-docs/decisions/](https://github.com/openshift/enhancements/tree/master/ai-docs/decisions)

**Component-Specific ADRs**: See `harness-evals/harness-docs/decisions/` for component decisions.

---

**Last Updated**: 2026-08-12
