const frontendUrl = process.env.FRONTEND_URL || 'https://teamflow-dusky.vercel.app';
const backendUrl = process.env.BACKEND_URL || 'https://teamflow-wdrw.onrender.com';

const checks = [
  {
    name: 'frontend root',
    url: frontendUrl,
    expectHtml: true
  },
  {
    name: 'frontend signup route',
    url: `${frontendUrl.replace(/\/$/, '')}/signup`,
    expectHtml: true
  },
  {
    name: 'backend health',
    url: `${backendUrl.replace(/\/$/, '')}/health`,
    expectJson: true
  }
];

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30000);

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/json'
      }
    });
  } finally {
    clearTimeout(timer);
  }
};

let failed = false;

for (const check of checks) {
  try {
    const response = await fetchWithTimeout(check.url);
    const body = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const hasHtml = /<div id="root"><\/div>/.test(body) || /<script[^>]+src="\/assets\//.test(body);
    const hasJson = contentType.includes('application/json') && body.includes('"success"');
    const ok = response.ok && (!check.expectHtml || hasHtml) && (!check.expectJson || hasJson);

    if (!ok) {
      failed = true;
    }

    console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name}: ${response.status} ${check.url}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${check.name}: ${error.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : error.message}`);
  }
}

if (failed) {
  process.exit(1);
}
