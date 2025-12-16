# one-thing

A small React/Vite experience to capture your “One Thing”, set where and how long you’ll do it, then run a focused timer with an animated hourglass with sand particles!

## Getting started

```
npm install
npm run dev
```

Then open the printed local URL to try it.

## Security notes for deployment

- This app doesn’t send your inputs anywhere, but it does render your `Title`/`Location` back onto the page; `src/App.jsx` enforces basic length limits and strips control characters to reduce abuse.
- Serve with common security headers (CSP, `nosniff`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). If you deploy on Netlify, `public/_headers` applies a reasonable baseline.
