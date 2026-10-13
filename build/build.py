#!/usr/bin/env python3
"""Generates the static Éclat By Sev site into ../eclat-site."""
import os, html, json, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'site'
SITE = 'https://eclatbysev.com'
EMAIL = 'info@eclatbysev.com'

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

PRODUCTS = [
 dict(handle='lumiere-stacking-ring', name='Lumière Stacking Ring', type='Ring', cat='rings', tags='new bestsellers',
      material='18k gold plated · stainless steel', price=48, was=None, badge='New', tone='ph--1',
      features=['Water resistant', 'Tarnish free', 'Nickel free'], sizes=['50', '52', '54', '56', '58'],
      desc="Delicate, stackable, and designed to be worn every single day. The Lumière ring pairs beautifully on its own or layered with other pieces from the Éclat collection. Crafted in 18k gold plated stainless steel — it won't tarnish, won't irritate, and won't let you down.",
      details='18k gold plated stainless steel. Designed to stack with other Éclat rings.',
      photos=['ring on its own', 'stacked on the hand', 'side profile', 'in the gift box'],
      pairs=['douceur-chain-necklace', 'lumiere-douceur-set', 'petale-drop-earrings']),
 dict(handle='douceur-chain-necklace', name='Douceur Chain Necklace', type='Necklace', cat='necklaces', tags='new bestsellers gifts',
      material='18k gold plated · 45 cm chain', price=65, was=None, badge='New', tone='ph--2',
      features=['Water resistant', 'Gift ready'], sizes=None,
      desc="A whisper of a necklace — fine chain, crescent moon pendant. The Douceur sits at the collarbone and adds just the right amount of light. Order it alone, or layer it with the Lumière ring for a full Éclat look. Comes in our signature gift box, ready to give.",
      details='18k gold plated. 45 cm chain with crescent moon pendant.',
      photos=['necklace on the collarbone', 'pendant detail', 'chain flat lay', 'in the gift box'],
      pairs=['lumiere-stacking-ring', 'lumiere-douceur-set', 'velours-bangle']),
 dict(handle='petale-drop-earrings', name='Pétale Drop Earrings', type='Earrings', cat='earrings', tags='',
      material='Sterling silver 925', price=52, was=None, badge='', tone='ph--3',
      features=['Hypoallergenic', 'Nickel free'], sizes=None,
      desc="Three petals, one elegant drop. The Pétale earrings frame the face with softness and movement — light enough to wear all day, beautiful enough to wear every night. Made in genuine 925 sterling silver, they're hypoallergenic and safe for even the most sensitive ears.",
      details='Genuine 925 sterling silver. Sold as a pair.',
      photos=['earrings worn', 'petal detail', 'pair flat lay', 'in the gift box'],
      pairs=['douceur-chain-necklace', 'lumiere-stacking-ring', 'velours-bangle']),
 dict(handle='velours-bangle', name='Velours Bangle', type='Bracelet', cat='bracelets', tags='',
      material='18k gold plated · adjustable', price=72, was=90, badge='Sale', tone='ph--4',
      features=['Water resistant', 'Small batch', 'Adjustable'], sizes=None,
      desc="Thick, bold, and quietly luxurious. The Velours bangle makes a statement without trying. The knurled texture catches the light beautifully, and the adjustable opening means it fits most wrist sizes comfortably. A piece you'll reach for every morning.",
      details='18k gold plated with a knurled texture. Adjustable opening fits most wrists.',
      photos=['bangle on the wrist', 'texture detail', 'side profile', 'in the gift box'],
      pairs=['lumiere-stacking-ring', 'douceur-chain-necklace', 'petale-drop-earrings']),
 dict(handle='lumiere-douceur-set', name='Lumière & Douceur Set', type='Set', cat='sets', tags='new gifts',
      material='Ring and necklace · gift boxed', price=105, was=None, badge='Gift', tone='ph--1',
      features=['Gift ready', 'Water resistant'], sizes=['50', '52', '54', '56', '58'],
      desc="The Lumière ring and the Douceur necklace — two of our most-loved pieces, together in one box. Designed to be worn as a set or separately, they share the same refined finish and quiet confidence. Comes beautifully packaged, ready to give or to keep.",
      details='Lumière Stacking Ring and Douceur Chain Necklace, 18k gold plated, in one gift box.',
      photos=['the set together', 'worn together', 'ring detail', 'in the gift box'],
      pairs=['lumiere-stacking-ring', 'douceur-chain-necklace', 'velours-bangle']),
]
BY = {p['handle']: p for p in PRODUCTS}

