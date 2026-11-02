'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const plans = {
  pro: { label: 'Profissional', env: 'ASAAS_PLAN_PRO_PRICE' },
  business: { label: 'Negócio', env: 'ASAAS_PLAN_BUSINESS_PRICE' },
  scale: { label: 'Escala', env: 'ASAAS_PLAN_SCALE_PRICE' },
} as const;
const schema = z.object({ plan: z.enum(['pro','business','scale']), billingType: z.enum(['PIX','BOLETO']) });
async function asaasRequest(url: string, init: RequestInit): Promise<Response | null> {
  try { return await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15_000) }); }
  catch { return null; }
}

export async function startSubscription(formData: FormData) {
  const parsed = schema.safeParse({ plan: formData.get('plan'), billingType: formData.get('billingType') });
  if (!parsed.success) redirect('/dashboard/assinatura?error=plano-invalido');
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').replace(/\/$/, '');
  if (!apiKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/dashboard/assinatura?error=integracao-nao-configurada');
  const plan = plans[parsed.data.plan];
  const price = Number(process.env[plan.env]);
  if (!Number.isFinite(price) || price <= 0) redirect('/dashboard/assinatura?error=preco-nao-configurado');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase.from('organization_members').select('organization_id,role').eq('user_id', user.id).limit(1).maybeSingle();
  if (!membership || !['owner','admin'].includes(membership.role)) redirect('/dashboard/assinatura?error=sem-permissao');

  const admin = createAdminClient();
  const { data: current } = await admin.from('subscriptions').select('id').eq('organization_id', membership.organization_id).in('status',['pending','active','past_due']).limit(1).maybeSingle();
  if (current) redirect('/dashboard/assinatura?error=assinatura-existente');
  const { data: existing } = await admin.from('subscriptions').select('asaas_customer_id').eq('organization_id', membership.organization_id).not('asaas_customer_id','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
  const headers = { access_token: apiKey, 'Content-Type': 'application/json', accept: 'application/json' };
  let customerId = existing?.asaas_customer_id ?? null;
  if (!customerId) {
    const customerResponse = await asaasRequest(`${baseUrl}/customers`, { method: 'POST', headers, body: JSON.stringify({ name: String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente LucroSKU'), email: user.email, externalReference: membership.organization_id }) });
    const customer = customerResponse ? await customerResponse.json().catch(() => null) : null;
    if (!customerResponse?.ok || !customer?.id) redirect('/dashboard/assinatura?error=falha-cliente');
    customerId = customer.id;
  }

  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const subscriptionResponse = await asaasRequest(`${baseUrl}/subscriptions`, { method: 'POST', headers, body: JSON.stringify({ customer: customerId, billingType: parsed.data.billingType, value: price, nextDueDate: dueDate, cycle: 'MONTHLY', description: `LucroSKU - Plano ${plan.label}`, externalReference: membership.organization_id }) });
  const subscription = subscriptionResponse ? await subscriptionResponse.json().catch(() => null) : null;
  if (!subscriptionResponse?.ok || !subscription?.id) redirect('/dashboard/assinatura?error=falha-assinatura');

  const paymentsResponse = await asaasRequest(`${baseUrl}/subscriptions/${subscription.id}/payments`, { method: 'GET', headers });
  const paymentsPayload = paymentsResponse?.ok ? await paymentsResponse.json().catch(() => null) : null;
  const paymentUrl = Array.isArray(paymentsPayload?.data) ? paymentsPayload.data.find((item: { invoiceUrl?: string }) => item.invoiceUrl)?.invoiceUrl ?? null : null;
  const { error } = await admin.from('subscriptions').insert({ organization_id: membership.organization_id, plan_code: parsed.data.plan, status: 'pending', asaas_customer_id: customerId, asaas_subscription_id: subscription.id, payment_url: paymentUrl });
  if (error) {
    await asaasRequest(`${baseUrl}/subscriptions/${subscription.id}`, { method: 'DELETE', headers });
    redirect('/dashboard/assinatura?error=falha-registro');
  }
  redirect(`/dashboard/assinatura?created=1&subscription=${encodeURIComponent(subscription.id)}`);
}
