/* Shared code for the online admin panel (eclatbysev.com/admin).
 *
 * Content lives in the GitHub repo (content/*.json, site/assets/uploads/).
 * Saving commits to GitHub; Netlify rebuilds the site from that commit.
 *
 * Environment variables (Netlify → Project configuration → Environment variables, scope: Functions):
 *   ADMIN_USERS   "polat:long-password,sev:another-password"   (who can log in)
 *   GITHUB_TOKEN  fine-grained token with Contents: read & write on the repo
 * Optional: GITHUB_REPO (default polatozyurt/eclatbysev-site), GITHUB_BRANCH (default main),
 *           GITHUB_API (only for local testing against a mock).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

declare const Netlify: { env: { get(k: string): string | undefined } }

const env = (k: string, d = '') => (Netlify.env.get(k) ?? d).trim()
export const REPO = () => env('GITHUB_REPO', 'polatozyurt/eclatbysev-site')
export const BRANCH = () => env('GITHUB_BRANCH', 'main')
const API = () => env('GITHUB_API', 'https://api.github.com').replace(/\/$/, '')
const TOKEN = () => env('GITHUB_TOKEN')

export const COOKIE = '__Host-eclat_admin'
const SESSION_DAYS = 14
export const MIN_PASSWORD = 10

/* ------------------------------------------------------------------ responses */
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      ...headers,
    },
  })
}
export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  json({ ok: false, error, ...extra }, status)

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

/* ------------------------------------------------------------------ users & sessions */
function users(): Map<string, string> {
  const m = new Map<string, string>()
  for (const part of env('ADMIN_USERS').split(',')) {
    const i = part.indexOf(':')
    if (i > 0) m.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim())
  }
  return m
}

export function configProblem(): string | null {
  if (!users().size) return 'ADMIN_USERS ayarlanmamış.'
  if (!TOKEN()) return 'GITHUB_TOKEN ayarlanmamış.'
  return null
}

const sha256 = (s: string) => createHash('sha256').update(s).digest()

export function checkPassword(user: string, password: string): string | null {
  const name = (user || '').trim().toLowerCase()
  const expected = users().get(name)
  // Always compare something so timing doesn't reveal which usernames exist.
  const ok = timingSafeEqual(sha256(password || ''), sha256(expected ?? '\u0000no-user'))
  return ok && expected !== undefined && expected.length >= MIN_PASSWORD ? name : null
}

// Changing ADMIN_USERS or GITHUB_TOKEN logs everyone out.
const key = () => sha256('eclat-admin-session|' + env('ADMIN_USERS') + '|' + TOKEN())
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url')

export function makeSession(user: string) {
  const payload = b64u(JSON.stringify({ u: user, exp: Date.now() + SESSION_DAYS * 864e5 }))
  const value = payload + '.' + sign(payload)
  return `${COOKIE}=${value}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`
}
export const clearSession = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`

export function sessionUser(req: Request): string | null {
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))
  if (!raw) return null
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.')
  if (!payload || !sig) return null
  const good = Buffer.from(sign(payload)), got = Buffer.from(sig)
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof exp !== 'number' || exp < Date.now() || !users().has(u)) return null
    return u
  } catch { return null }
}

/** Writes must come from our own page: custom header (forces CORS preflight, which we never allow) + same Origin. */
export function sameOrigin(req: Request): boolean {
  if (req.headers.get('x-eclat-admin') !== '1') return false
  const origin = req.headers.get('origin')
  return !origin || origin === new URL(req.url).origin
}

/* ------------------------------------------------------------------ GitHub */
async function gh(path: string, init: RequestInit & { accept?: string } = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN()}`,
    Accept: init.accept || 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'eclat-admin',
  }
  if (init.body) headers['Content-Type'] = 'application/json'
  const r = await fetch(API() + path, { ...init, headers })
  if (r.status === 401) throw new HttpError(502, 'GitHub erişimi reddedildi: GITHUB_TOKEN geçersiz ya da süresi dolmuş.')
  if (r.status === 403 && !(init.method || 'GET').match(/GET/i)) throw new HttpError(502, 'GitHub yazma izni yok: token’a bu depo için “Contents: Read and write” izni verin.')
  return r
}
const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/')
const repoPath = (p: string) => `/repos/${REPO()}/contents/${enc(p)}`

export async function readFile(path: string): Promise<{ text: string; sha: string }> {
  const r = await gh(`${repoPath(path)}?ref=${encodeURIComponent(BRANCH())}`)
  if (!r.ok) throw new HttpError(502, `GitHub’dan okunamadı: ${path} (${r.status})`)
  const j = await r.json()
  return { text: Buffer.from(j.content || '', 'base64').toString('utf8'), sha: j.sha }
}

export async function readRaw(path: string): Promise<Response> {
  return gh(`${repoPath(path)}?ref=${encodeURIComponent(BRANCH())}`, { accept: 'application/vnd.github.raw' })
}

