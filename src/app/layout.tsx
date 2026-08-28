import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nutri Tummies — Healthy Meals Kids Will Actually Eat",
  description:
    "South Africa's AI-powered child nutrition app. Personal weekly meal plans, picky-eater coaching, allergy-safe recipes and smart shopping lists that fit your budget.",
  keywords: [
    "child nutrition",
    "meal planner",
    "picky eater",
    "South Africa",
    "kids meals",
    "family budget",
    "healthy recipes",
  ],
  authors: [{ name: "Nutri Tummies" }],
  openGraph: {
    title: "Nutri Tummies — Healthy Meals Kids Will Actually Eat",
    description:
      "AI meal plans, picky-eater coaching and budget-smart shopping lists for South African families.",
    siteName: "Nutri Tummies",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3f9e54",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${nunito.variable} ${nunitoSans.variable} font-[family-name:var(--font-nunito-sans)] antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
