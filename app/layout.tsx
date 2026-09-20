import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./components/providers";

export const metadata: Metadata = {
  title: "SpreadForge — Learn. Simulate. Compete.",
  description: "A Solana DeFi market-making simulator with verifiable results.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
