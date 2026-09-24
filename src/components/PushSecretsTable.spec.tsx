import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PushSecretsTable } from './PushSecretsTable';
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
    useDualScopeDeleteAllowed: jest.fn(() => () => true),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseK8sWatchResource = useK8sWatchResource as jest.Mock;
const mockUseOptionalClusterListWatch = useOptionalClusterListWatch as jest.Mock;
const { useDualScopeDeleteAllowed } = jest.requireMock('../hooks/useClusterWatchAllowed');
const mockUseDualScopeDeleteAllowed = useDualScopeDeleteAllowed as jest.Mock;

const nsPush = {
  kind: 'PushSecret',
  metadata: { name: 'push', namespace: 'app', creationTimestamp: '2026-01-01T00:00:00Z' },
  spec: {
    secretStoreRefs: [{ name: 'store', kind: 'SecretStore' }],
    selector: { secret: { name: 'src' } },
  },
};

describe('PushSecretsTable RBAC cluster watch gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseK8sWatchResource.mockReturnValue([[nsPush], true, undefined]);
    mockUseOptionalClusterListWatch.mockReturnValue({
      data: [],
      loaded: true,
      error: undefined,
      clusterWatchSkipped: true,
    });
  });

  it('renders namespace pushsecrets when cluster push secrets watch is denied', () => {
    render(<PushSecretsTable selectedProject="app" />);

    expect(screen.getByText('push')).toBeInTheDocument();
    expect(screen.queryByTestId('push-secrets-table-error')).not.toBeInTheDocument();
  });

  it('omits Delete when push secret delete is denied', async () => {
    const user = userEvent.setup();
    mockUseDualScopeDeleteAllowed.mockReturnValue(() => false);

    render(<PushSecretsTable selectedProject="app" />);

    await user.click(screen.getByRole('button', { name: /kebab dropdown toggle/i }));
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
