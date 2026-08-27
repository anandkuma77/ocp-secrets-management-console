// Generator models from External Secrets Operator (generators.external-secrets.io/v1alpha1)

export const GENERATOR_GROUP = 'generators.external-secrets.io';
export const GENERATOR_VERSION = 'v1alpha1';

export interface GeneratorKindDef {
  kind: string;
  plural: string;
  clusterScoped: boolean;
}

/** User-facing generator kinds. GeneratorState is omitted (operator-internal). */
export const GENERATOR_KIND_DEFS: readonly GeneratorKindDef[] = [
  { kind: 'ACRAccessToken', plural: 'acraccesstokens', clusterScoped: false },
  { kind: 'CloudsmithAccessToken', plural: 'cloudsmithaccesstokens', clusterScoped: false },
  { kind: 'ECRAuthorizationToken', plural: 'ecrauthorizationtokens', clusterScoped: false },
  { kind: 'Fake', plural: 'fakes', clusterScoped: false },
  { kind: 'GCRAccessToken', plural: 'gcraccesstokens', clusterScoped: false },
  { kind: 'GithubAccessToken', plural: 'githubaccesstokens', clusterScoped: false },
  { kind: 'Grafana', plural: 'grafanas', clusterScoped: false },
  { kind: 'MFA', plural: 'mfas', clusterScoped: false },
  { kind: 'Password', plural: 'passwords', clusterScoped: false },
  { kind: 'QuayAccessToken', plural: 'quayaccesstokens', clusterScoped: false },
  { kind: 'SSHKey', plural: 'sshkeys', clusterScoped: false },
  { kind: 'STSSessionToken', plural: 'stssessiontokens', clusterScoped: false },
  { kind: 'UUID', plural: 'uuids', clusterScoped: false },
  { kind: 'VaultDynamicSecret', plural: 'vaultdynamicsecrets', clusterScoped: false },
  { kind: 'Webhook', plural: 'webhooks', clusterScoped: false },
  { kind: 'ClusterGenerator', plural: 'clustergenerators', clusterScoped: true },
];

export const getGeneratorModel = (kind: string) => ({
  group: GENERATOR_GROUP,
  version: GENERATOR_VERSION,
  kind,
});

export const ClusterGeneratorModel = getGeneratorModel('ClusterGenerator');
export const PasswordModel = getGeneratorModel('Password');

export const getGeneratorDefByKind = (kind: string): GeneratorKindDef | undefined =>
  GENERATOR_KIND_DEFS.find((def) => def.kind === kind);

export const getGeneratorDefByPlural = (plural: string): GeneratorKindDef | undefined =>
  GENERATOR_KIND_DEFS.find((def) => def.plural === plural);

export interface GeneratorResource {
  kind?: string;
  apiVersion?: string;
  metadata: {
    name: string;
    namespace?: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: Record<string, unknown>;
  status?: {
    conditions?: {
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }[];
  };
}

export const isClusterGenerator = (resource: GeneratorResource): boolean => {
  return resource.kind === 'ClusterGenerator' || !resource.metadata.namespace;
};

/** Wrapped generator kind for ClusterGenerator; otherwise the resource kind. */
export const getGeneratorKind = (resource: GeneratorResource): string => {
  if (resource.kind === 'ClusterGenerator') {
    const wrapped = resource.spec?.kind;
    return typeof wrapped === 'string' && wrapped ? wrapped : 'ClusterGenerator';
  }
  return resource.kind || 'Unknown';
};

function describeSpec(spec: Record<string, unknown> | undefined): string {
  if (!spec) return '-';

  const parts: string[] = [];
  if (typeof spec.length === 'number') parts.push(`length ${spec.length}`);
  if (typeof spec.digits === 'number') parts.push(`${spec.digits} digits`);
  if (typeof spec.symbols === 'number') parts.push(`${spec.symbols} symbols`);
  if (typeof spec.size === 'number') parts.push(`size ${spec.size}`);
  if (typeof spec.region === 'string' && spec.region) parts.push(spec.region);
  if (typeof spec.path === 'string' && spec.path) parts.push(spec.path);
  if (typeof spec.url === 'string' && spec.url) parts.push(spec.url);
  if (typeof spec.server === 'string' && spec.server) parts.push(spec.server);
  if (typeof spec.host === 'string' && spec.host) parts.push(spec.host);
  if (typeof spec.registry === 'string' && spec.registry) parts.push(spec.registry);
  if (typeof spec.keyType === 'string' && spec.keyType) parts.push(spec.keyType);
  if (typeof spec.algorithm === 'string' && spec.algorithm) parts.push(spec.algorithm);
  if (Array.isArray(spec.data)) parts.push(`${spec.data.length} entries`);

  return parts.join(', ') || '-';
}

/** Short, non-sensitive summary of a generator spec for table display. */
export const describeGenerator = (resource: GeneratorResource): string => {
  const spec = resource.spec;
  if (resource.kind === 'ClusterGenerator') {
    const wrapped = typeof spec?.kind === 'string' ? spec.kind : undefined;
    const generator = spec?.generator as Record<string, unknown> | undefined;
    const innerSpec = generator
      ? (Object.values(generator).find((value) => value && typeof value === 'object') as
          | Record<string, unknown>
          | undefined)
      : undefined;
    const innerDesc = describeSpec(innerSpec);
    if (wrapped && innerDesc !== '-') return `${wrapped}: ${innerDesc}`;
    if (wrapped) return wrapped;
    return innerDesc;
  }
  return describeSpec(spec);
};

/** Inspect URL for a generator row (cluster-scoped kinds omit namespace). */
export const getGeneratorInspectHref = (resource: GeneratorResource): string => {
  const def = getGeneratorDefByKind(resource.kind || '');
  const resourceType = def?.plural || `${(resource.kind || '').toLowerCase()}s`;
  const name = resource.metadata.name;
  if (def?.clusterScoped || isClusterGenerator(resource)) {
    return `/secrets-management/inspect/${resourceType}/${name}`;
  }
  const namespace = resource.metadata.namespace || 'default';
  return `/secrets-management/inspect/${resourceType}/${namespace}/${name}`;
};
