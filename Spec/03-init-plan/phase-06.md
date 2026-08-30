# Phase 06 — AI Chat Interface (Markdown → Excalidraw Diagram)

> **Research verified:** Aug 2026, from Excalidraw source (`packages/excalidraw/data/transform.ts` v0.18.1), Groq API reference, Mistral API reference, and community projects (Agents365/excalidraw-skill, coleam00/excalidraw-diagram-skill).

## Overview

Add an AI chat interface that converts natural language descriptions, markdown content, or structured text into Excalidraw diagrams in real-time. The interface appears as a centered popup overlay (ChatGPT input box pattern), lets users choose between free AI models (Groq or Mistral), and renders the generated diagram directly onto the canvas via the Skeleton API.

---

## 1. AI Chat UI — Popup Overlay

### Problem
No way to generate diagrams from text. Users must manually draw everything. An AI assistant that converts text to Excalidraw diagrams would be a major productivity boost.

### Approach

#### 1.A Chat Button in Header
- Add an **"AI"** button in the TopBar (next to Templates), using the `Sparkle` icon from `@phosphor-icons/react`.
- Clicking it opens the chat popup overlay.

#### 1.B Chat Popup Overlay
- **Centered modal overlay** (like ChatGPT's input box pattern).
- **Position**: centered horizontally, positioned in the lower-third of the viewport (bottom-heavy, not dead center).
- **Width**: `max-w-[640px]`, responsive.
- **Style**: white background, `rounded-2xl`, soft shadow `[0_16px_64px_rgba(0,0,0,0.16)]`, no hard borders.
- **Backdrop**: `bg-black/30`, click to close.
- **Esc** closes the popup.

#### 1.C Input Area — Auto-Enlarging Textarea
- A `<textarea>` that auto-resizes from 1 line up to **5-6 visible lines** based on content height.
- Implementation: use `scrollHeight` approach — set `height: auto`, then `height: Math.min(scrollHeight, maxPx)` where `maxPx = 6 * lineHeight`.
- **Placeholder**: "Describe your diagram, paste markdown, or explain a concept..."
- **Font**: `text-[14px]`, `font-sans`, `leading-relaxed`.
- When content exceeds 6 lines, the textarea becomes **scrollable** (overflow-y auto).
- **Submit**: `Enter` key (without Shift), or a send button. `Shift+Enter` for newline.
- The textarea starts at 1 line and grows as the user types.

#### 1.D Model Selector
- A segmented toggle **below** the textarea.
- Two options:
  - **Groq** (GPT-OSS 120B) — fast, free, 30 RPM / 1K RPD
  - **Mistral** (Mistral Small 4) — high quality, free, ~1 RPS
- Default: **Groq** (faster inference, better for real-time).
- Persisted to localStorage (`exgit_ai_provider`).
- Display model name and a subtle "(free)" badge.

#### 1.E Settings Button
- A small **gear icon** button inside the popup (next to the model selector).
- Clicking it reveals the **system prompt** in a read-only scrollable panel.
- The system prompt is **not editable** — users can only view it.
- The panel slides down or expands inline (accordion style).

#### 1.F Chat History (In-Session)
- Keep a session-local chat history (array of `{role, content}` messages).
- Display previous exchanges as a scrollable list above the input.
- User messages: right-aligned, accent background.
- AI responses: left-aligned, surface background.
- Each AI response includes a **"Apply to Canvas"** button if it contains valid Excalidraw JSON.

#### 1.G Loading State
- While waiting for AI response, show a pulsing dots animation or a small spinner.
- The input is disabled during generation.
- A "Stop generating" button appears (aborts the fetch via `AbortController`).

#### 1.H Rendering Pipeline
When the AI responds with Excalidraw JSON:
1. Extract JSON from markdown code fences (````json ... ````) or raw JSON.
2. Validate the JSON structure (must be an array of elements or object with `elements` array).
3. Validate each element has `type`, `x`, `y`, `id`.
4. Use `convertToExcalidrawElements()` from `@excalidraw/excalidraw` to normalize elements (handles IDs, seeds, versions, arrow bindings, container bindings, text sizing).
5. Push the elements to the live canvas via `excalidrawAPI.updateScene({ elements })`.
6. Merge with existing elements (append mode) or replace (replace mode — toggle in settings).
7. Show a toast: "Diagram generated: N elements added to canvas".
8. Close the chat popup automatically (or keep open if user prefers — add a checkbox).

---

## 2. API Integration

### 2.A Groq API (Primary — Recommended)

**Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
**Auth**: `Authorization: Bearer <GROQ_API_KEY>`
**Format**: OpenAI-compatible

**Free Tier Limits (Aug 2026):**
| Model | RPM | RPD | TPM | TPD | Context | Max Output |
|-------|-----|-----|-----|-----|---------|------------|
| `openai/gpt-oss-120b` | 30 | 1,000 | 8,000 | 200,000 | 131,072 | 65,536 |
| `openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | 200,000 | 131,072 | 65,536 |
| `qwen/qwen3.6-27b` | 30 | 1,000 | 8,000 | 200,000 | 131,072 | 16,384 |
| `qwen/qwen3.8-27b` | 30 | 1,000 | 8,000 | 2,000,000 | 131,042 | 16,384 |

**Recommended model**: `openai/gpt-oss-120b` — best quality for JSON generation on the free tier.

**Key deprecation**: Use `max_completion_tokens` (not `max_tokens`).

**API Call**:
```ts
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
    temperature: 0.3,
    max_completion_tokens: 8192,
    stream: true,
  }),
});
```

**Streaming**: Use SSE (Server-Sent Events). Chunks arrive as:
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}
data: [DONE]
```

