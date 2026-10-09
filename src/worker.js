const A="https://api.instagram.com/oauth/authorize",T="https://api.instagram.com/oauth/access_token",G="https://graph.instagram.com",S="instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages";
export default{async fetch(r,e){const u=new URL(r.url),{IG_APP_ID:I,IG_APP_SECRET:K,BASE_URL:B}=e,V=e.PLATFORM_KV;
if(u.pathname=="/health")return Response.json({ok:1,svc:"eltonorvate-platform"});
if(u.pathname=="/auth"){const st=crypto.randomUUID();await V.put("st:"+st,"1",{expirationTtl:600});const a=new URL(A);a.searchParams.set("client_id",I);a.searchParams.set("redirect_uri",B+"/callback");a.searchParams.set("scope",S);a.searchParams.set("response_type","code");a.searchParams.set("state",st);return Response.redirect(a.toString(),302)}
if(u.pathname=="/callback"){const c=u.searchParams.get("code"),st=u.searchParams.get("state");if(!c)return new Response("no code",{status:400});if(!await V.get("st:"+st))return new Response("bad state",{status:400});
const t=await fetch(T,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:I,client_secret:K,grant_type:"authorization_code",redirect_uri:B+"/callback",code:c}).toString()}).then(x=>x.json());
if(!t.access_token)return new Response("TOKEN FAIL: "+JSON.stringify(t),{status:500});
const l=await fetch(G+"/access_token?grant_type=ig_exchange_token&client_secret="+K+"&access_token="+encodeURIComponent(t.access_token)).then(x=>x.json());
if(!l.access_token)return new Response("LONG FAIL: "+JSON.stringify(l),{status:500});
await V.put("tok",l.access_token,{expirationTtl:(l.expires_in||5184000)-3600});
const m=await fetch(G+"/me?fields=id,username,name,followers_count,follows_count,media_count,account_type&access_token="+encodeURIComponent(l.access_token)).then(x=>x.json());
await V.put("user",JSON.stringify(m));
return new Response("CONECTADO: "+JSON.stringify(m))}
if(u.pathname=="/api/me"){const t=await V.get("tok");if(!t)return Response.json({error:"no token"},{status:401});return Response.json(await fetch(G+"/me?fields=id,username,followers_count,media_count&access_token="+encodeURIComponent(t)).then(x=>x.json()))}
const sv=await V.get("user");
return new Response("Elton Orvate Platform OK. conta: "+(sv||"nenhuma")+" | /auth /callback /api/me /health")}}
