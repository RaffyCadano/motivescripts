# MotiveScripts AI (public website assistant)

A floating "Ask MotiveScripts AI" chat on the public marketing pages. Visitors ask about services, pricing, process, work, and how to start a project. Answers come from Claude, grounded in a small curated knowledge file. It never touches client, admin, or project data.

## Architecture

```
Browser (AiAssistant.tsx)
   -> supabase.functions.invoke("motivescripts-ai")      src/data/aiAssistant.ts
      -> Edge Function motivescripts-ai                   supabase/functions/motivescripts-ai/index.ts
         request handling, limits, rate limiting          supabase/functions/_shared/aiChat.ts
         system prompt + approved knowledge               supabase/functions/_shared/aiKnowledge.ts
         -> Claude Messages API (Anthropic SDK)
   <- { ok, reply, cta }   plain text only
```

- It follows the existing pattern for public endpoints (`public-lead`): a Supabase Edge Function with `verify_jwt = false` and the shared origin-locked CORS helper. No second backend was added.
- The provider key exists only as an Edge Function secret. The browser never sees it and never talks to the provider.
- The function has **no database client, no service-role key, no tools, and no outbound fetch of its own**. It sends the visitor's bounded conversation plus a fixed prompt to Claude and returns text.
- The widget renders replies as React text nodes (no `dangerouslySetInnerHTML`, no markdown), so model output can never inject HTML or script.
- Where it shows: `/`, `/services`, `/work`, `/work/:slug`, `/process`, `/pricing`, `/about`. It is not rendered on `/start-a-project`, login, invite, auth callback, or any admin/team/client route.

## Provider and secrets

| Secret (Supabase Edge Function secrets) | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Never a `VITE_` variable. Without it the endpoint answers "unavailable" and the widget shows a friendly fallback. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5`. See cost below. |
| `PUBLIC_SITE_URL` | already set | CORS allows only this origin (plus localhost). |

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # confirm the linked project first (see README: Sandbox vs. Production)
supabase functions deploy motivescripts-ai
```

`supabase/config.toml` already lists `[functions.motivescripts-ai] verify_jwt = false`.

## Knowledge

`supabase/functions/_shared/aiKnowledge.ts` is the entire knowledge the model receives, curated from the public site (services, pricing, process, about/FAQ, work, start a project). Nothing else is available to it: no database, no internal Feature Catalog, no proposal or add-on prices.

When a public page changes, update the matching section there and bump `AI_KNOWLEDGE_VERSION`. `node --test scripts/test-ai-endpoint.mjs` checks that the starting price, service names, process steps, and project names still match `src/data/*` and that the knowledge contains no internal terms or catalog prices.

Pricing behavior: the assistant states that Website and Growth each start at their published starting price ($2,500 and $3,500) and that these are starting prices, never final ones. Custom remains "quoted to scope" (no public price). Hosting, domain, business email, Website Care, SEO, and individual features are "scoped and priced in the proposal", and it will not quote numbers for them.

## Limits and abuse protection

| Protection | Value |
| --- | --- |
| Request body | 16 KB max (read with a streaming cap, not trusted `content-length`) |
| Message length | 800 characters each; 6,000 total |
| History | at most 30 messages accepted, last 10 sent to the model |
| Output | 600 tokens max from the model; 2,000 characters max returned |
| Per-visitor rate limit | 12 requests per 5 minutes per IP (`429` + `Retry-After`) |
| Global cap | 240 requests per 5 minutes per function instance |
| Model timeout | 25 s (aborted), one SDK retry |
| Errors | generic `unavailable`; provider error text and keys are never returned or logged |

**Important:** the rate limiter is in memory and per instance. Edge Function instances are ephemeral and not shared, so this slows abuse but is not a hard guarantee. The real cost backstop is a **monthly spend limit on the Anthropic API key/workspace** (Anthropic Console). Set one before launch.

## Cost

The system prompt is about 2.9K tokens; a typical exchange is roughly 3.5K input and a few hundred output tokens. At the default `claude-opus-5` ($5 / $25 per million tokens) that is on the order of $0.02 per message, so about 50 messages per dollar. A cheaper model (for example `claude-haiku-4-5`, about a fifth of the price) works for FAQ-style answers if cost matters more than the extra reasoning quality: set `ANTHROPIC_MODEL=claude-haiku-4-5`. The function only sends `effort` to model families that support it. Check answer quality on the representative questions below after changing the model.

## Testing

- `node --test scripts/test-ai-endpoint.mjs`: 19 tests of validation, size and history limits, rate limiting, timeout, provider-error handling, output shaping, and knowledge sync. The model call is stubbed.
- Manual, with a real key, after deploying: ask "What does MotiveScripts do?", "How much does a website cost?", "What is included in the $2,500 starting price?", "Can you build an online store?", "Do you build booking websites?", "How do I start a project?", and an unsupported question (for example "Do you offer a money-back guarantee?"). Confirm it never states $2,500 as a final price, never invents policies or clients, and points to Start a Project when appropriate.

## Known limitations (v1)

- No streaming: replies appear when complete, behind a typing indicator.
- Conversation lives in browser memory only (cleared on refresh); nothing is stored server-side, and there are no analytics or transcripts.
- Client-supplied history is untrusted (a visitor can fabricate earlier turns). This is safe here because the assistant holds no private data and takes no actions.
- The refusal fallback beta (`fallbacks`) is not enabled; a model refusal returns a friendly generic reply.

## Future work (not built)

Vector or retrieval-based knowledge, public case-study depth, lead qualification, appointment booking, CRM handoff, human handoff, conversation analytics, and multilingual support. The `aiChat.ts` / `aiKnowledge.ts` split is meant to make those additions local.
