import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CortexMed — Clinical Spatial Memory & Healthcare Guardian",
  description: "Zero-hardware browser-first 3D spatial memory, contactless vitals telemetry, and clinical medication safety platform for dementia care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased noise-bg">{children}</body>
    </html>
  );
}
