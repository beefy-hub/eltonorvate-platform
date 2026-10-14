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

async function waSend(text) {
  if (typeof DIGISAC_TOKEN === "undefined" || !DIGISAC_TOKEN) return { ok: 0, error: "digisac nao configurado" };
  const r = await fetch("https://beecont.digisac.app/api/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + DIGISAC_TOKEN },
    body: JSON.stringify({ text: text, type: "chat", serviceId: DIGISAC_SERVICE_ID, number: DIGISAC_NUMBER, dontOpenTicket: true, origin: "bot" })
  });
  let jr = null;
  try { jr = await r.json(); } catch (e) {}
  return { ok: r.ok ? 1 : 0, status: r.status, result: jr };
}


function bytesFromB64(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function filesIndex(V) {
  try { return JSON.parse(await V.get("f:index") || "{}"); } catch (e) { return {}; }
}

function slugTags(tema) {
  const stop = ["de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "a", "o", "as", "os", "um", "uma", "para", "com", "que", "se", "ao", "aos"];
  return String(tema).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3 && stop.indexOf(w) < 0).slice(0, 4).map((w) => "#" + w[0].toUpperCase() + w.slice(1));
}

function buildCaption(b) {
  const tema = String(b.tema || "").trim();
  const bullets = (Array.isArray(b.bullets) ? b.bullets : String(b.bullets || "").split("\n")).map((x) => String(x).trim()).filter(Boolean).slice(0, 5);
  const tom = String(b.tom || "critico");
  const pergunta = String(b.pergunta || "").trim();
  let gancho;
  if (tom === "dados") gancho = "Numero nao tem lado. Tem consequencia. E esse aqui muda a conta de qualquer gestor:";
  else if (tom === "motivacional") gancho = "O Brasil nao precisa de mais promessa. Precisa de gestao. Veja o que isso significa na pratica:";
  else gancho = "Enquanto o debate politico gira em fofoca, quem empreende e quem paga conta sabe: o que importa e isso aqui:";
  const body = bullets.map((x) => "- " + x).join("\n");
  const tags = ["#EltonOrvate", "#MenosEstadoMaisEmpreendedor", "#PoliticaComNegocios"].concat(slugTags(tema)).concat(["#DireitaConservadora"]).join(" ");
  let cap = gancho + "\n\n" + (body ? body + "\n\n" : "");
  if (pergunta) cap += pergunta + "\n\n";
  cap += "Sou Elton Orvate: contador, DEV e empreendedor. Analiso politica com a mesma regua dos negocios: resultado.\n\nMe segue para acompanhar as proximas analises.\n\n" + tags;
  return cap;
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

      if (url.pathname === "/panel/api/wa-test" && request.method === "POST") {
        const r = await waSend("Beefy HUB IG: integracao WhatsApp ativa. Aprovacoes de pauta chegarao por aqui - responda APROVAR ou REJEITAR com o codigo.");
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/wa-approve" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.id || b.id.indexOf("q:") !== 0) return Response.json({ error: "id invalido" }, { status: 400 });
        const v = await V.get(b.id);
        if (!v) return Response.json({ error: "item nao encontrado" }, { status: 404 });
        let it;
        try { it = JSON.parse(v); } catch (e) { it = {}; }
        const code = b.id.slice(2);
        const resumo = (it.titulo || it.caption || it.tipo || "post").toString().slice(0, 80);
        const n = (it.urls || []).length;
        const msg = "APROVACAO DE POST - @eltonorvate\n\nPauta: " + resumo + "\nCodigo: " + code + "\nImagens: " + n +
          (it.descricao ? "\n\n" + String(it.descricao).slice(0, 200) : "") +
          "\n\nResponda:\nAPROVAR " + code + " - publica agora\nREJEITAR " + code + " - descarta";
        const r = await waSend(msg);
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/files" && request.method === "GET") {
        return Response.json({ data: await filesIndex(V) });
      }

      if (url.pathname === "/panel/api/files" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const name = String(b.name || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
        const ct = String(b.ct || "");
        if (!name || !/^image\/(png|jpe?g|webp)$/.test(ct)) return Response.json({ error: "envie imagem png/jpg/webp com nome valido" }, { status: 400 });
        let bytes;
        try { bytes = bytesFromB64(String(b.data || "")); } catch (e) { return Response.json({ error: "base64 invalido" }, { status: 400 }); }
        if (!bytes.length || bytes.length > 12 * 1024 * 1024) return Response.json({ error: "arquivo vazio ou maior que 12MB" }, { status: 400 });
        await V.put("f:" + name, bytes);
        const idx = await filesIndex(V);
        idx[name] = { ct: ct, size: bytes.length, ts: Date.now() };
        await V.put("f:index", JSON.stringify(idx));
        return Response.json({ ok: 1, name: name, url: (typeof BASE_URL !== "undefined" ? BASE_URL : url.origin) + "/file/" + name });
      }

      if (url.pathname === "/panel/api/files/delete" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const name = String(b.name || "").toLowerCase();
        if (!name || name.indexOf("/") >= 0) return Response.json({ error: "nome invalido" }, { status: 400 });
        await V.delete("f:" + name);
        const idx = await filesIndex(V);
        delete idx[name];
        await V.put("f:index", JSON.stringify(idx));
        return Response.json({ ok: 1 });
      }
      if (url.pathname === "/panel/api/caption" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        return Response.json({ ok: 1, caption: buildCaption(b) });
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

    if (url.pathname === "/digisac" && request.method === "POST") {
      const ev = await request.json().catch(() => null);
      await V.put("wa:" + Date.now(), JSON.stringify(ev), { expirationTtl: 86400 });
      const msg = (ev && (ev.data || ev.message)) || ev || {};
      const num = String(msg.number || msg.from || "").replace(/\D/g, "");
      const admin = String(typeof DIGISAC_NUMBER !== "undefined" ? DIGISAC_NUMBER : "").replace(/\D/g, "");
      if (!admin || !num.endsWith(admin)) return Response.json({ ok: 0, error: "numero nao autorizado" }, { status: 403 });
      const text = String(msg.text || msg.body || "").trim();
      const m = text.match(/^(APROVAR|REJEITAR)\s*(\S+)?/i);
      if (!m) return Response.json({ ok: 0, error: "comando nao reconhecido" }, { status: 400 });
      const action = m[1].toLowerCase() === "aprovar" ? "approve" : "reject";
      let id = m[2] ? (m[2].indexOf("q:") === 0 ? m[2] : "q:" + m[2]) : null;
      if (!id) {
        const l = await V.list({ prefix: "q:" });
        const items = await Promise.all(l.keys.map(async (k) => {
          const v = await V.get(k.name);
          let it2;
          try { it2 = JSON.parse(v); } catch (e) { it2 = null; }
          return it2 ? { id: k.name, ...it2 } : null;
        }));
        const pend = items.filter(x => x && (x.status === "pendente" || !x.status)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
        if (!pend.length) { await waSend("Nenhuma pauta pendente de aprovacao."); return Response.json({ ok: 0, error: "nenhum pendente" }); }
        id = pend[0].id;
      }
      const v = await V.get(id);
      if (!v) { await waSend("Item " + id + " nao encontrado. Verifique o codigo."); return Response.json({ ok: 0, error: "nao encontrado" }, { status: 404 }); }
      let item;
      try { item = JSON.parse(v); } catch (e) { item = {}; }
      if (action === "reject") {
        item.status = "rejeitado";
        item.decided_at = Date.now();
        await V.put(id, JSON.stringify(item));
        await waSend("Rejeitado (" + id + "). A pauta foi descartada.");
        return Response.json({ ok: 1, id, status: "rejeitado" });
      }
      item.status = "aprovado";
      item.decided_at = Date.now();
      if (item.urls && item.urls.length && item.caption) {
        const r = await publishCarousel(V, item.urls, item.caption);
        item.status = r.ok ? "publicado" : "erro";
        item.result = r;
        item.finished_at = Date.now();
        await V.put(id, JSON.stringify(item));
        await waSend(r.ok ? ("Publicado no Instagram: " + id) : ("Falha ao publicar " + id + ": " + JSON.stringify(r.error || r).slice(0, 150)));
        return Response.json({ ok: 1, id, status: item.status });
      }
      await V.put(id, JSON.stringify(item));
      await waSend("Aprovado (" + id + "). Sem artes anexadas - aguardando publicacao pelo painel.");
      return Response.json({ ok: 1, id, status: "aprovado" });
    }

    if (url.pathname.indexOf("/file/") === 0 && request.method === "GET") {
      const name = url.pathname.slice(6).toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) return new Response("invalid", { status: 400 });
      const buf = await V.get("f:" + name, { type: "arrayBuffer" });
      if (!buf) return new Response("not found", { status: 404 });
      const idx = await filesIndex(V);
      const meta = idx[name];
      return new Response(buf, { headers: { "Content-Type": (meta && meta.ct) || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
    }

    const sv = await V.get("user");
    return new Response("Beefy HUB IG | plataforma @eltonorvate | conta: " + (sv || "nenhuma") + " | rotas: /panel /auth /callback /api/me /api/media /api/comments /api/insights /api/publishing-limit /health /webhook");
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
