import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CertificatesTable } from './CertificatesTable';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: jest.fn(),
  consoleFetch: jest.fn(),
}));

jest.mock('../hooks/useClusterWatchAllowed', () => {
  const actual = jest.requireActual('../hooks/useClusterWatchAllowed');
  return {
    ...actual,
    useNamespacedOnlyDeleteAllowed: jest.fn(() => true),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseK8sWatchResource = useK8sWatchResource as jest.Mock;
const { useNamespacedOnlyDeleteAllowed } = jest.requireMock('../hooks/useClusterWatchAllowed');
const mockUseNamespacedOnlyDeleteAllowed = useNamespacedOnlyDeleteAllowed as jest.Mock;

const cert = {
  metadata: { name: 'tls', namespace: 'app', creationTimestamp: '2026-01-01T00:00:00Z' },
  spec: { secretName: 'tls-secret', issuerRef: { name: 'issuer' } },
};

describe('CertificatesTable', () => {
  it('renders namespaced certificates (no cluster-scoped watch in this table)', () => {
    mockUseK8sWatchResource.mockReturnValue([[cert], true, undefined]);

    render(<CertificatesTable selectedProject="app" />);

    expect(screen.getByText('tls')).toBeInTheDocument();
    expect(screen.queryByTestId('certificates-table-error')).not.toBeInTheDocument();
  });

  it('omits Delete when certificate delete is denied', async () => {
    const user = userEvent.setup();
    mockUseK8sWatchResource.mockReturnValue([[cert], true, undefined]);
    mockUseNamespacedOnlyDeleteAllowed.mockReturnValue(false);

    render(<CertificatesTable selectedProject="app" />);

    await user.click(screen.getByRole('button', { name: /kebab dropdown toggle/i }));
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
