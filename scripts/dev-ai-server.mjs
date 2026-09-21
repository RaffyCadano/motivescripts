// Local test server for MotiveScripts AI. Runs the REAL endpoint logic and knowledge from
// supabase/functions/_shared with the REAL Anthropic SDK, so you can try the chat on localhost
// without the Supabase CLI, Docker, or Deno. Development only: production uses the Edge Function.
//
//   PowerShell:   $env:ANTHROPIC_API_KEY = "sk-ant-..."
//                 npm run dev:ai
//   then, in a second terminal, point the site at it (no file edits; closing the terminal undoes it):
//                 $env:VITE_SUPABASE_URL = "http://localhost:8000"
//                 npm run dev
//
// The key is read from the environment only. Never put it in a file or a VITE_ variable.
import http from "node:http";
import { Readable } from "node:stream";
import Anthropic from "@anthropic-ai/sdk";

const shared = new URL("../supabase/functions/_shared/", import.meta.url);
const { handleChatRequest, createRateLimiter, AI_LIMITS } = await import(new URL("aiChat.ts", shared).href);
const { buildSystemPrompt } = await import(new URL("aiKnowledge.ts", shared).href);

const PORT = Number(process.env.AI_DEV_PORT ?? 8000);
const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const model = (process.env.ANTHROPIC_MODEL ?? "").trim() || "claude-opus-5";
const systemPrompt = buildSystemPrompt();
const limiter = createRateLimiter({ windowMs: 5 * 60 * 1000, maxPerKey: 12, maxGlobal: 240 });
const supportsEffort = (name) => /^claude-(opus|sonnet|fable|mythos)-/.test(name);
const usage = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

// Mirrors generate() in supabase/functions/motivescripts-ai/index.ts.
async function generate(messages, signal) {
  const client = new Anthropic({ apiKey, timeout: AI_LIMITS.modelTimeoutMs, maxRetries: 1 });
  const response = await client.messages.create(
    {
      model,
      max_tokens: 600,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      ...(supportsEffort(model) ? { output_config: { effort: "low" } } : {}),
      messages,
    },
    { signal },
  );
  usage.calls++;
  usage.input += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;
  usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
  usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
  if (response.stop_reason === "refusal") return { text: "", refused: true };
  return { text: response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n") };
}

const server = http.createServer(async (nodeReq, nodeRes) => {
  const origin = nodeReq.headers.origin ?? "";
  const cors = {
    "Access-Control-Allow-Origin": /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (nodeReq.url === "/__usage") {
    nodeRes.setHeader("content-type", "application/json");
    return nodeRes.end(JSON.stringify({ model, ...usage }));
  }
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(nodeReq.method);
  const req = new Request(`http://localhost${nodeReq.url}`, {
    method: nodeReq.method,
    headers: nodeReq.headers,
    body: hasBody ? Readable.toWeb(nodeReq) : undefined,
    duplex: "half",
  });
  const res = await handleChatRequest(req, {
    generate,
    limiter,
    cors,
    configured: Boolean(apiKey),
    log: (message, meta) => console.error(message, meta ?? {}),
  });
  nodeRes.writeHead(res.status, Object.fromEntries(res.headers));
  nodeRes.end(Buffer.from(await res.arrayBuffer()));
});

server.listen(PORT, () => {
  console.log(`MotiveScripts AI dev server: http://localhost:${PORT}  (model ${model}, API key ${apiKey ? "set" : "NOT SET"})`);
  if (!apiKey) console.log('Set it first:  $env:ANTHROPIC_API_KEY = "sk-ant-..."   then run again.');
});