def e(s): return html.escape(s, quote=True)
def eur(n): return f'€{n}'

def head(title, desc, path, extra='', bodycls=''):
    url = SITE + path
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
<meta property="og:url" content="{url}">
<meta name="theme-color" content="#F6F1EA">
<link rel="icon" type="image/png" href="/assets/favicon.png">
{FONTS}
<link rel="stylesheet" href="/assets/style.css">
{extra}
</head>
<body class="{bodycls}">
<a class="skip" href="#main">Skip to content</a>'''

def header(active=''):
    def cur(k): return ' aria-current="page"' if k == active else ''
    return f'''
<div class="announce">Free shipping over €75<span class="hide-sm">·</span><span class="hide-sm" style="opacity:1;padding:0">30-day returns</span><span class="hide-sm">·</span><span class="hide-sm" style="opacity:1;padding:0">Handcrafted in small batches</span></div>
<header class="header" data-header>
  <div class="wrap header__in">
    <nav class="nav" aria-label="Main">
      <a href="/shop"{cur('shop')}>Shop</a>
      <a href="/#collections">Collections</a>
      <a href="/shop?category=gifts">Gifts</a>
      <a href="/about"{cur('about')}>Our story</a>
    </nav>
    <button type="button" class="icon-btn menu-btn" data-menu-open aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu">{I['menu']}</button>
    <a class="logo" href="/" aria-label="Éclat By Sev, home"><img src="/assets/logo-ink.png" alt="Éclat By Sev" width="148" height="54"></a>
    <div class="header__tools">
      <a class="icon-btn hide-sm" href="https://instagram.com/eclatbysev" aria-label="Instagram">{I['insta']}</a>
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
    <a href="/about">Our story</a>
    <a href="/shipping-returns">Shipping &amp; returns</a>
    <a href="/faq">FAQ</a>
    <a href="/contact">Contact</a>
  </div>
  <div class="mobile-menu__foot">@eclatbysev</div>
</div>
<main id="main">'''

FOOTER = f'''
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
        <a href="/about">Our story</a><a href="https://instagram.com/eclatbysev">Instagram</a><a href="mailto:{EMAIL}">{EMAIL}</a>
      </nav>
    </div>
    <div class="footer__bottom">
      <span>© 2026 Éclat By Sev</span>
      <div class="footer__legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
    </div>
  </div>
</footer>
<nav class="dock" aria-label="Quick navigation">
  <a class="dock__item" href="/" data-dock="home"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 11l8-6 8 6v9h-5v-6h-6v6H4z"/></svg><span>Home</span></a>
  <a class="dock__item" href="/shop" data-dock="shop"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg><span>Shop</span></a>
  <a class="dock__item" href="/#collections" data-dock="collections"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg><span>Collections</span></a>
  <a class="dock__item" href="https://instagram.com/eclatbysev" data-dock="insta"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg><span>Instagram</span></a>
