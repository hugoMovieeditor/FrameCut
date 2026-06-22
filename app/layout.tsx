import type { Metadata } from "next";
import { Familjen_Grotesk, Reddit_Mono } from "next/font/google";
import "./globals.css";

const sans = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Reddit_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FrameCut — cut a frame, mint it, on ARC",
  description:
    "Cut a single frame from a video and mint it as a collectible on-chain. Fans collect editions for a USDC micro-payment that pays the creator on the spot. Built on ARC.",
  keywords: "FrameCut, ARC, USDC, NFT, video, film, frame, editions, micropayments, web3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
