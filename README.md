# AQUA GitHub Pages frontend

AQUA is a static Vite and React frontend for the Railway launchpad API. It uses hash routes, so pages such as `#/create`, `#/rewards`, and `#/token/example` work on GitHub Pages without server rewrites.

## Local development

```bash
npm install
npm run dev
```

The default API is `https://launchpad-backend-production-63dc.up.railway.app`. Set `VITE_API_URL` only when you need a different backend.

## GitHub Pages deployment

### GitHub Actions

1. Upload this folder to the `launchpad-frontend` repository.
2. Open **Settings → Pages** and select **GitHub Actions** as the source.
3. Push to `main`.
4. Add the final GitHub Pages origin to Railway's `FRONTEND_URLS` variable.

### Deploy from a branch

1. Run `npm install` and `npm run build`.
2. Commit the generated `docs` folder.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**, choose `main`, then choose `/docs`.

The generated `docs/index.html` references compiled production assets. Do not publish the source `index.html` by itself.

## Runtime API configuration

The public API origin can be changed without editing application code:

```js
window.AQUA_CONFIG = {
  API_URL: "https://launchpad-backend-production-63dc.up.railway.app",
  X_URL: "https://x.com/your-aqua-handle",
};
```

Replace `X_URL` with AQUA's real X profile. After changing `public/config.js`, run `npm run build` so Vite copies it into `docs/config.js`.

## Network switching

The frontend reads its network from `/api/config`. Set `USE_TESTNET=true` on Railway for Devnet or `USE_TESTNET=false` for the live network.

## Wallet support

Phantom connects through its browser provider. MetaMask connects through MetaMask Solana account support. A standard launch uses four wallet approvals: token creation, Orca pool creation, liquidity, and permanent locking. Each transaction is simulated after its prerequisites confirm on-chain. Phantom reviews the complete transaction before AQUA collects the remaining account signatures; the backend verifies every signature and the approved message. After AQUA accepts the final signed lock, its durable relay completes the launch independently of the browser. An optional first buy is a separate post-launch transaction.

New launches commit the full fixed token supply to the one-sided, permanently
locked Orca position. There is no separate AQUA supply-reserve allocation.

New markets display `Pending indexing` until the built-in backend indexer records on-chain metrics. Market charts use stored backend snapshots and never generate sample price movement.

The launch wizard supports two real Orca market modes: `launch token / SOL` and `launch token / selected xStock`. The selected xStock is always recorded separately as the immutable holder-reward asset. A two-token Whirlpool cannot contain SOL and an xStock at the same time.

