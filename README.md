# Elton Orvate Platform

Plataforma própria de gestão do Instagram **@eltonorvate** — substitui o Metricool no pipeline editorial (pauta → aprovação → publicação → insights → comentários → DM).

## Stack
- **Cloudflare Workers** (ES module, sem build)
- **Cloudflare KV** (tokens OAuth da Meta, estado de fluxo, dados da conta)
- **Instagram API with Instagram Login** (`graph.instagram.com`)

## Status: Fase 1 — testes de conectividade
| Teste | Endpoint | Status |
|---|---|---|
| Troca de code por token | `/callback` | ⬜ |
| Long-lived token (60 dias) | `/callback` | ⬜ |
| Perfil (`instagram_business_basic`) | `/api/me` | ⬜ |
| Mídias da conta | `/api/media` | ⬜ |
| Insights da conta | `/api/insights` | ⬜ |
| Cota de publicação | `/api/publishing-limit` | ⬜ |
| Comentários | `/api/comments?media_id=` | ⬜ |
| Publicação de carrossel | (fase 2) | ⬜ |

## Scopes utilizados
- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

## Setup local
```bash
npm install
npx wrangler secret put IG_APP_ID       # App ID do Instagram Login
npx wrangler secret put IG_APP_SECRET   # App Secret
npx wrangler dev
```

## Deploy
```bash
npx wrangler deploy
```

## Fluxo OAuth
1. Painel em `/` mostra a URL de callback a cadastrar no app da Meta.
2. `/auth` redireciona para `api.instagram.com/oauth/authorize`.
3. `/callback` troca o code por token, converte para long-lived e grava no KV.
4. Testes de leitura validam os scopes.

> ⚠️ Enquanto o app estiver em **modo de desenvolvimento** (sem App Review), apenas contas com papel no app (admin/desenvolvedor/tester) podem autorizar. Isso cobre o @eltonorvate para os testes.
