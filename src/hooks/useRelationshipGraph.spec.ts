import { act, renderHook, waitFor } from '@testing-library/react';
import { useRelationshipGraph } from './useRelationshipGraph';
import { resolveRelationships } from '../components/RelationshipGraph/relationshipResolvers';

jest.mock('../components/RelationshipGraph/relationshipResolvers', () => ({
  resolveRelationships: jest.fn(),
}));

const mockResolveRelationships = resolveRelationships as jest.Mock;

describe('useRelationshipGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch until fetch() is called (lazy panel-expand behavior)', () => {
    renderHook(() =>
      useRelationshipGraph({
        kind: 'Certificate',
        resource: { metadata: { name: 'x' } },
        namespace: 'demo',
        name: 'x',
      }),
    );

    expect(mockResolveRelationships).not.toHaveBeenCalled();
  });

  it('fetches and exposes the resolved graph data', async () => {
    mockResolveRelationships.mockResolvedValue({ nodes: [{ id: 'a' }], edges: [], warnings: [] });

    const { result } = renderHook(() =>
      useRelationshipGraph({
        kind: 'Certificate',
        resource: { metadata: { name: 'x' } },
        namespace: 'demo',
        name: 'x',
      }),
    );

    act(() => {
      result.current.fetch();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.hasFetched).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.nodes).toHaveLength(1);
    expect(mockResolveRelationships).toHaveBeenCalledWith(
      'Certificate',
      { metadata: { name: 'x' } },
      'demo',
      'x',
    );
  });

  it('surfaces a rejected resolver promise as an error', async () => {
    mockResolveRelationships.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useRelationshipGraph({
        kind: 'Certificate',
        resource: { metadata: { name: 'x' } },
        namespace: 'demo',
        name: 'x',
      }),
    );

    act(() => {
      result.current.fetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('boom');
  });

  it('does nothing when disabled', () => {
    const { result } = renderHook(() =>
      useRelationshipGraph({
        kind: 'Certificate',
        resource: undefined,
        namespace: 'demo',
        name: 'x',
        enabled: false,
      }),
    );

    act(() => {
      result.current.fetch();
    });

    expect(mockResolveRelationships).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