</nav>
<script src="/assets/site.js" defer></script>
</body>
</html>
'''

def price_html(p):
    if p['was']:
        return f'<span class="price price--sale"><b>{eur(p["price"])}</b><s>{eur(p["was"])}</s></span>'
    return f'<span class="price"><b>{eur(p["price"])}</b></span>'

ALT_TONE = {'ph--1': 'ph--3', 'ph--2': 'ph--4', 'ph--3': 'ph--1', 'ph--4': 'ph--2'}

def photo(handle, n):
    """Real product photo if present at assets/products/<handle>-<n>.jpg|webp, else None."""
    for ext in ('webp', 'jpg', 'jpeg', 'png'):
        if (OUT / 'assets' / 'products' / f'{handle}-{n}.{ext}').exists():
            return f'/assets/products/{handle}-{n}.{ext}'
    return None

def media(p, label):
    """Two stacked layers: primary + secondary angle that cross-fades on hover/press."""
    layers = []
    for n, tone in ((1, p['tone']), (2, ALT_TONE[p['tone']])):
        src = photo(p['handle'], n)
        inner = (f'<img src="{src}" alt="{e(p["name"])}{" — " + label if n == 2 else ""}" loading="lazy" decoding="async">'
                 if src else (RING_L if n == 1 else RING_DETAIL))
        layers.append(f'<span class="media__layer media__layer--{n} {tone}" aria-hidden="{"true" if n == 2 else "false"}">{inner}</span>')
    return ''.join(layers)

def card(p, i=0, shop=False):
    badge = f'<span class="badge">{e(p["badge"])}</span>' if p['badge'] else ''
    attrs = f' data-cat="{p["cat"]}" data-tags="{p["tags"]}" data-price="{p["price"]}" data-order="{i}"' if shop else ''
    return f'''<a class="card" href="/products/{p['handle']}" data-reveal{attrs}>
  <div class="media">{media(p, p['photos'][1])}{badge}</div>
  <div class="card__meta">
    <span class="card__type">{e(p['type'])}</span>
    <span class="card__row"><span class="card__name">{e(p['name'])}</span>{price_html(p)}</span>
    <span class="card__mat">{e(p['material'])}</span>
  </div>
</a>'''

def join_band():
    return f'''
<section class="join" aria-labelledby="join-h">
  <div class="join__in" data-reveal>
    <span class="eyebrow">Stay in the loop</span>
    <h2 class="h-section" id="join-h">New pieces. <span class="it">Early access.</span></h2>
    <p class="lead">New collections and small-batch drops land on Instagram first. Online checkout opens soon — until then, order any piece by email.</p>
    <div class="join__cta">
      <a class="btn btn--ink" data-magnetic href="https://instagram.com/eclatbysev">Follow @eclatbysev</a>
      <a class="btn btn--line" data-magnetic href="mailto:{EMAIL}">Email us</a>
    </div>
  </div>
</section>'''

def write(rel, content):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

# ---------- Home ----------
def home():
    new = [BY['lumiere-stacking-ring'], BY['douceur-chain-necklace'], BY['petale-drop-earrings'], BY['velours-bangle']]
    ld = {"@context": "https://schema.org", "@type": "Organization", "name": "Éclat By Sev", "url": SITE,
          "logo": SITE + "/assets/logo-ink.png", "email": EMAIL, "sameAs": ["https://instagram.com/eclatbysev"]}
    body = head('Éclat By Sev — Handcrafted statement jewellery',
                'Statement jewellery designed by Sev and handcrafted in small batches. Water resistant, nickel free pieces made to be worn every day.',
                '/', f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')
    body += header()
    hero_src = None
    for ext in ('webp', 'jpg', 'jpeg'):
        if (OUT / 'assets' / f'hero.{ext}').exists():
            hero_src = f'/assets/hero.{ext}'; break
    hero_img = (f'<img class="hero__img" src="{hero_src}" alt="Hands wearing the Lumière Stacking Ring and Douceur Chain Necklace" fetchpriority="high">'
                if hero_src else f'<span class="hero__art" aria-hidden="true">{RING_L}</span>')
    hot = [  # x/y are % positions on the hero photo — adjust once the real photo is in place
        dict(p=BY['lumiere-stacking-ring'], x=52, y=56, id='qv-ring'),
        dict(p=BY['douceur-chain-necklace'], x=30, y=22, id='qv-neck'),
    ]
    spots = ''
    for h in hot:
        p = h['p']
        spots += f"""
      <div class="spot" style="--x:{h['x']}%;--y:{h['y']}%">
        <button type="button" class="spot__btn" aria-expanded="false" aria-controls="{h['id']}" aria-label="Quick view: {e(p['name'])}"><span class="spot__dot"></span></button>
        <div class="qv" id="{h['id']}" role="dialog" aria-label="{e(p['name'])}" hidden>
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
    body += f'''