export async function listDir(path: string): Promise<{ name: string; size: number; sha: string; type: string }[]> {
  const r = await gh(`${repoPath(path)}?ref=${encodeURIComponent(BRANCH())}`)
  if (r.status === 404) return []
  if (!r.ok) throw new HttpError(502, `GitHub’dan okunamadı: ${path} (${r.status})`)
  return r.json()
}

const author = (user: string) => ({ name: `${user} (admin)`, email: 'admin@eclatbysev.com' })

export async function writeFile(path: string, content: Buffer | string, message: string, user: string, sha?: string) {
  const body: Record<string, unknown> = {
    message, branch: BRANCH(), content: Buffer.from(content).toString('base64'),
    committer: author(user), author: author(user),
  }
  if (sha) body.sha = sha
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await gh(repoPath(path), { method: 'PUT', body: JSON.stringify(body) })
    if (r.ok) {
      const j = await r.json()
      return { sha: j.content.sha as string, commit: j.commit.sha as string }
    }
    const err = await r.json().catch(() => ({}))
    // 409 with our sha = someone else changed this file. 409 without = branch moved mid-commit; retry.
    if (r.status === 409 && sha) throw new HttpError(409, 'Bu bölüm siz düzenlerken başka biri tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin (değişikliklerinizi bir kenara kopyalayın).')
    if (r.status === 422 && !sha) throw new HttpError(422, 'exists')
    if (r.status !== 409 || attempt === 2) throw new HttpError(502, `GitHub’a kaydedilemedi (${r.status}): ${err.message || ''}`)
    await new Promise((res) => setTimeout(res, 400 * (attempt + 1)))
  }
  throw new HttpError(502, 'GitHub’a kaydedilemedi')
}

export async function deleteFile(path: string, sha: string, message: string, user: string) {
  const r = await gh(repoPath(path), {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: BRANCH(), committer: author(user), author: author(user) }),
  })
  if (!r.ok) throw new HttpError(502, `Silinemedi (${r.status})`)
}

export async function headSha(): Promise<string> {
  const r = await gh(`/repos/${REPO()}/commits/${encodeURIComponent(BRANCH())}`, { accept: 'application/vnd.github.sha' })
  if (!r.ok) throw new HttpError(502, `GitHub’a ulaşılamadı (${r.status})`)
  return (await r.text()).trim()
}

/** Is everything up to commit `sha` live? True if the deployed commit includes it, or if the only
 *  commits after the deployed one are image uploads marked [skip netlify] (nothing to rebuild). */
export async function contains(deployed: string, sha: string): Promise<boolean> {
  if (!deployed || !sha) return false
  if (deployed === sha) return true
  const r = await gh(`/repos/${REPO()}/compare/${deployed}...${sha}`)
  if (!r.ok) return false
  const j = await r.json()
  if (j.status === 'identical' || j.status === 'behind') return true
  if (j.status !== 'ahead') return false
  return (j.commits || []).every((c: any) => /\[skip (netlify|ci)\]/i.test(c?.commit?.message || ''))
}

/* ------------------------------------------------------------------ validation (mirrors admin/server.py) */
export class Invalid extends Error {}
const need = (c: unknown, msg: string) => { if (!c) throw new Invalid(msg) }
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATS = new Set(['rings', 'necklaces', 'earrings', 'bracelets', 'sets'])
export const CORE_PAGES = ['about', 'faq', 'contact', 'shipping-returns', 'privacy', 'terms']
const s = (v: unknown) => (v == null ? '' : String(v)).trim()
const strlist = (v: unknown) => (Array.isArray(v) ? v : []).map(s).filter(Boolean)

function cleanSrc(src: unknown, where: string) {
  const v = s(src)
  if (v) need(/^\/assets\/[\w./-]+$/.test(v) && !v.includes('..'), `${where}: görsel yolu geçersiz (${v})`)
  return v
}
function num(v: unknown, where: string, allowNull = false): number | null {
  if ((v === null || v === '' || v === undefined) && allowNull) return null
  const f = Number(v)
  need(v !== '' && v !== null && Number.isFinite(f), `${where}: sayı olmalı`)
  need(f >= 0, `${where}: negatif olamaz`)
  return Number.isInteger(f) ? f : Math.round(f * 100) / 100
}

export function stripDangerous(h: unknown) {
  return s(h)
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .trim()
}

