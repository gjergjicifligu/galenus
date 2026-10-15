import "./globals.css";
import { headers } from "next/headers";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = (await headers()).get("x-language") || "sq";
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
