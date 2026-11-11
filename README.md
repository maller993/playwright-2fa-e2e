# E2E web con Playwright: login con doble factor por email

[![E2E Tests](https://github.com/maller993/playwright-2fa-e2e/actions/workflows/e2e.yml/badge.svg)](https://github.com/maller993/playwright-2fa-e2e/actions)

**María Aller** · QA Automation Engineer · [LinkedIn](https://linkedin.com/in/maria-aller)

Suite de pruebas E2E con **Playwright + TypeScript** para un flujo de login con **doble factor de autenticación por email**: el test dispara el login, lee el código de 6 dígitos desde un buzón real (Mailpit) y completa el flujo, como lo haría un usuario.

> La app que se prueba es una **demo mínima creada solo para este portfolio**. No es código de ningún empleador: reproduce el tipo de flujo que automatizo en el trabajo (2FA con validación de códigos por email) sin exponer nada privado.

## Qué demuestra

- Automatización de un flujo **multi-sistema**: navegador + servidor SMTP + API del buzón.
- Tests **independientes y paralelizables**: cada test usa un usuario (email) único.
- **Sin esperas fijas** para sincronizar: el código del email se espera con `expect.poll`.
- **Page Object Model** con locators accesibles (`getByRole`, `getByLabel`), sin selectores CSS frágiles.
- **Casos negativos y de seguridad**, no solo el camino feliz.
- Ejecución en **CI** (GitHub Actions) con Mailpit como service container y reporte HTML como artifact.

## Arquitectura

```
┌──────────────┐   HTTP    ┌──────────────┐   SMTP :1025   ┌──────────────┐
│  Playwright  │ ────────▶ │   App demo   │ ─────────────▶ │   Mailpit    │
│   (tests)    │           │ (Node :3000) │                │ (buzón local)│
└──────┬───────┘           └──────────────┘                └──────┬───────┘
       │                  API HTTP :8025: lee el código del email │
       └───────────────────────────────────────────────────────────┘
```

## Escenarios cubiertos

| # | Escenario | Resultado esperado |
|---|-----------|--------------------|
| 1 | Login con el código recibido por email | Accede al dashboard |
| 2 | Formato del email de verificación | Asunto correcto y código de 6 dígitos |
| 3 | Código incorrecto | Error con los intentos restantes |
| 4 | 3 códigos incorrectos | Intento bloqueado; el código real ya no sirve |
| 5 | Reenviar el código | El código anterior queda invalidado |
| 6 | Credenciales inválidas | Error y **no** se envía ningún email |
| 7 | Ruta protegida sin sesión | Redirige al login |
| 8 | Cerrar sesión | Vuelve al login y la ruta queda protegida |

## Cómo correrlo

Requisitos: **Node.js 20+**

```bash
# 1. Instalar dependencias y el navegador
npm install
npx playwright install chromium

# 2. Levantar el buzón de email local (Mailpit)
npm run mail:up

# 3. Correr los tests (la app demo se levanta sola)
npm test

# 4. Ver el reporte HTML
npm run report
```

Mientras corrés los tests podés ver los emails reales en http://localhost:8025.
Para apagar el buzón: `npm run mail:down`.

## Estructura

```
├── demo-app/                 # App demo: login + 2FA por email (Express + Nodemailer)
├── tests/
│   ├── pages/                # Page Objects (login, verificación, dashboard)
│   ├── helpers/mailpit.ts    # Cliente de la API de Mailpit (espera y lee el código)
│   ├── fixtures.ts           # Fixtures: usuario único, page objects, mailpit
│   └── 2fa-login.spec.ts     # Los 8 escenarios
├── global-setup.ts           # Falla con un mensaje claro si Mailpit no está levantado
├── docker-compose.yml        # Mailpit
├── playwright.config.ts
└── .github/workflows/e2e.yml # CI
```

## Decisiones de diseño

- **Un email único por test, en lugar de vaciar el buzón.** Vaciar el buzón antes de cada test rompe la ejecución en paralelo: un test borraría los mensajes de otro. Con direcciones únicas (`qa-xxxxxxxx@demo.test`) cada test lee solo lo suyo.
- **`expect.poll` en lugar de `sleep`.** El email llega de forma asíncrona. Se consulta el buzón con reintentos y un timeout acotado: el test avanza apenas llega el mensaje y falla con un mensaje claro si no llega.
- **Una única espera fija, aislada y documentada.** Probar que *no* llega un email obliga a esperar un tiempo acotado (`expectNoMail`). Está en el helper, explicada, y es la única de toda la suite.
- **Locators por rol y label.** Reflejan cómo un usuario (o un lector de pantalla) encuentra los elementos y sobreviven a cambios de estilos o de estructura del DOM.
- **Los tests no conocen el código del servidor.** Solo interactúan por UI y por el buzón, igual que en un sistema real.

## Próximos pasos

- Cobertura de expiración del código (requiere controlar el TTL del servidor en test).
- Pruebas de accesibilidad del flujo (`@axe-core/playwright`).
- Ejecución en múltiples navegadores.

## Reglas de la app demo

- Cualquier email `@demo.test` con la contraseña `Passw0rd!` es un usuario válido.
- El código es de 6 dígitos y vence a los 5 minutos.
- 3 códigos incorrectos bloquean el intento.
- Reenviar el código invalida el anterior.
