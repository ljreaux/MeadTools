import type { Metadata } from "next";
import { Ubuntu_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const ubuntuMono = Ubuntu_Mono({ weight: ["400", "700"], subsets: ["latin"] });
export const metadata: Metadata = {
  metadataBase: new URL("https://meadtools.com"),
  title: "MeadTools",
  description: "The all in one mead, wine, and cider making calculator.",
  icons: `${process.env.NEXT_PUBLIC_BASE_URL}/icon.png`,
  openGraph: {
    type: "website",
    title: "MeadTools",
    description: "The all in one mead, wine, and cider making calculator.",
    images: `${process.env.NEXT_PUBLIC_BASE_URL}/icon.png`,
  },
  twitter: {
    card: "summary_large_image",
    site: "@meadtools",
    title: "MeadTools",
    description: "The all in one mead, wine, and cider making calculator.",
    images: `${process.env.NEXT_PUBLIC_BASE_URL}/icon.png`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ubuntuMono.className} bg-secondary h-screen`}>
        <Toaster />

        {children}
      </body>
    </html>
  );
}
