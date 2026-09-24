import { render, screen } from '@testing-library/react';
import { SecretProviderClassTable } from './SecretProviderClassTable';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useNamespacedWatchAllowed } from '../hooks/useClusterWatchAllowed';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: jest.fn(),
  consoleFetch: jest.fn(),
}));

jest.mock('../hooks/useClusterWatchAllowed', () => ({
  useNamespacedWatchAllowed: jest.fn(() => ({ allowed: false, loading: false })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseK8sWatchResource = useK8sWatchResource as jest.Mock;

describe('SecretProviderClassTable RBAC watch gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseK8sWatchResource.mockReturnValue([[], true, undefined]);
  });

  it('shows empty state without error when namespace watch is denied', () => {
    render(<SecretProviderClassTable selectedProject="app" />);

    expect(screen.queryByTestId('secret-provider-class-table-error')).not.toBeInTheDocument();
    expect(screen.getByText('No secret provider classes found')).toBeInTheDocument();
  });
});
