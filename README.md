# Equity Launch GitHub Pages frontend

Static Vite/React frontend for the Equity Launch Railway API. It uses hash-based routes, so markets such as `#/token/example` work correctly on GitHub Pages without server rewrites.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The default API is `https://launchpad-backend-production-63dc.up.railway.app`. Set `VITE_API_URL` only when you want to override it.

## GitHub Pages deployment

### Recommended: GitHub Actions

1. Create a new GitHub repository and upload this folder.
2. Open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Push to `main`. The included workflow builds and deploys the site.
4. Add the final GitHub Pages origin to Railway's `FRONTEND_URLS` variable.

### Alternative: deploy from a branch

1. Run `npm install` and `npm run build`.
2. Commit the generated `docs` folder.
3. Open **Settings → Pages**, choose **Deploy from a branch**, select `main`, and select `/docs`.
4. Add the final GitHub Pages origin to Railway's `FRONTEND_URLS` variable.

The generated `docs/index.html` references compiled JavaScript in `docs/assets`. Do not publish the unbuilt Vite source by itself. A request for `/src/main.tsx` means GitHub Pages was serving the source `index.html` instead of the production build. The root page included in this package also redirects branch deployments to `docs/` as a fallback.

After changing `public/config.js`, run `npm run build` again so the new value is copied to `docs/config.js`.

## Network switching

The frontend does not contain its own network toggle variable. It reads `/api/config` from Railway, meaning `USE_TESTNET=true` on the backend selects devnet and `USE_TESTNET=false` selects mainnet across the whole platform.

## Wallets

Phantom connects through its browser provider. MetaMask connects through MetaMask's Solana SDK. Message signing is implemented for both. The modal includes proper wallet icons, detection state, installation link, and a blurred backdrop.

Real launch and trade submission remains locked until the selected network has a deployed launchpad program ID and the transaction adapter is wired to that audited deployment.
