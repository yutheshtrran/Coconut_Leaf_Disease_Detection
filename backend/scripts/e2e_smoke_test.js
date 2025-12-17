require('dotenv').config();
const { execSync } = require('child_process');

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

const http = require('http');
const https = require('https');
const { URL } = require('url');

async function httpRequest(urlStr, opts = {}) {
  const url = new URL(urlStr);
  const isHttps = url.protocol === 'https:';
  const data = opts.body || null;
  const headers = opts.headers || {};
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const lib = isHttps ? https : http;
        const reqOpts = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: opts.method || 'GET',
          headers,
          timeout: 5000,
        };
        const req = lib.request(reqOpts, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
            resolve({ status: res.statusCode, body: parsed, headers: res.headers });
          });
        });
        req.on('error', (err) => reject(err));
        if (data) req.write(data);
        req.end();
      });
      return result;
    } catch (err) {
      console.error(`httpRequest failed (attempt ${attempt}):`, err.message || err);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

function runHelper(script, arg) {
  try {
    const out = execSync(`node ${script} ${arg}`, { encoding: 'utf8' });
    return out.trim();
  } catch (err) {
    return String(err.stdout || err.stderr || err.message || err);
  }
}

async function main() {
  console.log('E2E SMOKE TEST START');
  const email = 'smoketest@example.com';
  const username = 'smoketest';
  const password = 'Password123';
  try {
    console.log('\n1) START REGISTER (create pending)');
    const reg = await httpRequest(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    console.log('REGISTER =>', reg.status, JSON.stringify(reg.body));

    // wait a moment for DB write
    await new Promise(r => setTimeout(r, 800));

    console.log('\n2) READ PENDING USER CODE (helper script)');
    const pendingOut = runHelper('scripts/get_pending_code.js', email);
    console.log(pendingOut);
    // helper scripts may emit warnings before JSON; extract JSON object substring
    const firstBrace = pendingOut.indexOf('{');
    const lastBrace = pendingOut.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      console.error('No pending JSON found'); process.exit(1);
    }
    const pendingJson = pendingOut.slice(firstBrace, lastBrace + 1);
    let pending;
    try { pending = JSON.parse(pendingJson); } catch (e) { console.error('Failed parsing pending JSON', e); process.exit(1); }
    const code = pending.code;
    console.log('EXTRACTED CODE:', code);

    console.log('\n3) CONFIRM REGISTER with code');
    const conf = await httpRequest(`${API_BASE}/auth/register/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    console.log('CONFIRM =>', conf.status, JSON.stringify(conf.body));

    console.log('\n4) LOGIN with original password');
    const login = await httpRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: email, password })
    });
    console.log('LOGIN =>', login.status, JSON.stringify(login.body));

    console.log('\n5) FORGOT PASSWORD (generate reset code)');
    const forgot = await httpRequest(`${API_BASE}/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    console.log('FORGOT =>', forgot.status, JSON.stringify(forgot.body));

    await new Promise(r => setTimeout(r, 800));
    console.log('\n6) READ USER DOC to get resetPasswordCode');
    const userOut = runHelper('scripts/get_user.js', email);
    console.log(userOut);
    const f1 = userOut.indexOf('{');
    const l1 = userOut.lastIndexOf('}');
    if (f1 === -1 || l1 === -1) { console.error('No user JSON found'); process.exit(1); }
    const userJson = userOut.slice(f1, l1 + 1);
    let user;
    try { user = JSON.parse(userJson); } catch (e) { console.error('Failed parsing user JSON', e); process.exit(1); }
    const resetCode = user.resetPasswordCode;
    console.log('EXTRACTED RESET CODE:', resetCode);

    console.log('\n7) CONFIRM FORGOT with reset code (set new password)');
    const forgotConfirm = await httpRequest(`${API_BASE}/auth/forgot/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: resetCode, password: 'NewPass123' })
    });
    console.log('FORGOT_CONFIRM =>', forgotConfirm.status, JSON.stringify(forgotConfirm.body));

    console.log('\n8) FINAL LOGIN with new password');
    const finalLogin = await httpRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: email, password: 'NewPass123' })
    });
    console.log('FINAL_LOGIN =>', finalLogin.status, JSON.stringify(finalLogin.body));

    console.log('\nE2E SMOKE TEST COMPLETE');
  } catch (err) {
    console.error('E2E ERROR', err);
    process.exit(1);
  }
}

main();