<section class="hero">
  <div class="hero__media" data-reveal="fade">
    {hero_img}{spots}
    <span class="hero__hint" aria-hidden="true">Explore the pieces</span>
  </div>
  <div class="hero__text">
    <span class="eyebrow eyebrow--rule" data-reveal>New collection · Autumn 2026</span>
    <h1 class="h-display lines" data-reveal><span class="ln" style="--i:0">Jewellery that</span> <span class="ln" style="--i:1">tells <span class="it">your</span> story</span></h1>
    <p class="lead" data-reveal style="--d:.25s">Statement pieces, handcrafted in small batches. Water resistant, nickel free and made to be worn every day.</p>
    <div class="hero__cta" data-reveal style="--d:.35s">
      <a class="btn btn--ink" data-magnetic href="/shop">Shop the collection {I['arrow']}</a>
      <a class="link-caps" href="/about">Meet Sev</a>
    </div>
  </div>
</section>

<section class="promise" aria-label="Our promise">
  <div class="wrap promise__in">
    <span class="promise__item">{I['star']}Handcrafted in small batches</span>
    <span class="promise__item">{I['truck']}Free shipping over €75</span>
    <span class="promise__item">{I['return']}30-day easy returns</span>
    <span class="promise__item">{I['clock']}Ships in 3–5 days</span>
  </div>
</section>

<section class="wrap section" id="collections" aria-labelledby="col-h">
  <div class="head" data-reveal>
    <div><span class="eyebrow">Shop by collection</span><h2 class="h-section" id="col-h">Pieces for <span class="it">every</span> moment</h2></div>
    <a class="link-caps" href="/shop">View all</a>
  </div>
  <div class="cols">
    <a class="tile tile--big" href="/shop?category=rings" data-reveal><div class="media"><span class="media__layer ph--1">{RING_L}</span></div><span class="tile__name"><span>Rings</span><span>01</span></span></a>
    <a class="tile" href="/shop?category=necklaces" data-reveal style="--d:.08s"><div class="media"><span class="media__layer ph--4"></span></div><span class="tile__name"><span>Necklaces</span><span>02</span></span></a>
    <a class="tile" href="/shop?category=earrings" data-reveal style="--d:.16s"><div class="media"><span class="media__layer ph--3"></span></div><span class="tile__name"><span>Earrings</span><span>03</span></span></a>
    <a class="tile" href="/shop?category=bracelets" data-reveal style="--d:.08s"><div class="media"><span class="media__layer ph--3"></span></div><span class="tile__name"><span>Bracelets &amp; Anklets</span><span>04</span></span></a>
    <a class="tile" href="/shop?category=sets" data-reveal style="--d:.16s"><div class="media"><span class="media__layer ph--4"></span></div><span class="tile__name"><span>Sets</span><span>05</span></span></a>
  </div>
</section>

<section class="wrap section section--pb" aria-labelledby="new-h">
  <div class="head" data-reveal>
    <div><span class="eyebrow">Just arrived</span><h2 class="h-section" id="new-h">New in</h2></div>
    <a class="link-caps" href="/shop?category=new">Shop new in</a>
  </div>
  <div class="grid grid--4">
    {''.join(card(p) for p in new)}
  </div>
</section>

