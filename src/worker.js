const AUTH = "https://api.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const G = "https://graph.instagram.com";
const SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { IG_APP_ID, IG_APP_SECRET, BASE_URL } = env;
    const V = env.PLATFORM_KV;
    const j = (r) => r.json();

    if (url.pathname === "/health") return Response.json({ ok: 1, svc: "beefyhub-ig" });

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
      if (await V.get("tok")) return Response.redirect("/", 302);
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
      if (!mid) return Response.json({ error: "informe ?media_id=" }, { status: 400 });
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
        if (m === "subscribe" && t === env.WEBHOOK_VERIFY_TOKEN) return new Response(c);
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
    return new Response("Beefy HUB IG | plataforma @eltonorvate | conta: " + (sv || "nenhuma") + " | rotas: /auth /callback /api/me /api/media /api/comments /api/insights /api/publishing-limit /health /webhook");
  }
}
