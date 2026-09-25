import type { Metadata, Viewport } from "next";
import { DM_Sans, Baloo_2, Pridi } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const baloo2 = Baloo_2({
  variable: "--font-baloo-2",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const pridi = Pridi({
  variable: "--font-pridi",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Hey, Cohen",
  description: "Smart SMS for small businesses",
  icons: {
    icon: "https://res.cloudinary.com/diy08lj9x/image/upload/v1788457911/favicon_ajrnub.png",
  },
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