# ADR-0001: Console Dynamic Plugin Architecture

**Status**: Accepted  
**Date**: 2024-01-01 (estimated from repo history)  
**Deciders**: Secrets Management team  
**Component**: Secrets Management Console

## Context

The team needed a way to provide unified visibility into secrets-related operators (cert-manager, ESO, SSCSID, trust-manager) within the OpenShift Console. Options were: standalone web app, Console static plugin, or Console dynamic plugin.

## Decision

Build as an OpenShift Console dynamic plugin using `@openshift-console/dynamic-plugin-sdk` with module federation via `ConsoleRemotePlugin` webpack plugin.

## Rationale

- Dynamic plugins are loaded at runtime — no Console rebuild required
- Plugin can be deployed/upgraded independently via Helm chart or OLM operator
- Full access to Console SDK hooks (`useK8sWatchResource`, `consoleFetch`) for native K8s API integration
- Plugin is hidden when no managed operators are installed (no UI clutter)

## Consequences

### Positive
- Independent release cycle from Console
- Native look-and-feel with PatternFly components
- Real-time resource watching via Console SDK websockets

### Negative
- `useParams()` from React Router does not work — URL parsing is manual (`window.location.pathname.split('/')`)
- Navigation must use `window.location.href` instead of React Router navigation
- Limited to Console SDK's API surface — some K8s operations require manual `consoleFetch` path construction

## References

- [Console Dynamic Plugin SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk)
- `console-extensions.json` — plugin extension declarations
