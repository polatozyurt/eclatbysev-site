#!/usr/bin/env python3
"""Éclat By Sev — local admin panel.

    python3 admin/server.py            # opens http://localhost:8787
    python3 admin/server.py --no-open  # don't open a browser tab

Admin UI:     http://localhost:8787
Site preview: http://localhost:8788  (the generated site/, rebuilt after every save)

Only listens on 127.0.0.1. Uses the Python standard library only.
Saving writes content/*.json and rebuilds site/. "Publish" commits and pushes to
GitHub, which makes Netlify deploy the live site.
"""
import argparse, hashlib, json, mimetypes, os, pathlib, re, subprocess, sys, threading, unicodedata, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'content'
SITE = ROOT / 'site'
UPLOADS = SITE / 'assets' / 'uploads'
UI = pathlib.Path(__file__).resolve().parent / 'ui'
BUILD = ROOT / 'build' / 'build.py'

LOCK = threading.Lock()
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
CATS = {'rings', 'necklaces', 'earrings', 'bracelets', 'sets'}
CORE_PAGES = {'about', 'faq', 'contact', 'shipping-returns', 'privacy', 'terms'}
MAX_UPLOAD = 25 * 1024 * 1024
IMAGE_MAGIC = [(b'\xff\xd8\xff', 'jpg'), (b'\x89PNG\r\n\x1a\n', 'png'), (b'GIF8', 'gif')]

mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('text/javascript', '.js')


# ---------------------------------------------------------------- content io
def read_json(name):
    return json.loads((CONTENT / name).read_text(encoding='utf-8'))


def write_json(name, data):
    path = CONTENT / name
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    os.replace(tmp, path)


def run_build():
    r = subprocess.run([sys.executable, str(BUILD)], cwd=ROOT, capture_output=True, text=True)
    return {'ok': r.returncode == 0, 'log': (r.stdout + r.stderr).strip()[-4000:]}


def slugify(s):
    s = s.replace('ı', 'i').replace('İ', 'i').replace('ß', 'ss').replace('&', ' and ')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60] or 'image'


# ---------------------------------------------------------------- validation
class Invalid(Exception):
    pass


def need(cond, msg):
    if not cond:
        raise Invalid(msg)


def clean_src(src, where):
    src = (src or '').strip()
    if src:
        need(src.startswith('/assets/') and '..' not in src, f'{where}: görsel yolu geçersiz ({src})')
        need((SITE / src.lstrip('/')).is_file(), f'{where}: görsel bulunamadı ({src})')
    return src


def num(v, where, allow_none=False):
    if v in (None, '') and allow_none:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise Invalid(f'{where}: sayı olmalı')
    need(f >= 0, f'{where}: negatif olamaz')
    return int(f) if f.is_integer() else round(f, 2)


def strlist(v):
    return [str(x).strip() for x in (v or []) if str(x).strip()]


def validate_products(items):
    need(isinstance(items, list), 'Ürün listesi bekleniyordu')
    seen, out = set(), []
    tones = ['ph--1', 'ph--2', 'ph--3', 'ph--4']
    for i, p in enumerate(items):
        name = (p.get('name') or '').strip()
        need(name, f'{i + 1}. ürünün adı boş')
        h = (p.get('handle') or '').strip()
        need(SLUG_RE.match(h), f'"{name}": URL adı sadece küçük harf, rakam ve tire içerebilir')
        need(h not in seen, f'"{name}": URL adı "{h}" başka bir üründe de var')
        seen.add(h)
        need(p.get('cat') in CATS, f'"{name}": kategori seçilmeli')
        price = num(p.get('price'), f'"{name}" fiyat')
        was = num(p.get('was'), f'"{name}" eski fiyat', allow_none=True)
        imgs = []
        for im in p.get('images') or []:
            src = clean_src(im.get('src'), f'"{name}"')
            if src:
                imgs.append({'src': src, 'alt': (im.get('alt') or '').strip()})
        sizes = strlist(p.get('sizes'))
        tags = ' '.join(t for t in ['new', 'bestsellers', 'gifts'] if t in (p.get('tags') or '').split())
        out.append(dict(
            handle=h, name=name, type=(p.get('type') or '').strip(), cat=p['cat'], tags=tags,
            material=(p.get('material') or '').strip(), price=price, was=was or None,
            badge=(p.get('badge') or '').strip(), tone=p.get('tone') if p.get('tone') in tones else tones[i % 4],
            features=strlist(p.get('features')), sizes=sizes or None,
            desc=(p.get('desc') or '').strip(), details=(p.get('details') or '').strip(),
            photos=strlist(p.get('photos')) or ['front', 'detail', 'worn', 'in the gift box'],
            pairs=[x for x in strlist(p.get('pairs')) if x != h][:3],
            images=imgs, hidden=bool(p.get('hidden')),
        ))
    for p in out:
        p['pairs'] = [x for x in p['pairs'] if x in seen]
    return out


