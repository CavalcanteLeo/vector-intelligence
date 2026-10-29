import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./motion.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vector Intelligence",
  description:
    "Vector Intelligence builds software, modernizes complex systems, and makes AI useful in real work.",
  icons: {
    icon: [
      {
        url: "/assets/images/vector-intelligence-favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        url: "/assets/images/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/assets/images/favicon-16x16.png",
        type: "image/png",
        sizes: "16x16",
      },
    ],
    apple: {
      url: "/assets/images/apple-touch-icon.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
