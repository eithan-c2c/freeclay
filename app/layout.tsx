import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "FreeGTM — Enrichis tes données avec l'IA. Gratuitement.",
  description:
    "Alternative open-source à Clay. Enrichis n'importe quel spreadsheet avec l'IA + recherche web. Apporte ta propre clé API. Aucun compte, aucun stockage.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} min-h-screen bg-white text-[#04261A] antialiased font-[family-name:var(--font-inter)]`}>
        {children}
      </body>
    </html>
  );
}