def validate_posts(items):
    need(isinstance(items, list), 'Yazı listesi bekleniyordu')
    seen, out = set(), []
    for i, p in enumerate(items):
        title = (p.get('title') or '').strip()
        need(title, f'{i + 1}. yazının başlığı boş')
        slug = (p.get('slug') or '').strip()
        need(SLUG_RE.match(slug), f'"{title}": URL adı sadece küçük harf, rakam ve tire içerebilir')
        need(slug not in seen and slug != 'index', f'"{title}": URL adı "{slug}" kullanılamaz / zaten var')
        seen.add(slug)
        date = (p.get('date') or '').strip()
        need(re.match(r'^\d{4}-\d{2}-\d{2}$', date), f'"{title}": tarih YYYY-AA-GG olmalı')
        cover = p.get('cover') or {}
        out.append(dict(
            slug=slug, title=title, date=date, author=(p.get('author') or '').strip(),
            status='published' if p.get('status') == 'published' else 'draft',
            excerpt=(p.get('excerpt') or '').strip(), seoDescription=(p.get('seoDescription') or '').strip(),
            cover={'src': clean_src(cover.get('src'), f'"{title}" kapak'), 'alt': (cover.get('alt') or '').strip()},
            body=strip_dangerous(p.get('body') or ''),
        ))
    return out


def validate_pages(items):
    need(isinstance(items, list), 'Sayfa listesi bekleniyordu')
    seen, out = set(), []
    reserved = {'index', 'shop', '404', 'blog', 'products', 'assets', 'sitemap', 'robots'}
    for p in items:
        slug = (p.get('slug') or '').strip()
        need(SLUG_RE.match(slug) and slug not in reserved, f'Sayfa URL adı geçersiz: "{slug}"')
        need(slug not in seen, f'"{slug}" iki kez kullanılmış')
        seen.add(slug)
        need((p.get('title') or '').strip(), f'"{slug}": sayfa başlığı boş')
        out.append(dict(
            slug=slug, title=p['title'].strip(), desc=(p.get('desc') or '').strip(),
            eyebrow=(p.get('eyebrow') or '').strip(), h1=(p.get('h1') or p['title']).strip(),
            intro=(p.get('intro') or '').strip(), inner=strip_dangerous(p.get('inner') or ''),
            active='about' if slug == 'about' else '',
        ))
    missing = CORE_PAGES - seen
    need(not missing, 'Bu sayfalar silinemez: ' + ', '.join(sorted(missing)))
    return out


