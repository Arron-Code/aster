import type { Metadata, Viewport } from "next";
import "./globals.css";
import BodyThemeClass from "./body-theme-class";
import PwaInstall from "./pwa-install";

export const metadata: Metadata = {
  title: {
    default: "Aster Caffe",
    template: "%s | Aster Caffe",
  },
  description: "Äthiopische Küche, Premium-Kaffee, Tischbestellung und Reservierungen",
  applicationName: "Aster Caffe",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aster Caffe",
  },
  icons: {
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#18212d",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <BodyThemeClass />
        {children}
        <PwaInstall />
        <link rel="stylesheet" href="/aster-theme.css" />
      </body>
    </html>
  );
}
