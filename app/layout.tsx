import type { Metadata } from "next";
import { DM_Sans, Baloo_2, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const baloo2 = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo-2",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Odeon | Headliner Music Academy",
  description: "Internal messaging and contact management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${baloo2.variable} ${jetbrainsMono.variable} font-sans bg-bg`}>
        {children}
      </body>
    </html>
  );
}