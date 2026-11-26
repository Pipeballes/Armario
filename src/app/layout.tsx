import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import ReminderSync from "@/components/ReminderSync";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

const sans = Geist({ variable: "--font-sans-app", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display-app", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Armario",
  description: "Tu armario digital con asesor de estilo.",
  appleWebApp: { capable: true, title: "Armario", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#17140f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-28">{children}</main>
        <BottomNav />
        <ServiceWorker />
        <ReminderSync />
      </body>
    </html>
  );
}
