import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fatigue Analysis Workspace",
  description: "Fatigue life analysis for materials, S-N models and loading cases.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#f8fafc] text-[#0f172a] antialiased">{children}</body>
    </html>
  );
}
