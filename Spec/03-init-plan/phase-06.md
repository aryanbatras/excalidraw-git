# Phase 06 — AI Chat Interface (Text/Markdown → Excalidraw Diagram)

## Overview
Add an AI chat interface that converts natural language descriptions, markdown content, or structured text into Excalidraw diagrams in real-time. The interface appears as a centered popup overlay (like ChatGPT's input box), lets users choose between free AI models (Groq or Mistral), and renders the generated diagram directly onto the canvas.

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
- Implementation: use a hidden `<div>` to measure text height, or use `scrollHeight` approach.
- **Placeholder**: "Describe your diagram, paste markdown, or explain a concept..."
- **Font**: `text-[14px]`, `font-sans`, `leading-relaxed`.
- When content exceeds 6 lines, the textarea becomes **scrollable** (overflow-y auto).
- **Submit**: `Enter` key (without Shift), or a send button. `Shift+Enter` for newline.
- The textarea starts at 1 line and grows as the user types.

#### 1.D Model Selector
- A segmented toggle or dropdown **above or below** the textarea.
- Two options:
  - **Groq** (Llama 3.3 70B) — fast, free, 30 RPM / 1,000 RPD
  - **Mistral** (Mistral Small 3.2) — high quality, free, 1 RPS
- Default: **Groq** (faster inference, better for real-time).
- Persisted to localStorage (user's last choice).
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
1. Parse the JSON response (extract JSON from markdown code fences if wrapped).
2. Validate the JSON structure (must have `type: "excalidraw"`, `elements` array).
3. Use `convertToExcalidrawElements()` from `@excalidraw/excalidraw` to normalize the elements (handles IDs, seeds, versions).
4. Push the elements to the live canvas via `excalidrawAPI.updateScene({ elements })`.
5. Merge with existing elements (append mode) or replace (replace mode — toggle in settings).
6. Show a toast: "Diagram generated: N elements added to canvas".
7. Close the chat popup automatically (or keep open if user prefers — add a checkbox).

---

## 2. API Integration

### 2.A Groq API (Primary — Recommended)

**Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
**Auth**: Bearer token (API key)
**Format**: OpenAI-compatible

**Free Tier Limits (2026)**:
| Model | RPM | RPD | TPM | TPD |
|-------|-----|-----|-----|-----|
| `llama-3.3-70b-versatile` | 30 | 1,000 | 12,000 | 100,000 |
| `llama-3.1-8b-instant` | 30 | 14,400 | 6,000 | 500,000 |
| `meta-llama/llama-4-scout-17b-16e-instruct` | 30 | 1,000 | 30,000 | 500,000 |

**Recommended model**: `llama-3.3-70b-versatile` — best quality for JSON generation, 12K TPM is sufficient for diagrams.

**API Call**:
```ts
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
    temperature: 0.3,  // Low temperature for deterministic JSON output
    max_tokens: 8192,  // Diagrams can be large
    stream: true,      // Enable streaming for real-time rendering
  }),
});
```

**Streaming**: Use SSE (Server-Sent Events) to stream the response. Parse `data: [DONE]` and `data: {...}` chunks. Accumulate the response, and when complete, parse the JSON.

**Error Handling**:
- 429: Show "Rate limit exceeded. Try again in X seconds." (read `x-ratelimit-reset-tokens` header).
- 401: Show "Invalid API key. Check your Groq API key in Settings."
- Network errors: Show "Connection failed. Check your internet."

### 2.B Mistral API (Secondary — Fallback)

**Endpoint**: `https://api.mistral.ai/v1/chat/completions`
**Auth**: Bearer token (API key)
**Format**: OpenAI-compatible

**Free Tier Limits (2026)**:
- Rate limit: 1 request per second per API key
- All models available on free tier (rate-limited)
- Recommended model: `mistral-small-latest` (cheapest, fastest)

**API Call** (same OpenAI-compatible format as Groq):
```ts
const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "mistral-small-latest",
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

## 3. System Prompt (Excalidraw JSON Generation)

### 3.A System Prompt Content

The system prompt is the critical component that ensures high-accuracy Excalidraw JSON generation. It must teach the AI the exact Excalidraw element structure, available types, and layout best practices.

```
You are an Excalidraw diagram generator. Your ONLY output is valid Excalidraw JSON.
You convert natural language descriptions, markdown content, or structured text into
beautiful, well-laid-out Excalidraw diagrams.

## OUTPUT FORMAT
You MUST output a complete .excalidraw JSON object. No explanation, no markdown fences,
just raw JSON. The JSON must have this exact structure:

{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [ ... ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20
  },
  "files": {}
}

## ELEMENT TYPES

### Rectangle (boxes, containers)
{
  "type": "rectangle",
  "id": "unique_id",
  "x": 100, "y": 100,
  "width": 180, "height": 80,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "roundness": { "type": 3 },
  "seed": 1234567890,
  "version": 1,
  "versionNonce": 1234567890,
  "isDeleted": false,
  "boundElements": [],
  "updated": 1700000000000,
  "link": null,
  "locked": false
}

### Ellipse (circles, ovals)
{
  "type": "ellipse",
  "id": "unique_id",
  "x": 100, "y": 100,
  "width": 120, "height": 80,
  "roundness": { "type": 2 },
  ...same base properties as rectangle...
}

### Diamond (decisions)
{
  "type": "diamond",
  "id": "unique_id",
  "x": 100, "y": 100,
  "width": 120, "height": 100,
  ...same base properties...
}

### Text (labels, descriptions)
{
  "type": "text",
  "id": "unique_id",
  "x": 100, "y": 100,
  "width": 100, "height": 25,
  "text": "Hello World",
  "fontSize": 20,
  "fontFamily": 5,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": null,  // null for free text, or element ID for bound text
  "originalText": "Hello World",
  "autoResize": true,
  "lineHeight": 1.25,
  ...same base properties...
}

### Arrow (connections)
{
  "type": "arrow",
  "id": "unique_id",
  "x": 280, "y": 140,
  "width": 100, "height": 0,
  "points": [[0, 0], [100, 0]],
  "lastCommittedPoint": null,
  "startBinding": { "elementId": "source_id", "focus": 0, "gap": 1 },
  "endBinding": { "elementId": "target_id", "focus": 0, "gap": 1 },
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "elbowed": false,
  ...same base properties...
}

### Line (connectors without arrows)
Same as arrow but with `"type": "line"` and no arrowheads.

## BOUND TEXT (Text Inside Shapes)
To put text inside a rectangle/ellipse/diamond:
1. Create the shape with `boundElements: [{ "id": "text_id", "type": "text" }]`
2. Create a text element with `containerId: "shape_id"`
3. The text will auto-center inside the shape.

## LAYOUT RULES
1. **Grid spacing**: Use 60px gaps between elements horizontally, 80px vertically.
2. **Element sizes**: Rectangles 160-200px wide, 60-80px tall. Text 16-20px font.
3. **Colors**: Use a consistent palette. Prefer light fills (#a5d8ff blue, #b2f2bb green, #ffec99 yellow, #ffc9c9 red) with dark strokes (#1e1e1e).
4. **Arrows**: Always bind arrows to source and target elements. Use `focus: 0` for centered binding.
5. **IDs**: Generate unique short strings (8-12 chars). Use descriptive prefixes: "rect_", "text_", "arrow_".
6. **Seeds**: Random integers (1000000000 - 9999999999) for hand-drawn variation.
7. **Timestamps**: Use current epoch milliseconds for `updated` field.

## DIAGRAM PATTERNS

### Flowchart
- Start/End: ellipse with light green/red fill
- Process: rectangle with light blue fill
- Decision: diamond with light yellow fill
- Arrows connect shapes left-to-right or top-to-bottom

### Mind Map
- Central node: large rectangle or ellipse
- Branches: arrows radiating outward
- Sub-nodes: smaller rectangles
- Use groupIds to group related branches

### System Architecture
- Components: rectangles with labels
- Data flow: arrows with labels
- External systems: dashed border rectangles
- Databases: cylinder shape (rectangle + ellipse)

### Sequence Diagram
- Participants: rectangles at top
- Lifelines: vertical dashed lines
- Messages: horizontal arrows between lifelines
- Time flows downward

## IMPORTANT RULES
- Output ONLY the JSON object. No explanation text, no markdown code fences.
- Every element MUST have all required properties listed above.
- IDs must be unique across all elements.
- Arrows MUST have startBinding and endBinding pointing to valid element IDs.
- Text inside shapes MUST use containerId and the shape MUST have matching boundElements.
- The diagram should be visually balanced with adequate spacing.
- Prefer left-to-right or top-to-bottom flow.
- Use color semantically: blue for processes, green for starts, red for errors/ends, yellow for decisions.
```

### 3.B Why This System Prompt Works

1. **Exact JSON structure**: The prompt specifies every property the AI needs, preventing missing fields.
2. **Copy-paste templates**: The AI can copy the element templates and fill in values.
3. **Layout rules**: Explicit spacing, sizing, and color rules prevent messy layouts.
4. **Bound text pattern**: The most common source of broken diagrams is incorrect text binding. The prompt explicitly explains the two-step process.
5. **Arrow binding**: Explains how to connect arrows to shapes with proper `startBinding`/`endBinding`.
6. **Output format**: Forces raw JSON output (no markdown fences), making parsing reliable.
7. **Low temperature (0.3)**: Ensures deterministic, structured output rather than creative variation.

### 3.C Validation Layer (Client-Side)

Even with a good system prompt, the AI may produce invalid JSON. Add a validation layer:

```ts
function validateExcalidrawJSON(data: unknown): data is Scene {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (obj.type !== "excalidraw") return false;
  if (!Array.isArray(obj.elements)) return false;
  if (obj.elements.length === 0) return false;

  for (const el of obj.elements) {
    if (!el || typeof el !== "object") return false;
    const e = el as Record<string, unknown>;
    if (!["rectangle", "ellipse", "diamond", "text", "arrow", "line", "freedraw"].includes(e.type as string)) return false;
    if (typeof e.x !== "number" || typeof e.y !== "number") return false;
    if (typeof e.id !== "string" || !e.id) return false;
  }
  return true;
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

function applyToCanvas(scene: Scene, api: ExcalidrawImperativeAPI, mode: "append" | "replace") {
  const elements = convertToExcalidrawElements(scene.elements as ExcalidrawElementSkeleton[], {
    regenerateIds: true,  // Ensure no ID collisions
  });

  if (mode === "replace") {
    api.updateScene({ elements });
  } else {
    // Append: offset new elements to the right of existing content
    const existing = api.getSceneElements() ?? [];
    const offset = calculateOffset(existing);  // Find rightmost edge + 60px gap
    const offsetElements = elements.map(el => ({
      ...el,
      x: el.x + offset.x,
      y: el.y + offset.y,
    }));
    api.updateScene({ elements: [...existing, ...offsetElements] });
  }
}
```

### 4.C `convertToExcalidrawElements` Usage

This API from `@excalidraw/excalidraw` (v0.18.1) converts simplified element skeletons into full Excalidraw elements with proper IDs, seeds, versions, and dimensions. It handles:
- Auto-generating `id`, `seed`, `version`, `versionNonce`, `updated`
- Computing `width` and `height` for text elements
- Setting up `boundElements` for container relationships
- Normalizing arrow bindings

```ts
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw";

const skeletons: ExcalidrawElementSkeleton[] = [
  { type: "rectangle", x: 100, y: 100, width: 200, height: 80, label: { text: "Hello" } },
  { type: "arrow", x: 300, y: 140, end: { type: "rectangle", x: 400, y: 100, width: 200, height: 80, label: { text: "World" } } },
];

const elements = convertToExcalidrawElements(skeletons, { regenerateIds: true });
// elements is now a full ExcalidrawElement[] array ready for updateScene
```

**Note**: The Skeleton API uses a simplified format where:
- `label` on a container auto-creates bound text
- `start`/`end` on arrows auto-create and bind to target elements
- IDs are auto-generated if not provided
- Dimensions are computed from text content

This means the AI can output the **simplified skeleton format** instead of full element JSON, which is much easier to generate correctly. The system prompt should offer both options and prefer the skeleton format for reliability.

---

## 5. Files to Create/Modify

### New Files
- `components/ai-chat/AiChatPopup.tsx` — Main chat popup component
- `components/ai-chat/ChatMessage.tsx` — Individual message bubble
- `components/ai-chat/ModelSelector.tsx` — Groq/Mistral toggle
- `components/ai-chat/SystemPromptViewer.tsx` — Read-only system prompt display
- `components/ai-chat/useAiStream.ts` — Custom hook for streaming API calls
- `components/ai-chat/validateScene.ts` — JSON validation utilities
- `lib/ai-providers.ts` — API abstraction (Groq + Mistral clients)
- `lib/ai-prompts.ts` — System prompt constant

### Modified Files
- `components/topbar/TopBar.tsx` — Add AI button
- `components/AppShell.tsx` — Add chat state, pass excalidrawRef to chat
- `lib/store.ts` — Add `aiProvider`, `groqApiKey`, `mistralApiKey` to persisted state
- `package.json` — No new dependencies needed (all already installed)

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
- [ ] Valid JSON is rendered to the live canvas via `updateScene`.
- [ ] Append mode adds elements to the right of existing content.
- [ ] Replace mode clears and replaces all elements.
- [ ] Loading state shows during generation; "Stop" button aborts fetch.
- [ ] Error states: invalid API key, rate limit, network error, invalid JSON.
- [ ] Chat history persists within the session (not across page reloads).
- [ ] Last model choice persists to localStorage.
- [ ] Works with both Groq and Mistral API keys.
- [ ] No new npm dependencies required.

---

## 7. Out of Scope (Follow-Up)
- Server-side API key proxy (production security).
- Image generation from diagrams.
- Multi-turn conversation with context.
- Undo/redo for AI-generated diagrams.
- Template suggestions based on content analysis.
- Voice input for diagram descriptions.
