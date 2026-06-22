# FrameCut

There's always one frame in a cut that does the work — the look, the pause, the light
landing right. FrameCut lets you keep that one.

Scrub to the timestamp, cut the still, and it goes on-chain. People collect an edition
for a few cents of USDC, and it lands in your wallet the instant they do.

**Live → https://framecut-arc.vercel.app**

### How it works

1. Paste a video link, pick a timecode, name the frame, set a price.
2. `cut()` writes it on-chain — the source, the exact timestamp, the title, the price.
3. `collect()` is an open edition: anyone buys one and the USDC goes straight to you.
   No platform cut, no payout to chase.

### Why Arc

A few-cents sale only works if moving the money is instant and basically free. Arc
settles in native USDC — the price is plain dollars, nothing to swap and nothing to
approve. That's the whole reason charging cents per frame makes sense here.

Contract [`0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9`](https://testnet.arcscan.app/address/0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9)
— verified on ARC testnet. Built with Next.js, ethers v6, one Solidity contract, and no
backend; it reads straight from the chain.