**Error Handling**:
- 429: Show "Rate limit exceeded. Try again in X seconds." (read `retry-after` header).
- 401: Show "Invalid API key. Check your Groq API key in Settings."
- Network errors: Show "Connection failed. Check your internet."

**Rate limit headers**:
| Header | Meaning |
|--------|---------|
| `retry-after` | Seconds (only on 429) |
| `x-ratelimit-limit-requests` | RPD |
| `x-ratelimit-remaining-requests` | RPD remaining |
| `x-ratelimit-limit-tokens` | TPM |
| `x-ratelimit-remaining-tokens` | TPM remaining |

### 2.B Mistral API (Secondary — Fallback)

**Endpoint**: `https://api.mistral.ai/v1/chat/completions`
**Auth**: `Authorization: Bearer <MISTRAL_API_KEY>`
**Format**: OpenAI-compatible

**Free Tier Limits (Aug 2026):**
- Cost: $0 (no credit card, phone verification only)
- Monthly cap: ~1 billion tokens
- Rate limit: ~1 req/sec per API key
- **All models available** on free tier (including Mistral Large, Codestral)
- Models may use inputs for training by default — opt out in console

**Available models (current, not deprecated):**
| Model ID | Description | Context |
|----------|-------------|---------|
| `mistral-small-4-0-26-03` (Small 4) | Hybrid instruct/reasoning/coding | 128K |
| `ministral-3-8b-25-12` | Efficient text+vision | 128K |
| `ministral-3-3b-25-12` | Tiny, efficient | 128K |
| `ministral-3-14b-25-12` | Best-in-class text+vision | 128K |
| `mistral-large-3-25-12` | Flagship 675B params | 256K |
| `mistral-medium-3-5-26-04` | Frontier-class, agentic | 256K |

**Recommended**: `mistral-small-4-0-26-03` (Smallest, fastest, cheapest).

**Deprecated models (DO NOT USE):**
- `mistral-small-2506` (retiring Jul 31, 2026 — replaced by Small 4)
- `mistral-small-latest` (alias, may resolve to deprecated version)

**API Call** (same OpenAI-compatible format as Groq):
```ts
const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "mistral-small-4-0-26-03",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
    temperature: 0.3,
    max_tokens: 8192,
    stream: true,
  }),
});
```

**Error format**: `{ "message": "...", "request_id": "...", "code": 400 }`

### 2.C API Key Management
- API keys are stored in `localStorage` (not sent to any server — client-side only).
- Settings panel (accessed via gear icon in chat popup) has input fields for:
  - Groq API key (with a link to `console.groq.com` to get one)
  - Mistral API key (with a link to `console.mistral.ai` to get one)
- Keys are never logged or sent anywhere except the respective API endpoints.
- If no API key is set, show a prompt: "Add your Groq API key (free) to start generating diagrams." with a direct link.

