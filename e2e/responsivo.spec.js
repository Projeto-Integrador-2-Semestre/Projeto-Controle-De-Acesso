import { test, expect } from '@playwright/test';
import { entrar, instalarApiFalsa } from './apiFalsa.js';

test.use({ viewport: { width: 375, height: 812 } });

test('CT-07: em 375 px aparece o menu hambúrguer e não há rolagem horizontal', async ({ page }) => {
  await instalarApiFalsa(page);
  await entrar(page);
  await expect(page).toHaveURL('/gestao');
  await expect(page.getByText('Maria Souza').first()).toBeVisible();

  const hamburguer = page.getByRole('button', { name: 'Abrir menu' });
  await expect(hamburguer).toBeVisible();
  await hamburguer.click();
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeVisible();

  for (const rota of ['/gestao', '/logs', '/monitoramento']) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
    const larguras = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(larguras.pagina, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(larguras.janela);
  }
});
