# Equity Launch GitHub Pages frontend

Static Vite/React frontend for the Equity Launch Railway API. It uses hash-based routes, so markets such as `#/token/example` work correctly on GitHub Pages without server rewrites.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` to your Railway backend URL with no trailing slash.

## GitHub Pages deployment

1. Create a new GitHub repository and upload this folder.
2. Open repository **Settings → Secrets and variables → Actions → Variables**.
3. Create a repository variable named `VITE_API_URL` containing your Railway backend URL.
4. Open **Settings → Pages** and choose **GitHub Actions** as the source.
5. Push to `main`. The included workflow builds and deploys the site.
6. Add the final GitHub Pages origin to Railway's `FRONTEND_URLS` variable.

## Network switching

The frontend does not contain its own network toggle variable. It reads `/api/config` from Railway, meaning `USE_TESTNET=true` on the backend selects devnet and `USE_TESTNET=false` selects mainnet across the whole platform.

## Wallets

Phantom connects through its browser provider. MetaMask connects through MetaMask's Solana SDK. Message signing is implemented for both. The modal includes proper wallet icons, detection state, installation link, and a blurred backdrop.

Real launch and trade submission remains locked until the selected network has a deployed launchpad program ID and the transaction adapter is wired to that audited deployment.
 
