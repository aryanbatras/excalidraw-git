import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excalidraw Git",
  description: "Your Excalidraw, backed by Git.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script
          // Excalidraw fetches its hand-drawn fonts from this base path.
          // We copied node_modules/@excalidraw/excalidraw/dist/prod/fonts -> public/fonts.
          dangerouslySetInnerHTML={{
            __html: `window.EXCALIDRAW_ASSET_PATH = "/";`,
          }}
        />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
