# Éclat By Sev — eclatbysev.com

Static storefront, deployed by Netlify on every push to `main`.

- `site/` — the published site (HTML, CSS, JS, images)
- `build/build.py` — generates the pages in `site/` from product data (`python3 build/build.py`)
- Product photos: drop `site/assets/products/<handle>-1.jpg` (main) and `-2.jpg` (hover angle), and `site/assets/hero.jpg`, then rebuild.
