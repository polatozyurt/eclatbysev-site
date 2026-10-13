#!/usr/bin/env python3
"""Generates the static Éclat By Sev site into ../site from the files in ../content.

Content lives in JSON so the local admin panel (admin/server.py) can edit it:
  content/settings.json  home page copy, announcement bar, brand details, blog intro
  content/products.json  products (order = shop order)
  content/pages.json     simple pages (about, FAQ, contact, legal)
  content/posts.json     blog / journal posts
Uploaded images live in site/assets/uploads/.
"""
import html, json, pathlib, hashlib, re, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'site'
CONTENT = ROOT / 'content'
SITE = 'https://eclatbysev.com'


def load(name):
    return json.loads((CONTENT / name).read_text(encoding='utf-8'))


S = load('settings.json')
PRODUCTS_ALL = load('products.json')
SIMPLE = load('pages.json')
POSTS_ALL = load('posts.json')

PRODUCTS = [p for p in PRODUCTS_ALL if not p.get('hidden')]
BY = {p['handle']: p for p in PRODUCTS}
POSTS = sorted((p for p in POSTS_ALL if p.get('status') == 'published'),
               key=lambda p: (p.get('date') or '', p.get('slug')), reverse=True)

EMAIL = S['brand']['email']
IG = S['brand']['instagram']
IG_URL = f'https://instagram.com/{IG}'


def asset_v(name):
    """Short content hash so browsers fetch new CSS/JS right after each deploy."""
    return hashlib.sha1((OUT / 'assets' / name).read_bytes()).hexdigest()[:10]

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500'
         '&family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet">')

RING = ('<svg class="ph__ring" viewBox="0 0 220 220" fill="none" aria-hidden="true">'
        '<circle cx="110" cy="110" r="78" stroke="{c}" stroke-width="1"/>'
        '<circle cx="110" cy="110" r="64" stroke="{c}" stroke-width="1"/>'
        '<circle cx="110" cy="32" r="7" stroke="{c2}" stroke-width="1"/></svg>')
RING_L = RING.format(c='#C9B9A4', c2='#B49E83')
RING_D = RING.format(c='#4A3E35', c2='#4A3E35')
RING_DETAIL = ('<svg class="ph__ring" viewBox="0 0 220 220" fill="none" aria-hidden="true">'
               '<ellipse cx="110" cy="118" rx="84" ry="34" stroke="#BCA88E" stroke-width="1"/>'
               '<ellipse cx="110" cy="112" rx="84" ry="34" stroke="#C9B9A4" stroke-width="1"/>'
               '<circle cx="110" cy="80" r="9" stroke="#B08D57" stroke-width="1"/></svg>')

I = {
 'search': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
 'menu': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h12"/></svg>',
 'close': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 'mail': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/></svg>',
 'insta': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
 'arrow': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
 'star': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A2632" stroke-width="1.3" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
 'truck': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A2632" stroke-width="1.3" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
 'return': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A2632" stroke-width="1.3" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>',
 'clock': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A2632" stroke-width="1.3" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
 'gift': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A2632" stroke-width="1.4" aria-hidden="true"><rect x="4" y="9" width="16" height="11"/><path d="M4 13h16M12 9v11M12 9c-2-4-6-4-6-1s6 1 6 1c0 0 6 2 6-1s-4-3-6 1"/></svg>',
}

TONES = ['ph--1', 'ph--2', 'ph--3', 'ph--4']


def e(s): return html.escape(str(s), quote=True)
def t(s): return html.escape(str(s), quote=False)          # text content
def eur(n): return f'€{n:.2f}' if isinstance(n, float) and not n.is_integer() else f'€{int(n)}'


def rich(s):
    """Escape text, then turn *word* into the brand's italic accent."""
    return re.sub(r'\*(.+?)\*', r'<span class="it">\1</span>', t(s))


def lines(text, start=0, sep=' '):
    """One <span class="ln"> per line (for the line-by-line reveal). A line wrapped in *...* is italic."""
    out = []
    for ln in [l.strip() for l in str(text).split('\n') if l.strip()]:
        i = start + len(out)
        m = re.fullmatch(r'\*([^*]+)\*', ln)
        if m:
            out.append(f'<span class="ln it" style="--i:{i}">{t(m.group(1))}</span>')
        else:
            out.append(f'<span class="ln" style="--i:{i}">{rich(ln)}</span>')
    return sep.join(out), start + len(out)


def img(src, alt='', cls='ph__img', lazy=True):
    extra = ' loading="lazy" decoding="async"' if lazy else ''
    return f'<img class="{cls}" src="{e(src)}" alt="{e(alt)}"{extra}>'


