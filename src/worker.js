/**
 * Elton Orvate Platform — Fase 1 (testes Instagram API com Instagram Login)
 * Cloudflare Worker (ES module) + KV
 *
 * Rotas:
 *  GET /              → painel de status
 *  GET /auth          → redireciona para OAuth do Instagram
 *  GET /callback      → troca code por token (curto → longo), salva no KV, mostra /me
 *  GET /api/me        → perfil da conta (testa instagram_business_basic)
 *  GET /api/media     → últimas mídias da conta
 *  GET /api/insights  → insights da conta (7 dias)
 *  GET /api/publishing-limit → cota de publicação restante
 *  GET /health        → ok
 */

const IG_AUTHORIZE = "https://api.instagram.com/oauth/authorize";
const IG_TOKEN = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH = "https://graph.instagram.com";
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
].join(",");

const KV_TOKEN = "ig_access_token";
const KV_USER = "ig_user";
const KV_STATE = "oauth_state:";

async function ig(path, params = {}, method = "GET", body = null) {
  const token = await PLATFORM_KV.get(KV_TOKEN);
  if (!token) return { error: "token_missing" };
  const url = new URL(IG_GRAPH + path);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
    body: body ? new URLSearchParams(body).toString() : null,
  });
  return res.json();
}

function html(title, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Elton Orvate Platform</title>
<style>
body{background:#0A0B0D;color:#E7EAEB;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;margin:0;padding:40px 20px}
main{max-width:760px;margin:0 auto}
h1{color:#CDA468;font-weight:300;font-size:28px;border-bottom:1px solid #3a332a;padding-bottom:12px}
h2{color:#F5DDB1;font-weight:400;font-size:18px}
pre{background:#14161a;border:1px solid #2a2d33;border-radius:8px;padding:16px;overflow:auto;font-size:13px;line-height:1.5}
a{color:#CDA468}
.badge{display:inline-block;background:#1d2026;border:1px solid #CDA468;color:#F5DDB1;border-radius:20px;padding:4px 14px;font-size:13px;margin:2px 4px 2px 0}
.ok{color:#7fc97f}.err{color:#e06c6c}
</style></head><body><main>${body}</main></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { IG_APP_ID, IG_APP_SECRET, BASE_URL } = env;

    // ---------- /health ----------
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "eltonorvate-platform", time: new Date().toISOString() });
    }

    // ---------- /auth ----------
    if (url.pathname === "/auth") {
      const state = crypto.randomUUID();
      await env.PLATFORM_KV.put(KV_STATE + state, "1", { expirationTtl: 600 });
      const authUrl = new URL(IG_AUTHORIZE);
      authUrl.searchParams.set("client_id", IG_APP_ID);
      authUrl.searchParams.set("redirect_uri", `${BASE_URL}/callback`);
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      return Response.redirect(authUrl.toString(), 302);
    }

    // ---------- /callback ----------
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err = url.searchParams.get("error");
      if (err) return new Response(html("Erro", `<h1>Falha na autorização</h1><pre>${err}: ${url.searchParams.get("error_description") || ""}</pre>`), { status: 400 });
      if (!code) return new Response(html("Erro", "<h1>Sem code na callback</h1>"), { status: 400 });
      if (!(await env.PLATFORM_KV.get(KV_STATE + state))) {
        return new Response(html("Erro", "<h1>State inválido ou expirado</h1>"), { status: 400 });
      }
      await env.PLATFORM_KV.delete(KV_STATE + state);

      // 1) code → short-lived token
      const tokenRes = await fetch(IG_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: IG_APP_ID,
          client_secret: IG_APP_SECRET,
          grant_type: "authorization_code",
          redirect_uri: `${BASE_URL}/callback`,
          code,
        }).toString(),
      }).then((r) => r.json());

      if (!tokenRes.access_token) {
        return new Response(html("Erro no token", `<h1>Teste 1 — troca de code por token</h1><h2 class="err">FALHOU</h2><pre>${JSON.stringify(tokenRes, null, 2)}</pre>`), { status: 500 });
      }

      // 2) short-lived → long-lived (60 dias)
      const llUrl = new URL(`${IG_GRAPH}/access_token`);
      llUrl.searchParams.set("grant_type", "ig_exchange_token");
      llUrl.searchParams.set("client_secret", IG_APP_SECRET);
      llUrl.searchParams.set("access_token", tokenRes.access_token);
      const llRes = await fetch(llUrl.toString()).then((r) => r.json());

      if (!llRes.access_token) {
        return new Response(html("Erro no token longo", `<h1>Teste 2 — long-lived token</h1><h2 class="err">FALHOU</h2><pre>${JSON.stringify(llRes, null, 2)}</pre>`), { status: 500 });
      }

      await env.PLATFORM_KV.put(KV_TOKEN, llRes.access_token, {
        expirationTtl: (llRes.expires_in || 5184000) - 3600,
      });

      // 3) /me — testa instagram_business_basic
      const me = await (async () => {
        const u = new URL(`${IG_GRAPH}/me`);
        u.searchParams.set("fields", "id,username,name,profile_picture_url,followers_count,follows_count,media_count,account_type,biography,website");
        u.searchParams.set("access_token", llRes.access_token);
        return fetch(u.toString()).then((r) => r.json());
      })();

      if (me.error) {
        return new Response(html("Erro no /me", `<h1>Teste 3 — leitura do perfil</h1><h2 class="err">FALHOU</h2><pre>${JSON.stringify(me, null, 2)}</pre>`), { status: 500 });
      }

      await env.PLATFORM_KV.put(KV_USER, JSON.stringify(me));
      return new Response(html("Conectado!", `
<h1>✅ Conexão estabelecida</h1>
<p><span class="badge">Teste 1 · token: OK</span><span class="badge">Teste 2 · long-lived: OK</span><span class="badge">Teste 3 · perfil: OK</span></p>
<h2>Conta conectada</h2>
<pre>${JSON.stringify(me, null, 2)}</pre>
<p><a href="/">← Voltar ao painel</a></p>`));
    }

    // ---------- API de leitura (exigem token) ----------
    if (url.pathname === "/api/me") {
      const r = await ig("/me", { fields: "id,username,name,profile_picture_url,followers_count,follows_count,media_count,account_type,biography,website" });
      return Response.json(r, { status: r.error ? 401 : 200 });
    }
    if (url.pathname === "/api/media") {
      const r = await ig("/me/media", { fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count", limit: "5" });
      return Response.json(r, { status: r.error ? 500 : 200 });
    }
    if (url.pathname === "/api/insights") {
      const r = await ig("/me/insights", { metric: "reach,impressions,profile_views,follower_count", period: "day", since: String(Math.floor(Date.now() / 1000) - 7 * 86400), until: String(Math.floor(Date.now() / 1000)) });
      return Response.json(r, { status: r.error ? 500 : 200 });
    }
    if (url.pathname === "/api/publishing-limit") {
      const r = await ig("/me/content_publishing_limit");
      return Response.json(r, { status: r.error ? 500 : 200 });
    }
    if (url.pathname === "/api/comments") {
      const mediaId = url.searchParams.get("media_id");
      if (!mediaId) return Response.json({ error: "informe media_id" }, { status: 400 });
      const r = await ig(`/${mediaId}/comments`, { fields: "id,text,username,timestamp,replies" });
      return Response.json(r, { status: r.error ? 500 : 200 });
    }

    // ---------- / painel ----------
    const [savedUser, hasToken] = await Promise.all([env.PLATFORM_KV.get(KV_USER), env.PLATFORM_KV.get(KV_TOKEN)]);
    const user = savedUser ? JSON.parse(savedUser) : null;
    const base = BASE_URL || `${url.protocol}//${url.host}`;
    return new Response(html("Painel", `
<h1>Elton Orvate Platform <span style="font-size:13px;color:#8a8f98">Fase 1 · testes Instagram API</span></h1>
<p>Token: ${hasToken ? '<span class="ok">✔ armazenado</span>' : '<span class="err">✖ não conectado</span>'}</p>
${user ? `<h2>Conta</h2><p>@${user.username} · ${user.followers_count ?? "?"} seguidores · ${user.media_count ?? "?"} posts</p>` : ""}
<h2>Passo a passo</h2>
<ol style="line-height:1.9">
<li>Cadastre a URL de callback no app da Meta (Instagram → API setup with Instagram Login → OAuth redirect URIs):<br><code style="color:#F5DDB1">${base}/callback</code></li>
<li><a href="/auth">Clique aqui para autorizar com a conta @eltonorvate</a></li>
<li>Testes de leitura: <a href="/api/me">/api/me</a> · <a href="/api/media">/api/media</a> · <a href="/api/insights">/api/insights</a> · <a href="/api/publishing-limit">/api/publishing-limit</a></li>
<li>Comentários: <code>/api/comments?media_id=&lt;id&gt;</code></li>
</ol>
<p><a href="/health">/health</a></p>`));
  },
};
