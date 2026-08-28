import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@excalidraw/excalidraw",
    "react-syntax-highlighter",
    "react-pdf",
    "pdfjs-dist",
  ],
};

export default nextConfig;
