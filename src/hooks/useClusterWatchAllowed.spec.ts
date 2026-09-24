import { renderHook } from '@testing-library/react';
import {
  useClusterWatchAllowed,
  useNamespacedWatchAllowed,
  getClusterWatchAccessReviewAttributes,
  getNamespacedWatchAccessReviewAttributes,
} from './useClusterWatchAllowed';
import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterIssuerModel, IssuerModel } from '../components/crds/Issuer';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useAccessReview: jest.fn(),
}));

const mockUseAccessReview = useAccessReview as jest.MockedFunction<typeof useAccessReview>;

describe('useClusterWatchAllowed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClusterWatchAccessReviewAttributes', () => {
    it('uses plural API resource name for cluster issuers', () => {
      const attrs = getClusterWatchAccessReviewAttributes(ClusterIssuerModel);
      expect(attrs).toEqual({
        group: 'cert-manager.io',
        resource: 'clusterissuers',
        verb: 'watch',
      });
      expect(attrs?.resource).not.toBe('ClusterIssuer');
    });

    it('uses plural API resource name for namespaced issuers', () => {
      const attrs = getNamespacedWatchAccessReviewAttributes(IssuerModel, 'my-project');
      expect(attrs).toEqual({
        group: 'cert-manager.io',
        resource: 'issuers',
        verb: 'watch',
        namespace: 'my-project',
      });
    });
  });

  describe('useClusterWatchAllowed', () => {
    it('reports cluster watch disallowed when access review denies', () => {
      mockUseAccessReview.mockImplementation((attrs) => {
        if (attrs.resource === 'clusterissuers') {
          return [false, false];
        }
        return [true, false];
      });

      const { result } = renderHook(() => useClusterWatchAllowed(ClusterIssuerModel));

      expect(result.current.allowed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(mockUseAccessReview).toHaveBeenCalledWith(
        {
          group: 'cert-manager.io',
          resource: 'clusterissuers',
          verb: 'watch',
        },
        undefined,
        false,
      );
    });

    it('reports loading while cluster access review is pending', () => {
      mockUseAccessReview.mockReturnValue([false, true]);

      const { result } = renderHook(() => useClusterWatchAllowed(ClusterIssuerModel));

      expect(result.current.loading).toBe(true);
      expect(result.current.allowed).toBe(false);
    });

    it('returns allowed=false without review when model is omitted', () => {
      const { result } = renderHook(() => useClusterWatchAllowed(null));

      expect(result.current).toEqual({ allowed: false, loading: false });
      expect(mockUseAccessReview).toHaveBeenCalledWith(
        { group: '', resource: '' },
        undefined,
        true,
      );
    });
  });

  describe('useNamespacedWatchAllowed', () => {
    it('allows namespaced issuers when access review permits', () => {
      mockUseAccessReview.mockImplementation((attrs) => {
        if (attrs.resource === 'issuers') {
          return [true, false];
        }
        return [false, false];
      });

      const { result } = renderHook(() => useNamespacedWatchAllowed(IssuerModel, 'my-project'));

      expect(result.current.allowed).toBe(true);
      expect(mockUseAccessReview).toHaveBeenCalledWith(
        {
          group: 'cert-manager.io',
          resource: 'issuers',
          verb: 'watch',
          namespace: 'my-project',
        },
        undefined,
        false,
      );
    });
  });
});
