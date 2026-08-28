export type FileKind = "excalidraw" | "markdown" | "code" | "text" | "image" | "pdf";

const IMAGE_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif", "apng",
]);
const CODE_EXT = new Set([
  "js", "mjs", "cjs", "ts", "d.ts", "tsx", "jsx", "java", "cpp", "cxx", "cc",
  "c", "h", "hpp", "cs", "go", "rs", "rb", "php", "swift", "kt", "kts",
  "scala", "py", "sh", "bash", "zsh", "sql", "html", "htm", "css", "scss",
  "less", "xml", "json", "yaml", "yml", "toml", "ini", "cfg", "diff", "patch",
  "vue", "svelte", "dockerfile", "gradle", "r", "lua", "pl", "ex", "erl",
]);
const MARKDOWN_EXT = new Set(["md", "markdown", "mdx", "qmd"]);

export function fileExt(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function classifyFile(path: string): FileKind {
  const ext = fileExt(path);
  if (ext === "excalidraw") return "excalidraw";
  if (MARKDOWN_EXT.has(ext)) return "markdown";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (CODE_EXT.has(ext)) return "code";
  return "text";
}

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  pdf: "application/pdf",
  md: "text/markdown",
  markdown: "text/markdown",
  mdx: "text/mdx",
  txt: "text/plain",
  log: "text/plain",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
  xml: "text/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  toml: "text/toml",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  ts: "text/plain",
  tsx: "text/plain",
};

// Extension → prism language id (for react-syntax-highlighter).
export const LANG_BY_EXT: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  ts: "typescript", tsx: "tsx", "d.ts": "typescript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  cpp: "cpp", cxx: "cpp", cc: "cpp", h: "cpp", hpp: "cpp", cs: "csharp",
  php: "php", swift: "swift", kt: "kotlin", kts: "kotlin", scala: "scala",
  sh: "bash", bash: "bash", zsh: "bash", sql: "sql", html: "markup",
  htm: "markup", xml: "markup", css: "css", scss: "css", less: "css",
  json: "json", yaml: "yaml", yml: "yaml", toml: "ini", ini: "ini",
  diff: "diff", patch: "diff", dockerfile: "docker", gradle: "groovy",
  vue: "markup", svelte: "markup", r: "r", lua: "lua", pl: "perl",
  ex: "elixir", erl: "erlang", md: "markdown", markdown: "markdown",
};