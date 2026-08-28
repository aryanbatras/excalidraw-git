import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const assistant = Assistant({
  subsets: ["latin"],
  variable: "--font-assistant",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Excalidraw Git",
  description: "Your Excalidraw, backed by GitHub.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${assistant.variable} ${jetbrains.variable}`}>
      <head />
      <body>
        <Script
          id="excalidraw-asset-path"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.EXCALIDRAW_ASSET_PATH = "/";`,
          }}
        />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
