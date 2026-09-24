import { render, screen } from '@testing-library/react';
import { SecretStoresTable } from './SecretStoresTable';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useOptionalClusterListWatch } from '../hooks/useClusterWatchAllowed';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: jest.fn(),
  consoleFetch: jest.fn(),
}));

jest.mock('../hooks/useClusterWatchAllowed', () => {
  const actual = jest.requireActual('../hooks/useClusterWatchAllowed');
  return { ...actual, useOptionalClusterListWatch: jest.fn() };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseK8sWatchResource = useK8sWatchResource as jest.Mock;
const mockUseOptionalClusterListWatch = useOptionalClusterListWatch as jest.Mock;

const nsStore = {
  kind: 'SecretStore',
  metadata: { name: 'store', namespace: 'app', creationTimestamp: '2026-01-01T00:00:00Z' },
  spec: { provider: { aws: { service: 'SecretsManager', region: 'us-east-1' } } },
};

describe('SecretStoresTable RBAC cluster watch gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseK8sWatchResource.mockReturnValue([[nsStore], true, undefined]);
    mockUseOptionalClusterListWatch.mockReturnValue({
      data: [],
      loaded: true,
      error: undefined,
      clusterWatchSkipped: true,
    });
  });

  it('renders namespace secretstores when cluster secret stores watch is denied', () => {
    render(<SecretStoresTable selectedProject="app" />);

    expect(screen.getByText('store')).toBeInTheDocument();
    expect(screen.queryByTestId('secret-stores-table-error')).not.toBeInTheDocument();
  });
});
