import { test, expect } from './fixtures';

// Devuelve un código incorrecto garantizado (distinto del real).
const wrongCodeFor = (realCode: string) => (realCode === '000000' ? '111111' : '000000');

test.describe('Login con doble factor por email', () => {
  test('inicia sesión con el código recibido por email', async ({
    loginPage, verifyPage, dashboardPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    await verifyPage.expectVisibleFor(user.email);
    const code = await mailpit.waitForCode(user.email);
    await verifyPage.submitCode(code);

    await dashboardPage.expectLoggedInAs(user.email);
  });

  test('el email de verificación tiene el asunto y el formato esperados', async ({
    loginPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    const mail = await mailpit.waitForMail(user.email);
    expect(mail.subject).toBe('Your verification code');
    expect(mail.text).toMatch(/Your verification code is \d{6}\./);
  });

  test('rechaza un código incorrecto e informa los intentos restantes', async ({
    loginPage, verifyPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    const code = await mailpit.waitForCode(user.email);

    await verifyPage.submitCode(wrongCodeFor(code));

    await verifyPage.expectError('Invalid code. 2 attempts left.');
  });

  test('bloquea el intento tras 3 códigos incorrectos, incluso si luego se ingresa el correcto', async ({
    loginPage, verifyPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    const code = await mailpit.waitForCode(user.email);

    for (let i = 0; i < 3; i++) {
      await verifyPage.submitCode(wrongCodeFor(code));
    }
    await verifyPage.expectError('Too many attempts');

    // El código real ya no sirve: hay que iniciar sesión de nuevo.
    await verifyPage.submitCode(code);
    await verifyPage.expectError('Session expired');
  });

  test('reenviar el código invalida el anterior', async ({
    loginPage, verifyPage, dashboardPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    const firstCode = await mailpit.waitForCode(user.email, 1);

    await verifyPage.resend();
    const secondCode = await mailpit.waitForCode(user.email, 2);
    expect(secondCode).not.toBe(firstCode);

    await verifyPage.submitCode(firstCode);
    await verifyPage.expectError('Invalid code');

    await verifyPage.submitCode(secondCode);
    await dashboardPage.expectLoggedInAs(user.email);
  });

  test('con credenciales inválidas no avanza al segundo factor ni envía email', async ({
    loginPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, 'contraseña-incorrecta');

    await loginPage.expectError('Invalid email or password.');
    await mailpit.expectNoMail(user.email);
  });

  test('una ruta protegida redirige al login si no hay sesión', async ({ page, loginPage }) => {
    await page.goto('/dashboard');
    await loginPage.expectVisible();
  });

  test('cerrar sesión devuelve al login y vuelve a proteger la ruta', async ({
    page, loginPage, verifyPage, dashboardPage, mailpit, user,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    await verifyPage.submitCode(await mailpit.waitForCode(user.email));
    await dashboardPage.expectLoggedInAs(user.email);

    await dashboardPage.logout();
    await loginPage.expectVisible();

    await page.goto('/dashboard');
    await loginPage.expectVisible();
  });
});
