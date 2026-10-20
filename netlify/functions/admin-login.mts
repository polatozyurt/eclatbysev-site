// POST /api/admin/login  {user, password}  → session cookie
// POST /api/admin/logout                    → clears it
import type { Config } from '@netlify/functions'
import { checkPassword, clearSession, configProblem, fail, json, makeSession, MIN_PASSWORD, sameOrigin } from '../lib/admin.mts'

export default async (req: Request) => {
  if (!sameOrigin(req)) return fail('Forbidden', 403)
  if (new URL(req.url).pathname.endsWith('/logout')) {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSession() })
  }
  const problem = configProblem()
  if (problem) return fail(`Giriş henüz ayarlanmadı: ${problem} (Netlify → Environment variables)`, 503)
  let body: { user?: string; password?: string } = {}
  try { body = await req.json() } catch { /* empty */ }
  const user = checkPassword(body.user || '', body.password || '')
  if (!user) {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500))
    return fail(`Kullanıcı adı ya da şifre hatalı. (Şifreler en az ${MIN_PASSWORD} karakter olmalı.)`, 401)
  }
  return json({ ok: true, user }, 200, { 'Set-Cookie': makeSession(user) })
}

export const config: Config = {
  path: ['/api/admin/login', '/api/admin/logout'],
  method: 'POST',
  // Free plan allows 2 code-based rules per project; this is the only one we use.
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
