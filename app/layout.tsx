import type { Metadata, Viewport } from "next";
import { DM_Sans, Pridi } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Bundle the font to avoid Google CSS URL parsing failures during production builds.
const baloo2 = localFont({
  src: "./fonts/Baloo2-variable.ttf",
  variable: "--font-baloo-2",
  weight: "600 700",
  display: "swap",
});

const pridi = Pridi({
  variable: "--font-pridi",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hey, Cohen",
  description: "Smart SMS for small businesses",
  icons: {
    icon: "https://res.cloudinary.com/diy08lj9x/image/upload/v1790707365/favicon_system_wdq6oi.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${baloo2.variable} ${pridi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}