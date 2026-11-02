import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime = 'nodejs';
type Payload = { id?: string; event?: string; subscription?: { id?: string }; payment?: { id?: string; subscription?: string; status?: string; invoiceUrl?: string } };
function safeTokenMatch(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !safeTokenMatch(request.headers.get('asaas-access-token'), expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let payload: Payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!payload.id || !payload.event) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  const subscriptionId = payload.subscription?.id ?? payload.payment?.subscription;
  if (!subscriptionId) return NextResponse.json({ received: true, ignored: true });
  const admin = createAdminClient();
  const { error: eventError } = await admin.from('asaas_webhook_events').insert({ id: payload.id, event: payload.event });
  if (eventError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: 'Could not persist event' }, { status: 500 });
  let status: 'active' | 'past_due' | 'canceled' | null = null;
  if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(payload.event)) status = 'active';
  else if (['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE'].includes(payload.event)) status = 'past_due';
  else if (['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(payload.event)) status = 'canceled';
  const updates: { status?: 'active' | 'past_due' | 'canceled'; payment_url?: string } = {};
  if (status) updates.status = status;
  if (payload.payment?.invoiceUrl) updates.payment_url = payload.payment.invoiceUrl;
  if (Object.keys(updates).length) {
    let query = admin.from('subscriptions').update(updates).eq('asaas_subscription_id', subscriptionId);
    if (status) query = query.in('status',['pending','active','past_due']);
    const { error } = await query;
    if (error) {
      await admin.from('asaas_webhook_events').delete().eq('id', payload.id);
      return NextResponse.json({ error: 'Could not update subscription' }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
