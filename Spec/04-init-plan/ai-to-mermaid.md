# AI → Mermaid Generation: Robust Strategy

## Goal
Make the AI produce correct Mermaid that converts cleanly. The previous "raw element JSON" prompt
(`lib/ai-prompts.ts` `SYSTEM_PROMPT`) causes inaccurate layouts → replace with Mermaid-first.

## Verified diagram types we can accept (see mermaid-conversion.md)
flowchart (graph/flowchart-v2), sequence, class, er, state. Everything else → bitmap fallback.

## Prompting rules (compiled from Mermaid prompt-engineering + parser-failure catalogs)
1. **Declare exact type + direction** first: "Output ONLY a `flowchart TD` ...; no explanation."
2. **Code-only output**: forbid prose, forbid markdown wrapper besides the code fence.
3. **Negative constraints** reduce creative drift:
   - No `classDef`/`style`/`%%` comment overuse (styling is dropped; keep it simple).
   - Max N nodes (e.g. ≤ 30) and N edges.
   - Use ASCII-safe node **IDs**, short and unique.
   - No raw HTML labels; no emoji/special glyphs in IDs.
4. **Quote labels that contain special characters**: parentheses, brackets, `/`, `\`, `,`, `:` and
   spaces in display text MUST be wrapped in double quotes: `D1["Sell Items (Drain)"]`. This is the
   single most common LLM error (parser-failure catalogs, CLI-jaw #194, php.cn guide).
5. Provide a short example for the requested type.

## Validation pipeline (in-call, client-side)
Because `parseMermaidToExcalidraw` calls `mermaid.getDiagramFromText` + `mermaid.render`, it
**throws on invalid syntax** (this is our validator). Flow:
1. Extract Mermaid from the model output (strip fences / prose → get the `mermaid` block).
2. Call `mermaidToScene(mermaid)`. On throw → capture the parser error message.
3. **Error-recovery loop (up to 2-3 retries)**: send the failed Mermaid + the exact parser error to
   the same model with "Fix this Mermaid syntax error: [error]. Output ONLY corrected Mermaid."
   This is a well-documented, high-success technique (Microsoft GenAIScript, mermaid2img guide,
   cli-jaw).
4. If still failing → surface a readable error and a "View Mermaid" code block so the user can fix.

## Model selection note
- Groq (Mixtral/LLaMA) + Mistral (BYOK, used in `lib/ai-providers.ts`): prefer the strongest model
  the user has a key for. Open-source models are "medium" accuracy for Mermaid → the validation +
  retry loop is mandatory for them.
- Keep the flow deterministic: parse errors must not hang — enforce a timeout/attempt cap.

## Where it lives
- `lib/ai-prompts.ts`: new `MERMAID_SYSTEM_PROMPT` (+ a `QA` variant and enhance prompt that
  reference Mermaid output rather than JSON).
- `validateScene.ts` / `AiChatPopup.tsx`: replace element-JSON parse + `parseAiResponse` with
  Mermaid extraction + `mermaidToScene` + retry loop.
