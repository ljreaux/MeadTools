import type { Metadata } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Nunito,
  Orbitron,
  Ubuntu_Mono,
  Young_Serif,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import {
  DEFAULT_DESIGN_THEME,
  designThemeInitScript,
} from "@/lib/design-themes";

const ubuntuMono = Ubuntu_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-ubuntu-mono",
});

// Fonts for the design themes in app/themes/*.css, exposed as CSS variables.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  preload: false,
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  preload: false,
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  preload: false,
});
const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  preload: false,
});
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  preload: false,
});
const youngSerif = Young_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-young-serif",
  preload: false,
});
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  preload: false,
});
const designFontVariables = [
  ubuntuMono,
  jetbrainsMono,
  fraunces,
  inter,
  orbitron,
  ibmPlexMono,
  youngSerif,
  nunito,
]
  .map((font) => font.variable)
  .join(" ");
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
    <html
      lang="en"
      data-design={DEFAULT_DESIGN_THEME}
      className={designFontVariables}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: designThemeInitScript }} />
      </head>
      <body className="h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
