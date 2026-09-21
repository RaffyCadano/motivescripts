// One-off: renders public/og-image.png (1200x630), the picture shown when a page is shared. Re-run after a
// brand change:  node scripts/make-og-image.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";

const logo = fs.readFileSync("src/assets/brand/logo.png").toString("base64");
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;800&family=Inter:wght@500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;font-family:Manrope,Inter,Arial,sans-serif;background:#fff;position:relative;overflow:hidden}
  .glow{position:absolute;right:-180px;top:-160px;width:720px;height:720px;border-radius:50%;background:radial-gradient(circle,rgba(0,160,255,.28),rgba(0,80,240,.10) 55%,transparent 70%)}
  .glow2{position:absolute;left:-220px;bottom:-320px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(0,80,240,.12),transparent 65%)}
  .wrap{position:relative;padding:64px 80px;height:100%;display:flex;flex-direction:column;justify-content:space-between}
  img{height:64px;width:auto;align-self:flex-start;object-fit:contain}
  h1{font-size:82px;line-height:1.04;font-weight:800;letter-spacing:-2px;color:#07111f;max-width:980px}
  h1 span{background:linear-gradient(135deg,#0050f0,#00a0ff);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{font-family:Inter,Arial,sans-serif;font-size:30px;font-weight:500;color:#556070}
  .row{display:flex;justify-content:space-between;align-items:center}
  .url{font-weight:800;font-size:28px;color:#0050f0}
</style></head><body><div class="glow"></div><div class="glow2"></div>
<div class="wrap"><img src="data:image/png;base64,${logo}" alt="">
<div><h1>Websites that <span>turn visitors into customers.</span></h1></div>
<div class="row"><p>Fast, modern websites for small businesses.</p><div class="url">motivescripts.com</div></div></div></body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9520;
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=" + process.env.TEMP + "/cdp-og", "about:blank"], { stdio: "ignore" });
let t;
for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
fs.mkdirSync("tmp-og", { recursive: true });
fs.writeFileSync("tmp-og/og.html", html);
await send("Page.navigate", { url: "file:///" + process.cwd().replace(/\\/g, "/") + "/tmp-og/og.html" });
await sleep(3500);
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync("public/og-image.png", Buffer.from(shot.result.data, "base64"));
fs.rmSync("tmp-og", { recursive: true, force: true });
console.log("wrote public/og-image.png");
ws.close(); chrome.kill(); process.exit(0);
