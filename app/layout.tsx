import "./globals.css";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "HOA SaaS",
  description: "HOA management platform for Philippine subdivisions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        <NextTopLoader color="#4f46e5" showSpinner={false} height={2} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