<section class="editorial" aria-labelledby="phil-h">
  <div class="wrap editorial__in">
    <div class="ph ph--night editorial__media" data-reveal="fade">{RING_D}</div>
    <div class="editorial__text">
      <span class="eyebrow" id="phil-h" data-reveal>The philosophy</span>
      <p class="editorial__quote lines" data-reveal><span class="ln" style="--i:0">Every piece</span> <span class="ln" style="--i:1">holds a</span> <span class="ln it" style="--i:2">quiet power.</span></p>
      <p class="body lines" data-reveal><span class="ln" style="--i:3">Éclat isn't just jewellery.</span> <span class="ln" style="--i:4">It's the ring you reach for before a big day.</span> <span class="ln" style="--i:5">The earrings you wear when you want to feel like yourself again.</span></p>
      <a class="btn btn--line" data-magnetic href="/about" data-reveal style="--d:.5s">Read our story</a>
    </div>
  </div>
</section>

<section class="wrap section" aria-labelledby="set-h">
  <div class="feature" data-reveal>
    <div class="feature__text">
      <span class="eyebrow">Gift ready</span>
      <h2 class="h-section" id="set-h">The Lumière &amp; Douceur Set</h2>
      <p class="lead" style="font-size:16px">Our stacking ring and chain necklace, paired and boxed in our signature gift box.</p>
      <div class="feature__buy">
        <span class="feature__price">€105</span>
        <a class="btn btn--ink" data-magnetic href="/products/lumiere-douceur-set">Shop the set</a>
      </div>
    </div>
    <div class="media feature__media"><span class="media__layer ph--3">{RING_DETAIL}</span></div>
  </div>
</section>

<section class="wrap section section--pb story" id="story" aria-labelledby="story-h">
  <div class="story__text">
    <span class="eyebrow" data-reveal>Our story</span>
    <h2 class="h-section lines" id="story-h" data-reveal><span class="ln" style="--i:0">Made by hand.</span><br><span class="ln it" style="--i:1">Made with heart.</span></h2>
    <p class="prose lines" data-reveal><span class="ln" style="--i:2">Éclat By Sev was born from a simple belief —</span> <span class="ln" style="--i:3">that jewellery should feel like a second skin.</span> <span class="ln" style="--i:4">Founded by Sev, each collection is designed and handcrafted in small batches,</span> <span class="ln" style="--i:5">with attention to every curve and detail.</span></p>
    <div class="story__def" data-reveal style="--d:.3s">
      <span class="it">éclat</span>
      <p class="prose">French for radiance. It's what we want every woman who wears our pieces to feel — seen, luminous, and entirely herself.</p>
    </div>
    <a class="link-caps" href="/about" data-reveal style="--d:.4s">Meet Sev</a>
  </div>
  <div class="story__media" data-reveal="fade"><div class="ph ph--1"></div><div class="ph"></div></div>
</section>

<section class="wrap section--pb insta" aria-label="Instagram">
  <div class="insta__head" data-reveal>
    <span class="insta__handle">@eclatbysev</span>
    <a class="link-caps" href="https://instagram.com/eclatbysev">Follow on Instagram</a>
  </div>
  <div class="insta__grid" data-reveal>
    <div class="ph ph--1"></div><div class="ph ph--2"></div><div class="ph ph--3"></div><div class="ph ph--4"></div><div class="ph ph--1"></div><div class="ph ph--2"></div>
  </div>
</section>
''' + join_band() + FOOTER
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
      <span id="shop-count" aria-live="polite">{len(PRODUCTS)} pieces</span>
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
</section>''' + FOOTER
    write('shop.html', body)