def head(title, desc, path, extra='', bodycls='', image=''):
    url = SITE + path
    og_img = f'\n<meta property="og:image" content="{e(SITE + image)}">' if image else ''
    return f'''<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>document.documentElement.classList.replace('no-js','js')</script>
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">{og_img}
<meta name="theme-color" content="#F6F1EA">
<link rel="icon" type="image/png" href="/assets/favicon.png">
{FONTS}
<link rel="stylesheet" href="/assets/style.css?v={asset_v('style.css')}">
{extra}
</head>
<body class="{bodycls}">
<a class="skip" href="#main">Skip to content</a>'''


def announce():
    items = [t(x) for x in S['announce'] if x.strip()]
    if not items:
        return ''
    rest = ''.join(f'<span class="hide-sm">·</span><span class="hide-sm" style="opacity:1;padding:0">{x}</span>' for x in items[1:])
    return f'\n<div class="announce">{items[0]}{rest}</div>'


def header(active=''):
    def cur(k): return ' aria-current="page"' if k == active else ''
    blog = S['blog']['navLabel']
    blog_nav = f'\n      <a href="/blog/"{cur("blog")}>{t(blog)}</a>' if POSTS else ''
    blog_sub = f'\n    <a href="/blog/">{t(blog)}</a>' if POSTS else ''
    return f'''{announce()}
<header class="header" data-header>
  <div class="wrap header__in">
    <nav class="nav" aria-label="Main">
      <a href="/shop"{cur('shop')}>Shop</a>
      <a href="/#collections">Collections</a>
      <a href="/shop?category=gifts">Gifts</a>
      <a href="/about"{cur('about')}>Our story</a>{blog_nav}
    </nav>
    <button type="button" class="icon-btn menu-btn" data-menu-open aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu">{I['menu']}</button>
    <a class="logo" href="/" aria-label="Éclat By Sev, home"><img src="/assets/logo-ink.png" alt="Éclat By Sev" width="148" height="54"></a>
    <div class="header__tools">
      <a class="icon-btn hide-sm" href="{IG_URL}" aria-label="Instagram">{I['insta']}</a>
      <a class="icon-btn" href="/contact" aria-label="Contact">{I['mail']}</a>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" hidden role="dialog" aria-modal="true" aria-label="Menu">
  <div class="mobile-menu__top">
    <button type="button" class="icon-btn" data-menu-close aria-label="Close menu">{I['close']}</button>
    <img src="/assets/logo-ink.png" alt="" width="115" height="42">
    <span style="width:44px"></span>
  </div>
  <nav aria-label="Menu">
    <a href="/shop">Shop all <span aria-hidden="true" style="font-size:18px">→</span></a>
    <a href="/shop?category=rings">Rings</a>
    <a href="/shop?category=necklaces">Necklaces</a>
    <a href="/shop?category=earrings">Earrings</a>
    <a href="/shop?category=bracelets">Bracelets &amp; Anklets</a>
    <a href="/shop?category=sets">Sets &amp; gifts</a>
  </nav>
  <div class="mobile-menu__sub">
    <a href="/about">Our story</a>{blog_sub}
    <a href="/shipping-returns">Shipping &amp; returns</a>
    <a href="/faq">FAQ</a>
    <a href="/contact">Contact</a>
  </div>
  <div class="mobile-menu__foot">@{t(IG)}</div>
</div>
<main id="main">'''


def footer():
    blog = f'<a href="/blog/">{t(S["blog"]["navLabel"])}</a>' if POSTS else ''
    return f'''
</main>
<footer class="footer">
  <div class="wrap footer__in">
    <div class="footer__cols">
      <div class="footer__brand">
        <img src="/assets/logo-ivory.png" alt="Éclat By Sev" width="176" height="64" loading="lazy">
        <p>Handcrafted jewellery for the woman who shines. Designed by Sev, made in small batches.</p>
      </div>
      <nav aria-label="Shop"><h2>Shop</h2>
        <a href="/shop?category=new">New in</a><a href="/shop?category=rings">Rings</a><a href="/shop?category=necklaces">Necklaces</a><a href="/shop?category=earrings">Earrings</a><a href="/shop?category=bracelets">Bracelets</a>
      </nav>
      <nav aria-label="Help"><h2>Help</h2>
        <a href="/shipping-returns">Shipping &amp; returns</a><a href="/faq">FAQ</a><a href="/contact">Contact</a>
      </nav>
      <nav aria-label="About"><h2>About</h2>
        <a href="/about">Our story</a>{blog}<a href="{IG_URL}">Instagram</a><a href="mailto:{EMAIL}">{EMAIL}</a>
      </nav>
    </div>
    <div class="footer__bottom">
      <span>© {datetime.date.today().year} Éclat By Sev</span>
      <div class="footer__legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
    </div>
  </div>
</footer>
<nav class="dock" aria-label="Quick navigation">
  <a class="dock__item" href="/" data-dock="home"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 11l8-6 8 6v9h-5v-6h-6v6H4z"/></svg><span>Home</span></a>
  <a class="dock__item" href="/shop" data-dock="shop"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg><span>Shop</span></a>
  <a class="dock__item" href="/#collections" data-dock="collections"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg><span>Collections</span></a>
  <a class="dock__item" href="{IG_URL}" data-dock="insta"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg><span>Instagram</span></a>
</nav>
<script src="/assets/site.js?v={asset_v('site.js')}" defer></script>
</body>
</html>
'''


