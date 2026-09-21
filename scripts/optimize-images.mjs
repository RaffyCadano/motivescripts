// Converts the preview photos to WebP (max 1000px wide) and the brand icon to a small WebP, printing the savings.
// One-off, safe to re-run:  node scripts/optimize-images.mjs
// Sources stay in git history; the app imports the .webp versions.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const previews = "src/assets/previews";
let before = 0;
let after = 0;
for (const name of fs.readdirSync(previews).filter((n) => /\.(jpe?g|png)$/i.test(n))) {
  const src = path.join(previews, name);
  const out = path.join(previews, name.replace(/\.(jpe?g|png)$/i, ".webp"));
  await sharp(src).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toFile(out);
  const b = fs.statSync(src).size;
  const a = fs.statSync(out).size;
  before += b;
  after += a;
  console.log(`${name.padEnd(36)} ${String(Math.round(b / 1024)).padStart(5)} KB -> ${String(Math.round(a / 1024)).padStart(4)} KB`);
}

const icon = "src/assets/brand/icon.png";
if (fs.existsSync(icon)) {
  const out = "src/assets/brand/icon.webp";
  await sharp(icon).resize({ width: 256, withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90, effort: 6 }).toFile(out);
  console.log(`brand/icon.png ${Math.round(fs.statSync(icon).size / 1024)} KB -> ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
console.log(`\npreviews total: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB (${Math.round((1 - after / before) * 100)}% smaller)`);
