import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '@/lib/supabase/admin';

export const runtime='nodejs';

type KiwifyPayload={
  order_id?:string;
  order_status?:string;
  webhook_event_type?:string;
  checkout_link?:string;
  subscription_id?:string;
  Product?:{product_id?:string;product_offer_id?:string};
  Customer?:{email?:string|null};
  Subscription?:{id?:string;status?:string};
};

const checkoutPlans:Record<string,'pro'|'business'|'scale'>={
  '5r7dtb9':'pro',
  '5FlGk2B':'business',
  'BHTtFXE':'scale',
};

function matchesToken(received:string|null,expected:string){
  if(!received)return false;
  const a=Buffer.from(received);const b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}

async function findUserIdByEmail(admin:ReturnType<typeof createAdminClient>,email:string){
  for(let page=1;page<=20;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const found=data.users.find(user=>user.email?.toLowerCase()===email);
    if(found)return found.id;
    if(data.users.length<1000)break;
  }
  return null;
}

export async function POST(request:NextRequest){
  const expected=process.env.KIWIFY_WEBHOOK_TOKEN;
  if(!expected||!matchesToken(request.nextUrl.searchParams.get('token'),expected)){
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }

  let payload:KiwifyPayload;
  try{payload=await request.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  const event=payload.webhook_event_type;
  const orderId=payload.order_id;
  if(!event||!orderId)return NextResponse.json({error:'Missing event/order id'},{status:400});

  const plan=checkoutPlans[payload.checkout_link??''];
  const subscriptionId=payload.subscription_id??payload.Subscription?.id??null;
  const admin=createAdminClient();
  const eventId=`${orderId}:${event}`;

  const {error:logged}=await admin.from('kiwify_webhook_events').insert({id:eventId,event,order_id:orderId});
  if(logged?.code==='23505')return NextResponse.json({received:true,duplicate:true});
  if(logged)return NextResponse.json({error:'Could not persist event'},{status:500});

  try{
    const email=payload.Customer?.email?.trim().toLowerCase();
    const activating=['order_approved','subscription_renewed'].includes(event)&&payload.order_status==='paid';
    const canceling=['subscription_canceled','subscription_cancelled'].includes(event);
    const overdue=['subscription_overdue','subscription_late'].includes(event);
    const refunding=['order_refunded','order_chargeback','order_chargedback'].includes(event);

    if(activating){
      if(!plan){
        await admin.from('kiwify_webhook_events').delete().eq('id',eventId);
        return NextResponse.json({error:'Unknown checkout link'},{status:422});
      }
      let organizationId:string|null=null;
      if(subscriptionId){
        const {data:existing,error}=await admin.from('subscriptions').select('organization_id').eq('kiwify_subscription_id',subscriptionId).limit(1).maybeSingle();
        if(error)throw error;
        organizationId=existing?.organization_id??null;
      }
      if(!organizationId&&email){
        const userId=await findUserIdByEmail(admin,email);
        if(userId){
          const {data:membership,error}=await admin.from('organization_members').select('organization_id').eq('user_id',userId).eq('role','owner').limit(1).maybeSingle();
          if(error)throw error;
          organizationId=membership?.organization_id??null;
        }
      }
      if(!organizationId){
        await admin.from('kiwify_webhook_events').delete().eq('id',eventId);
        return NextResponse.json({error:'No LucroSKU account matched the buyer email'},{status:422});
      }

      const {data:updated,error:updateError}=await admin.from('subscriptions')
        .update({plan_code:plan,status:'active',kiwify_order_id:orderId,kiwify_subscription_id:subscriptionId})
        .eq('organization_id',organizationId)
        .in('status',['pending','active','past_due'])
        .select('id').limit(1);
      if(updateError)throw updateError;
      if(!updated?.length){
        const {error:insertError}=await admin.from('subscriptions').insert({
          organization_id:organizationId,plan_code:plan,status:'active',
          kiwify_order_id:orderId,kiwify_subscription_id:subscriptionId
        });
        if(insertError)throw insertError;
      }
    }else if(subscriptionId&&(canceling||overdue||refunding)){
      const status=canceling?'canceled':'past_due';
      const {error:updateError}=await admin.from('subscriptions').update({status})
        .eq('kiwify_subscription_id',subscriptionId)
        .in('status',['pending','active','past_due']);
      if(updateError)throw updateError;
    }

    return NextResponse.json({received:true});
  }catch(error){
    await admin.from('kiwify_webhook_events').delete().eq('id',eventId);
    console.error('Kiwify webhook processing failed',error);
    return NextResponse.json({error:'Webhook processing failed'},{status:500});
  }
}