def price_html(p):
    if p.get('was'):
        return f'<span class="price price--sale"><b>{eur(p["price"])}</b><s>{eur(p["was"])}</s></span>'
    return f'<span class="price"><b>{eur(p["price"])}</b></span>'


ALT_TONE = {'ph--1': 'ph--3', 'ph--2': 'ph--4', 'ph--3': 'ph--1', 'ph--4': 'ph--2'}


def legacy_photo(handle, n):
    """Photo dropped by hand at assets/products/<handle>-<n>.jpg|webp (pre-admin convention)."""
    for ext in ('webp', 'jpg', 'jpeg', 'png'):
        if (OUT / 'assets' / 'products' / f'{handle}-{n}.{ext}').exists():
            return f'/assets/products/{handle}-{n}.{ext}'
    return None


def images(p):
    """[{src, alt}] for a product: uploaded images first, else hand-dropped files."""
    labels = p.get('photos') or []
    out = []
    for i, im in enumerate(p.get('images') or []):
        if im.get('src'):
            label = labels[i] if i < len(labels) else ''
            out.append({'src': im['src'], 'alt': im.get('alt') or (p['name'] + (' — ' + label if label and i else ''))})
    if not out:
        for n in (1, 2):
            src = legacy_photo(p['handle'], n)
            if src:
                label = labels[1] if len(labels) > 1 else ''
                out.append({'src': src, 'alt': p['name'] + (' — ' + label if n == 2 else '')})
    return out


def media(p, label):
    """Two stacked layers: primary + secondary angle that cross-fades on hover/press."""
    tone = p.get('tone') or 'ph--1'
    ims = images(p)
    if not ims:
        return (f'<span class="media__layer media__layer--1 {tone}" aria-hidden="false">{RING_L}</span>'
                f'<span class="media__layer media__layer--2 {ALT_TONE[tone]}" aria-hidden="true">{RING_DETAIL}</span>')
    layers = f'<span class="media__layer media__layer--1 {tone}" aria-hidden="false"><img src="{e(ims[0]["src"])}" alt="{e(ims[0]["alt"])}" loading="lazy" decoding="async"></span>'
    if len(ims) > 1:
        layers += f'<span class="media__layer media__layer--2 {ALT_TONE[tone]}" aria-hidden="true"><img src="{e(ims[1]["src"])}" alt="{e(ims[1]["alt"])}" loading="lazy" decoding="async"></span>'
    return layers


def card(p, i=0, shop=False):
    badge = f'<span class="badge">{e(p["badge"])}</span>' if p.get('badge') else ''
    attrs = f' data-cat="{p["cat"]}" data-tags="{p.get("tags", "")}" data-price="{p["price"]}" data-order="{i}"' if shop else ''
    labels = p.get('photos') or ['', '']
    return f'''<a class="card" href="/products/{p['handle']}" data-reveal{attrs}>
  <div class="media">{media(p, labels[1] if len(labels) > 1 else '')}{badge}</div>
  <div class="card__meta">
    <span class="card__type">{e(p['type'])}</span>
    <span class="card__row"><span class="card__name">{e(p['name'])}</span>{price_html(p)}</span>
    <span class="card__mat">{e(p['material'])}</span>
  </div>
</a>'''


def join_band():
    j = S['join']
    return f'''
<section class="join" aria-labelledby="join-h">
  <div class="join__in" data-reveal>
    <span class="eyebrow">{t(j['eyebrow'])}</span>
    <h2 class="h-section" id="join-h">{rich(j['title'])}</h2>
    <p class="lead">{rich(j['text'])}</p>
    <div class="join__cta">
      <a class="btn btn--ink" data-magnetic href="{IG_URL}">Follow @{t(IG)}</a>
      <a class="btn btn--line" data-magnetic href="mailto:{EMAIL}">Email us</a>
    </div>
  </div>
</section>'''


