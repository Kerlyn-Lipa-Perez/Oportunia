import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

const sectionPages = [
  'src/app/admin/page.tsx',
  'src/app/admin/convocatorias/page.tsx',
  'src/app/admin/campanas/page.tsx',
  'src/app/admin/ingesta/page.tsx',
  'src/app/admin/equipo/page.tsx',
];

test('admin shell is a sidebar layout with one route per functional section', () => {
  const layout = source('src/app/admin/layout.tsx');
  const sidebar = source('src/app/admin/sidebar.tsx');

  assert.match(layout, /requireEditorial/);
  assert.match(layout, /isEditorialAccess/);
  assert.match(layout, /AdminSidebar/);
  assert.match(layout, /AdminLogin/);

  for (const path of sectionPages) {
    assert.ok(existsSync(path), `${path} must exist`);
  }

  assert.match(sidebar, /usePathname/);
  for (const href of ['/admin', '/admin/convocatorias', '/admin/campanas', '/admin/ingesta', '/admin/equipo']) {
    assert.ok(sidebar.includes(`href="${href}"`), `sidebar must link ${href}`);
  }
  assert.match(sidebar, /aria-current/);
  assert.match(sidebar, /Equipo/);

  assert.equal(existsSync('src/app/admin/panel.tsx'), false, 'the panel.tsx monolith must be removed');
});

test('admin sections keep the responsibilities extracted from the monolith', () => {
  const resumen = source('src/app/admin/page.tsx');
  const convocatorias = source('src/app/admin/convocatorias/panel.tsx');
  const campanas = source('src/app/admin/campanas/page.tsx');
  const ingesta = source('src/app/admin/ingesta/panel.tsx');
  const equipo = source('src/app/admin/equipo/page.tsx');
  const login = source('src/app/admin/login.tsx');

  assert.match(resumen, /getAllOpportunities/);
  assert.match(resumen, /Resumen/);

  assert.match(convocatorias, /Nueva convocatoria/);
  assert.match(convocatorias, /editor-overlay/);

  assert.match(campanas, /SocialCampaignsPanel/);
  assert.match(campanas, /getAllOpportunities/);

  assert.match(ingesta, /Carga y fuentes oficiales/);
  assert.match(ingesta, /\/api\/admin\/ingestion\//);

  assert.match(equipo, /access\.kind !== 'admin'/);
  assert.match(equipo, /TeamPanel/);

  assert.match(login, /'Ingresar'/);
  assert.doesNotMatch(login, /Ingresar al CMS/);
});

test('admin shell styles the sidebar for desktop and mobile', () => {
  const styles = source('src/app/admin/admin.css');

  assert.match(styles, /\.admin-sidebar/);
  assert.match(styles, /\.admin-nav/);
  assert.match(styles, /@media\(max-width:800px\)/);
});
