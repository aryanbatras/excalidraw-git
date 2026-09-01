# Excalidraw MCP Integration — Deep Assessment

## What MCP is
Model Context Protocol. An **MCP Host** (Claude, ChatGPT, VS Code, Cursor, a custom app) embeds an
**MCP Client**, which speaks JSON-RPC over a transport (stdio or **Streamable HTTP** + SSE) to one
or more MCP **Servers**. Servers expose tools/resources/prompts.

## Verified SDK facts (2025-2026)
- TS SDK is split: **`@modelcontextprotocol/client`** (client lib) and `@modelcontextprotocol/server`
  (server lib). Streamable HTTP via `StreamableHTTPClientTransport` / `StreamableHTTPServerTransport`
  (SSE fallback). Node-targeted (uses `globalThis.crypto`, Node streams in places).
- Streamable HTTP: client POST `initialize` → server returns JSON + session handling; further calls
  use the session. Bidirectional via SSE. Stateful sessions in older revisions; newer spec (2025-11-25)
  is **stateless** (no session IDs) — simpler to deploy serverless.

## Official Excalidraw MCP + community servers
- Official `github.com/excalidraw/excalidraw-mcp`: remote `https://mcp.excalidraw.com` for clients with
  an official integration; local `.mcpb` extension for Claude Desktop. Driven by **MCP Apps** (interactive
  chat UIs). Primarily for chat-embedded fullscreen **editing**, not for embedding a server into a custom app.
- Community canvas servers (WebSocket based): yctimlin/mcp_excalidraw (v2, Express+WS canvas server on
  127.0.0.1:3000, tools: add/query/describe/screenshot/export/import/**mermaid**/snapshot/arrange/share/apply),
  lesleslie/excalidraw-mcp, cmd8/excalidraw-mcp (createNode/createEdge/deleteElement/getFullDiagramState),
  Scofieldfree/excalidraw-mcp.

## Key architectural question: in-app end-user feature vs agent tooling
Embedding an MCP **client in the browser** is possible but awkward: the SDK is Node-centric, needs
`globalThis.crypto` (browser has it) and careful bundling; a stateful canvas-sync server needs a
persistent/long-running host (Vercel serverless can't hold a WebSocket canvas). This is heavy for the
UX we want.

**Two directions:**

### Direction B (RECOMMENDED for this app) — native in-app "AI draws live"
- The AI chat already streams. Have it produce **Mermaid**, convert with
  `@excalidraw/mermaid-to-excalidraw`, then `excalidrawAPI.updateScene({ elements })`.
- Local, deterministic, no extra server, no WebSocket, no MCP dependency. This is exactly the
  Mermaid feature already planned — no separate MCP work needed for the end-user AI-drawing UX.

### Direction A (future/integration) — expose our canvas as an MCP server for coding agents
- Ship a server (using `@modelcontextprotocol/server` + Streamable HTTP) whose tools operate on the
  user's `.excalidraw` files in GitHub (read/modify scene → commit). A Claude Code / Cursor / VS Code
  client registers it and can then build diagrams in the repo.
- This is developer-facing, not the current end-user UI. Needs a long-running host for a stateful
  canvas, or use stateless Streamable HTTP (newer spec) on serverless.
- The official MCP (`mcp.excalidraw.com`) and Excalidraw+ API (`list_scenes`, `create_scene`,
  `get_scene`, `edit_scene_content`, ...) are chat-hosted / hosted-scenes products — not aligned with
  our git-backed storage + no-extra-host preference.

## Recommendation
- **Do MCP via Direction A only as a later integration**, and only if we want external AI agents to
  drive the canvas. For "AI draws live" in-app, **Direction B (Mermaid) is the robust, simple answer**
  and is already covered by the Mermaid feature. Document this decision so we don't over-engineer.