def write(rel, content):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def ph(tone, src, alt='', cls=''):
    """A placeholder block that shows an uploaded image when there is one."""
    inner = img(src, alt) if src else ''
    c = f'ph {tone}'.strip() + (f' {cls}' if cls else '')
    return f'<div class="{c}">{inner}</div>'


# ---------- Home ----------
def home():
    H, C, N, P, F, ST = S['hero'], S['collections'], S['newIn'], S['philosophy'], S['feature'], S['story']
    new = [BY[h] for h in N['products'] if h in BY]
    ld = {"@context": "https://schema.org", "@type": "Organization", "name": "Éclat By Sev", "url": SITE,
          "logo": SITE + "/assets/logo-ink.png", "email": EMAIL, "sameAs": [IG_URL]}
    body = head(S['seo']['title'], S['seo']['description'],
                '/', f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>',
                image=S['seo'].get('image') or H.get('image') or '')
    body += header()
    hero_src = H.get('image') or None
    if not hero_src:
        for ext in ('webp', 'jpg', 'jpeg'):
            if (OUT / 'assets' / f'hero.{ext}').exists():
                hero_src = f'/assets/hero.{ext}'; break
    hero_img = (f'<img class="hero__img" src="{e(hero_src)}" alt="{e(H["imageAlt"])}" fetchpriority="high">'
                if hero_src else f'<span class="hero__art" aria-hidden="true">{RING_L}</span>')
    spots = ''
    for n, h in enumerate(H.get('hotspots') or []):
        p = BY.get(h['product'])
        if not p:
            continue
        sid = {0: 'qv-ring', 1: 'qv-neck'}.get(n, f'qv-{n}')
        spots += f"""
      <div class="spot" style="--x:{h['x']}%;--y:{h['y']}%">
        <button type="button" class="spot__btn" aria-expanded="false" aria-controls="{sid}" aria-label="Quick view: {e(p['name'])}"><span class="spot__dot"></span></button>
        <div class="qv" id="{sid}" role="dialog" aria-label="{e(p['name'])}" hidden>
          <span class="qv__type">{e(p['type'])}</span>
          <b class="qv__name">{e(p['name'])}</b>
          <span class="qv__mat">{e(p['material'])}</span>
          <span class="qv__price">{eur(p['price'])}</span>
          <div class="qv__actions">
            <a class="btn btn--ink btn--sm" data-magnetic href="/products/{p['handle']}">View piece</a>
            <a class="qv__link" href="mailto:{EMAIL}?subject={e('Inquiry: ' + p['name'])}">Inquire</a>
          </div>
          <button type="button" class="qv__close" aria-label="Close quick view"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
      </div>"""
    h1, _ = lines(H['title'])
    icons = ['star', 'truck', 'return', 'clock']
    promise = '\n    '.join(f'<span class="promise__item">{I[icons[i % 4]]}{t(x)}</span>' for i, x in enumerate(S['promise']))

    tile_tone = ['ph--1', 'ph--4', 'ph--3', 'ph--3', 'ph--4']
    tile_d = ['', ' style="--d:.08s"', ' style="--d:.16s"', ' style="--d:.08s"', ' style="--d:.16s"']
    tiles = []
    for i, tl in enumerate(C['tiles']):
        inner = img(tl['image'], tl['name']) if tl.get('image') else (RING_L if i == 0 else '')
        big = ' tile--big' if i == 0 else ''
        tiles.append(f'<a class="tile{big}" href="/shop?category={e(tl["category"])}" data-reveal{tile_d[i % 5]}><div class="media">'
                     f'<span class="media__layer {tile_tone[i % 5]}">{inner}</span></div>'
                     f'<span class="tile__name"><span>{t(tl["name"])}</span><span>{i + 1:02d}</span></span></a>')
    tiles = '\n    '.join(tiles)

    quote, n = lines(P['quote'])
    pbody, _ = lines(P['body'], n)
    ed_inner = img(P['image'], '') if P.get('image') else RING_D

    fp = BY.get(F['product'])
    feature = ''
    if fp:
        f_inner = img(F['image'], fp['name']) if F.get('image') else RING_DETAIL
        feature = f'''
<section class="wrap section" aria-labelledby="set-h">
  <div class="feature" data-reveal>
    <div class="feature__text">
      <span class="eyebrow">{t(F['eyebrow'])}</span>
      <h2 class="h-section" id="set-h">{rich(F['title'])}</h2>
      <p class="lead" style="font-size:16px">{rich(F['text'])}</p>
      <div class="feature__buy">
        <span class="feature__price">{eur(fp['price'])}</span>
        <a class="btn btn--ink" data-magnetic href="/products/{fp['handle']}">{t(F['cta'])}</a>
      </div>
    </div>
    <div class="media feature__media"><span class="media__layer ph--3">{f_inner}</span></div>
  </div>
</section>
'''
    st_title, n = lines(ST['title'], 0, '<br>')
    st_body, _ = lines(ST['body'], n)
    st_imgs = (ST.get('images') or []) + ['', '']
    story_media = ph('ph--1', st_imgs[0]) + ph('', st_imgs[1])
    ig_imgs = (S['instagram'].get('images') or []) + [''] * 6
    insta = ''.join(ph(TONES[i % 4], ig_imgs[i]) for i in range(6))

    body += f'''
<section class="hero">
  <div class="hero__media" data-reveal="fade">
    {hero_img}{spots}
    <span class="hero__hint" aria-hidden="true">Explore the pieces</span>
  </div>
  <div class="hero__text">
    <span class="eyebrow eyebrow--rule" data-reveal>{t(H['eyebrow'])}</span>
    <h1 class="h-display lines" data-reveal>{h1}</h1>
    <p class="lead" data-reveal style="--d:.25s">{rich(H['lead'])}</p>
    <div class="hero__cta" data-reveal style="--d:.35s">
      <a class="btn btn--ink" data-magnetic href="/shop">{t(H['cta'])} {I['arrow']}</a>
      <a class="link-caps" href="/about">Meet Sev</a>
    </div>
  </div>
</section>

<section class="promise" aria-label="Our promise">
  <div class="wrap promise__in">
    {promise}
  </div>
</section>

<section class="wrap section" id="collections" aria-labelledby="col-h">
  <div class="head" data-reveal>
    <div><span class="eyebrow">{t(C['eyebrow'])}</span><h2 class="h-section" id="col-h">{rich(C['title'])}</h2></div>
    <a class="link-caps" href="/shop">View all</a>
  </div>
  <div class="cols">
    {tiles}
  </div>
</section>

<section class="wrap section section--pb" aria-labelledby="new-h">
  <div class="head" data-reveal>
    <div><span class="eyebrow">{t(N['eyebrow'])}</span><h2 class="h-section" id="new-h">{rich(N['title'])}</h2></div>
    <a class="link-caps" href="/shop?category=new">Shop new in</a>
  </div>
  <div class="grid grid--4">
    {''.join(card(p) for p in new)}
  </div>
</section>

<section class="editorial" aria-labelledby="phil-h">
  <div class="wrap editorial__in">
    <div class="ph ph--night editorial__media" data-reveal="fade">{ed_inner}</div>
    <div class="editorial__text">
      <span class="eyebrow" id="phil-h" data-reveal>{t(P['eyebrow'])}</span>
      <p class="editorial__quote lines" data-reveal>{quote}</p>
      <p class="body lines" data-reveal>{pbody}</p>
      <a class="btn btn--line" data-magnetic href="/about" data-reveal style="--d:.5s">Read our story</a>
    </div>
  </div>
</section>
{feature}
<section class="wrap section section--pb story" id="story" aria-labelledby="story-h">
  <div class="story__text">
    <span class="eyebrow" data-reveal>{t(ST['eyebrow'])}</span>
    <h2 class="h-section lines" id="story-h" data-reveal>{st_title}</h2>
    <p class="prose lines" data-reveal>{st_body}</p>
    <div class="story__def" data-reveal style="--d:.3s">
      <span class="it">{t(ST['word'])}</span>
      <p class="prose">{rich(ST['definition'])}</p>
    </div>
    <a class="link-caps" href="/about" data-reveal style="--d:.4s">Meet Sev</a>
  </div>
  <div class="story__media" data-reveal="fade">{story_media}</div>
</section>

<section class="wrap section--pb insta" aria-label="Instagram">
  <div class="insta__head" data-reveal>
    <span class="insta__handle">@{t(IG)}</span>
    <a class="link-caps" href="{IG_URL}">Follow on Instagram</a>
  </div>
  <div class="insta__grid" data-reveal>
    {insta}
  </div>
</section>
''' + join_band() + footer()
    write('index.html', body)


