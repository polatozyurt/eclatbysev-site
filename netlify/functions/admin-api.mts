// Online admin API: everything under /api/admin/* except login/logout. Requires a session cookie.
import type { Config } from '@netlify/functions'
import {
  BRANCH, HttpError, Invalid, MAX_UPLOAD, REPO, configProblem, contains, contentHash, deleteFile, fail,
  headSha, imageExt, json, listDir, readFile, readRaw, sameOrigin, sessionUser, slugify,
  validatePages, validatePosts, validateProducts, validateSettings, writeFile,
} from '../lib/admin.mts'

const FILES: Record<string, { path: string; label: string }> = {
  settings: { path: 'content/settings.json', label: 'ana sayfa' },
  products: { path: 'content/products.json', label: 'ürünler' },
  pages: { path: 'content/pages.json', label: 'sayfalar' },
  posts: { path: 'content/posts.json', label: 'blog' },
}
const UPLOADS = 'site/assets/uploads'
const NAME_RE = /^[a-z0-9][a-z0-9-]*\.(webp|jpg|png|gif)$/

async function readAll() {
  const keys = Object.keys(FILES)
  const files = await Promise.all(keys.map((k) => readFile(FILES[k].path)))
  const data: Record<string, any> = {}, shas: Record<string, string> = {}
  keys.forEach((k, i) => { data[k] = JSON.parse(files[i].text); shas[k] = files[i].sha })
  return { data, shas, text: files.map((f) => f.text).join('') }
}

async function deployedCommit(req: Request): Promise<string> {
  try {
    const r = await fetch(new URL('/build.json?t=' + Date.now(), req.url), { headers: { 'Cache-Control': 'no-cache' } })
    if (!r.ok) return ''
    return ((await r.json()).commit || '') as string
  } catch { return '' }
}

async function handle(req: Request, user: string): Promise<Response> {
  const url = new URL(req.url)
  const route = url.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '')
  const method = req.method.toUpperCase()

  if (method === 'GET' && route === 'me') return json({ ok: true, user })

  if (method === 'GET' && route === 'state') {
    const [{ data, shas }, head] = await Promise.all([readAll(), headSha().catch(() => '')])
    return json({ ...data, shas, head, mode: 'cloud', user, repo: REPO(), branch: BRANCH() })
  }

  if (method === 'PUT' && FILES[route]) {
    const { path, label } = FILES[route]
    const baseSha = req.headers.get('x-base-sha') || undefined
    let body: unknown
    try { body = await req.json() } catch { return fail('Geçersiz veri') }
    let data: any
    if (route === 'products') data = validateProducts(body)
    else if (route === 'posts') data = validatePosts(body)
    else if (route === 'pages') data = validatePages(body)
    else data = validateSettings(body, JSON.parse((await readFile(path)).text))
    const text = JSON.stringify(data, null, 1) + '\n'
    const r = await writeFile(path, text, `Admin: ${label} güncellendi (${user})`, user, baseSha)
    return json({ ok: true, data, sha: r.sha, commit: r.commit })
  }

  if (method === 'POST' && route === 'upload') {
    const buf = Buffer.from(await req.arrayBuffer())
    if (!buf.length) return fail('Dosya boş')
    if (buf.length > MAX_UPLOAD) return fail('Dosya çok büyük (en fazla 4 MB). Fotoğraf otomatik küçültülemediyse JPG olarak tekrar deneyin.', 413)
    const ext = imageExt(buf)
    if (!ext) return fail('Sadece JPG, PNG, WEBP veya GIF yüklenebilir')
    const stem = slugify((url.searchParams.get('name') || 'image').replace(/\.[^.]+$/, ''))
    const name = `${stem}-${contentHash(buf)}.${ext}`
    try {
      // [skip netlify]: no deploy just for an image; it goes live with the next content save.
      await writeFile(`${UPLOADS}/${name}`, buf, `Admin: görsel yüklendi ${name} (${user}) [skip netlify]`, user)
    } catch (e) {
      if (!(e instanceof HttpError && e.message === 'exists')) throw e // same image uploaded before
    }
    return json({ ok: true, src: `/assets/uploads/${name}` })
  }

  if (method === 'GET' && route === 'uploads') {
    const [items, all] = await Promise.all([listDir(UPLOADS), readAll()])
    const list = items.filter((f) => f.type === 'file' && !f.name.startsWith('.')).map((f) => {
      const src = `/assets/uploads/${f.name}`
      return { src, name: f.name, size: f.size, used: all.text.includes(src) }
    }).reverse()
    return json(list)
  }

  if (method === 'DELETE' && route === 'uploads') {
    const name = url.searchParams.get('name') || ''
    if (!NAME_RE.test(name)) return fail('Dosya bulunamadı', 404)
    const src = `/assets/uploads/${name}`
    const [items, all] = await Promise.all([listDir(UPLOADS), readAll()])
    const f = items.find((x) => x.name === name)
    if (!f) return fail('Dosya bulunamadı', 404)
    if (all.text.includes(src)) return fail('Bu görsel sitede kullanılıyor; önce kaldırın.')
    await deleteFile(`${UPLOADS}/${name}`, f.sha, `Admin: görsel silindi ${name} (${user}) [skip netlify]`, user)
    return json({ ok: true })
  }

  // Images uploaded since the last deploy aren't on the CDN yet; serve them from GitHub for the admin.
  if (method === 'GET' && route === 'file') {
    const p = url.searchParams.get('path') || ''
    const name = p.replace(/^\/assets\/uploads\//, '')
    if (!p.startsWith('/assets/uploads/') || !NAME_RE.test(name)) return fail('Not found', 404)
    const r = await readRaw(`${UPLOADS}/${name}`)
    if (!r.ok) return fail('Not found', 404)
    const type = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif' }[name.split('.').pop()!]!
    return new Response(r.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=600' } })
  }

  // Has commit `sha` reached the live site yet?
  if (method === 'GET' && route === 'deploy') {
    const sha = url.searchParams.get('sha') || ''
    const deployed = await deployedCommit(req)
    return json({ ok: true, deployed, live: await contains(deployed, sha) })
  }

  if (method === 'GET' && route === 'git') {
    // Kept for parity with the local panel.
    return json({ available: false, cloud: true, head: await headSha() })
  }

  return fail('Not found', 404)
}

export default async (req: Request) => {
  const problem = configProblem()
  if (problem) return fail(`Panel henüz ayarlanmadı: ${problem}`, 503, { setup: true })
  const user = sessionUser(req)
  if (!user) return fail('Oturum açın', 401, { login: true })
  if (req.method !== 'GET' && !sameOrigin(req)) return fail('Forbidden', 403)
  try {
    return await handle(req, user)
  } catch (e) {
    if (e instanceof Invalid) return fail(e.message, 400)
    if (e instanceof HttpError) return fail(e.message, e.status)
    console.error(e)
    return fail('Beklenmeyen bir hata oluştu: ' + (e as Error).message, 500)
  }
}

export const config: Config = {
  path: '/api/admin/*',
  excludedPath: ['/api/admin/login', '/api/admin/logout'],
}
