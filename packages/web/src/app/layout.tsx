import "./globals.css";

/**
 * Root layout is minimal; `<html>` / `<body>` live in `app/[locale]/layout.tsx`
 * so `lang` and messages match the active locale (SEO + i18n).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
