import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Oracode - Claude Code in the Browser",
  description: "Prototype features and open PRs without touching the terminal. Just connect GitHub and start vibe coding.",
  metadataBase: new URL("https://www.oracode.dev"),
  icons: {
    icon: [
      { url: "/icon-light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.svg", media: "(prefers-color-scheme: dark)" },
    ],
  },
  openGraph: {
    title: "Oracode - Claude Code in the Browser",
    description: "Prototype features and open PRs without touching the terminal. Just connect GitHub and start vibe coding.",
    url: "https://www.oracode.dev",
    siteName: "Oracode",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Oracode - Claude Code in the Browser",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oracode - Claude Code in the Browser",
    description: "Prototype features and open PRs without touching the terminal. Just connect GitHub and start vibe coding.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans dark antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