### 2.D Proxy Route (Recommended for Production)
- For production, API keys should NOT be in the client. Add a server-side proxy:
  ```
  POST /api/ai/generate
  Body: { provider: "groq" | "mistral", messages: [...], model?: string }
  ```
- The proxy reads the API key from server-side env vars (`GROQ_API_KEY`, `MISTRAL_API_KEY`).
- For this iteration (free tool), client-side keys are acceptable. The proxy route is a follow-up.

---

## 3. System Prompt (Excalidraw Skeleton JSON Generation)

### 3.A System Prompt Design

The system prompt is the critical component that ensures high-accuracy Excalidraw JSON generation. It teaches the AI the exact **Skeleton format** (not raw full-element JSON), which is dramatically easier to generate correctly.

**Why Skeleton format, not raw full-element JSON?**
- Full JSON requires ~30+ fields per element (`versionNonce`, `seed`, `roundness`, `index`, etc.)
- Arrows need correct `points` arrays, `startBinding`/`endBinding` with `focus`, `gap`, `elementId`
- Text containers need linked `containerId` + matching `boundElements` on parent
- The Skeleton API handles all of this automatically via `convertToExcalidrawElements()`

**Skeleton API confirmed behavior** (from `packages/excalidraw/data/transform.ts`):
- `label` on containers auto-creates bound text elements
- `start`/`end` on arrows auto-creates and binds to target elements
- IDs are auto-generated (set `regenerateIds: true` to avoid collisions)
- Dimensions auto-computed from text content when `width`/`height` omitted
- Arrow `points` auto-computed from bindings — never set manually
- `boundElements` arrays auto-synced between arrows and containers

### 3.B System Prompt Content

