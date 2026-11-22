# Waitlist V2 Draft

This folder is an independent draft project. Changes made here do not affect the original prototype in the parent folder.

The main V2 workspace starts at:

- `wishlist.html`

Supporting prototype pages:

- `history.html`
- `review.html`
- `ultimate.html`
- `account.html`

Shared pieces:

- `partials/header.html`
- `partials/footer.html`
- `assets/styles.css`
- `assets/mock-data.js`
- `assets/app.js`

## Run locally

Use the included local server so the product-link preview endpoint is available.

From this folder:

```bash
npm start
```

Then open:

```text
http://localhost:8000/wishlist.html
```

## Local data

All pages now start from one versioned local data store in `assets/data-store.js`.
The store uses the browser's `localStorage` key `waitlist-v2-data` and exposes
save, update, reset, export, and import methods through `window.WAITLIST_STORE`.

The next implementation step is connecting each user action to this store.

## Install as a PWA

The draft includes a web app manifest, standalone display mode, app icons, and
a service worker for the local application shell. PWA installation requires an
HTTPS deployment (or `localhost` during development).

## Product link preview

The local server exposes `POST /api/product-preview`. It reads public product
pages without storing the submitted URL, preferring JSON-LD product data and
then Open Graph metadata. Some retailers may block automated access, so the
add form always keeps manual editing available.

## Deploy on Render

This project includes `render.yaml` for a free Render Node web service. Deploy
this folder as the repository root, then connect a custom domain in Render.
Render supplies HTTPS automatically. The product-preview endpoint includes a
basic per-client rate limit and blocks private-network destinations.

Data remains device-local after deployment. Before moving from localhost to a
production domain, export existing data from Account and import it on the new
domain.
