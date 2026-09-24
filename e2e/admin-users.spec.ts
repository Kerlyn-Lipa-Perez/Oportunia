import { expect, test, type Page } from '@playwright/test';
import { resolveAdminE2eCredentials } from './config';

const credentials = resolveAdminE2eCredentials(process.env);

async function login(page: Page, email: string, password: string) {
  await page.goto('/admin');
  await page.getByLabel('Correo editorial').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Convocatorias' })).toBeVisible();
}

function teamRow(page: Page, email: string) {
  return page.locator('.editor-team-row').filter({ hasText: email });
}

test('admin manages an editor while editorial access stays separated', async ({ browser, page }) => {
  await login(page, credentials.adminEmail, credentials.adminPassword);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Convocatorias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();

  let row = teamRow(page, credentials.editorEmail);
  if (await row.count() === 0) {
    const form = page.locator('.editor-team-create');
    await form.getByLabel('Nombre').fill('Editora E2E');
    await form.getByLabel('Correo').fill(credentials.editorEmail);
    await form.getByLabel('Contraseña inicial').fill(credentials.editorPassword);
    await form.getByLabel('Rol').selectOption('editor');
    await form.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText(/Cuenta creada/)).toBeVisible();
    row = teamRow(page, credentials.editorEmail);
  }
  await expect(row).toHaveCount(1);

  const role = row.getByLabel(`Rol de ${credentials.editorEmail}`);
  if (await role.inputValue() !== 'editor') {
    await role.selectOption('editor');
    await expect(page.getByText(/Acceso actualizado/)).toBeVisible();
  }
  row = teamRow(page, credentials.editorEmail);
  if (await row.getByRole('button', { name: 'Reactivar' }).count()) {
    await row.getByRole('button', { name: 'Reactivar' }).click();
    await expect(teamRow(page, credentials.editorEmail)).toContainText('Activa');
  }

  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await login(editorPage, credentials.editorEmail, credentials.editorPassword);
  await expect(editorPage.getByRole('button', { name: /Nueva convocatoria/ })).toBeVisible();
  await expect(editorPage.getByRole('heading', { name: 'Carga y fuentes oficiales' })).toBeVisible();
  await expect(editorPage.getByRole('heading', { name: 'Equipo' })).toHaveCount(0);
  const editorUsersApi = await editorPage.evaluate(async () => {
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  });
  expect(editorUsersApi.status).toBe(403);
  await editorContext.close();

  row = teamRow(page, credentials.editorEmail);
  await row.getByLabel(`Rol de ${credentials.editorEmail}`).selectOption('admin');
  await expect(page.getByText(/Acceso actualizado/)).toBeVisible();
  await teamRow(page, credentials.editorEmail).getByLabel(`Rol de ${credentials.editorEmail}`).selectOption('editor');
  await expect(page.getByText(/Acceso actualizado/)).toBeVisible();

  row = teamRow(page, credentials.editorEmail);
  await row.getByRole('button', { name: 'Suspender' }).click();
  await expect(teamRow(page, credentials.editorEmail)).toContainText('Suspendida');
  await teamRow(page, credentials.editorEmail).getByRole('button', { name: 'Reactivar' }).click();
  await expect(teamRow(page, credentials.editorEmail)).toContainText('Activa');

  const selfProtection = await page.evaluate(async () => {
    const list = await fetch('/api/admin/users', { cache: 'no-store' });
    const payload = await list.json();
    const current = payload.users.find((user: { isCurrent: boolean }) => user.isCurrent);
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: current.id, role: 'editor' }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(selfProtection.status).toBe(409);
  expect(selfProtection.body.code).toBe('self_management_forbidden');
});
