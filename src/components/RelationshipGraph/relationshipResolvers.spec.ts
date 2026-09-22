import { k8sGet, k8sListItems, HttpError } from '@openshift-console/dynamic-plugin-sdk';
import { getNodeHref, resolveRelationships } from './relationshipResolvers';
import type { Certificate, ExternalSecret, Issuer } from '../crds';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  k8sGet: jest.fn(),
  k8sListItems: jest.fn(),
  HttpError: class HttpError extends Error {
    code?: number;
    constructor(message: string, code?: number) {
      super(message);
      this.code = code;
    }
  },
}));

const mockK8sGet = k8sGet as jest.Mock;
const mockK8sListItems = k8sListItems as jest.Mock;

const notFound = () => Promise.reject(new HttpError('Not Found', 404));

describe('getNodeHref', () => {
  it('builds an in-plugin inspect href for namespaced CRD kinds', () => {
    expect(getNodeHref('Certificate', 'my-ns', 'my-cert')).toBe(
      '/secrets-management/inspect/certificates/my-ns/my-cert',
    );
  });

  it('builds an in-plugin inspect href for cluster-scoped CRD kinds without a namespace segment', () => {
    expect(getNodeHref('ClusterIssuer', undefined, 'my-issuer')).toBe(
      '/secrets-management/inspect/clusterissuers/my-issuer',
    );
  });

  it('builds a native Console href for core resources', () => {
    expect(getNodeHref('Secret', 'my-ns', 'my-secret')).toBe('/k8s/ns/my-ns/secrets/my-secret');
  });

  it('returns undefined for unknown kinds', () => {
    expect(getNodeHref('SomethingUnknown', 'my-ns', 'x')).toBeUndefined();
  });
});

describe('resolveRelationships', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockK8sListItems.mockResolvedValue([]);
  });

  it('Certificate: builds upstream issuerRef, downstream secret, and workload edges', async () => {
    const certificate: Certificate = {
      metadata: { name: 'my-cert', namespace: 'demo', creationTimestamp: '' },
      spec: { secretName: 'my-cert-tls', issuerRef: { name: 'my-issuer', kind: 'Issuer' } },
      status: { conditions: [{ type: 'Ready', status: 'True' }] },
    };

    mockK8sGet.mockImplementation(({ model, name }: { model: { kind: string }; name: string }) => {
      if (model.kind === 'Issuer' && name === 'my-issuer') return Promise.resolve({});
      if (model.kind === 'Secret' && name === 'my-cert-tls') return Promise.resolve({});
      return notFound();
    });
    // No workloads reference the secret in this scenario.
    mockK8sListItems.mockResolvedValue([]);

    const result = await resolveRelationships('Certificate', certificate, 'demo', 'my-cert');

    expect(result.nodes.find((n) => n.isRoot)?.status).toBe('ready');
    const issuerEdge = result.edges.find((e) => e.label === 'issuerRef');
    expect(issuerEdge).toBeDefined();
    const secretEdge = result.edges.find((e) => e.label === 'Creates');
    expect(secretEdge).toBeDefined();
    expect(result.nodes.some((n) => n.kind === 'Issuer' && n.name === 'my-issuer')).toBe(true);
    expect(result.nodes.some((n) => n.kind === 'Secret' && n.name === 'my-cert-tls')).toBe(true);
  });

  it('Certificate: marks the produced Secret as not-found when it does not exist', async () => {
    const certificate: Certificate = {
      metadata: { name: 'my-cert', namespace: 'demo', creationTimestamp: '' },
      spec: { secretName: 'missing-secret', issuerRef: { name: 'my-issuer', kind: 'Issuer' } },
    };
    mockK8sGet.mockImplementation(notFound);

    const result = await resolveRelationships('Certificate', certificate, 'demo', 'my-cert');

    const secretNode = result.nodes.find((n) => n.kind === 'Secret');
    expect(secretNode?.status).toBe('not-found');
    expect(secretNode?.href).toBeUndefined();
  });

  it('Issuer: finds Certificates referencing it via a reverse lookup', async () => {
    const issuer: Issuer = {
      metadata: { name: 'my-issuer', namespace: 'demo', creationTimestamp: '' },
      spec: { selfSigned: {} },
    };
    mockK8sListItems.mockResolvedValue([
      {
        metadata: { name: 'cert-a', namespace: 'demo' },
        spec: { issuerRef: { name: 'my-issuer', kind: 'Issuer' } },
        status: { conditions: [{ type: 'Ready', status: 'True' }] },
      },
      {
        metadata: { name: 'cert-b', namespace: 'demo' },
        spec: { issuerRef: { name: 'other-issuer', kind: 'Issuer' } },
      },
    ]);

    const result = await resolveRelationships('Issuer', issuer, 'demo', 'my-issuer');

    expect(result.nodes.some((n) => n.kind === 'Certificate' && n.name === 'cert-a')).toBe(true);
    expect(result.nodes.some((n) => n.kind === 'Certificate' && n.name === 'cert-b')).toBe(false);
  });

  it('ExternalSecret: falls back to the CR name for the produced Secret when spec.target.name is unset', async () => {
    const externalSecret: ExternalSecret = {
      metadata: { name: 'db-creds', namespace: 'demo', creationTimestamp: '' },
      spec: { secretStoreRef: { name: 'aws-store', kind: 'SecretStore' } },
    };
    mockK8sGet.mockResolvedValue({});

    const result = await resolveRelationships('ExternalSecret', externalSecret, 'demo', 'db-creds');

    expect(result.nodes.some((n) => n.kind === 'Secret' && n.name === 'db-creds')).toBe(true);
  });

  it('adds an "Insufficient permissions" warning instead of throwing on a forbidden LIST', async () => {
    const issuer: Issuer = {
      metadata: { name: 'my-issuer', namespace: 'demo', creationTimestamp: '' },
      spec: { selfSigned: {} },
    };
    mockK8sListItems.mockRejectedValue(new HttpError('Forbidden', 403));

    const result = await resolveRelationships('Issuer', issuer, 'demo', 'my-issuer');

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.nodes).toHaveLength(1); // root only
  });

  it('falls back to a root-only graph (plus explicit ownerReferences) for unknown kinds', async () => {
    const result = await resolveRelationships(
      'SomeUnknownKind',
      {
        metadata: {
          name: 'child',
          ownerReferences: [{ apiVersion: 'v1', kind: 'Parent', name: 'parent-1', uid: 'abc' }],
        },
      },
      'demo',
      'child',
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.edges[0].label).toBe('Owned By');
  });
});
