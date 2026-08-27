import { test, expect } from '@playwright/test';
import {
  mockOperatorDetection,
  mockNamespaces,
  mockK8sResourceList,
  mockGeneratorLists,
} from '../support/mock-api';
import mockPasswords from '../fixtures/mock-passwords.json';
import mockClusterGenerators from '../fixtures/mock-cluster-generators.json';

test.describe('External Secrets Operator Generators', () => {
  test.describe('Generators table rendering', () => {
    test.beforeEach(async ({ page }) => {
      await mockOperatorDetection(page, { externalSecrets: true });
      await mockNamespaces(page, ['default', 'external-secrets-operator']);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'externalsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'secretstores', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'clustersecretstores', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'clusterexternalsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1alpha1', 'pushsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1alpha1', 'clusterpushsecrets', []);
      await mockGeneratorLists(page, {
        passwords: mockPasswords,
        clustergenerators: mockClusterGenerators,
      });
    });

    test('renders Generators section with heading, badge, and columns', async ({ page }) => {
      await page.goto('/secrets-management');

      await expect(page.getByRole('heading', { name: 'Secrets Management' })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole('heading', { name: 'Generators', level: 3 })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('External Secrets Operator').first()).toBeVisible();

      const table = page.locator('[data-test="generators-table"]');
      await expect(table).toBeVisible({ timeout: 15000 });
      await expect(table.getByText('Name')).toBeVisible();
      await expect(table.getByText('Namespace')).toBeVisible();
      await expect(table.getByText('Type')).toBeVisible();
      await expect(table.getByText('Generator Kind')).toBeVisible();
      await expect(table.getByText('Details')).toBeVisible();
      await expect(table.getByText('Status')).toBeVisible();
    });

    test('renders namespaced Password and ClusterGenerator rows', async ({ page }) => {
      await page.goto('/secrets-management');

      const table = page.locator('[data-test="generators-table"]');
      await expect(table).toBeVisible({ timeout: 30000 });
      await expect(table.getByText('db-password')).toBeVisible();
      await expect(table.getByText('api-password')).toBeVisible();
      await expect(table.getByText('cluster-password')).toBeVisible();
      await expect(table.getByText('Cluster-wide')).toBeVisible();
      await expect(table.getByText('length 42, 5 digits, 3 symbols')).toBeVisible();
      await expect(table.getByText('Password: length 32, 4 digits')).toBeVisible();
    });
  });

  test.describe('Pagination', () => {
    test('shows pagination when more than 10 generators exist', async ({ page }) => {
      const manyPasswords = Array.from({ length: 12 }, (_, i) => ({
        kind: 'Password',
        metadata: {
          name: `password-${String(i + 1).padStart(2, '0')}`,
          namespace: 'external-secrets-operator',
          creationTimestamp: '2024-06-01T00:00:00Z',
        },
        spec: { length: 16 },
      }));

      await mockOperatorDetection(page, { externalSecrets: true });
      await mockNamespaces(page, ['default']);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'externalsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'secretstores', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'clustersecretstores', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'clusterexternalsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1alpha1', 'pushsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1alpha1', 'clusterpushsecrets', []);
      await mockGeneratorLists(page, { passwords: manyPasswords });

      await page.goto('/secrets-management');

      const table = page.locator('[data-test="generators-table"]');
      await expect(table).toBeVisible({ timeout: 30000 });
      await expect(table.getByText('password-01')).toBeVisible();
      await expect(table.getByText('password-10')).toBeVisible();
      await expect(table.getByText('password-11')).toHaveCount(0);

      const pagination = page.locator('[data-test="generators-table-pagination-bottom"]');
      await expect(pagination).toBeVisible();
      await expect(pagination.getByRole('button', { name: '1 - 10 of 12' })).toBeVisible();

      await pagination.getByRole('button', { name: 'Go to next page' }).click();
      await expect(table.getByText('password-11')).toBeVisible();
      await expect(table.getByText('password-12')).toBeVisible();
      await expect(table.getByText('password-01')).toHaveCount(0);
    });
  });

  test.describe('Empty state', () => {
    test('shows empty state when no generators exist', async ({ page }) => {
      await mockOperatorDetection(page, { externalSecrets: true });
      await mockNamespaces(page, ['default']);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'externalsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'secretstores', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'clustersecretstores', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1', 'clusterexternalsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1alpha1', 'pushsecrets', []);
      await mockK8sResourceList(page, 'external-secrets.io', 'v1alpha1', 'clusterpushsecrets', []);
      await mockGeneratorLists(page);

      await page.goto('/secrets-management');

      await expect(page.getByText('No generators found')).toBeVisible({ timeout: 30000 });
    });
  });
});
