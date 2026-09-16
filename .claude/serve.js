const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
};

/* Sem resposta a Range o navegador marca o vídeo como não-buscável
   (seekable fica [0,0]) e ignora qualquer currentTime, mesmo com o
   arquivo inteiro já baixado. É disso que depende o vídeo seguir o
   scroll, então o servidor local precisa se comportar como um host real. */
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const file = path.join(root, rel);

  if (!file.startsWith(root)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404).end('not found');
      return;
    }

    const tipo = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const base = {
      'Content-Type': tipo,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };

    const faixa = req.headers.range;
    if (faixa) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(faixa.trim());
      if (m) {
        let ini = m[1] === '' ? null : parseInt(m[1], 10);
        let fim = m[2] === '' ? null : parseInt(m[2], 10);

        if (ini === null && fim !== null) {          // bytes=-N — os últimos N
          ini = Math.max(0, st.size - fim);
          fim = st.size - 1;
        } else {
          if (ini === null) ini = 0;
          if (fim === null || fim >= st.size) fim = st.size - 1;
        }

        if (ini > fim || ini >= st.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
          return;
        }

        res.writeHead(206, {
          ...base,
          'Content-Range': `bytes ${ini}-${fim}/${st.size}`,
          'Content-Length': fim - ini + 1,
        });
        fs.createReadStream(file, { start: ini, end: fim }).pipe(res);
        return;
      }
    }

    res.writeHead(200, { ...base, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}).listen(5173, () => console.log('serving on http://localhost:5173'));
