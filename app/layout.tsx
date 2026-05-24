import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Project Dashboard",
  description: "Dashboard วิเคราะห์โครงการวิจัยและแบบประเมินความพึงพอใจ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
