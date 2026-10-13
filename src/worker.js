const AUTH = "https://api.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const G = "https://graph.instagram.com";
const SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages";

async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieVal(request, name) {
  const h = request.headers.get("Cookie") || "";
  for (const part of h.split(";")) {
    const p = part.trim();
    if (p.startsWith(name + "=")) return p.slice(name.length + 1);
  }
  return "";
}

const LOGIN_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elton Orvate - Acesso</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b0d;color:#f5f0e8;font-family:Georgia,'Times New Roman',serif}
.card{background:#121316;border:1px solid #2a2c31;border-radius:16px;padding:40px 36px;width:320px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#d4af6a;margin:0 0 6px;text-align:center}
p.sub{font-size:12px;color:#9a948a;text-align:center;margin:0 0 26px;letter-spacing:.08em}
label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9a948a;margin:14px 0 6px}
input{width:100%;box-sizing:border-box;background:#0d0e10;border:1px solid #2a2c31;border-radius:8px;color:#f5f0e8;padding:11px 12px;font-size:14px;outline:none}
input:focus{border-color:#d4af6a}
button{width:100%;margin-top:24px;background:linear-gradient(135deg,#d4af6a,#b8934a);border:none;border-radius:8px;color:#0a0b0d;font-weight:700;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:12px;cursor:pointer}
button:hover{filter:brightness(1.1)}
.err{color:#e06c5b;font-size:12px;margin-top:14px;text-align:center;min-height:14px}
.mono{text-align:center;color:#d4af6a;font-size:26px;letter-spacing:.3em;margin-bottom:2px}
</style></head><body><div class="card">
<div class="mono">EO</div>
<h1>Elton Orvate</h1>
<p class="sub">Painel de Gest&#227;&#227;o - Instagram</p>
<form id="f">
<label>E-mail</label><input id="u" type="email" autocomplete="username" required>
<label>Senha</label><input id="p" type="password" autocomplete="current-password" required>
<button type="submit">Entrar</button>
<div class="err" id="e"></div>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const r = await fetch('/panel/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: document.getElementById('u').value.trim(), password: document.getElementById('p').value }) });
  if (r.ok) { location.href = '/panel'; return; }
  document.getElementById('e').textContent = 'Usu\u00e1rio ou senha inv\u00e1lidos.';
});
</script></div></body></html>`;

async function publishCarousel(V, urls, caption) {
  const tok = await V.get("tok");
  if (!tok) return { ok: 0, error: "no token" };
  const children = [];
  for (const u of urls) {
    const r = await fetch(G + "/me/media", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: tok }).toString()
    }).then((x) => x.json());
    if (!r.id) return { ok: 0, error: "falha ao criar item", detail: r };
    children.push(r.id);
  }
  const cont = await fetch(G + "/me/media", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ caption: caption, media_type: "CAROUSEL", children: children.join(","), access_token: tok }).toString()
  }).then((x) => x.json());
  if (!cont.id) return { ok: 0, error: "falha ao criar container", detail: cont };
  const pub = await fetch(G + "/me/media_publish?creation_id=" + encodeURIComponent(cont.id) + "&access_token=" + encodeURIComponent(tok), { method: "POST" }).then((x) => x.json());
  return { ok: 1, result: pub };
}

async function runDue(V, dryRun) {
  const l = await V.list({ prefix: "s:" });
  const now = Date.now();
  const out = [];
  for (const k of l.keys) {
    const v = await V.get(k.name);
    let it;
    try { it = JSON.parse(v); } catch (e) { continue; }
    if (!it || typeof it !== "object") continue;
    if (it.status !== "agendado" || !it.run_at || it.run_at > now) continue;
    if (dryRun) { out.push({ id: k.name, due: 1, caption: (it.caption || "").slice(0, 60) }); continue; }
    const r = await publishCarousel(V, it.urls, it.caption);
    it.status = r.ok ? "publicado" : "erro";
    it.result = r;
    it.finished_at = Date.now();
    await V.put(k.name, JSON.stringify(it));
    out.push({ id: k.name, status: it.status });
  }
  return out;
}

addEventListener("scheduled", (event) => {
  event.waitUntil((async () => {
    const r = await runDue(PLATFORM_KV, false);
    console.log("cron runDue:", JSON.stringify(r));
  })());
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const V = PLATFORM_KV;
    const j = (r) => r.json();

    if (url.pathname === "/health") return Response.json({ ok: 1, svc: "beefyhub-ig" });

    // ---------- PAINEL ----------
    if (url.pathname === "/panel" || url.pathname === "/panel/") {
      const sess = cookieVal(request, "sess");
      const expect = await hmacHex(PANEL_PASSWORD, PANEL_USER + "|sess");
      if (!sess || sess !== expect) return Response.redirect(url.origin + "/panel/login", 302);
      const html = await V.get("panel:html");
      if (!html) return new Response("Painel ainda nao publicado (KV panel:html vazio).", { status: 503 });
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/panel/login") {
      if (request.method === "GET") return new Response(LOGIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const okUser = (body.user || "").trim().toLowerCase() === (PANEL_USER || "").toLowerCase();
        const okPass = body.password === PANEL_PASSWORD;
        if (!okUser || !okPass) return Response.json({ error: "invalid" }, { status: 401 });
        const token = await hmacHex(PANEL_PASSWORD, PANEL_USER + "|sess");
        return Response.json({ ok: 1 }, { headers: { "Set-Cookie": "sess=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400" } });
      }
      return new Response("method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/panel/api/")) {
      const sess = cookieVal(request, "sess");
      const expect = await hmacHex(PANEL_PASSWORD, PANEL_USER + "|sess");
      if (!sess || sess !== expect) return Response.json({ error: "unauthorized" }, { status: 401 });

      const tok = await V.get("tok");
      if (!tok) return Response.json({ error: "no token" }, { status: 401 });
      const T = encodeURIComponent(tok);

      if (url.pathname === "/panel/api/summary" && request.method === "GET") {
        const [me, limit, ins] = await Promise.all([
          fetch(G + "/me?fields=id,username,name,followers_count,follows_count,media_count,account_type&access_token=" + T).then(j),
          fetch(G + "/me/content_publishing_limit?access_token=" + T).then(j).catch(() => null),
          fetch(G + "/me/insights?metric=reach,accounts_engaged,total_interactions,follower_count,profile_views&period=day&access_token=" + T).then(j).catch(() => null)
        ]);
        return Response.json({ me, limit, insights: ins });
      }

      if (url.pathname === "/panel/api/media" && request.method === "GET") {
        const m = await fetch(G + "/me/media?fields=id,caption,media_type,media_product_type,permalink,timestamp&limit=12&access_token=" + T).then(j);
        const items = (m.data || []).slice(0, 8);
        const withIns = await Promise.all(items.map(async (it) => {
          if (it.media_product_type !== "FEED" && it.media_product_type !== "REELS") return it;
          const metric = it.media_product_type === "REELS" ? "likes,comments,reach,saved,shares,plays" : "likes,comments,reach,saved,shares";
          const ins = await fetch(G + "/" + it.id + "/insights?metric=" + metric + "&access_token=" + T).then(j).catch(() => null);
          return { ...it, insights: ins && ins.data ? ins.data : null };
        }));
        return Response.json({ data: withIns });
      }

      if (url.pathname === "/panel/api/comments" && request.method === "GET") {
        const mid = url.searchParams.get("media_id");
        if (!mid) return Response.json({ error: "informe media_id na query" }, { status: 400 });
        return Response.json(await fetch(G + "/" + mid + "/comments?fields=id,text,username,timestamp&access_token=" + T).then(j));
      }

      if (url.pathname === "/panel/api/reply" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.comment_id || !b.message) return Response.json({ error: "comment_id e message sao obrigatorios" }, { status: 400 });
        const r = await fetch(G + "/" + encodeURIComponent(b.comment_id) + "/replies", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ message: b.message, access_token: tok }).toString()
        }).then(j);
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/hide" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.comment_id) return Response.json({ error: "comment_id obrigatorio" }, { status: 400 });
        const r = await fetch(G + "/" + encodeURIComponent(b.comment_id) + "?access_token=" + T, { method: "DELETE" }).then(j);
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/queue" && request.method === "GET") {
        const l = await V.list({ prefix: "q:" });
        const items = await Promise.all(l.keys.map(async (k) => {
          const v = await V.get(k.name);
          try { return { id: k.name, ...JSON.parse(v) }; } catch (e) { return { id: k.name, raw: v }; }
        }));
        items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return Response.json({ data: items });
      }

      if (url.pathname === "/panel/api/queue/action" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.id || !b.action) return Response.json({ error: "id e action sao obrigatorios" }, { status: 400 });
        const v = await V.get(b.id);
        if (!v) return Response.json({ error: "item nao encontrado" }, { status: 404 });
        let item;
        try { item = JSON.parse(v); } catch (e) { item = {}; }
        item.status = b.action === "approve" ? "aprovado" : "rejeitado";
        item.decided_at = Date.now();
        await V.put(b.id, JSON.stringify(item));
        return Response.json({ ok: 1, item });
      }

      if (url.pathname === "/panel/api/publish" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.urls || !b.urls.length || !b.caption) return Response.json({ error: "urls e caption sao obrigatorios" }, { status: 400 });
        if (b.urls.length < 2) return Response.json({ error: "carrossel precisa de no minimo 2 imagens" }, { status: 400 });
        const children = [];
        for (const u of b.urls) {
          const r = await fetch(G + "/me/media", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: tok }).toString()
          }).then(j);
          if (!r.id) return Response.json({ error: "falha ao criar item", detail: r }, { status: 500 });
          children.push(r.id);
        }
        const cont = await fetch(G + "/me/media", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ caption: b.caption, media_type: "CAROUSEL", children: children.join(","), access_token: tok }).toString()
        }).then(j);
        if (!cont.id) return Response.json({ error: "falha ao criar container", detail: cont }, { status: 500 });
        const pub = await fetch(G + "/me/media_publish?creation_id=" + encodeURIComponent(cont.id) + "&access_token=" + T, { method: "POST" }).then(j);
        return Response.json({ ok: 1, result: pub });
      }

      if (url.pathname === "/panel/api/schedule" && request.method === "GET") {
        const l = await V.list({ prefix: "s:" });
        const items = await Promise.all(l.keys.map(async (k) => {
          const v = await V.get(k.name);
          try { return { id: k.name, ...JSON.parse(v) }; } catch (e) { return { id: k.name, raw: v }; }
        }));
        items.sort((a, b) => (a.run_at || 0) - (b.run_at || 0));
        return Response.json({ data: items, now: Date.now() });
      }

      if (url.pathname === "/panel/api/schedule" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.urls || !b.urls.length || !b.caption || !b.run_at) return Response.json({ error: "urls, caption e run_at sao obrigatorios" }, { status: 400 });
        const id = "s:" + Date.now();
        const item = { urls: b.urls, caption: b.caption, run_at: Number(b.run_at), status: "agendado", created_at: Date.now() };
        await V.put(id, JSON.stringify(item));
        return Response.json({ ok: 1, id, item });
      }

      if (url.pathname === "/panel/api/schedule/delete" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.id || b.id.indexOf("s:") !== 0) return Response.json({ error: "id invalido" }, { status: 400 });
        await V.delete(b.id);
        return Response.json({ ok: 1 });
      }

      if (url.pathname === "/panel/api/schedule/run-now" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const r = await runDue(V, !!b.dry_run);
        return Response.json({ ran: r });
      }

      return Response.json({ error: "rota nao encontrada" }, { status: 404 });
    }

    if (url.pathname === "/auth") {
      const st = crypto.randomUUID();
      await V.put("st:" + st, "1", { expirationTtl: 600 });
      const a = new URL(AUTH);
      a.searchParams.set("client_id", IG_APP_ID);
      a.searchParams.set("redirect_uri", BASE_URL + "/callback");
      a.searchParams.set("scope", SCOPES);
      a.searchParams.set("response_type", "code");
      a.searchParams.set("state", st);
      return Response.redirect(a.toString(), 302);
    }

    if (url.pathname === "/callback") {
      // Se ja existe token, nao reprocessa o code (evita "code has been used" ao atualizar a pagina)
      if (await V.get("tok")) return Response.redirect(url.origin + "/", 302);
      const code = url.searchParams.get("code");
      const st = url.searchParams.get("state");
      if (!code) return new Response("no code", { status: 400 });
      if (!await V.get("st:" + st)) return new Response("bad state", { status: 400 });
      const t = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: BASE_URL + "/callback", code }).toString()
      }).then(j);
      if (!t.access_token) return new Response("TOKEN FAIL: " + JSON.stringify(t), { status: 500 });
      const l = await fetch(G + "/access_token?grant_type=ig_exchange_token&client_secret=" + IG_APP_SECRET + "&access_token=" + encodeURIComponent(t.access_token)).then(j);
      if (!l.access_token) return new Response("LONG FAIL: " + JSON.stringify(l), { status: 500 });
      await V.put("tok", l.access_token, { expirationTtl: (l.expires_in || 5184000) - 3600 });
      const m = await fetch(G + "/me?fields=id,username,name,followers_count,follows_count,media_count,account_type&access_token=" + encodeURIComponent(l.access_token)).then(j);
      await V.put("user", JSON.stringify(m));
      return new Response("CONECTADO: " + JSON.stringify(m));
    }

    if (url.pathname === "/api/me") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      return Response.json(await fetch(G + "/me?fields=id,username,followers_count,media_count&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/media") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      return Response.json(await fetch(G + "/me/media?fields=id,caption,media_type,permalink,timestamp&limit=12&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/comments") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      const mid = url.searchParams.get("media_id");
      if (!mid) return Response.json({ error: "informe media_id na query" }, { status: 400 });
      return Response.json(await fetch(G + "/" + mid + "/comments?fields=id,text,username,timestamp&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/publishing-limit") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      return Response.json(await fetch(G + "/me/content_publishing_limit?access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/insights") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      const mid = url.searchParams.get("media_id");
      const target = mid || "me";
      const metric = mid ? "likes,comments,reach,saved,shares" : "reach,accounts_engaged,total_interactions,follower_count,profile_views";
      const apiUrl = G + "/" + target + "/insights?metric=" + metric + (mid ? "" : "&period=day");
      return Response.json(await fetch(apiUrl + "&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/webhook") {
      if (request.method === "GET") {
        const m = url.searchParams.get("hub.mode"), t = url.searchParams.get("hub.verify_token"), c = url.searchParams.get("hub.challenge");
        if (m === "subscribe" && t === WEBHOOK_VERIFY_TOKEN) return new Response(c);
        return new Response("forbidden", { status: 403 });
      }
      if (request.method === "POST") {
        const ev = await request.json().catch(() => null);
        if (ev) await V.put("webhook:" + Date.now(), JSON.stringify(ev), { expirationTtl: 86400 });
        return Response.json({ ok: 1 });
      }
      return new Response("method not allowed", { status: 405 });
    }

    const sv = await V.get("user");
    return new Response("Beefy HUB IG | plataforma @eltonorvate | conta: " + (sv || "nenhuma") + " | rotas: /panel /auth /callback /api/me /api/media /api/comments /api/insights /api/publishing-limit /health /webhook");
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
