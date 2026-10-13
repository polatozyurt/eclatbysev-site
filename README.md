# Éclat By Sev — eclatbysev.com

Static storefront, deployed by Netlify on every push to `main`.

- `content/` — all site content as JSON (edited through the admin panel)
  - `settings.json` home page copy, announcement bar, contact details, blog intro
  - `products.json` products, in shop order
  - `pages.json` about, FAQ, contact, shipping & legal pages
  - `posts.json` blog (Journal) posts
- `site/` — the published site, generated from `content/` (don't edit the HTML by hand)
- `site/assets/uploads/` — images uploaded through the admin panel
- `build/build.py` — generates `site/` from `content/` (`python3 build/build.py`)
- `admin/` — local admin panel

## Admin panel

Mac: double-click **`admin/Eclat Admin.command`**
(first time: right-click → Open, because macOS asks about files downloaded from the internet).

Or from a terminal in the repo folder:

```
python3 admin/server.py
```

It opens http://localhost:8787 in the browser. Only Python 3 is needed, nothing to install.

- **Ürünler** — add/edit/hide/delete products, upload and reorder photos (first photo = main,
  second = hover angle), drag cards to change the shop order.
- **Ana sayfa** — every text and image on the home page, hero photo with clickable product dots.
- **Sayfalar** — about, FAQ, contact, shipping and legal pages.
- **Blog** — write posts with a rich-text editor, cover image, drafts.
- **Medya** — all uploaded images; delete unused ones.

**Kaydet** saves to this computer and rebuilds the preview at http://localhost:8788.
**Yayınla** commits and pushes to GitHub → Netlify updates eclatbysev.com in a few minutes.
Publishing only goes live from the `main` branch. Close the panel with Ctrl+C in its terminal window.

Uploaded photos are resized to max 2000px and converted to WebP in the browser before upload.
In text fields marked so, `*word*` becomes the brand's italic accent and each line is a separate line on the site.
