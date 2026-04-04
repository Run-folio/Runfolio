import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { PersistenceProvider } from "@/components/persistence-context";
import { ShellProviders } from "@/components/shell/shell-providers";
import { SiteFooter } from "@/components/site-footer";
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
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} flex min-h-screen flex-col font-sans`}>
        <PersistenceProvider value={persistence}>
          <ShellProviders>
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter />
          </ShellProviders>
        </PersistenceProvider>
      </body>
    </html>
  );
}