```
You are an Excalidraw diagram generator. Your ONLY output is valid Excalidraw JSON in the SKELETON format.

## OUTPUT FORMAT
Output a JSON array of element skeletons. Each element is a simplified object.
The app will convert these to full Excalidraw elements automatically.

Wrap your output in a JSON code fence: ```json ... ```

## ELEMENT SKELETON FORMAT

### Rectangle (boxes, containers)
{
  "type": "rectangle",
  "id": "rect_01",
  "x": 100, "y": 100,
  "width": 180, "height": 80,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "roughness": 1,
  "label": { "text": "Hello World" }
}

### Ellipse (circles, ovals)
{
  "type": "ellipse",
  "id": "ell_01",
  "x": 100, "y": 100,
  "width": 120, "height": 80,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#b2f2bb",
  "label": { "text": "Start" }
}

### Diamond (decisions)
{
  "type": "diamond",
  "id": "dia_01",
  "x": 100, "y": 100,
  "width": 140, "height": 100,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#ffec99",
  "label": { "text": "Decision?" }
}

### Text (free-standing labels)
{
  "type": "text",
  "id": "txt_01",
  "x": 100, "y": 100,
  "text": "Title",
  "fontSize": 28,
  "strokeColor": "#1e1e1e"
}

### Arrow (connections)
{
  "type": "arrow",
  "id": "arr_01",
  "x": 280, "y": 140,
  "points": [[0, 0], [120, 0]],
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "start": { "id": "rect_01" },
  "end": { "id": "rect_02" },
  "endArrowhead": "arrow",
  "label": { "text": "data flow" }
}

### Line (connector without arrow)
Same as arrow but with "type": "line" and no arrowheads.

## BINDING RULES

### Text inside shapes
Use the `label` property on the shape. The text auto-centers inside.
{
  "type": "rectangle",
  "id": "rect_01",
  "x": 100, "y": 100,
  "width": 200, "height": 80,
  "label": { "text": "Process" }
}

### Connecting arrows
Use `start` and `end` with `{ "id": "element_id" }`. The arrow auto-binds.
{
  "type": "arrow",
  "id": "arr_01",
  "x": 200, "y": 300,
  "points": [[0, 0], [100, 0]],
  "start": { "id": "rect_01" },
  "end": { "id": "rect_02" },
  "endArrowhead": "arrow"
}

### Creating new elements inline
Arrows can create and bind to new elements in one step:
{
  "type": "arrow",
  "id": "arr_01",
  "x": 200, "y": 300,
  "start": { "id": "rect_01" },
  "end": {
    "type": "rectangle",
    "id": "rect_02",
    "x": 400, "y": 100,
    "width": 180, "height": 70,
    "label": { "text": "Output" }
  },
  "endArrowhead": "arrow"
}

## LAYOUT RULES
1. Spacing: 60px horizontal gap, 80px vertical gap between elements.
2. Sizing: Rectangles 160-200px wide, 60-80px tall. Font 16-20px.
3. Colors: Light fills with dark strokes. Blue (#a5d8ff) for processes, green (#b2f2bb) for starts, red (#ffc9c9) for ends, yellow (#ffec99) for decisions.
4. Flow: Left-to-right or top-to-bottom. Be visually balanced.
5. IDs: Unique short strings (8-12 chars, e.g. "rect_01", "text_a").
6. Arrow points are auto-computed — just provide approximate coordinates.

## IMPORTANT
- Output ONLY the JSON code fence with the elements array. No explanation text.
- Every element MUST have type, x, y, and id.
- IDs must be unique across all elements.
- Arrows MUST reference valid element IDs in start/end.
- The diagram should be well-laid-out and visually clear.

## EXAMPLE INPUT
"Create a flowchart for user login: User enters credentials, system validates, if valid show dashboard, if invalid show error."

## EXAMPLE OUTPUT
```json
[
  { "type": "rectangle", "id": "rect_01", "x": 50, "y": 100, "width": 180, "height": 70, "strokeColor": "#1e1e1e", "backgroundColor": "#a5d8ff", "fillStyle": "solid", "strokeWidth": 2, "roughness": 1, "label": { "text": "Enter Credentials" } },
  { "type": "arrow", "id": "arr_01", "x": 230, "y": 135, "points": [[0, 0], [60, 0]], "strokeColor": "#1e1e1e", "strokeWidth": 2, "start": { "id": "rect_01" }, "end": { "id": "rect_02" }, "endArrowhead": "arrow" },
  { "type": "rectangle", "id": "rect_02", "x": 290, "y": 100, "width": 180, "height": 70, "strokeColor": "#1e1e1e", "backgroundColor": "#a5d8ff", "fillStyle": "solid", "strokeWidth": 2, "roughness": 1, "label": { "text": "Validate" } },
  { "type": "arrow", "id": "arr_02", "x": 380, "y": 170, "points": [[0, 0], [0, 60]], "strokeColor": "#1e1e1e", "strokeWidth": 2, "start": { "id": "rect_02" }, "end": { "id": "dia_01" }, "endArrowhead": "arrow" },
  { "type": "diamond", "id": "dia_01", "x": 310, "y": 230, "width": 140, "height": 100, "strokeColor": "#1e1e1e", "backgroundColor": "#ffec99", "fillStyle": "solid", "strokeWidth": 2, "roughness": 1, "label": { "text": "Valid?" } },
  { "type": "arrow", "id": "arr_03", "x": 380, "y": 330, "points": [[0, 0], [-150, 70]], "strokeColor": "#1e1e1e", "strokeWidth": 2, "start": { "id": "dia_01" }, "end": { "id": "rect_03" }, "endArrowhead": "arrow" },
  { "type": "arrow", "id": "arr_04", "x": 450, "y": 280, "points": [[0, 0], [130, 0]], "strokeColor": "#1e1e1e", "strokeWidth": 2, "start": { "id": "dia_01" }, "end": { "id": "rect_04" }, "endArrowhead": "arrow" },
  { "type": "rectangle", "id": "rect_03", "x": 130, "y": 350, "width": 180, "height": 70, "strokeColor": "#1e1e1e", "backgroundColor": "#ffc9c9", "fillStyle": "solid", "strokeWidth": 2, "roughness": 1, "label": { "text": "Show Error" } },
  { "type": "rectangle", "id": "rect_04", "x": 530, "y": 250, "width": 180, "height": 70, "strokeColor": "#1e1e1e", "backgroundColor": "#b2f2bb", "fillStyle": "solid", "strokeWidth": 2, "roughness": 1, "label": { "text": "Dashboard" } }
]
```

### 3.C Why This System Prompt Works

1. **Skeleton format**: Dramatically simpler than full-element JSON. No `seed`, `versionNonce`, `boundElements`, etc.
2. **Copy-paste templates**: The AI can copy the element templates and fill in values.
3. **Layout rules**: Explicit spacing, sizing, and color rules prevent messy layouts.
4. **Bound text pattern**: `label: { text: "..." }` on containers auto-creates bound text — the most common failure point in raw JSON.
5. **Arrow binding**: `start: { id }` / `end: { id }` auto-creates bidirectional bindings — the second most common failure point.
6. **Output format**: JSON code fences (not raw JSON) — more reliable extraction via regex.
7. **Low temperature (0.3)**: Ensures deterministic, structured output rather than creative variation.
8. **Verified**: Based on actual `packages/excalidraw/data/transform.ts` source code (810 lines).

### 3.D Validation Layer (Client-Side)

Even with a good system prompt, the AI may produce invalid JSON. Add a validation layer:

```ts
function validateExcalidrawJSON(elements: unknown[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as Record<string, unknown>;
    // Required fields
    if (!el.id || !el.type || el.x == null || el.y == null) {
      errors.push(`Element ${i}: missing required fields (id, type, x, y)`);
      continue;
    }
    // Unique IDs
    if (ids.has(el.id as string)) {
      errors.push(`Element ${el.id}: duplicate ID`);
    }
    ids.add(el.id as string);

    // Type-specific validation
    const validTypes = ["rectangle", "ellipse", "diamond", "text", "arrow", "line"];
    if (!validTypes.includes(el.type as string)) {
      errors.push(`Element ${el.id}: invalid type "${el.type}"`);
    }

    // Arrow bindings
    if (el.type === "arrow") {
      const start = el.start as { id?: string } | undefined;
      const end = el.end as { id?: string } | undefined;
      if (start?.id && !ids.has(start.id)) {
        errors.push(`Arrow ${el.id}: start binding references missing id "${start.id}"`);
      }
      if (end?.id && !ids.has(end.id)) {
        errors.push(`Arrow ${el.id}: end binding references missing id "${end.id}"`);
      }
    }
  }
  return errors;
}
```

If validation fails:
- Try to extract JSON from markdown code fences (````json ... ````).
- Try to fix common issues (missing `version`, missing `source`).
- If still invalid, show the raw response to the user with an error message.

---

## 4. Real-Time Rendering

### 4.A Streaming Response → Live Preview

For the best UX, stream the AI response and progressively render:

1. **Accumulate response chunks** as they arrive via SSE.
2. **Show raw text preview** in the chat bubble as it streams (markdown-rendered).
3. **On completion**: Parse the full JSON, validate, and render to canvas.
4. **Alternative — Progressive rendering** (advanced, future): Parse partial JSON and render elements as they complete. This is complex and not recommended for v1.

### 4.B Canvas Integration

```ts
// After AI response is parsed and validated:
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

