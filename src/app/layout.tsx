import type { Metadata } from "next";
import "./globals.css";
import AIChatWrapper from "@/components/AIChatWrapper";

export const metadata: Metadata = {
  title: "Rencana Anggaran - Central Kitchen",
  description: "Aplikasi internal finance untuk otomasi rencana anggaran, rekap pembayaran, dan approval email ke direktur.",
  keywords: "finance, rencana anggaran, central kitchen, purchase invoice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="bg-mesh" aria-hidden="true" />
        {children}
        <AIChatWrapper />
      </body>
    </html>
  );
}
