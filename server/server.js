const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 8000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function proxyRequest(req, res) {
  const options = {
    hostname: API_HOST, port: API_PORT, path: req.originalUrl,
    method: req.method, headers: { ...req.headers },
    timeout: 300000,
  };
  delete options.headers.host;

  let responded = false;
  const respond = (code, body) => {
    if (responded) return;
    responded = true;
    res.status(code).json(body);
  };

  const proxyReq = http.request(options, (proxyRes) => {
    if (responded) return;
    responded = true;
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    respond(502, { error: 'Backend unavailable: ' + e.message });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    respond(504, { error: 'Backend timeout' });
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

app.use('/api', proxyRequest);
app.use('/admin', proxyRequest);
app.use('/media', proxyRequest);

const buildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(buildPath, {
  setHeaders: (res) => {
    // Отключаем кеширование для index.html и JS/CSS файлов
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));
app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log('CRM on 0.0.0.0:' + PORT));