export function validateProducts(items: any): any[] {
  need(Array.isArray(items), 'Ürün listesi bekleniyordu')
  const seen = new Set<string>()
  const tones = ['ph--1', 'ph--2', 'ph--3', 'ph--4']
  const out = items.map((p: any, i: number) => {
    const name = s(p?.name)
    need(name, `${i + 1}. ürünün adı boş`)
    const h = s(p.handle)
    need(SLUG.test(h), `"${name}": URL adı sadece küçük harf, rakam ve tire içerebilir`)
    need(!seen.has(h), `"${name}": URL adı "${h}" başka bir üründe de var`)
    seen.add(h)
    need(CATS.has(p.cat), `"${name}": kategori seçilmeli`)
    const price = num(p.price, `"${name}" fiyat`)
    const was = num(p.was, `"${name}" eski fiyat`, true)
    const images = (Array.isArray(p.images) ? p.images : [])
      .map((im: any) => ({ src: cleanSrc(im?.src, `"${name}"`), alt: s(im?.alt) }))
      .filter((im: any) => im.src)
    const tagSet = new Set(s(p.tags).split(/\s+/))
    const sizes = strlist(p.sizes)
    const photos = strlist(p.photos)
    return {
      handle: h, name, type: s(p.type), cat: p.cat,
      tags: ['new', 'bestsellers', 'gifts'].filter((t) => tagSet.has(t)).join(' '),
      material: s(p.material), price, was: was || null, badge: s(p.badge),
      tone: tones.includes(p.tone) ? p.tone : tones[i % 4],
      features: strlist(p.features), sizes: sizes.length ? sizes : null,
      desc: s(p.desc), details: s(p.details),
      photos: photos.length ? photos : ['front', 'detail', 'worn', 'in the gift box'],
      pairs: strlist(p.pairs).filter((x) => x !== h).slice(0, 3),
      images, hidden: !!p.hidden,
    }
  })
  for (const p of out) p.pairs = p.pairs.filter((x: string) => seen.has(x))
  return out
}

export function validatePosts(items: any): any[] {
  need(Array.isArray(items), 'Yazı listesi bekleniyordu')
  const seen = new Set<string>()
  return items.map((p: any, i: number) => {
    const title = s(p?.title)
    need(title, `${i + 1}. yazının başlığı boş`)
    const slug = s(p.slug)
    need(SLUG.test(slug), `"${title}": URL adı sadece küçük harf, rakam ve tire içerebilir`)
    need(!seen.has(slug) && slug !== 'index', `"${title}": URL adı "${slug}" kullanılamaz / zaten var`)
    seen.add(slug)
    const date = s(p.date)
    need(/^\d{4}-\d{2}-\d{2}$/.test(date), `"${title}": tarih YYYY-AA-GG olmalı`)
    const cover = p.cover || {}
    return {
      slug, title, date, author: s(p.author),
      status: p.status === 'published' ? 'published' : 'draft',
      excerpt: s(p.excerpt), seoDescription: s(p.seoDescription),
      cover: { src: cleanSrc(cover.src, `"${title}" kapak`), alt: s(cover.alt) },
      body: stripDangerous(p.body),
    }
  })
}

export function validatePages(items: any): any[] {
  need(Array.isArray(items), 'Sayfa listesi bekleniyordu')
  const seen = new Set<string>()
  const reserved = new Set(['index', 'shop', '404', 'blog', 'products', 'assets', 'sitemap', 'robots', 'admin', 'api', 'build'])
  const out = items.map((p: any) => {
    const slug = s(p?.slug)
    need(SLUG.test(slug) && !reserved.has(slug), `Sayfa URL adı geçersiz: "${slug}"`)
    need(!seen.has(slug), `"${slug}" iki kez kullanılmış`)
    seen.add(slug)
    const title = s(p.title)
    need(title, `"${slug}": sayfa başlığı boş`)
    return {
      slug, title, desc: s(p.desc), eyebrow: s(p.eyebrow), h1: s(p.h1) || title,
      intro: s(p.intro), inner: stripDangerous(p.inner), active: slug === 'about' ? 'about' : '',
    }
  })
  const missing = CORE_PAGES.filter((c) => !seen.has(c))
  need(!missing.length, 'Bu sayfalar silinemez: ' + missing.join(', '))
  return out
}

export function validateSettings(next: any, current: any): any {
  need(next && typeof next === 'object' && !Array.isArray(next), 'Ayarlar bekleniyordu')
  need(Object.keys(current).every((k) => k in next), 'Ayarlarda eksik bölüm var')
  const walk = (v: any, path: string) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, path))
    else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (k === 'image' || k === 'images' || k.endsWith('Image')) {
          v[k] = Array.isArray(v[k]) ? v[k].map((x: unknown) => cleanSrc(x, path + k)) : cleanSrc(v[k], path + k)
        } else walk(v[k], path + k + '.')
      }
    }
  }
  walk(next, '')
  need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s(next.brand?.email)), 'E-posta adresi geçersiz')
  next.brand.instagram = s(next.brand.instagram).replace(/^@/, '')
  for (const h of next.hero?.hotspots || []) {
    h.x = Math.max(0, Math.min(100, Math.round(Number(h.x) || 50)))
    h.y = Math.max(0, Math.min(100, Math.round(Number(h.y) || 50)))
  }
  return next
}

/* ------------------------------------------------------------------ uploads */
export const MAX_UPLOAD = 4 * 1024 * 1024 // Netlify request limit is ~4.5 MB of binary

export function imageExt(b: Buffer): string | null {
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif'
  return null
}

export function slugify(name: string) {
  return (name || '')
    .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ß/g, 'ss').replace(/&/g, ' and ')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image'
}
export const contentHash = (b: Buffer) => createHash('sha1').update(b).digest('hex').slice(0, 8)