# ---------- Shop ----------
def shop():
    cats = [('all', 'All'), ('new', 'New in'), ('rings', 'Rings'), ('necklaces', 'Necklaces'), ('earrings', 'Earrings'), ('bracelets', 'Bracelets'), ('sets', 'Sets'), ('gifts', 'Gifts')]
    chips = ''.join(f'<button type="button" class="chip" data-filter="{k}" aria-pressed="{"true" if k=="all" else "false"}">{v}</button>' for k, v in cats)
    body = head('Shop all — Éclat By Sev', 'Rings, necklaces, earrings, bracelets and gift sets by Éclat By Sev. Handcrafted in small batches.', '/shop')
    body += header('shop')
    body += f'''
<section class="wrap page-head">
  <div>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>Shop</nav>
    <h1 class="h-display" style="font-size:clamp(44px,5.6vw,76px)" id="shop-heading">Shop all</h1>
  </div>
  <p>Every piece is designed by Sev and made in small batches. Water resistant, nickel free, ready to be worn every day.</p>
</section>
<div class="filters">
  <div class="wrap filters__in">
    <div class="chips" role="group" aria-label="Filter by category">{chips}</div>
    <div class="filters__meta">
      <span id="shop-count" aria-live="polite">{len(PRODUCTS)} {"piece" if len(PRODUCTS) == 1 else "pieces"}</span>
      <label>Sort <select id="sort"><option value="featured">Featured</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option></select></label>
    </div>
  </div>
</div>
<section class="wrap section--pb" style="padding-top:44px" aria-label="Products">
  <div class="grid" id="shop-grid">
    {''.join(card(p, i, True) for i, p in enumerate(PRODUCTS))}
  </div>
</section>
<section class="care" aria-label="Care">
  <div class="wrap care__in">
    <div><b>Water resistant</b><span>Made to be worn every day.</span></div>
    <div><b>Nickel free</b><span>Gentle on sensitive skin.</span></div>
    <div><b>Gift ready</b><span>Every order arrives in our signature box.</span></div>
  </div>
</section>''' + footer()
    write('shop.html', body)


