import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrameCut — cut a frame, mint it, on ARC",
  description:
    "Cut a single frame from a video and mint it as a collectible on-chain. Fans collect editions for a USDC micro-payment that pays the creator on the spot. Built on ARC.",
  keywords: "FrameCut, ARC, USDC, NFT, video, film, frame, editions, micropayments, web3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
