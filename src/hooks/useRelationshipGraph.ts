/**
 * Hook that lazily resolves the relationship graph for the currently inspected resource.
 *
 * Mirrors the lazy-fetch pattern used by the "Related Resources" panel design: no API
 * calls happen until `fetch()` is called (i.e. when the user expands the panel), and the
 * result is cached in state until `refresh()` is invoked.
 */
import * as React from 'react';
import { resolveRelationships } from '../components/RelationshipGraph/relationshipResolvers';
import type {
  MinimalK8sResource,
  RelationshipGraphData,
} from '../components/RelationshipGraph/relationshipTypes';

export interface UseRelationshipGraphResult {
  data?: RelationshipGraphData;
  loading: boolean;
  error?: string;
  /** True once `fetch`/`refresh` has been called at least once. */
  hasFetched: boolean;
  fetch: () => void;
  refresh: () => void;
}

export interface UseRelationshipGraphOptions {
  kind: string;
  resource: MinimalK8sResource | undefined;
  namespace: string | undefined;
  name: string;
  /** Skip fetching entirely, e.g. while the root resource itself hasn't loaded yet. */
  enabled?: boolean;
}

export function useRelationshipGraph({
  kind,
  resource,
  namespace,
  name,
  enabled,
}: UseRelationshipGraphOptions): UseRelationshipGraphResult {
  const [data, setData] = React.useState<RelationshipGraphData | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [hasFetched, setHasFetched] = React.useState(false);

  // `enabled` defaults to true. Deliberately not a destructured default parameter or a
  // `enabled ?? true`/`enabled !== false` expression: this project's lint autofix (running
  // with `strictNullChecks: false`) has been observed to "simplify" both of those forms down
  // to just `enabled`, which would silently disable fetching by default. Do not simplify.
  let isEnabled = true;
  if (typeof enabled === 'boolean') {
    isEnabled = enabled;
  }

  const runFetch = React.useCallback(() => {
    if (!isEnabled || !resource) return;
    setLoading(true);
    setError(undefined);
    setHasFetched(true);
    resolveRelationships(kind, resource, namespace, name)
      .then((result) => {
        setData(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load related resources');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isEnabled, resource, kind, namespace, name]);

  return {
    data,
    loading,
    error,
    hasFetched,
    fetch: runFetch,
    refresh: runFetch,
  };
}
