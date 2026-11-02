# LucroSKU

Plataforma SaaS em português brasileiro para gestão de lucratividade de vendedores de marketplaces. Stack: Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/RLS e Decimal.js.

## Recursos
- Painel autenticado, cadastro de produtos e importação/exportação CSV.
- Cálculo de lucro, margem, ROI, preço de equilíbrio e preço para margem-alvo.
- Simulações persistentes, canais de marketplace, comparador, metas e relatórios.
- Assinaturas recorrentes cobradas pela Kiwify (PRO, BUSINESS e SCALE).
- Webhook Kiwify com token secreto na URL, validação de eventos, associação pelo e-mail da conta LucroSKU e idempotência.
- RLS e isolamento multi-organização no Supabase.

## Configuração
Copie .env.example para .env.local. Configure no servidor:
- SUPABASE_SERVICE_ROLE_KEY
- KIWIFY_WEBHOOK_TOKEN (token aleatório forte)
- URLs dos três checkouts Kiwify

Nunca publique .env.local nem use NEXT_PUBLIC_ em segredos.

## Webhook Kiwify
Depois de publicar, cadastre no painel Kiwify em Apps → Webhooks a URL:
`https://SEU_DOMINIO/api/webhooks/kiwify?token=SEU_KIWIFY_WEBHOOK_TOKEN`

Selecione os três produtos/ofertas e os eventos de compra aprovada, assinatura renovada, assinatura cancelada, assinatura atrasada, reembolso e chargeback. O comprador deve usar o mesmo e-mail da conta LucroSKU para que o sistema associe o pagamento à organização correta. Teste o webhook e confira os logs da Kiwify.

## Desenvolvimento local
Node.js 22+ e npm:
```bash
npm install
npm run dev
npm test
npm run build
```
