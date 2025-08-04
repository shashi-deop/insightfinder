import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsightFinder - Semantic File Search",
  description: "Search through your documents using natural language queries powered by AI",
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '200x200', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
