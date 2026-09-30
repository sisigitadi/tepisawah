const http = require('http');
const fs = require('fs');
const path = require('path');

const apps = {
  '/admin': path.join(__dirname, 'apps/admin/dist'),
  '/kitchen': path.join(__dirname, 'apps/kitchen/dist'),
  '/order': path.join(__dirname, 'apps/order/dist'),
  '/pos': path.join(__dirname, 'apps/pos/dist'),
  '/waiter': path.join(__dirname, 'apps/waiter/dist'),
  '/': path.join(__dirname, 'apps/web/dist')
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let matchedApp = '/';
  let subPath = urlPath;

  for (const prefix of Object.keys(apps).sort((a,b) => b.length - a.length)) {
    if (prefix !== '/' && (urlPath === prefix || urlPath.startsWith(prefix + '/'))) {
      matchedApp = prefix;
      subPath = urlPath.slice(prefix.length) || '/';
      break;
    }
  }

  const root = apps[matchedApp];
  let filePath = path.join(root, subPath === '/' ? 'index.html' : subPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found: ' + urlPath);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        }
      });
    } else {
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png'
      }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server listening on http://localhost:' + PORT);
});
