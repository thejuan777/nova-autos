import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
export function createLocalServer() {
    return createServer(async (req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
            if (!file.startsWith(root + sep) || pathname.split('/').some(part => part.startsWith('.')) || !types[extname(file)]) {
                res.writeHead(404).end('Not found'); return;
            }
            const body = await readFile(file);
            res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' }).end(body);
        } catch { res.writeHead(404).end('Not found'); }
    });
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(root, 'serve.mjs')) {
    createLocalServer().listen(4173, '127.0.0.1', () => console.log('NOVA AUTOS: http://localhost:4173'));
}