# ---------- Products ----------
def product(p):
    ims = images(p)
    badge = f'<span class="badge">{e(p["badge"])}</span>' if p.get('badge') else ''
    if ims:
        thumbs = ''.join(
            f'<button type="button" class="thumb ph {TONES[i % 4]}" data-thumb="{TONES[0]}" data-src="{e(im["src"])}" data-alt="{e(im["alt"])}" '
            f'aria-pressed="{"true" if i==0 else "false"}" aria-label="Photo {i+1}: {e(im["alt"])}">{img(im["src"], "")}</button>'
            for i, im in enumerate(ims)) if len(ims) > 1 else ''
        main_img = f'<img class="ph__img" id="gallery-img" src="{e(ims[0]["src"])}" alt="{e(ims[0]["alt"])}">'
        main = f'<div class="ph gallery__main {TONES[0]}" id="gallery-main">{main_img}{badge}</div>'
    else:
        thumbs = ''.join(f'<button type="button" class="thumb ph {TONES[i]}" data-thumb="{TONES[i]}" aria-pressed="{"true" if i==0 else "false"}" aria-label="Photo {i+1}: {e(lb)}"></button>' for i, lb in enumerate((p.get('photos') or [])[:4]))
        main = f'<div class="ph gallery__main {TONES[0]}" id="gallery-main">{RING_L}{badge}</div>'
    was = f'<s>{eur(p["was"])}</s>' if p.get('was') else ''
    tags = ''.join(f'<span>{e(x)}</span>' for x in p.get('features') or [])
    sizes = ''
    if p.get('sizes'):
        btns = ''.join(f'<button type="button" class="size" data-size="{e(s)}" aria-pressed="false">{e(s)}</button>' for s in p['sizes'])
        sizes = f'''<div class="opt">
  <div class="opt__head"><span class="opt__label">Ring size <span id="size-label">· choose your size</span></span><a href="/faq#ring-size" style="font-size:13px;text-underline-offset:4px">Size guide</a></div>
  <div class="sizes" role="group" aria-label="Ring size">{btns}</div>
</div>'''
    order_label = 'Select a size' if p.get('sizes') else 'Order by email'
    order_btn = f'<a class="btn btn--ink btn--block" data-order="{e(p["name"])}" href="mailto:{EMAIL}">{order_label}</a>'

    def pair(q):
        qi = images(q)
        inner = img(qi[0]['src'], '') if qi else ''
        return f'''<a class="pair" href="/products/{q['handle']}"><span class="ph {q.get('tone') or 'ph--1'}">{inner}</span><span><small>{e(q['type'])}</small><b>{e(q['name'])}</b><span class="p">{eur(q['price'])}</span></span></a>'''
    pairs = ''.join(pair(BY[h]) for h in p.get('pairs') or [] if h in BY and h != p['handle'])
    ld = {"@context": "https://schema.org", "@type": "Product", "name": p['name'], "description": p['desc'],
          "brand": {"@type": "Brand", "name": "Éclat By Sev"}, "material": p['material'],
          "offers": {"@type": "Offer", "price": str(p['price']), "priceCurrency": "EUR", "url": f"{SITE}/products/{p['handle']}"}}
    if ims:
        ld['image'] = [SITE + im['src'] for im in ims]
    body = head(f"{p['name']} — Éclat By Sev", p['desc'][:155], f"/products/{p['handle']}",
                f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>', bodycls='page-product',
                image=ims[0]['src'] if ims else '')
    body += header('shop')
    pairs_section = f'''
<section class="pairs" aria-labelledby="pairs-h">
  <div class="wrap pairs__in">
    <h2 class="h-section" style="font-size:clamp(30px,3.2vw,42px)" id="pairs-h">Pairs <span class="it">beautifully</span> with</h2>
    <div class="pairs__row">{pairs}</div>
  </div>
</section>''' if pairs else ''
    body += f'''
<div class="wrap crumbs-wrap" style="padding-top:28px;padding-bottom:28px">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop?category={p['cat']}">{e(p['type'])}</a><span>/</span>{e(p['name'])}</nav>
</div>
<section class="wrap pdp">
  <div class="gallery">
    <div class="thumbs" role="group" aria-label="Product photos">{thumbs}</div>
    {main}
  </div>
  <div class="pdp__info">
    <div style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">{e(p['type'])}</span>
      <h1 class="pdp__title">{e(p['name'])}</h1>
      <div class="pdp__price"><b>{eur(p['price'])}</b>{was}<small>VAT included</small></div>
    </div>
    <p class="prose" style="margin:0">{e(p['desc'])}</p>
    <div class="tags">{tags}</div>
    {sizes}
    <div class="buy">
      {order_btn}
      <p class="buy__note">Online checkout opens soon. Until then, email us your order and we'll send a secure payment link.</p>
    </div>
    <div class="perks">
      <span>{I['clock'].replace('22','18')}Made to order, ships in 3–5 days</span>
      <span>{I['return'].replace('22','18')}30-day easy returns</span>
      <span>{I['gift']}Arrives in our signature gift box</span>
    </div>
    <div class="acc">
      <details open><summary>Details</summary><p>{e(p['details'])}</p></details>
      <details><summary>Care</summary><p>Wipe gently with a soft cloth after wear. Avoid direct contact with perfume and harsh chemicals, and store each piece in its pouch or box.</p></details>
      <details><summary>Shipping &amp; returns</summary><p>Ships within the Netherlands in 3–5 business days. Free standard shipping over €75. Returns accepted within 30 days for unworn items in original packaging. <a href="/shipping-returns">Read more</a></p></details>
    </div>
  </div>
</section>
<div class="sticky-buy">{order_btn}</div>{pairs_section}''' + footer()
    write(f"products/{p['handle']}.html", body)


