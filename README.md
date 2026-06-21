# FrameCut

**Cut one frame from a video. Mint it. Sell the moment.**

Pick a timestamp, cut that single still, and it lands on-chain as a collectible.
Fans collect an edition for a few cents of USDC — and the money hits your wallet the
instant they do.

→ **Live:** https://framecut-arc.vercel.app

## Slate

```
SCENE      cut a frame  →  mint it  →  collectors buy editions in USDC
NETWORK    ARC Testnet · chain 5042002
CONTRACT   0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9   [verified]
PRICE      set per frame, by the creator (free editions allowed)
PAYOUT     100% to the creator, same transaction, native USDC
```

## The cut

A frame keeps its source video, the exact timecode (down to the millisecond), a
title and a price. `cut()` writes it on-chain; `collect()` is `payable` and forwards
your USDC straight to the creator — no platform cut, no custody, no payout to chase.
Every edition, every timecode and every cent is readable by anyone on
[ArcScan](https://testnet.arcscan.app/address/0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9).

## Why ARC

A 30-cent sale only pencils out if moving the money is instant and basically free.
ARC settles in **native USDC** — the price is plain dollars, there's no token to buy
and no approval to sign. That's the whole reason micro-priced editions make sense
here and not anywhere else.

## Built with

Next.js · ethers v6 · Solidity · EIP-6963 wallets · zero backend — static on Vercel,
reads straight from the chain.
