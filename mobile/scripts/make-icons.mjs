// Erzeugt die App-Symbole (Android) aus dem Favicon der Oberfläche.
// Aufruf: npm run icons   (optional: npm run icons -- --src pfad/zum/bild.svg --bg "#c8563a")
// Schreibt nach android/app/src/main/res: mipmap-*/ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
// und die Hintergrundfarbe values/ic_launcher_background.xml. Danach die geänderten Dateien einchecken.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const here = import.meta.dirname;
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const staticDir = path.resolve(here, '../../app/static');
const candidates = [arg('src'), path.join(staticDir, 'favicon.svg'), path.join(staticDir, 'icon-512.png'), path.join(staticDir, 'icon-192.png')].filter(Boolean);
const src = candidates.find((f) => fs.existsSync(f));
if (!src) { console.error('Kein Bild gefunden. Mit --src angeben.'); process.exit(1); }
const res = path.resolve(here, '../android/app/src/main/res');

// Legacy-Symbole (dp x Faktor) und Vordergrund des adaptiven Symbols (108 dp)
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

const big = await sharp(src, { density: 600 }).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

// Hintergrundfarbe: aus dem Bild (mittlerer Rand oben, leicht eingerückt), sonst Vorgabe oder App-Hintergrund
let bg = arg('bg');
if (!bg) {
  const { data, info } = await sharp(big).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const o = (y * info.width + x) * info.channels; return data.slice(o, o + 4); };
  const samples = [px(512, 48), px(512, 976), px(48, 512), px(976, 512)].filter((p) => p[3] === 255);
  bg = samples.length ? hex(...[0, 1, 2].map((i) => Math.round(samples.reduce((a, p) => a + p[i], 0) / samples.length))) : '#FBF5EE';
}
console.log(`Quelle: ${path.relative(process.cwd(), src)}, Hintergrundfarbe: ${bg}`);
const bgRgb = { r: parseInt(bg.slice(1, 3), 16), g: parseInt(bg.slice(3, 5), 16), b: parseInt(bg.slice(5, 7), 16), alpha: 1 };

for (const [name, f] of Object.entries(DENS)) {
  const dir = path.join(res, `mipmap-${name}`);
  fs.mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * f), layer = Math.round(108 * f);
  // Altes Symbol: das Bild selbst
  await sharp(big).resize(legacy, legacy).png().toFile(path.join(dir, 'ic_launcher.png'));
  // Rundes Symbol: Kreis mit der Hintergrundfarbe, Bild im Sicherheitsbereich
  const inner = Math.round(legacy * 0.78);
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}" fill="${bg}"/></svg>`);
  await sharp(circle).composite([{ input: await sharp(big).resize(inner, inner).png().toBuffer(), gravity: 'center' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  // Vordergrund des adaptiven Symbols: Bild auf zwei Dritteln der Fläche, damit keine Maske etwas abschneidet
  const fg = Math.round(layer * 0.62);
  await sharp({ create: { width: layer, height: layer, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(big).resize(fg, fg).png().toBuffer(), gravity: 'center' }]).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
}
fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bg}</color>\n</resources>\n`);
// Das Vektor-Symbol der Vorlage (Capacitor-Logo) wird nicht mehr benutzt
fs.rmSync(path.join(res, 'drawable-v24'), { recursive: true, force: true });
console.log('Symbole geschrieben.');