# ---------- Simple pages ----------
def simple(slug, title, desc, eyebrow, h1, intro, inner, active='', **_):
    body = head(f'{title} — Éclat By Sev', desc, f'/{slug}')
    body += header(active)
    intro_html = f'<p>{intro}</p>' if intro else ''  # intro may hold simple HTML
    body += f'''
<article class="simple">
  <div class="simple__hero">
    <span class="eyebrow">{t(eyebrow)}</span>
    <h1>{rich(h1)}</h1>
    {intro_html}
  </div>
  {inner}
</article>''' + footer()
    write(f'{slug}.html', body)


# ---------- Blog ----------
def nice_date(d):
    try:
        x = datetime.date.fromisoformat(d)
        return f'{x.day} {x:%B %Y}'
    except (ValueError, TypeError):
        return d or ''


def post_card(p, i):
    cover = p.get('cover') or {}
    media_inner = (f'<span class="media__layer ph--{i % 4 + 1}">{img(cover["src"], cover.get("alt") or p["title"], "")}</span>'
                   if cover.get('src') else f'<span class="media__layer ph--{i % 4 + 1}">{RING_L}</span>')
    return f'''<a class="post-card" href="/blog/{p['slug']}" data-reveal>
  <div class="media post-card__media">{media_inner}</div>
  <div class="post-card__meta">
    <time datetime="{e(p.get('date', ''))}">{t(nice_date(p.get('date')))}</time>
    <h2 class="post-card__title">{t(p['title'])}</h2>
    {f'<p>{t(p["excerpt"])}</p>' if p.get('excerpt') else ''}
    <span class="link-caps">Read</span>
  </div>
</a>'''


