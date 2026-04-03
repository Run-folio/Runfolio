import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { PersistenceProvider } from "@/components/persistence-context";
import { clientPersistenceFromReadiness, getServerPersistenceReadiness } from "@/lib/persistence-readiness";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Runfolio",
  description: "A curated running portfolio platform."
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const readiness = await getServerPersistenceReadiness();
  const persistence = clientPersistenceFromReadiness(readiness);
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className={`${inter.className} font-sans`}>
        <PersistenceProvider value={persistence}>{children}</PersistenceProvider>
      </body>
    </html>
  );
}
