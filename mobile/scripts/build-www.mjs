// Baut die Oberfläche der App: kopiert app/static nach mobile/www und passt index.html an.
// Die App enthält die Oberfläche selbst (Start ohne Server). Aufruf: npm run build:www
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const src = path.resolve(here, '../../app/static');
const out = process.env.WWW_OUT ? path.resolve(process.env.WWW_OUT) : path.resolve(here, '../www');
const name = process.env.APP_NAME || 'MeowMetrics';

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('app/static/index.html nicht gefunden: ' + src);
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// Service Worker und Manifest gehören zur PWA im Browser, nicht in die App
const skip = new Set(['sw.js', 'manifest.json']);
fs.cpSync(src, path.join(out, 'static'), {
  recursive: true,
  dereference: true,
  filter: (s) => !skip.has(path.basename(s)) && s !== path.join(src, 'index.html'),   // index.html wird unten angepasst nach www/ geschrieben
});

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const cfg = `<script>window.APP_NAME=${JSON.stringify(name).replace(/</g, '\\u003c')};window.APP_BUNDLED=true;</script>`;
if (!html.includes('<!--APP_CONFIG-->')) throw new Error('Platzhalter <!--APP_CONFIG--> fehlt in index.html');
html = html.replace('<!--APP_CONFIG-->', cfg).replaceAll('{{APP_NAME}}', name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
// Schriften von Google blockieren den ersten Bildaufbau nicht (ohne Netz gilt die Ersatzschrift)
html = html.replace(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)" rel="stylesheet">/, '<link href="$1" rel="stylesheet" media="print" onload="this.media=\'all\'">');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`www gebaut: ${fs.readdirSync(path.join(out, 'static')).length} Einträge in static/, App-Name "${name}"`);
