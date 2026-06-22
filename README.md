```
┌─────────────────────────────────────────────────────────────┐
│  FRAMECUT                                       ROLL · 01     │
│                                                               │
│  PROD ......  FrameCut — open-edition stills, on-chain        │
│  DIR .......  Hugo Luisi  (@hugoMovieeditor)                  │
│  CAMERA ....  one Solidity contract, no second unit           │
│  STOCK .....  native USDC                                     │
│  LOCATION ..  Arc testnet · chain 5042002                     │
│  GATE ......  0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9       │
│  DAILIES ...  https://framecut-arc.vercel.app                 │
└─────────────────────────────────────────────────────────────┘
```

> A cut lives or dies on a handful of frames. FrameCut is for pulling
> one of those out — a single still at an exact timecode — and letting
> people own an edition of it. Collectors pay in USDC; the money walks
> straight to the creator the same second the frame is grabbed.

Read this like a shot list. Two setups, one piece of hardware.

---

## INT. THE CUT — creator side

A creator scrubs to a moment and marks it. Four things go on the record:

```
cut(video, atMs, title, price) → frameId
```

- `video`  — the source link (1–300 chars; YouTube / Vimeo / any URL)
- `atMs`   — the timecode, in milliseconds (`uint32`); UI takes `1:23` or `83`
- `title`  — what the frame is (1–120 chars)
- `price`  — USDC per edition, native 18-decimal amount; `0` makes it free,
             otherwise the front desk floors paid frames at `0.01`

The call mints frame `++frameCount`, stamps `msg.sender` as creator and
`block.timestamp` as `cutAt`, files the id under that creator, and fires
`Cut`. Nothing is escrowed. A cut is a listing, not a sale.

No supply cap is written. This is an **open edition** — the print run is
however many fans show up.

## EXT. THE COLLECT — fan side

A collector finds the still on the contact sheet and buys a print:

```
collect(frameId) payable
```

What the contract enforces, in order:

```
require  frame exists           (creator != 0x0)
require  not your own frame     (creator != msg.sender)
require  msg.value >= price      (send the asking price)
─ effects ─
editions      += 1
totalCollected += 1
totalVolume   += msg.value
editionsOwned[id][buyer] += 1
─ interaction ─
payable(creator).call{ value: msg.value }   ← the whole payment, forwarded
emit Collected(id, buyer, creator, edition, price)
```

Checks-effects-interactions, in that order. The paid USDC is not parked in
the contract for a payout run later — it leaves in the same transaction,
into the creator's wallet. Editions are counted, not minted as separate
tokens; `editionsOwned[id][you]` is your receipt.

## WHY THIS NEEDS ARC — the budget note

Here's the arithmetic that only closes on Arc. A still sells for cents —
the default ask is `0.5`, the floor is `0.01`. If the rail that carries
that payment skims a fee comparable to the sale, or makes the buyer first
acquire and approve some separate gas token, the economics of selling a
single frame for thirty cents collapse before the creator sees a dime.

Arc settles in native USDC. The price the creator types is plain dollars;
the buyer sends plain dollars; the transport cost is a sliver, not a tax on
the sale. Because `collect()` forwards `msg.value` straight through, the
creator is paid in the same confirmed transaction the fan collects in —
not on a Friday, not after a threshold, not minus a platform's cut. That
instant, near-free, dollar-denominated settlement is the *only* reason
charging by the frame is a real business instead of a rounding error.

## SCRIPT SUPERVISOR — the ledger

The contract keeps continuity so the front end never has to guess:

```
frameCount       total frames cut
totalCollected   total editions sold across all frames
totalVolume      total USDC that has passed through collect()
editionsOwned    how many prints an address holds of a frame
framesOf(a)      frame ids a created
collectedBy(a)   frame ids a has collected at least one print of
getFrame(id)     the full Frame struct
```

The site (`app/page.tsx`) is a viewer over those reads — the contact sheet
with **All / Yours / Collected** tabs, the `● REC` cut form, and the running
totals up top all come from the contract through `ethers` v6 (`lib/framecut.ts`).
There is no server, no off-chain index, and **no autonomous agent or x402
route** in this build — every figure is pulled live from the gate address.

## THE GATE

```
contract   0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9
chain      Arc testnet · 5042002
source     contracts/FrameCut.sol  (Solidity ^0.8.20)
```

Look it up: https://testnet.arcscan.app/address/0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9

## SETUP — striking the lights locally

```
npm install
npm run dev      # http://localhost:3000
```

Bring a wallet (Rabby or MetaMask) holding Arc-testnet USDC; the site
offers to switch the network for you. Cut a frame, collect someone else's,
watch the totals move.

```
                                                          — Hugo
                                              that's the cut. print it.
```