def validate_settings(s):
    old = read_json('settings.json')
    need(isinstance(s, dict), 'Ayarlar bekleniyordu')
    need(set(old) <= set(s), 'Ayarlarda eksik bölüm var')

    def walk(v, path):
        if isinstance(v, dict):
            for k, x in v.items():
                if k in ('image', 'images') or k.endswith('Image'):
                    if isinstance(x, list):
                        v[k] = [clean_src(y, path + k) for y in x]
                    else:
                        v[k] = clean_src(x, path + k)
                else:
                    walk(x, path + k + '.')
        elif isinstance(v, list):
            for x in v:
                walk(x, path)
    walk(s, '')
    need(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', s['brand'].get('email', '')), 'E-posta adresi geçersiz')
    s['brand']['instagram'] = s['brand'].get('instagram', '').strip().lstrip('@')
    for h in s['hero'].get('hotspots') or []:
        h['x'] = max(0, min(100, round(float(h.get('x', 50)))))
        h['y'] = max(0, min(100, round(float(h.get('y', 50)))))
    return s


def strip_dangerous(h):
    """The panel is local and single-user, but never let pasted scripts reach the live site."""
    h = re.sub(r'<\s*(script|style|iframe|object|embed)\b[^>]*>.*?<\s*/\s*\1\s*>', '', h, flags=re.I | re.S)
    h = re.sub(r'<\s*(script|style|iframe|object|embed)\b[^>]*/?>', '', h, flags=re.I)
    h = re.sub(r'\s+on[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)', '', h, flags=re.I)
    h = re.sub(r'(href|src)\s*=\s*(["\'])\s*javascript:[^"\']*\2', r'\1="#"', h, flags=re.I)
    return h.strip()


# ---------------------------------------------------------------- uploads
def save_upload(data, name):
    need(0 < len(data) <= MAX_UPLOAD, 'Dosya boş ya da çok büyük (en fazla 25 MB)')
    ext = None
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        ext = 'webp'
    for magic, x in IMAGE_MAGIC:
        if data.startswith(magic):
            ext = x
    need(ext, 'Sadece JPG, PNG, WEBP veya GIF yüklenebilir')
    stem = slugify(pathlib.Path(name or 'image').stem)
    fname = f'{stem}-{hashlib.sha1(data).hexdigest()[:8]}.{ext}'
    UPLOADS.mkdir(parents=True, exist_ok=True)
    (UPLOADS / fname).write_bytes(data)
    return f'/assets/uploads/{fname}'


def all_content_text():
    return ''.join((CONTENT / n).read_text(encoding='utf-8') for n in ('settings.json', 'products.json', 'pages.json', 'posts.json'))


def list_uploads():
    text = all_content_text()
    out = []
    if UPLOADS.is_dir():
        for f in sorted(UPLOADS.iterdir(), key=lambda f: f.stat().st_mtime, reverse=True):
            if f.is_file() and not f.name.startswith('.'):
                src = f'/assets/uploads/{f.name}'
                out.append({'src': src, 'name': f.name, 'size': f.stat().st_size, 'used': src in text})
    return out


# ---------------------------------------------------------------- git
def git(*args, check=False):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError((r.stdout + r.stderr).strip())
    return r


def git_status():
    if not (ROOT / '.git').exists():
        return {'available': False}
    r = git('status', '--porcelain', '--', 'content', 'site', 'build')
    if r.returncode != 0:
        return {'available': False, 'error': r.stderr.strip()}
    changes = [l[3:] for l in r.stdout.splitlines() if l.strip()]
    branch = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.strip()
    last = git('log', '-1', '--format=%s · %cr').stdout.strip()
    return {'available': True, 'branch': branch, 'changes': changes, 'last': last}


def publish(message):
    log = []
    st = git_status()
    need(st.get('available'), 'Bu klasör bir git deposu değil')
    message = (message or '').strip() or 'Update site content'
    if st['changes']:
        git('add', '--', 'content', 'site', 'build', check=True)
        r = git('commit', '-m', message + '\n\nPublished from the Éclat admin panel.', check=True)
        log.append(r.stdout.strip().splitlines()[0] if r.stdout.strip() else 'committed')
    r = git('pull', '--rebase', '--autostash')
    if r.returncode != 0:
        git('rebase', '--abort')
        raise RuntimeError('GitHub\'daki değişikliklerle birleştirilemedi. Terminalde "git status" ile bakın.\n' + (r.stdout + r.stderr).strip())
    log.append('pull: ' + (r.stdout.strip().splitlines() or ['ok'])[-1])
    r = git('push')
    if r.returncode != 0:
        raise RuntimeError('Push başarısız:\n' + (r.stdout + r.stderr).strip())
    log.append('push: ok')
    return log


# ---------------------------------------------------------------- http
class Handler(BaseHTTPRequestHandler):
    server_version = 'EclatAdmin/1.0'
    root_dir = None  # set per server

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('  ' + (fmt % args) + '\n')

    def host_ok(self):
        host = (self.headers.get('Host') or '').split(':')[0]
        return host in ('localhost', '127.0.0.1')

    def send(self, code, body, ctype='application/json; charset=utf-8', headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def serve_file(self, path):
        ctype = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
            ctype += '; charset=utf-8'
        self.send(200, path.read_bytes(), ctype)

    def resolve_site(self, url_path):
        """Clean-URL resolution like Netlify: /shop -> shop.html, /blog/ -> blog/index.html."""
        rel = unquote(url_path).lstrip('/')
        base = SITE.resolve()
        cands = [rel] if rel and not rel.endswith('/') else []
        cands += [rel + 'index.html'] if (not rel or rel.endswith('/')) else [rel + '.html', rel + '/index.html']
        for c in cands:
            p = (SITE / c).resolve()
            if base in p.parents and p.is_file():
                return p
        return None

    def body_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'null')


class SiteHandler(Handler):
    def do_GET(self):
        if not self.host_ok():
            return self.send(403, 'Forbidden', 'text/plain')
        p = self.resolve_site(urlparse(self.path).path)
        if p:
            return self.serve_file(p)
        nf = SITE / '404.html'
        self.send(404, nf.read_bytes() if nf.exists() else b'Not found', 'text/html; charset=utf-8')
    do_HEAD = do_GET


class AdminHandler(Handler):
    def do_GET(self):
        if not self.host_ok():
            return self.send(403, 'Forbidden', 'text/plain')
        url = urlparse(self.path)
        path = url.path
        if path == '/api/state':
            with LOCK:
                return self.send(200, {
                    'settings': read_json('settings.json'), 'products': read_json('products.json'),
                    'pages': read_json('pages.json'), 'posts': read_json('posts.json'),
                    'previewPort': self.server.preview_port,
                })
        if path == '/api/uploads':
            return self.send(200, list_uploads())
        if path == '/api/git':
            return self.send(200, git_status())
        if path.startswith('/assets/'):
            p = self.resolve_site(path)
            return self.serve_file(p) if p else self.send(404, 'Not found', 'text/plain')
        name = 'index.html' if path in ('/', '') else path.lstrip('/')
        f = (UI / name).resolve()
        if UI.resolve() in f.parents and f.is_file():
            return self.serve_file(f)
        self.send(404, 'Not found', 'text/plain')
    do_HEAD = do_GET

    def guard(self):
        # Custom header => browsers block cross-site requests (no CORS), so other sites can't write here.
        if not self.host_ok() or self.headers.get('X-Eclat-Admin') != '1':
            self.send(403, {'ok': False, 'error': 'Forbidden'})
            return False
        return True

    def do_PUT(self):
        if not self.guard():
            return
        kinds = {'/api/products': ('products.json', validate_products), '/api/posts': ('posts.json', validate_posts),
                 '/api/pages': ('pages.json', validate_pages), '/api/settings': ('settings.json', validate_settings)}
        path = urlparse(self.path).path
        if path not in kinds:
            return self.send(404, {'ok': False, 'error': 'Not found'})
        fname, validate = kinds[path]
        try:
            data = validate(self.body_json())
        except Invalid as ex:
            return self.send(400, {'ok': False, 'error': str(ex)})
        except (ValueError, KeyError, TypeError, AttributeError) as ex:
            return self.send(400, {'ok': False, 'error': f'Geçersiz veri: {ex}'})
        with LOCK:
            backup = (CONTENT / fname).read_text(encoding='utf-8')
            write_json(fname, data)
            build = run_build()
            if not build['ok']:
                (CONTENT / fname).write_text(backup, encoding='utf-8')
                run_build()
                return self.send(500, {'ok': False, 'error': 'Site oluşturulamadı, değişiklik geri alındı.', 'log': build['log']})
        self.send(200, {'ok': True, 'data': data, 'build': build})

    def do_POST(self):
        if not self.guard():
            return
        url = urlparse(self.path)
        if url.path == '/api/upload':
            n = int(self.headers.get('Content-Length') or 0)
            if n > MAX_UPLOAD:
                return self.send(413, {'ok': False, 'error': 'Dosya çok büyük (en fazla 25 MB)'})
            data = self.rfile.read(n)
            name = parse_qs(url.query).get('name', ['image'])[0]
            try:
                return self.send(200, {'ok': True, 'src': save_upload(data, name)})
            except Invalid as ex:
                return self.send(400, {'ok': False, 'error': str(ex)})
        if url.path == '/api/publish':
            try:
                with LOCK:
                    log = publish((self.body_json() or {}).get('message'))
                return self.send(200, {'ok': True, 'log': log, 'git': git_status()})
            except (Invalid, RuntimeError) as ex:
                return self.send(400, {'ok': False, 'error': str(ex)})
        if url.path == '/api/rebuild':
            with LOCK:
                b = run_build()
            return self.send(200 if b['ok'] else 500, {'ok': b['ok'], 'build': b, 'error': None if b['ok'] else b['log']})
        self.send(404, {'ok': False, 'error': 'Not found'})

    def do_DELETE(self):
        if not self.guard():
            return
        url = urlparse(self.path)
        if url.path == '/api/uploads':
            name = parse_qs(url.query).get('name', [''])[0]
            f = (UPLOADS / name).resolve()
            if not name or UPLOADS.resolve() not in f.parents or not f.is_file():
                return self.send(404, {'ok': False, 'error': 'Dosya bulunamadı'})
            if f'/assets/uploads/{name}' in all_content_text():
                return self.send(400, {'ok': False, 'error': 'Bu görsel sitede kullanılıyor; önce kaldırın.'})
            f.unlink()
            return self.send(200, {'ok': True})
        self.send(404, {'ok': False, 'error': 'Not found'})


def main():
    ap = argparse.ArgumentParser(description='Éclat By Sev admin panel')
    ap.add_argument('--port', type=int, default=8787)
    ap.add_argument('--preview-port', type=int, default=8788)
    ap.add_argument('--no-open', action='store_true')
    a = ap.parse_args()
    b = run_build()
    if not b['ok']:
        print('Uyarı: site oluşturulamadı:\n' + b['log'])
    admin = ThreadingHTTPServer(('127.0.0.1', a.port), AdminHandler)
    admin.preview_port = a.preview_port
    preview = ThreadingHTTPServer(('127.0.0.1', a.preview_port), SiteHandler)
    threading.Thread(target=preview.serve_forever, daemon=True).start()
    url = f'http://localhost:{a.port}'
    print(f'\n  Éclat admin    {url}\n  Site önizleme  http://localhost:{a.preview_port}\n\n  Kapatmak için Ctrl+C\n')
    if not a.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        admin.serve_forever()
    except KeyboardInterrupt:
        print('\nKapatıldı.')


if __name__ == '__main__':
    main()