function applyToCanvas(
  elements: unknown[],
  api: ExcalidrawImperativeAPI,
  mode: "append" | "replace"
) {
  const excalidrawElements = convertToExcalidrawElements(elements, {
    regenerateIds: true,  // Ensure no ID collisions with existing elements
  });

  if (mode === "replace") {
    api.updateScene({ elements: excalidrawElements });
  } else {
    // Append: offset new elements to the right of existing content
    const existing = api.getSceneElements();
    const maxX = existing.reduce((max, el) => Math.max(max, el.x + el.width), 0);
    const offset = maxX + 60;
    const offsetElements = excalidrawElements.map(el => ({
      ...el,
      x: el.x + offset,
    }));
    api.updateScene({ elements: [...existing, ...offsetElements] });
  }
}
```

### 4.C `convertToExcalidrawElements` Verified Behavior

This API from `@excalidraw/excalidraw` (v0.18.1) converts simplified element skeletons into full Excalidraw elements:

```ts
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw";

const skeletons: ExcalidrawElementSkeleton[] = [
  {
    type: "rectangle",
    x: 100, y: 100,
    width: 200, height: 80,
    label: { text: "Hello" },
  },
  {
    type: "arrow",
    x: 300, y: 140,
    start: { id: "auto-generated-rect-id" },
    end: {
      type: "rectangle",
      x: 500, y: 100,
      width: 200, height: 80,
      label: { text: "World" },
    },
  },
];