def blog_index():
    B = S['blog']
    body = head(f'{B["navLabel"]} — Éclat By Sev', B['description'], '/blog/')
    body += header('blog')
    body += f'''
<section class="wrap page-head">
  <div>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>{t(B['navLabel'])}</nav>
    <h1 class="h-display" style="font-size:clamp(44px,5.6vw,76px)">{rich(B['title'])}</h1>
  </div>
  <p>{rich(B['intro'])}</p>
</section>
<section class="wrap section--pb" style="padding-top:44px" aria-label="Posts">
  <div class="post-grid">
    {''.join(post_card(p, i) for i, p in enumerate(POSTS))}
  </div>
</section>''' + join_band() + footer()
    write('blog/index.html', body)


def blog_post(p, i):
    cover = p.get('cover') or {}
    url = f"/blog/{p['slug']}"
    desc = p.get('seoDescription') or p.get('excerpt') or S['blog']['description']
    ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": p['title'], "datePublished": p.get('date', ''),
          "author": {"@type": "Person", "name": p.get('author') or 'Sev'}, "publisher": {"@type": "Organization", "name": "Éclat By Sev"},
          "mainEntityOfPage": SITE + url, "description": desc}
    if cover.get('src'):
        ld['image'] = SITE + cover['src']
    body = head(f"{p['title']} — Éclat By Sev", desc[:160], url,
                f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>', image=cover.get('src', ''))
    body += header('blog')
    cover_html = (f'<figure class="post__cover">{img(cover["src"], cover.get("alt", ""), "", lazy=False)}</figure>'
                  if cover.get('src') else '')
    others = [q for q in POSTS if q['slug'] != p['slug']][:2]
    more = (f'''
<section class="wrap section--pb post-more" aria-labelledby="more-h">
  <div class="head"><div><h2 class="h-section" id="more-h">Keep <span class="it">reading</span></h2></div><a class="link-caps" href="/blog/">All posts</a></div>
  <div class="post-grid">{''.join(post_card(q, j) for j, q in enumerate(others))}</div>
</section>''' if others else '')
    body += f'''
<article class="simple post">
  <div class="simple__hero">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/blog/">{t(S['blog']['navLabel'])}</a></nav>
    <span class="eyebrow"><time datetime="{e(p.get('date', ''))}">{t(nice_date(p.get('date')))}</time>{(' · ' + t(p['author'])) if p.get('author') else ''}</span>
    <h1>{rich(p['title'])}</h1>
    {f'<p>{t(p["excerpt"])}</p>' if p.get('excerpt') else ''}
  </div>
  {cover_html}
  <div class="post__body">
  {p.get('body', '')}
  </div>
</article>{more}''' + footer()
    write(f"blog/{p['slug']}.html", body)


def clean_stale(folder, keep):
    d = OUT / folder
    if d.is_dir():
        for f in d.glob('*.html'):
            if f.name not in keep:
                f.unlink()


def build():
    home(); shop()
    for p in PRODUCTS: product(p)
    clean_stale('products', {f"{p['handle']}.html" for p in PRODUCTS})
    for pg in SIMPLE: simple(**pg)
    if POSTS:
        blog_index()
        for i, p in enumerate(POSTS): blog_post(p, i)
        clean_stale('blog', {'index.html'} | {f"{p['slug']}.html" for p in POSTS})
    else:
        clean_stale('blog', set())
    # 404
    body = head('Page not found — Éclat By Sev', 'This page could not be found.', '/404') + header()
    body += '''
<article class="simple" style="text-align:center">
  <div class="simple__hero" style="align-items:center;border:0">
    <span class="eyebrow">404</span>
    <h1>This piece has <span class="it">wandered off.</span></h1>
    <p>The page you're looking for doesn't exist.</p>
    <a class="btn btn--ink" data-magnetic href="/shop" style="margin-top:12px">Back to the shop</a>
  </div>
</article>''' + footer()
    write('404.html', body)
    # sitemap + robots + vercel config
    urls = ['/', '/shop', '/about', '/faq', '/contact', '/shipping-returns', '/privacy', '/terms'] + [f"/products/{p['handle']}" for p in PRODUCTS]
    urls += [f"/{pg['slug']}" for pg in SIMPLE if f"/{pg['slug']}" not in urls]
    if POSTS:
        urls += ['/blog/'] + [f"/blog/{p['slug']}" for p in POSTS]
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE}{u}</loc></url>\n' for u in urls) + '</urlset>\n')
    write('robots.txt', f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
    write('vercel.json', json.dumps({"cleanUrls": True, "trailingSlash": False,
        "headers": [{"source": "/assets/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=604800"}]},
                    {"source": "/(.*)", "headers": [{"key": "X-Content-Type-Options", "value": "nosniff"},
                                                     {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
                                                     {"key": "X-Frame-Options", "value": "SAMEORIGIN"}]}]}, indent=2))


if __name__ == '__main__':
    build()
    print('ok')
