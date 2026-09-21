// Serves dist/ the way GitHub Pages does, so the real HTTP behavior of the build can be checked locally:
//   exact file -> 200; "/x" with x.html -> 200; folder with index.html -> 301 to "/x/"; anything else -> 404.html
//   with status 404.  Usage: node scripts/serve-pages-like.mjs [port]
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve("dist");
const port = Number(process.argv[2] || 5230);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain", ".json": "application/json", ".woff2": "font/woff2" };
const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();

function send(res, status, file, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", ...extraHeaders });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const target = path.join(root, url);
    if (!target.startsWith(root)) return send(res, 404, path.join(root, "404.html"));
    if (isFile(target)) return send(res, 200, target);
    if (isFile(target + ".html")) return send(res, 200, target + ".html");
    if (isDir(target) && isFile(path.join(target, "index.html"))) {
      if (!url.endsWith("/")) { res.writeHead(301, { Location: url + "/" }); return res.end(); }
      return send(res, 200, path.join(target, "index.html"));
    }
    return send(res, 404, path.join(root, "404.html"));
  })
  .listen(port, () => console.log(`serving dist/ GitHub-Pages-style on http://localhost:${port}`));
