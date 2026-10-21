import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shiftly | Workforce attendance",
  description: "A simple workspace for employee records and daily attendance."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
