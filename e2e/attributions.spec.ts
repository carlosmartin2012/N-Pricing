import { test, expect } from '@playwright/test';
import { registerApiMocks } from './mockApi.ts';

/**
 * Atribuciones jerárquicas E2E — Ola 8 Bloque B (cobertura Banca March).
 *
 * Cubre los 3 entry-points de la feature end-to-end con mocks API:
 *   1. /approvals          — Approval Cockpit (bandeja con KPIs + acciones)
 *   2. /attributions/matrix — Editor Admin (lista jerárquica + thresholds)
 *   3. Calculator embed     — AttributionSimulator widget contextual
 *
 * Mocks viven en e2e/mockApi.ts bajo el prefijo `/attributions/*`.
 */

test.beforeEach(async ({ page }) => {
  await registerApiMocks(page);
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('demo-username').fill('demo');
  await page.getByTestId('demo-password').fill('demo');
  await page.getByTestId('demo-login-btn').click();
  await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
});

test.describe('Atribuciones — Approval Cockpit', () => {
  test('lista decisiones pendientes con KPIs agregados', async ({ page }) => {
    await page.goto('/approvals');
    // Header de la vista
    await expect(page.getByText(/My approvals|Mis aprobaciones/i)).toBeVisible({ timeout: 5_000 });
    // KPIs (count + volumen agregado + RAROC + drift)
    await expect(page.getByText(/Pending|Pendientes/i).first()).toBeVisible();
    // Filas de decisiones del mock
    await expect(page.getByText('ABC-1234')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('ABC-1240')).toBeVisible();
  });

  test('botón aprobar abre confirmación inline con motivo', async ({ page }) => {
    await page.goto('/approvals');
    await expect(page.getByText('ABC-1234')).toBeVisible({ timeout: 5_000 });
    // Acción aprobar (aria-label en EN)
    await page.getByRole('button', { name: 'Approve' }).first().click();
    // Aparece el confirm con campo motivo + botón "Confirm approval"
    await expect(page.getByPlaceholder(/Reason|Motivo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirm approval|Confirmar aprobación/i })).toBeVisible();
  });
});

test.describe('Atribuciones — Matrix Editor', () => {
  test('lista la jerarquía actual del tenant', async ({ page }) => {
    await page.goto('/attributions/matrix');
    await expect(page.getByText(/Attribution matrix|Matriz de atribuciones/i).first()).toBeVisible({ timeout: 5_000 });
    // Niveles del mock
    await expect(page.getByText('Director Oficina').first()).toBeVisible();
    await expect(page.getByText('Zona').first()).toBeVisible();
    await expect(page.getByText('Comité').first()).toBeVisible();
    // Badges de orden (L1/L2/L3)
    await expect(page.getByText('L1').first()).toBeVisible();
  });

  test('botón "Add level" abre el formulario de creación', async ({ page }) => {
    await page.goto('/attributions/matrix');
    await page.getByRole('button', { name: /Add level|Añadir nivel/i }).click();
    // Inputs del form (Name + Order + Role + Parent)
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save|Guardar$/i })).toBeVisible();
  });
});

test.describe('Atribuciones — Simulator embebido en Calculator', () => {
  test('renderiza el widget compacto bajo el Recommendation Panel', async ({ page }) => {
    // El simulator se monta en /pricing tras el cálculo del deal.
    await page.goto('/pricing');
    await expect(page.getByTestId('deal-input-panel')).toBeVisible({ timeout: 10_000 });
    // Esperamos a que el simulator se hidrate (lazy import + matrix fetch).
    await expect(page.getByTestId('attribution-simulator')).toBeVisible({ timeout: 10_000 });
  });
});
