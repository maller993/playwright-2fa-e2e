// App de demo: login con doble factor por email.
// Existe SOLO para el portfolio: permite probar un flujo 2FA real
// (el código llega por SMTP a Mailpit) sin depender de ningún sistema de terceros.
//
// Reglas de la demo:
//   - Cualquier email @demo.test con la contraseña "Passw0rd!" es un usuario válido.
//   - El código es de 6 dígitos y vence a los 5 minutos.
//   - 3 códigos incorrectos bloquean el intento y obligan a iniciar sesión de nuevo.
//   - Reenviar el código invalida el anterior.

const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 5 * 60 * 1000);
const MAX_ATTEMPTS = 3;
const DEMO_PASSWORD = 'Passw0rd!';
const DEMO_DOMAIN = '@demo.test';

const pending = new Map(); // idDesafío -> { email, code, attempts, expiresAt }
const sessions = new Map(); // idSesión -> { email }

const transport = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false });

function readCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map((pair) => {
        const i = pair.indexOf('=');
        return [pair.slice(0, i).trim(), decodeURIComponent(pair.slice(i + 1))];
      })
  );
}

function newCode(previous) {
  let code;
  do {
    code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  } while (code === previous); // un reenvío nunca repite el código anterior
  return code;
}

async function sendCode(email, code) {
  await transport.sendMail({
    from: 'Demo Bank <no-reply@demo.test>',
    to: email,
    subject: 'Your verification code',
    text: `Your verification code is ${code}. It expires in 5 minutes.`,
  });
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const validUser = typeof email === 'string' && email.endsWith(DEMO_DOMAIN) && password === DEMO_PASSWORD;
  if (!validUser) return res.status(401).json({ error: 'Invalid email or password.' });

  const id = crypto.randomUUID();
  const challenge = { email, code: newCode(), attempts: 0, expiresAt: Date.now() + OTP_TTL_MS };
  try {
    await sendCode(email, challenge.code);
  } catch {
    return res.status(502).json({ error: 'We could not send the verification email. Try again.' });
  }
  pending.set(id, challenge);
  res.cookie('pending', id, { httpOnly: true, sameSite: 'lax' });
  res.json({ next: '/verify.html' });
});

app.get('/api/pending', (req, res) => {
  const challenge = pending.get(readCookies(req).pending);
  if (!challenge) return res.status(401).json({ error: 'Session expired. Sign in again.' });
  res.json({ email: challenge.email });
});

app.post('/api/resend', async (req, res) => {
  const challenge = pending.get(readCookies(req).pending);
  if (!challenge) return res.status(401).json({ error: 'Session expired. Sign in again.' });

  challenge.code = newCode(challenge.code);
  challenge.attempts = 0;
  challenge.expiresAt = Date.now() + OTP_TTL_MS;
  try {
    await sendCode(challenge.email, challenge.code);
  } catch {
    return res.status(502).json({ error: 'We could not send the verification email. Try again.' });
  }
  res.json({ message: 'New code sent.' });
});

app.post('/api/verify', (req, res) => {
  const id = readCookies(req).pending;
  const challenge = pending.get(id);
  if (!challenge) return res.status(401).json({ error: 'Session expired. Sign in again.' });

  if (Date.now() > challenge.expiresAt) {
    pending.delete(id);
    return res.status(410).json({ error: 'Code expired. Sign in again.' });
  }

  if (req.body && req.body.code === challenge.code) {
    pending.delete(id);
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { email: challenge.email });
    res.clearCookie('pending');
    res.cookie('session', sessionId, { httpOnly: true, sameSite: 'lax' });
    return res.json({ next: '/dashboard' });
  }

  challenge.attempts += 1;
  if (challenge.attempts >= MAX_ATTEMPTS) {
    pending.delete(id);
    res.clearCookie('pending');
    return res.status(423).json({ error: 'Too many attempts. Sign in again.' });
  }
  res.status(401).json({ error: `Invalid code. ${MAX_ATTEMPTS - challenge.attempts} attempts left.` });
});

app.get('/api/me', (req, res) => {
  const session = sessions.get(readCookies(req).session);
  if (!session) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ email: session.email });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(readCookies(req).session);
  res.clearCookie('session');
  res.json({ next: '/' });
});

// La página protegida vive fuera de /public para no servirla sin sesión.
app.get('/dashboard', (req, res) => {
  if (!sessions.has(readCookies(req).session)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.listen(PORT, () => console.log(`Demo app escuchando en http://localhost:${PORT}`));
