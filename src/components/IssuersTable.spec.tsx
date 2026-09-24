import { render, screen } from '@testing-library/react';
import { IssuersTable } from './IssuersTable';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useOptionalClusterListWatch } from '../hooks/useClusterWatchAllowed';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: jest.fn(),
  consoleFetch: jest.fn(),
}));

jest.mock('../hooks/useClusterWatchAllowed', () => {
  const actual = jest.requireActual('../hooks/useClusterWatchAllowed');
  return {
    ...actual,
    useOptionalClusterListWatch: jest.fn(),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseK8sWatchResource = useK8sWatchResource as jest.Mock;
const mockUseOptionalClusterListWatch = useOptionalClusterListWatch as jest.Mock;

const namespaceIssuer = {
  metadata: { name: 'ns-issuer', namespace: 'app', creationTimestamp: '2026-01-01T00:00:00Z' },
  spec: { selfSigned: {} },
};

describe('IssuersTable RBAC cluster watch gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseK8sWatchResource.mockReturnValue([[namespaceIssuer], true, undefined]);
    mockUseOptionalClusterListWatch.mockReturnValue({
      data: [],
      loaded: true,
      error: undefined,
      clusterWatchSkipped: true,
    });
  });

  it('renders namespace issuers when cluster clusterissuers watch is denied', () => {
    render(<IssuersTable selectedProject="app" />);

    expect(screen.getByText('ns-issuer')).toBeInTheDocument();
    expect(screen.queryByTestId('issuers-table-error')).not.toBeInTheDocument();
  });
});