const elements = convertToExcalidrawElements(skeletons, { regenerateIds: true });
// elements is now a full ExcalidrawElement[] array ready for updateScene
```

**What it handles automatically:**
- Auto-generates `id`, `seed`, `version`, `versionNonce`, `updated`, `index`
- Computes `width` and `height` for text elements from content
- Sets up `boundElements` for container relationships
- Normalizes arrow bindings (`startBinding`/`endBinding` with `FixedPointBinding`)
- Creates bound text elements from `label` properties
- Normalizes arrow `points` from bindings

---

## 5. Files to Create/Modify

### New Files
- `lib/ai-prompts.ts` — System prompt constant (verified Skeleton API format)
- `lib/ai-providers.ts` — API abstraction (Groq + Mistral clients with SSE streaming)
- `components/ai-chat/AiChatPopup.tsx` — Main chat popup component
- `components/ai-chat/ChatMessage.tsx` — Individual message bubble
- `components/ai-chat/ModelSelector.tsx` — Groq/Mistral toggle
- `components/ai-chat/SystemPromptViewer.tsx` — Read-only system prompt display
- `components/ai-chat/useAiStream.ts` — Custom hook for streaming API calls
- `components/ai-chat/validateScene.ts` — JSON validation utilities

### Modified Files
- `components/topbar/TopBar.tsx` — Add AI button (Sparkle icon)
- `components/AppShell.tsx` — Add chat state, pass excalidrawRef to chat

### No New Dependencies
All needed packages are already installed:
- `react-markdown` + `remark-gfm` — for rendering AI responses as markdown
- `@excalidraw/excalidraw` — for `convertToExcalidrawElements` and `ExcalidrawImperativeAPI`

---

## 6. Acceptance Criteria

- [ ] AI button in TopBar opens the chat popup overlay.
- [ ] Chat popup is centered, bottom-heavy, with auto-enlarging textarea (1-6 lines).
- [ ] Model selector toggles between Groq (default) and Mistral.
- [ ] Settings button reveals read-only system prompt.
- [ ] User can type a description and press Enter to generate.
- [ ] API key input in settings (with links to provider consoles).
- [ ] Response streams in real-time (SSE parsing).
- [ ] Generated JSON is validated before rendering.
- [ ] Valid JSON is rendered to the live canvas via `updateScene(convertToExcalidrawElements(...))`.
- [ ] Append mode adds elements to the right of existing content.
- [ ] Replace mode clears and replaces all elements.
- [ ] Loading state shows during generation; "Stop" button aborts fetch.
- [ ] Error states: invalid API key, rate limit, network error, invalid JSON.
- [ ] Chat history persists within the session (not across page reloads).
- [ ] Last model choice persists to localStorage.
- [ ] Works with both Groq and Mistral API keys.
- [ ] No new npm dependencies required.

---

## 7. Research Sources (Verified)

| Source | What Was Verified | Date |
|--------|-------------------|------|
| `packages/excalidraw/data/transform.d.ts` | Skeleton type, `convertToExcalidrawElements` signature | Aug 2026 |
| `packages/excalidraw/element/types.d.ts` | All element types, arrow bindings, container bindings | Aug 2026 |
| `packages/excalidraw/index.d.ts` | Exported API (`convertToExcalidrawElements`, `ExcalidrawElementSkeleton`) | Aug 2026 |
| `npmjs.com/package/@excalidraw/excalidraw` | Version 0.18.1 confirmed | Aug 2026 |
| `console.groq.com/docs/api-reference` | API endpoint, request/response format, SSE streaming | Aug 2026 |
| `console.groq.com/docs/rate-limits` | Free tier limits — llama-3.3-70b is enterprise only, free models: gpt-oss, qwen | Aug 2026 |
| `console.groq.com/docs/supported-models` | Free tier model list with RPM/RPD/TPM/TPD | Aug 2026 |
| `docs.mistral.ai/api/` | API endpoint, `max_tokens`, request format | Aug 2026 |
| `docs.mistral.ai/getting-started/models/` | Correct model IDs: `mistral-small-4-0-26-03`, deprecated models | Aug 2026 |
| Agents365/excalidraw-skill | System prompt engineering, 8-color palette | Aug 2026 |
| coleam00/excalidraw-diagram-skill | JSON schema reference, element templates | Aug 2026 |

---

## 8. Out of Scope (Follow-Up)
- Server-side API key proxy (production security).
- Image generation from diagrams.
- Multi-turn conversation with context.
- Undo/redo for AI-generated diagrams.
- Template suggestions based on content analysis.
- Voice input for diagram descriptions.
- Progressive rendering (render elements as they stream in).
- Mermaid syntax support via `parseMermaidToExcalidraw()`.
