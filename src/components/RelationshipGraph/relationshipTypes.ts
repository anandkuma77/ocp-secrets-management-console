// Data model for the resource relationship network graph shown on the Inspect page.
// See relationshipResolvers.ts for the traversal logic that produces this shape and
// RelationshipGraph.tsx for the rendering.

/** Lifecycle/status of a node, driving the badge shown in the graph. */
export type NodeStatus = 'ready' | 'not-ready' | 'unknown' | 'not-found' | 'forbidden';

/** Which side of the root resource a node was discovered on; drives graph layout. */
export type NodeGroup = 'root' | 'upstream' | 'downstream' | 'secret' | 'workload';

export interface GraphNode {
  /** Stable id: `${kind}/${namespace ?? '-'}/${name}` */
  id: string;
  kind: string;
  name: string;
  namespace?: string;
  isRoot?: boolean;
  status: NodeStatus;
  /** Human-readable detail, e.g. "Not found (deleted or never created)". */
  statusMessage?: string;
  /** Inspect (plugin) or native Console href. Undefined => node is not clickable. */
  href?: string;
  group: NodeGroup;
}

export interface GraphEdge {
  id: string;
  /** Node id the relationship originates from. */
  source: string;
  /** Node id the relationship points to. */
  target: string;
  /** Relationship type shown on the edge, e.g. "issuerRef", "Owned By", "Uses Secret". */
  label: string;
}

export interface RelationshipGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Non-fatal issues to surface inline, e.g. RBAC or capped-result notices. */
  warnings: string[];
}

/** Minimal shape used across resolvers; mirrors K8sResourceCommon from the Console SDK. */
export interface MinimalK8sResource {
  kind?: string;
  apiVersion?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    uid?: string;
    labels?: Record<string, string>;
    // apiVersion/kind/name/uid are required (not optional) to structurally match the Console
    // SDK's OwnerReference type, which lets MinimalK8sResource satisfy the K8sResourceCommon
    // constraint required by k8sGetResource/k8sListResourceItems.
    ownerReferences?: {
      apiVersion: string;
      kind: string;
      name: string;
      uid: string;
      controller?: boolean;
    }[];
  };
  spec?: unknown;
  status?: unknown;
}

export const buildNodeId = (kind: string, namespace: string | undefined, name: string): string =>
  `${kind}/${namespace ?? '-'}/${name}`;