# ---------- Products ----------
def product(p):
    tones = ['ph--1', 'ph--2', 'ph--3', 'ph--4']
    thumbs = ''.join(f'<button type="button" class="thumb ph {tones[i]}" data-thumb="{tones[i]}" aria-pressed="{"true" if i==0 else "false"}" aria-label="Photo {i+1}: {e(ph)}"></button>' for i, ph in enumerate(p['photos']))
    badge = f'<span class="badge">{e(p["badge"])}</span>' if p['badge'] else ''
    was = f'<s>{eur(p["was"])}</s>' if p['was'] else ''
    tags = ''.join(f'<span>{e(t)}</span>' for t in p['features'])
    sizes = ''
    if p['sizes']:
        btns = ''.join(f'<button type="button" class="size" data-size="{s}" aria-pressed="false">{s}</button>' for s in p['sizes'])
        sizes = f'''<div class="opt">
  <div class="opt__head"><span class="opt__label">Ring size <span id="size-label">· choose your size</span></span><a href="/faq#ring-size" style="font-size:13px;text-underline-offset:4px">Size guide</a></div>
  <div class="sizes" role="group" aria-label="Ring size">{btns}</div>
</div>'''
    order_label = 'Select a size' if p['sizes'] else 'Order by email'
    order_btn = f'<a class="btn btn--ink btn--block" data-order="{e(p["name"])}" href="mailto:{EMAIL}">{order_label}</a>'
    pairs = ''.join(f'''<a class="pair" href="/products/{q['handle']}"><span class="ph {q['tone']}"></span><span><small>{e(q['type'])}</small><b>{e(q['name'])}</b><span class="p">{eur(q['price'])}</span></span></a>''' for q in (BY[h] for h in p['pairs']))
    ld = {"@context": "https://schema.org", "@type": "Product", "name": p['name'], "description": p['desc'],
          "brand": {"@type": "Brand", "name": "Éclat By Sev"}, "material": p['material'],
          "offers": {"@type": "Offer", "price": str(p['price']), "priceCurrency": "EUR", "url": f"{SITE}/products/{p['handle']}"}}
    body = head(f"{p['name']} — Éclat By Sev", p['desc'][:155], f"/products/{p['handle']}",
                f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>', bodycls='page-product')
    body += header('shop')
    body += f'''
<div class="wrap crumbs-wrap" style="padding-top:28px;padding-bottom:28px">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop?category={p['cat']}">{e(p['type'])}</a><span>/</span>{e(p['name'])}</nav>
</div>
<section class="wrap pdp">
  <div class="gallery">
    <div class="thumbs" role="group" aria-label="Product photos">{thumbs}</div>
    <div class="ph gallery__main {tones[0]}" id="gallery-main">{RING_L}{badge}</div>
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
<div class="sticky-buy">{order_btn}</div>
<section class="pairs" aria-labelledby="pairs-h">
  <div class="wrap pairs__in">
    <h2 class="h-section" style="font-size:clamp(30px,3.2vw,42px)" id="pairs-h">Pairs <span class="it">beautifully</span> with</h2>
    <div class="pairs__row">{pairs}</div>
  </div>
</section>''' + FOOTER
    write(f"products/{p['handle']}.html", body)

# ---------- Simple pages ----------
SIMPLE = json.load(open(pathlib.Path(__file__).resolve().parent / 'pages.json', encoding='utf-8'))

def simple(slug, title, desc, eyebrow, h1, intro, inner, active=''):
    body = head(f'{title} — Éclat By Sev', desc, f'/{slug}')
    body += header(active)
    intro_html = f'<p>{intro}</p>' if intro else ''
    body += f'''
<article class="simple">
  <div class="simple__hero">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{h1}</h1>
    {intro_html}
  </div>
  {inner}
</article>''' + FOOTER
    write(f'{slug}.html', body)

def build():
    home(); shop()
    for p in PRODUCTS: product(p)
    for pg in SIMPLE: simple(**pg)
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
</article>''' + FOOTER
    write('404.html', body)
    # sitemap + robots + vercel config
    urls = ['/', '/shop', '/about', '/faq', '/contact', '/shipping-returns', '/privacy', '/terms'] + [f"/products/{p['handle']}" for p in PRODUCTS]
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE}{u}</loc></url>\n' for u in urls) + '</urlset>\n')
    write('robots.txt', f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
    write('vercel.json', json.dumps({"cleanUrls": True, "trailingSlash": False,
        "headers": [{"source": "/assets/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=604800"}]},
                    {"source": "/(.*)", "headers": [{"key": "X-Content-Type-Options", "value": "nosniff"},
                                                     {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
                                                     {"key": "X-Frame-Options", "value": "SAMEORIGIN"}]}]}, indent=2))

build()
print('ok')
