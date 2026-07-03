import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude Monitor",
  description: "Claude Code usage dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#0f1117" }}>{children}</body>
    </html>
  );
}
