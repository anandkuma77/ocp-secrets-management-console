// Backend/data-transformation logic for the resource relationship graph.
//
// One resolver function per CRD kind (see RESOLVERS at the bottom), each returning a
// nodes-and-edges payload rooted at the currently inspected resource. Resolvers parse:
//   - Explicit K8s relationships: metadata.ownerReferences (parent/child).
//   - Implicit/custom-resource references: spec.issuerRef, spec.secretName,
//     spec.secretStoreRef, spec.secretStoreRefs, label/namespace selectors, etc.
//
// All network calls use one-time REST calls (k8sGetResource/k8sListResourceItems), never
// useK8sWatchResource -- this graph is built lazily when the user expands the panel.
// Note: the SDK's public entry point aliases the options-object based functions to
// `k8sGet`/`k8sListItems` (the deprecated positional-argument `k8sGet`/`k8sList` are not
// exported at the package root) -- see @openshift-console/dynamic-plugin-sdk/lib/api/core-api.d.ts.
import {
  k8sGet as k8sGetResource,
  k8sListItems as k8sListResourceItems,
  HttpError,
} from '@openshift-console/dynamic-plugin-sdk';
import type { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import type {
  Certificate,
  ExternalSecret,
  ClusterExternalSecret,
  PushSecret,
  ClusterPushSecret,
  SecretProviderClass,
  Bundle,
} from '../crds';
import type {
  GraphEdge,
  GraphNode,
  MinimalK8sResource,
  NodeStatus,
  RelationshipGraphData,
} from './relationshipTypes';
import { buildNodeId } from './relationshipTypes';

// ---------------------------------------------------------------------------
// K8s models. `k8sGetResource`/`k8sListResourceItems` need the REST `plural` and
// `namespaced` flag, unlike the `{ group, version, kind }` GVK refs used elsewhere in
// this codebase for `useK8sWatchResource` (which resolves plural via API discovery).
// ---------------------------------------------------------------------------
interface K8sModelLite {
  apiGroup?: string;
  apiVersion: string;
  kind: string;
  plural: string;
  namespaced: boolean;
}

/** Cast a lightweight model descriptor to the SDK's `K8sModel` (only these fields are read at runtime). */
const asModel = (m: K8sModelLite): K8sModel => m as unknown as K8sModel;

const SecretCoreModel = asModel({
  apiVersion: 'v1',
  kind: 'Secret',
  plural: 'secrets',
  namespaced: true,
});
const DeploymentModel = asModel({
  apiGroup: 'apps',
  apiVersion: 'v1',
  kind: 'Deployment',
  plural: 'deployments',
  namespaced: true,
});
const StatefulSetModel = asModel({
  apiGroup: 'apps',
  apiVersion: 'v1',
  kind: 'StatefulSet',
  plural: 'statefulsets',
  namespaced: true,
});
const DaemonSetModel = asModel({
  apiGroup: 'apps',
  apiVersion: 'v1',
  kind: 'DaemonSet',
  plural: 'daemonsets',
  namespaced: true,
});

const WORKLOAD_MODELS: K8sModel[] = [DeploymentModel, StatefulSetModel, DaemonSetModel];

/** Cap on reverse (list + filter) lookups to keep the graph readable and bound API load. */
const REVERSE_LOOKUP_CAP = 25;
/** Cap on workload-scan results, per the performance guidelines. */
const WORKLOAD_CAP = 50;

// ---------------------------------------------------------------------------
// CRD registry: single source of truth for each kind's API model AND its Inspect route.
// ---------------------------------------------------------------------------
interface CrdRegistryEntry extends K8sModelLite {
  plural: string;
  clusterScoped: boolean;
}

const CRD_REGISTRY: Record<string, CrdRegistryEntry> = {
  Certificate: {
    apiGroup: 'cert-manager.io',
    apiVersion: 'v1',
    kind: 'Certificate',
    plural: 'certificates',
    namespaced: true,
    clusterScoped: false,
  },
  Issuer: {
    apiGroup: 'cert-manager.io',
    apiVersion: 'v1',
    kind: 'Issuer',
    plural: 'issuers',
    namespaced: true,
    clusterScoped: false,
  },
  ClusterIssuer: {
    apiGroup: 'cert-manager.io',
    apiVersion: 'v1',
    kind: 'ClusterIssuer',
    plural: 'clusterissuers',
    namespaced: false,
    clusterScoped: true,
  },
  ExternalSecret: {
    apiGroup: 'external-secrets.io',
    apiVersion: 'v1',
    kind: 'ExternalSecret',
    plural: 'externalsecrets',
    namespaced: true,
    clusterScoped: false,
  },
  ClusterExternalSecret: {
    apiGroup: 'external-secrets.io',
    apiVersion: 'v1',
    kind: 'ClusterExternalSecret',
    plural: 'clusterexternalsecrets',
    namespaced: false,
    clusterScoped: true,
  },
  SecretStore: {
    apiGroup: 'external-secrets.io',
    apiVersion: 'v1',
    kind: 'SecretStore',
    plural: 'secretstores',
    namespaced: true,
    clusterScoped: false,
  },
  ClusterSecretStore: {
    apiGroup: 'external-secrets.io',
    apiVersion: 'v1',
    kind: 'ClusterSecretStore',
    plural: 'clustersecretstores',
    namespaced: false,
    clusterScoped: true,
  },
  PushSecret: {
    apiGroup: 'external-secrets.io',
    apiVersion: 'v1alpha1',
    kind: 'PushSecret',
    plural: 'pushsecrets',
    namespaced: true,
    clusterScoped: false,
  },
  ClusterPushSecret: {
    apiGroup: 'external-secrets.io',
    apiVersion: 'v1alpha1',
    kind: 'ClusterPushSecret',
    plural: 'clusterpushsecrets',
    namespaced: false,
    clusterScoped: true,
  },
  SecretProviderClass: {
    apiGroup: 'secrets-store.csi.x-k8s.io',
    apiVersion: 'v1',
    kind: 'SecretProviderClass',
    plural: 'secretproviderclasses',
    namespaced: true,
    clusterScoped: false,
  },
  Bundle: {
    apiGroup: 'trust.cert-manager.io',
    apiVersion: 'v1alpha1',
    kind: 'Bundle',
    plural: 'bundles',
    namespaced: false,
    clusterScoped: true,
  },
};

const CertificateModel = asModel(CRD_REGISTRY.Certificate);
const IssuerModel = asModel(CRD_REGISTRY.Issuer);
const ClusterIssuerModel = asModel(CRD_REGISTRY.ClusterIssuer);
const ExternalSecretModel = asModel(CRD_REGISTRY.ExternalSecret);
const SecretStoreModel = asModel(CRD_REGISTRY.SecretStore);
const ClusterSecretStoreModel = asModel(CRD_REGISTRY.ClusterSecretStore);
const PushSecretModel = asModel(CRD_REGISTRY.PushSecret);

/** Native Console plural for core/apps resources we link out to (never inspected in-plugin). */
const NATIVE_KIND_PLURAL: Record<string, string> = {
  Secret: 'secrets',
  ConfigMap: 'configmaps',
  Deployment: 'deployments',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  Pod: 'pods',
};

/** Build an href for a graph node; undefined when the resource can't be navigated to. */
export function getNodeHref(
  kind: string,
  namespace: string | undefined,
  name: string,
): string | undefined {
  const crdRoute = CRD_REGISTRY[kind];
  if (crdRoute) {
    return crdRoute.clusterScoped
      ? `/secrets-management/inspect/${crdRoute.plural}/${name}`
      : `/secrets-management/inspect/${crdRoute.plural}/${namespace}/${name}`;
  }
  const nativePlural = NATIVE_KIND_PLURAL[kind];
  if (nativePlural) {
    return namespace
      ? `/k8s/ns/${namespace}/${nativePlural}/${name}`
      : `/k8s/cluster/${nativePlural}/${name}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Node/edge construction helpers
// ---------------------------------------------------------------------------

function statusFromConditions(
  conditions: { type?: string; status?: string }[] | undefined,
  readyType = 'Ready',
): NodeStatus {
  if (!conditions) return 'unknown';
  const cond = conditions.find((c) => c.type === readyType);
  if (!cond) return 'unknown';
  return cond.status === 'True' ? 'ready' : 'not-ready';
}

/** Safely pull `status.conditions` out of an untyped (`unknown`) resource status. */
function extractConditions(status: unknown): { type?: string; status?: string }[] | undefined {
  if (!status || typeof status !== 'object') return undefined;
  const conditions = (status as { conditions?: unknown }).conditions;
  return Array.isArray(conditions)
    ? (conditions as { type?: string; status?: string }[])
    : undefined;
}

function makeNode(params: {
  kind: string;
  name: string;
  namespace?: string;
  group: GraphNode['group'];
  status: NodeStatus;
  statusMessage?: string;
  isRoot?: boolean;
}): GraphNode {
  const { kind, name, namespace, group, status, statusMessage, isRoot } = params;
  return {
    id: buildNodeId(kind, namespace, name),
    kind,
    name,
    namespace,
    isRoot,
    status,
    statusMessage,
    href: status === 'not-found' ? undefined : getNodeHref(kind, namespace, name),
    group,
  };
}

function makeEdge(source: string, target: string, label: string): GraphEdge {
  return { id: `${source}->${target}:${label}`, source, target, label };
}

/** Stringify an unknown error without triggering default `[object Object]` output. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

/** True when an error represents "resource not found" (404). */
function isNotFound(err: unknown): boolean {
  return err instanceof HttpError ? err.code === 404 : /not found/i.test(describeError(err));
}

/** True when an error represents "insufficient RBAC permissions" (401/403). */
function isForbidden(err: unknown): boolean {
  return err instanceof HttpError
    ? err.code === 401 || err.code === 403
    : /forbidden|unauthorized/i.test(describeError(err));
}

/**
 * GET a single resource purely to check existence/reachability, translating 404/403 into
 * node status instead of throwing. Callers only need the status, not the fetched body.
 */
async function safeGet(
  model: K8sModel,
  name: string,
  namespace: string | undefined,
): Promise<{ status: NodeStatus; statusMessage?: string }> {
  try {
    await k8sGetResource<MinimalK8sResource>({ model, name, ns: namespace });
    return { status: 'unknown' };
  } catch (err) {
    if (isNotFound(err)) {
      return { status: 'not-found', statusMessage: 'Not found (deleted or never created)' };
    }
    if (isForbidden(err)) {
      return { status: 'forbidden', statusMessage: 'Insufficient permissions' };
    }
    return { status: 'unknown', statusMessage: describeError(err) };
  }
}

/** LIST resources, returning [] with a warning on RBAC errors rather than throwing. */
async function safeList<T extends MinimalK8sResource>(
  model: K8sModel,
  queryParams: Record<string, string> = {},
): Promise<{ items: T[]; warning?: string }> {
  try {
    const items = await k8sListResourceItems<T>({ model, queryParams });
    return { items };
  } catch (err) {
    if (isForbidden(err)) {
      return { items: [], warning: `Insufficient permissions to list ${model.kind}` };
    }
    return {
      items: [],
      warning: `Could not list ${model.kind}: ${describeError(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Explicit relationship: metadata.ownerReferences (parent/child, e.g. Deployment -> ReplicaSet).
// Adds "Owned By" edges from the root to each declared owner. Generic across all kinds.
// ---------------------------------------------------------------------------
function resolveOwnerReferenceEdges(
  rootId: string,
  resource: MinimalK8sResource,
  namespace: string | undefined,
) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const ref of resource.metadata?.ownerReferences ?? []) {
    if (!ref.kind || !ref.name) continue;
    const ownerNode = makeNode({
      kind: ref.kind,
      name: ref.name,
      namespace,
      group: 'upstream',
      status: 'unknown',
    });
    nodes.push(ownerNode);
    edges.push(makeEdge(rootId, ownerNode.id, 'Owned By'));
  }
  return { nodes, edges };
}

/**
 * Reverse ownerReference lookup: find resources of `childModel` whose ownerReferences
 * point back at the root (used for ClusterExternalSecret/ClusterPushSecret -> the
 * namespaced ExternalSecret/PushSecret CRs they created).
 */
async function resolveOwnedChildren<T extends MinimalK8sResource>(
  childModel: K8sModel,
  rootKind: string,
  rootName: string,
): Promise<{ items: T[]; warning?: string }> {
  const { items, warning } = await safeList<T>(childModel);
  const owned = items.filter((item) =>
    item.metadata?.ownerReferences?.some((ref) => ref.kind === rootKind && ref.name === rootName),
  );
  return { items: owned.slice(0, REVERSE_LOOKUP_CAP), warning };
}

// ---------------------------------------------------------------------------
// Workload scan: Deployments/StatefulSets/DaemonSets referencing a Secret by name.
// Checks volumes[].secret, containers[]/initContainers[].envFrom[].secretRef,
// and containers[]/initContainers[].env[].valueFrom.secretKeyRef.
// ---------------------------------------------------------------------------
interface PodSpecLike {
  volumes?: { secret?: { secretName?: string } }[];
  containers?: ContainerLike[];
  initContainers?: ContainerLike[];
}
interface ContainerLike {
  envFrom?: { secretRef?: { name?: string } }[];
  env?: { valueFrom?: { secretKeyRef?: { name?: string } } }[];
}
interface WorkloadLike extends MinimalK8sResource {
  spec?: { template?: { spec?: PodSpecLike } };
}

function workloadUsesSecret(podSpec: PodSpecLike | undefined, secretName: string): boolean {
  if (!podSpec) return false;
  if (podSpec.volumes?.some((v) => v.secret?.secretName === secretName)) return true;
  const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
  return containers.some(
    (c) =>
      c.envFrom?.some((e) => e.secretRef?.name === secretName) ||
      c.env?.some((e) => e.valueFrom?.secretKeyRef?.name === secretName),
  );
}

async function scanWorkloadsUsingSecret(
  namespace: string,
  secretName: string,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] }> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const secretNodeId = buildNodeId('Secret', namespace, secretName);

  for (const model of WORKLOAD_MODELS) {
    const { items, warning } = await safeList<WorkloadLike>(model, { ns: namespace });
    if (warning) warnings.push(warning);
    const matches = items.filter((item) =>
      workloadUsesSecret(item.spec?.template?.spec, secretName),
    );
    for (const item of matches.slice(0, WORKLOAD_CAP)) {
      const name = item.metadata?.name;
      if (!name) continue;
      const node = makeNode({
        kind: model.kind,
        name,
        namespace,
        group: 'workload',
        status: 'unknown',
      });
      nodes.push(node);
      edges.push(makeEdge(node.id, secretNodeId, 'Uses Secret'));
    }
  }
  if (nodes.length > WORKLOAD_CAP)
    warnings.push(`Workload results capped at ${String(WORKLOAD_CAP)}.`);
  return { nodes, edges, warnings };
}

/** Adds a "Secret created" node for the given secret name, GET'ing it for status. */
async function resolveCreatedSecret(
  rootId: string,
  namespace: string,
  secretName: string,
  label = 'Creates',
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { status, statusMessage } = await safeGet(SecretCoreModel, secretName, namespace);
  const secretNode = makeNode({
    kind: 'Secret',
    name: secretName,
    namespace,
    group: 'secret',
    status: status === 'unknown' ? 'ready' : status,
    statusMessage,
  });
  return { nodes: [secretNode], edges: [makeEdge(rootId, secretNode.id, label)] };
}

// ---------------------------------------------------------------------------
// Per-kind resolvers. Each returns the full graph rooted at `resource`.
// ---------------------------------------------------------------------------

async function resolveCertificate(
  resource: Certificate,
  namespace: string,
  name: string,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('Certificate', namespace, name);
  const rootNode = makeNode({
    kind: 'Certificate',
    name,
    namespace,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(resource.status?.conditions),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // Upstream: spec.issuerRef -> Issuer | ClusterIssuer
  const issuerRef = resource.spec?.issuerRef;
  if (issuerRef?.name) {
    const isCluster = issuerRef.kind === 'ClusterIssuer';
    const model = isCluster ? ClusterIssuerModel : IssuerModel;
    const { status, statusMessage } = await safeGet(
      model,
      issuerRef.name,
      isCluster ? undefined : namespace,
    );
    const issuerNode = makeNode({
      kind: issuerRef.kind || 'Issuer',
      name: issuerRef.name,
      namespace: isCluster ? undefined : namespace,
      group: 'upstream',
      status: status === 'unknown' ? 'ready' : status,
      statusMessage,
    });
    nodes.push(issuerNode);
    edges.push(makeEdge(rootId, issuerNode.id, 'issuerRef'));
  }

  // Downstream: spec.secretName -> Secret, then workloads using that Secret.
  if (resource.spec?.secretName) {
    const { nodes: secretNodes, edges: secretEdges } = await resolveCreatedSecret(
      rootId,
      namespace,
      resource.spec.secretName,
    );
    nodes.push(...secretNodes);
    edges.push(...secretEdges);

    const {
      nodes: wNodes,
      edges: wEdges,
      warnings: wWarnings,
    } = await scanWorkloadsUsingSecret(namespace, resource.spec.secretName);
    nodes.push(...wNodes);
    edges.push(...wEdges);
    warnings.push(...wWarnings);
  }

  return { nodes, edges, warnings };
}

async function resolveIssuerLike(
  kind: 'Issuer' | 'ClusterIssuer',
  namespace: string | undefined,
  name: string,
  resource: MinimalK8sResource,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId(kind, namespace, name);
  const rootNode = makeNode({
    kind,
    name,
    namespace,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(extractConditions(resource.status)),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // Downstream (reverse lookup): Certificates (any namespace for ClusterIssuer) whose
  // spec.issuerRef points at this Issuer/ClusterIssuer.
  const { items, warning } = await safeList<Certificate>(
    CertificateModel,
    kind === 'Issuer' ? { ns: namespace ?? '' } : {},
  );
  if (warning) warnings.push(warning);
  const referencing = items.filter(
    (cert) =>
      cert.spec?.issuerRef?.name === name && (cert.spec?.issuerRef?.kind || 'Issuer') === kind,
  );
  for (const cert of referencing.slice(0, REVERSE_LOOKUP_CAP)) {
    const certNode = makeNode({
      kind: 'Certificate',
      name: cert.metadata.name,
      namespace: cert.metadata.namespace,
      group: 'downstream',
      status: statusFromConditions(cert.status?.conditions),
    });
    nodes.push(certNode);
    edges.push(makeEdge(certNode.id, rootId, 'issuerRef'));
  }
  if (referencing.length > REVERSE_LOOKUP_CAP) {
    warnings.push(
      `Showing first ${String(REVERSE_LOOKUP_CAP)} of ${String(referencing.length)} referencing Certificates.`,
    );
  }

  return { nodes, edges, warnings };
}

async function resolveExternalSecret(
  resource: ExternalSecret,
  namespace: string,
  name: string,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('ExternalSecret', namespace, name);
  const rootNode = makeNode({
    kind: 'ExternalSecret',
    name,
    namespace,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(resource.status?.conditions),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // Upstream: spec.secretStoreRef -> SecretStore | ClusterSecretStore
  const storeRef = resource.spec?.secretStoreRef;
  if (storeRef?.name) {
    const isCluster = storeRef.kind === 'ClusterSecretStore';
    const model = isCluster ? ClusterSecretStoreModel : SecretStoreModel;
    const { status, statusMessage } = await safeGet(
      model,
      storeRef.name,
      isCluster ? undefined : namespace,
    );
    const storeNode = makeNode({
      kind: storeRef.kind || 'SecretStore',
      name: storeRef.name,
      namespace: isCluster ? undefined : namespace,
      group: 'upstream',
      status: status === 'unknown' ? 'ready' : status,
      statusMessage,
    });
    nodes.push(storeNode);
    edges.push(makeEdge(rootId, storeNode.id, 'secretStoreRef'));
  }

  // Downstream: spec.target.name (or CR name) -> Secret, then workloads using it.
  const secretName = resource.spec?.target?.name || name;
  const { nodes: secretNodes, edges: secretEdges } = await resolveCreatedSecret(
    rootId,
    namespace,
    secretName,
  );
  nodes.push(...secretNodes);
  edges.push(...secretEdges);

  const {
    nodes: wNodes,
    edges: wEdges,
    warnings: wWarnings,
  } = await scanWorkloadsUsingSecret(namespace, secretName);
  nodes.push(...wNodes);
  edges.push(...wEdges);
  warnings.push(...wWarnings);

  return { nodes, edges, warnings };
}

async function resolveSecretStoreLike(
  kind: 'SecretStore' | 'ClusterSecretStore',
  namespace: string | undefined,
  name: string,
  resource: MinimalK8sResource,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId(kind, namespace, name);
  const rootNode = makeNode({
    kind,
    name,
    namespace,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(extractConditions(resource.status)),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  const listNs = kind === 'SecretStore' ? { ns: namespace ?? '' } : {};

  // Downstream (reverse lookup): ExternalSecrets referencing this store.
  const { items: extSecrets, warning: extWarning } = await safeList<ExternalSecret>(
    ExternalSecretModel,
    listNs,
  );
  if (extWarning) warnings.push(extWarning);
  const referencingExt = extSecrets.filter(
    (es) =>
      es.spec?.secretStoreRef?.name === name &&
      (es.spec?.secretStoreRef?.kind || 'SecretStore') === kind,
  );

  // Downstream (reverse lookup): PushSecrets referencing this store (secretStoreRefs is a list).
  const { items: pushSecrets, warning: pushWarning } = await safeList<PushSecret>(
    PushSecretModel,
    listNs,
  );
  if (pushWarning) warnings.push(pushWarning);
  const referencingPush = pushSecrets.filter((ps) =>
    ps.spec?.secretStoreRefs?.some(
      (ref) => ref.name === name && (ref.kind || 'SecretStore') === kind,
    ),
  );

  const referencing = [
    ...referencingExt.map((ref) => ({ ref, refKind: 'ExternalSecret' as const })),
    ...referencingPush.map((ref) => ({ ref, refKind: 'PushSecret' as const })),
  ].slice(0, REVERSE_LOOKUP_CAP);
  for (const { ref, refKind } of referencing) {
    const node = makeNode({
      kind: refKind,
      name: ref.metadata.name,
      namespace: ref.metadata.namespace,
      group: 'downstream',
      status: statusFromConditions(ref.status?.conditions),
    });
    nodes.push(node);
    edges.push(makeEdge(node.id, rootId, 'secretStoreRef'));
  }
  const totalReferencing = referencingExt.length + referencingPush.length;
  if (totalReferencing > REVERSE_LOOKUP_CAP) {
    warnings.push(
      `Showing first ${String(REVERSE_LOOKUP_CAP)} of ${String(totalReferencing)} referencing resources.`,
    );
  }

  return { nodes, edges, warnings };
}

async function resolvePushSecret(
  resource: PushSecret,
  namespace: string,
  name: string,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('PushSecret', namespace, name);
  const rootNode = makeNode({
    kind: 'PushSecret',
    name,
    namespace,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(resource.status?.conditions),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];

  // Upstream: spec.secretStoreRefs[] -> SecretStore(s) (can also target ClusterSecretStore).
  for (const ref of resource.spec?.secretStoreRefs ?? []) {
    if (!ref.name) continue;
    const isCluster = ref.kind === 'ClusterSecretStore';
    const model = isCluster ? ClusterSecretStoreModel : SecretStoreModel;
    const { status, statusMessage } = await safeGet(
      model,
      ref.name,
      isCluster ? undefined : namespace,
    );
    const storeNode = makeNode({
      kind: ref.kind || 'SecretStore',
      name: ref.name,
      namespace: isCluster ? undefined : namespace,
      group: 'upstream',
      status: status === 'unknown' ? 'ready' : status,
      statusMessage,
    });
    nodes.push(storeNode);
    edges.push(makeEdge(rootId, storeNode.id, 'secretStoreRefs'));
  }

  return { nodes, edges, warnings: [] };
}

async function resolveClusterExternalSecret(
  resource: ClusterExternalSecret,
  name: string,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('ClusterExternalSecret', undefined, name);
  const rootNode = makeNode({
    kind: 'ClusterExternalSecret',
    name,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(resource.status?.conditions),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // Upstream: spec.externalSecretSpec.secretStoreRef -> SecretStore | ClusterSecretStore.
  // Namespace is ambiguous for a cluster-scoped CR fanning into many namespaces, so a
  // namespaced SecretStore reference is shown unqualified (informational only).
  const storeRef = resource.spec?.externalSecretSpec?.secretStoreRef;
  if (storeRef?.name) {
    const isCluster = storeRef.kind === 'ClusterSecretStore';
    if (isCluster) {
      const { status, statusMessage } = await safeGet(
        ClusterSecretStoreModel,
        storeRef.name,
        undefined,
      );
      const storeNode = makeNode({
        kind: 'ClusterSecretStore',
        name: storeRef.name,
        group: 'upstream',
        status: status === 'unknown' ? 'ready' : status,
        statusMessage,
      });
      nodes.push(storeNode);
      edges.push(makeEdge(rootId, storeNode.id, 'secretStoreRef'));
    } else {
      const storeNode = makeNode({
        kind: 'SecretStore',
        name: storeRef.name,
        group: 'upstream',
        status: 'unknown',
        statusMessage:
          'Namespace determined per-target-namespace; open a generated ExternalSecret to verify.',
      });
      nodes.push(storeNode);
      edges.push(makeEdge(rootId, storeNode.id, 'secretStoreRef'));
    }
  }

  // Downstream (reverse ownerReference lookup): ExternalSecrets this CR created.
  const { items: owned, warning } = await resolveOwnedChildren<ExternalSecret>(
    ExternalSecretModel,
    'ClusterExternalSecret',
    name,
  );
  if (warning) warnings.push(warning);
  for (const es of owned) {
    const node = makeNode({
      kind: 'ExternalSecret',
      name: es.metadata.name,
      namespace: es.metadata.namespace,
      group: 'downstream',
      status: statusFromConditions(es.status?.conditions),
    });
    nodes.push(node);
    edges.push(makeEdge(node.id, rootId, 'Owned By'));
  }

  return { nodes, edges, warnings };
}

async function resolveClusterPushSecret(
  resource: ClusterPushSecret,
  name: string,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('ClusterPushSecret', undefined, name);
  const rootNode = makeNode({
    kind: 'ClusterPushSecret',
    name,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(resource.status?.conditions),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];

  // Upstream: spec.pushSecretSpec.secretStoreRefs[] -> SecretStore(s).
  for (const ref of resource.spec?.pushSecretSpec?.secretStoreRefs ?? []) {
    if (!ref.name) continue;
    const isCluster = ref.kind === 'ClusterSecretStore';
    const model = isCluster ? ClusterSecretStoreModel : SecretStoreModel;
    const { status, statusMessage } = await safeGet(model, ref.name, undefined);
    const storeNode = makeNode({
      kind: ref.kind || 'SecretStore',
      name: ref.name,
      namespace: isCluster ? undefined : undefined,
      group: 'upstream',
      status: isCluster ? (status === 'unknown' ? 'ready' : status) : 'unknown',
      statusMessage: isCluster ? statusMessage : 'Namespace determined per target namespace.',
    });
    nodes.push(storeNode);
    edges.push(makeEdge(rootId, storeNode.id, 'secretStoreRefs'));
  }

  return { nodes, edges, warnings: [] };
}

async function resolveSecretProviderClass(
  resource: SecretProviderClass,
  namespace: string,
  name: string,
): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('SecretProviderClass', namespace, name);
  const rootNode = makeNode({
    kind: 'SecretProviderClass',
    name,
    namespace,
    group: 'root',
    isRoot: true,
    status: 'ready',
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];

  // Downstream: spec.secretObjects[].secretName -> Secret(s) synced by the CSI driver.
  for (const secretObject of resource.spec?.secretObjects ?? []) {
    if (!secretObject.secretName) continue;
    const { nodes: secretNodes, edges: secretEdges } = await resolveCreatedSecret(
      rootId,
      namespace,
      secretObject.secretName,
    );
    nodes.push(...secretNodes);
    edges.push(...secretEdges);
  }

  // Pods mounting this CSI volume: derived from SecretProviderClassPodStatus (already
  // watched by the Inspect page for the Pod Statuses table), so it is not re-fetched here.
  // The panel's caller can pass `podNames` if it wants pod nodes; kept out of this
  // resolver to avoid a duplicate watch/list of PodStatuses.

  return { nodes, edges, warnings: [] };
}

async function resolveBundle(resource: Bundle, name: string): Promise<RelationshipGraphData> {
  const rootId = buildNodeId('Bundle', undefined, name);
  const rootNode = makeNode({
    kind: 'Bundle',
    name,
    group: 'root',
    isRoot: true,
    status: statusFromConditions(resource.status?.conditions),
  });
  const nodes: GraphNode[] = [rootNode];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // Upstream: spec.sources[] -> ConfigMaps/Secrets feeding the bundle. Source namespace
  // isn't part of the Bundle spec (trust-manager watches all namespaces for the name),
  // so we surface the source by name only, unqualified by namespace.
  for (const source of resource.spec?.sources ?? []) {
    if (source.configMap?.name) {
      nodes.push(
        makeNode({
          kind: 'ConfigMap',
          name: source.configMap.name,
          group: 'upstream',
          status: 'unknown',
        }),
      );
      edges.push(
        makeEdge(
          rootId,
          buildNodeId('ConfigMap', undefined, source.configMap.name),
          'sources[].configMap',
        ),
      );
    }
    if (source.secret?.name) {
      const { status, statusMessage } = await safeGet(
        SecretCoreModel,
        source.secret.name,
        undefined,
      );
      nodes.push(
        makeNode({
          kind: 'Secret',
          name: source.secret.name,
          group: 'upstream',
          status: status === 'unknown' ? 'ready' : status,
          statusMessage,
        }),
      );
      edges.push(
        makeEdge(rootId, buildNodeId('Secret', undefined, source.secret.name), 'sources[].secret'),
      );
    }
  }

  // Downstream: spec.target -> ConfigMap/Secret key distributed to matching namespaces.
  if (resource.spec?.target?.configMap) {
    const targetName = name; // trust-manager creates the target with the Bundle's own name
    nodes.push(
      makeNode({ kind: 'ConfigMap', name: targetName, group: 'downstream', status: 'unknown' }),
    );
    edges.push(
      makeEdge(buildNodeId('ConfigMap', undefined, targetName), rootId, 'target.configMap'),
    );
  }
  if (resource.spec?.target?.secret) {
    const targetName = name;
    nodes.push(
      makeNode({ kind: 'Secret', name: targetName, group: 'downstream', status: 'unknown' }),
    );
    edges.push(makeEdge(buildNodeId('Secret', undefined, targetName), rootId, 'target.secret'));
  }
  if (!resource.spec?.target?.configMap && !resource.spec?.target?.secret) {
    warnings.push('Bundle has no distribution target configured.');
  }

  return { nodes, edges, warnings };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Resolve the relationship graph for the currently inspected resource. Dispatches to the
 * resolver for `kind`; falls back to a root-only graph (plus any explicit ownerReferences)
 * for kinds without a bespoke resolver, so the panel degrades gracefully for future CRDs.
 */
export async function resolveRelationships(
  kind: string,
  resource: MinimalK8sResource,
  namespace: string | undefined,
  name: string,
): Promise<RelationshipGraphData> {
  switch (kind) {
    case 'Certificate':
      return resolveCertificate(resource as Certificate, namespace ?? 'default', name);
    case 'Issuer':
      return resolveIssuerLike('Issuer', namespace, name, resource);
    case 'ClusterIssuer':
      return resolveIssuerLike('ClusterIssuer', undefined, name, resource);
    case 'ExternalSecret':
      return resolveExternalSecret(resource as ExternalSecret, namespace ?? 'default', name);
    case 'ClusterExternalSecret':
      return resolveClusterExternalSecret(resource as ClusterExternalSecret, name);
    case 'SecretStore':
      return resolveSecretStoreLike('SecretStore', namespace, name, resource);
    case 'ClusterSecretStore':
      return resolveSecretStoreLike('ClusterSecretStore', undefined, name, resource);
    case 'PushSecret':
      return resolvePushSecret(resource as PushSecret, namespace ?? 'default', name);
    case 'ClusterPushSecret':
      return resolveClusterPushSecret(resource as ClusterPushSecret, name);
    case 'SecretProviderClass':
      return resolveSecretProviderClass(
        resource as SecretProviderClass,
        namespace ?? 'default',
        name,
      );
    case 'Bundle':
      return resolveBundle(resource as Bundle, name);
    default: {
      const rootId = buildNodeId(kind, namespace, name);
      const rootNode = makeNode({
        kind,
        name,
        namespace,
        group: 'root',
        isRoot: true,
        status: 'unknown',
      });
      const { nodes: ownerNodes, edges: ownerEdges } = resolveOwnerReferenceEdges(
        rootId,
        resource,
        namespace,
      );
      return { nodes: [rootNode, ...ownerNodes], edges: ownerEdges, warnings: [] };
    }
  }
}

// Exported for testing and for advanced callers that want to compose custom graphs.
export {
  resolveOwnerReferenceEdges,
  resolveOwnedChildren,
  scanWorkloadsUsingSecret,
  resolveCreatedSecret,
  statusFromConditions,
  extractConditions,
  safeGet,
  safeList,
  isNotFound,
  isForbidden,
  SecretCoreModel,
  WORKLOAD_MODELS,
};
