import * as React from 'react';
import {
  useAccessReview,
  useK8sWatchResource,
  type AccessReviewResourceAttributes,
} from '@openshift-console/dynamic-plugin-sdk';

/** Minimal GVK shape used by table components and CRD shims. */
export type K8sGroupVersionKind = {
  group: string;
  version: string;
  kind: string;
};

/**
 * Maps Kubernetes kind to the plural API resource name used in SelfSubjectAccessReview.
 * Keep in sync with relationship graph CRD registry (FR-003).
 */
const KIND_TO_PLURAL_RESOURCE: Record<string, string> = {
  Certificate: 'certificates',
  Issuer: 'issuers',
  ClusterIssuer: 'clusterissuers',
  ExternalSecret: 'externalsecrets',
  ClusterExternalSecret: 'clusterexternalsecrets',
  SecretStore: 'secretstores',
  ClusterSecretStore: 'clustersecretstores',
  PushSecret: 'pushsecrets',
  ClusterPushSecret: 'clusterpushsecrets',
  Generator: 'generators',
  ClusterGenerator: 'clustergenerators',
  SecretProviderClass: 'secretproviderclasses',
  Bundle: 'bundles',
};

const CLUSTER_SCOPED_KINDS = new Set([
  'ClusterIssuer',
  'ClusterExternalSecret',
  'ClusterSecretStore',
  'ClusterPushSecret',
  'ClusterGenerator',
  'Bundle',
]);

export function getPluralResourceName(kind: string): string | undefined {
  return KIND_TO_PLURAL_RESOURCE[kind];
}

export function isClusterScopedKind(kind: string): boolean {
  return CLUSTER_SCOPED_KINDS.has(kind);
}

/** Builds access review attributes for a cluster-scoped list/watch check. */
export function getClusterWatchAccessReviewAttributes(
  model: K8sGroupVersionKind,
): AccessReviewResourceAttributes | null {
  const resource = getPluralResourceName(model.kind);
  if (!resource) {
    return null;
  }
  return {
    group: model.group,
    resource,
    verb: 'watch',
  };
}

/** Builds access review attributes for a namespaced resource watch in a project. */
export function getNamespacedWatchAccessReviewAttributes(
  model: K8sGroupVersionKind,
  namespace: string,
): AccessReviewResourceAttributes | null {
  const resource = getPluralResourceName(model.kind);
  if (!resource || !namespace || namespace === 'all') {
    return null;
  }
  return {
    group: model.group,
    resource,
    verb: 'watch',
    namespace,
  };
}

export type ClusterWatchAllowedResult = {
  /** Whether the user may watch the cluster-scoped resource type. */
  allowed: boolean;
  loading: boolean;
};

/**
 * Returns whether the current user may start a cluster-scoped watch for the given model.
 * Pass a cluster-scoped model (e.g. ClusterIssuerModel). For undefined/null model, returns
 * allowed=false without calling the API.
 */
export function useClusterWatchAllowed(
  clusterModel?: K8sGroupVersionKind | null,
): ClusterWatchAllowedResult {
  const attributes = React.useMemo(() => {
    if (!clusterModel) {
      return null;
    }
    return getClusterWatchAccessReviewAttributes(clusterModel);
  }, [clusterModel?.group, clusterModel?.version, clusterModel?.kind]);

  const skipReview = attributes === null;

  const [allowed, loading] = useAccessReview(
    attributes ?? { group: '', resource: '' },
    undefined,
    skipReview,
  );

  if (skipReview) {
    return { allowed: false, loading: false };
  }

  return { allowed, loading };
}

export type NamespacedWatchAllowedResult = ClusterWatchAllowedResult;

/**
 * Returns whether the user may watch a namespaced resource type in the given project.
 */
export function useNamespacedWatchAllowed(
  model: K8sGroupVersionKind | null | undefined,
  namespace: string,
): NamespacedWatchAllowedResult {
  const attributes = React.useMemo(
    () => (model ? getNamespacedWatchAccessReviewAttributes(model, namespace) : null),
    [model?.group, model?.version, model?.kind, namespace],
  );

  const skipReview = attributes === null;

  const [allowed, loading] = useAccessReview(
    attributes ?? { group: '', resource: '' },
    undefined,
    skipReview,
  );

  if (skipReview) {
    return { allowed: false, loading: false };
  }

  return { allowed, loading };
}

export type OptionalClusterListWatchResult<T> = {
  data: T[];
  loaded: boolean;
  error: unknown;
  clusterWatchSkipped: boolean;
};

/**
 * Watches a cluster-scoped list when the user is allowed; otherwise skips the watch without error.
 */
export function useOptionalClusterListWatch<T>(
  clusterModel: K8sGroupVersionKind,
): OptionalClusterListWatchResult<T> {
  const { allowed, loading: accessLoading } = useClusterWatchAllowed(clusterModel);
  const [data, watchLoaded, error] = useK8sWatchResource<T[]>(
    allowed
      ? {
          groupVersionKind: clusterModel,
          isList: true,
        }
      : null,
  );

  const loaded = !accessLoading && (allowed ? watchLoaded : true);

  return {
    data: allowed ? data || [] : [],
    loaded,
    error: allowed ? error : undefined,
    clusterWatchSkipped: !allowed,
  };
}

/** Combines namespaced + optional cluster list watch loading flags. */
export function combineDualListWatchLoaded(
  namespacedLoaded: boolean,
  cluster: OptionalClusterListWatchResult<unknown>,
): boolean {
  return namespacedLoaded && cluster.loaded;
}

/** Combines errors; skipped cluster watches do not contribute errors. */
export function combineDualListWatchError(
  namespacedError: unknown,
  cluster: OptionalClusterListWatchResult<unknown>,
): unknown {
  if (namespacedError) {
    return namespacedError;
  }
  return cluster.clusterWatchSkipped ? undefined : cluster.error;
}
