import {
  GENERATOR_GROUP,
  GENERATOR_KIND_DEFS,
  GENERATOR_VERSION,
  ClusterGeneratorModel,
  PasswordModel,
  describeGenerator,
  getGeneratorDefByKind,
  getGeneratorDefByPlural,
  getGeneratorKind,
  getGeneratorInspectHref,
  getGeneratorModel,
  isClusterGenerator,
  type GeneratorResource,
} from './Generator';

const baseMeta = {
  name: 'example',
  namespace: 'app',
  creationTimestamp: '2026-08-01T00:00:00Z',
};

function resource(overrides: Partial<GeneratorResource> = {}): GeneratorResource {
  const { metadata: metadataOverride, ...rest } = overrides;
  return {
    kind: 'Password',
    spec: {},
    ...rest,
    metadata: metadataOverride
      ? { name: 'example', creationTimestamp: baseMeta.creationTimestamp, ...metadataOverride }
      : { ...baseMeta },
  };
}

describe('generator CRD helpers', () => {
  it('lists user-facing generator kinds and omits GeneratorState', () => {
    const kinds = GENERATOR_KIND_DEFS.map((def) => def.kind);
    expect(kinds).toContain('Password');
    expect(kinds).toContain('UUID');
    expect(kinds).toContain('ClusterGenerator');
    expect(kinds).not.toContain('GeneratorState');
    expect(GENERATOR_KIND_DEFS.filter((def) => def.clusterScoped).map((def) => def.kind)).toEqual([
      'ClusterGenerator',
    ]);
  });

  it('builds models with the generators API group and v1alpha1', () => {
    expect(getGeneratorModel('Webhook')).toEqual({
      group: GENERATOR_GROUP,
      version: GENERATOR_VERSION,
      kind: 'Webhook',
    });
    expect(PasswordModel.kind).toBe('Password');
    expect(ClusterGeneratorModel.kind).toBe('ClusterGenerator');
    expect(PasswordModel.group).toBe('generators.external-secrets.io');
  });

  it('looks up kind defs by kind and plural', () => {
    expect(getGeneratorDefByKind('Password')).toEqual({
      kind: 'Password',
      plural: 'passwords',
      clusterScoped: false,
    });
    expect(getGeneratorDefByPlural('clustergenerators')).toEqual({
      kind: 'ClusterGenerator',
      plural: 'clustergenerators',
      clusterScoped: true,
    });
    expect(getGeneratorDefByKind('GeneratorState')).toBeUndefined();
    expect(getGeneratorDefByPlural('unknown')).toBeUndefined();
  });

  describe('isClusterGenerator', () => {
    it('is true for ClusterGenerator even if a namespace is present', () => {
      expect(
        isClusterGenerator(
          resource({
            kind: 'ClusterGenerator',
            metadata: { ...baseMeta, namespace: 'should-not-matter' },
          }),
        ),
      ).toBe(true);
    });

    it('is true when namespace is missing', () => {
      expect(
        isClusterGenerator(
          resource({
            kind: 'Password',
            metadata: { name: 'x', creationTimestamp: baseMeta.creationTimestamp },
          }),
        ),
      ).toBe(true);
    });

    it('is false for namespaced generators', () => {
      expect(isClusterGenerator(resource({ kind: 'UUID' }))).toBe(false);
    });
  });

  describe('getGeneratorKind', () => {
    it('returns the resource kind for namespaced generators', () => {
      expect(getGeneratorKind(resource({ kind: 'UUID' }))).toBe('UUID');
    });

    it('returns the wrapped kind for ClusterGenerator', () => {
      expect(
        getGeneratorKind(
          resource({
            kind: 'ClusterGenerator',
            spec: { kind: 'Password' },
          }),
        ),
      ).toBe('Password');
    });

    it('falls back when ClusterGenerator has no wrapped kind', () => {
      expect(getGeneratorKind(resource({ kind: 'ClusterGenerator', spec: {} }))).toBe(
        'ClusterGenerator',
      );
    });

    it('returns Unknown when kind is missing', () => {
      expect(getGeneratorKind(resource({ kind: undefined }))).toBe('Unknown');
    });
  });

  describe('describeGenerator', () => {
    it('summarizes Password spec fields', () => {
      expect(
        describeGenerator(
          resource({
            spec: { length: 42, digits: 5, symbols: 3 },
          }),
        ),
      ).toBe('length 42, 5 digits, 3 symbols');
    });

    it('returns "-" for empty specs', () => {
      expect(describeGenerator(resource({ kind: 'UUID', spec: {} }))).toBe('-');
    });

    it('summarizes Fake data entries and Vault/Webhook fields', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'Fake',
            spec: { data: [{ key: 'a' }, { key: 'b' }] },
          }),
        ),
      ).toBe('2 entries');
      expect(
        describeGenerator(
          resource({
            kind: 'VaultDynamicSecret',
            spec: { path: 'secret/data/app', server: 'https://vault.example' },
          }),
        ),
      ).toBe('secret/data/app, https://vault.example');
      expect(
        describeGenerator(
          resource({
            kind: 'Webhook',
            spec: { url: 'https://hooks.example/token' },
          }),
        ),
      ).toBe('https://hooks.example/token');
    });

    it('summarizes ClusterGenerator using the wrapped spec', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'ClusterGenerator',
            spec: {
              kind: 'Password',
              generator: { passwordSpec: { length: 32, digits: 4 } },
            },
          }),
        ),
      ).toBe('Password: length 32, 4 digits');
    });

    it('uses only the wrapped kind when the inner spec has no display fields', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'ClusterGenerator',
            spec: { kind: 'UUID', generator: { uuidSpec: {} } },
          }),
        ),
      ).toBe('UUID');
    });
  });

  describe('getGeneratorInspectHref', () => {
    it('builds a namespaced inspect path for Password', () => {
      expect(getGeneratorInspectHref(resource({ kind: 'Password' }))).toBe(
        '/secrets-management/inspect/passwords/app/example',
      );
    });

    it('builds a cluster-scoped inspect path for ClusterGenerator', () => {
      expect(
        getGeneratorInspectHref(
          resource({
            kind: 'ClusterGenerator',
            metadata: { name: 'cluster-password', creationTimestamp: baseMeta.creationTimestamp },
          }),
        ),
      ).toBe('/secrets-management/inspect/clustergenerators/cluster-password');
    });

    it('omits namespace in the path when the resource has no namespace', () => {
      expect(
        getGeneratorInspectHref(
          resource({
            kind: 'UUID',
            metadata: { name: 'id', namespace: undefined, creationTimestamp: baseMeta.creationTimestamp },
          }),
        ),
      ).toBe('/secrets-management/inspect/uuids/id');
    });

    it('builds inspect paths for all namespaced generator kinds', () => {
      const namespacedKinds = GENERATOR_KIND_DEFS.filter((def) => !def.clusterScoped);
      for (const def of namespacedKinds) {
        const href = getGeneratorInspectHref(resource({ kind: def.kind }));
        expect(href).toBe(`/secrets-management/inspect/${def.plural}/app/example`);
      }
    });
  });

  describe('describeGenerator - additional generator types', () => {
    it('summarizes SSHKey spec with keyType', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'SSHKey',
            spec: { keyType: 'rsa', size: 4096 },
          }),
        ),
      ).toBe('size 4096, rsa');
    });

    it('summarizes Webhook spec with url', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'Webhook',
            spec: { url: 'https://api.example.com/generate' },
          }),
        ),
      ).toBe('https://api.example.com/generate');
    });

    it('summarizes ACRAccessToken spec with registry', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'ACRAccessToken',
            spec: { registry: 'myregistry.azurecr.io' },
          }),
        ),
      ).toBe('myregistry.azurecr.io');
    });

    it('summarizes ECRAuthorizationToken spec with region', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'ECRAuthorizationToken',
            spec: { region: 'us-west-2' },
          }),
        ),
      ).toBe('us-west-2');
    });

    it('summarizes Grafana spec with url', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'Grafana',
            spec: { url: 'https://grafana.example.com' },
          }),
        ),
      ).toBe('https://grafana.example.com');
    });

    it('summarizes GithubAccessToken spec with host', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'GithubAccessToken',
            spec: { host: 'github.example.com' },
          }),
        ),
      ).toBe('github.example.com');
    });

    it('summarizes generator with algorithm field', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'SSHKey',
            spec: { algorithm: 'ed25519' },
          }),
        ),
      ).toBe('ed25519');
    });

    it('summarizes generator with server field', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'VaultDynamicSecret',
            spec: { server: 'https://vault.example.com' },
          }),
        ),
      ).toBe('https://vault.example.com');
    });

    it('summarizes MFA with empty spec', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'MFA',
            spec: {},
          }),
        ),
      ).toBe('-');
    });

    it('summarizes QuayAccessToken with registry', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'QuayAccessToken',
            spec: { registry: 'quay.io' },
          }),
        ),
      ).toBe('quay.io');
    });

    it('combines multiple spec fields', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'VaultDynamicSecret',
            spec: { path: 'secret/data/myapp', server: 'https://vault.example.com', region: 'us-east-1' },
          }),
        ),
      ).toBe('us-east-1, secret/data/myapp, https://vault.example.com');
    });
  });

  describe('edge cases', () => {
    it('handles undefined kind gracefully', () => {
      expect(getGeneratorKind(resource({ kind: undefined }))).toBe('Unknown');
    });

    it('handles missing spec gracefully', () => {
      expect(describeGenerator(resource({ kind: 'Password', spec: undefined }))).toBe('-');
    });

    it('handles ClusterGenerator with empty generator object', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'ClusterGenerator',
            spec: { kind: 'Password', generator: {} },
          }),
        ),
      ).toBe('Password');
    });

    it('handles ClusterGenerator with no kind in spec', () => {
      expect(
        describeGenerator(
          resource({
            kind: 'ClusterGenerator',
            spec: { generator: { passwordSpec: { length: 16 } } },
          }),
        ),
      ).toBe('length 16');
    });

    it('getGeneratorDefByKind returns undefined for unknown kind', () => {
      expect(getGeneratorDefByKind('UnknownGenerator')).toBeUndefined();
    });

    it('getGeneratorDefByPlural returns undefined for unknown plural', () => {
      expect(getGeneratorDefByPlural('unknowngenerators')).toBeUndefined();
    });
  });
});
