import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FatigueSim Pro",
  description: "Advanced Fatigue Life Analysis Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
