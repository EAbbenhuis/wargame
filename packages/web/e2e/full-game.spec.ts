import { expect, test } from '@playwright/test';

// Speelt een volledig spel in scripted modus met een vaste seed, zoals een speler dat zou doen:
// elke beurt de staf om een plan vragen, de voorstellen overnemen en de beurt beëindigen.
test('speelt een volledig spel tot een uitslag (scripted staf, seed 7)', async ({ page }) => {
  await page.goto('/?seed=7');
  await expect(page.getByRole('heading', { name: 'Operatie Grensbrug' })).toBeVisible();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('hex-map')).toBeVisible();
  await expect(page.getByTestId('turn')).toHaveText('1');

  // Een order geven door te klikken: eenheid selecteren, dan een hex.
  await page.getByTestId('unit-b-arm-1').click();
  await expect(page.getByTestId('selected-unit')).toContainText('Eskadron Delta');
  await page.locator('[data-hex="4,6"]').click({ force: true });
  await expect(page.getByTestId('unit-b-arm-1')).toContainText('verplaatsen');

  // Een onmogelijke zet wordt geweigerd met een reden.
  await page.getByTestId('unit-b-inf-1').click();
  await page.locator('[data-hex="18,12"]').click({ force: true });
  await expect(page.getByTestId('notice')).toContainText('Buiten bereik');

  for (let turn = 1; turn <= 12; turn++) {
    if (await page.getByTestId('end-screen').isVisible()) break;
    await page.getByRole('button', { name: 'Plan voor een doel' }).click();
    const apply = page.getByTestId('staff-apply').last();
    if (await apply.isVisible().catch(() => false)) await apply.click();
    await page.getByTestId('end-turn').click();
    const report = page.getByTestId('close-report');
    if (await report.isVisible().catch(() => false)) await report.click();
  }

  await expect(page.getByTestId('end-screen')).toBeVisible();
  await expect(page.getByTestId('outcome')).toHaveText(
    /Opdracht volbracht|Opdracht mislukt|Onbeslist/,
  );
  await expect(page.getByTestId('end-screen')).toContainText('Kantelpunten');
});
