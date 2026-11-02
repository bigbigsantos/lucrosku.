import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {DashboardShell,Notice} from '@/components/dashboard-shell';

type Subscription={id:string;plan_code:string;status:string;created_at:string};
const labels:Record<string,string>={pending:'Aguardando confirmação',active:'Ativa',past_due:'Pagamento pendente',canceled:'Cancelada',expired:'Expirada'};
const plans=[
  {code:'pro',name:'Profissional',description:'Mais capacidade para acompanhar produtos e rentabilidade.',url:process.env.KIWIFY_CHECKOUT_PRO||'https://pay.kiwify.com.br/5r7dtb9'},
  {code:'business',name:'Business',description:'Recursos ampliados para uma operação em crescimento.',url:process.env.KIWIFY_CHECKOUT_BUSINESS||'https://pay.kiwify.com.br/5FlGk2B'},
  {code:'scale',name:'Scale',description:'Estrutura para equipes e operações maiores.',url:process.env.KIWIFY_CHECKOUT_SCALE||'https://pay.kiwify.com.br/BHTtFXE'},
];
export default async function SubscriptionPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:rows}=await supabase.from('subscriptions').select('id,plan_code,status,created_at').order('created_at',{ascending:false}).limit(10);
  const subscriptions=(rows??[]) as Subscription[];
  const email=user.email;
  return <DashboardShell title="Assinatura" subtitle="Escolha seu plano mensal e acompanhe a situação da assinatura.">
    <Notice type="info">A assinatura é processada com segurança pela Kiwify. Para liberar seu acesso automaticamente, faça a compra usando este mesmo e-mail da sua conta LucroSKU: <strong>{email}</strong>.</Notice>
    <div className="grid3">{plans.map(plan=><article className="card" key={plan.code}>
      <div className="metric-label">PLANO {plan.code.toUpperCase()}</div>
      <h2 style={{fontSize:18,margin:'8px 0'}}>{plan.name}</h2>
      <div className="metric-value">Mensal</div>
      <p className="muted" style={{fontSize:12,lineHeight:1.6}}>{plan.description}</p>
      <a className="btn" href={`${plan.url}${plan.url.includes('?')?'&':'?'}email=${encodeURIComponent(email??'')}`} target="_blank" rel="noreferrer">Assinar {plan.name}</a>
    </article>)}</div>
    <article className="card" style={{marginTop:16}}><h2 style={{fontSize:17,marginTop:0}}>Histórico de assinatura</h2>
      {!subscriptions.length?<div className="empty">Nenhuma assinatura registrada. Após a confirmação da compra, ela aparecerá aqui.</div>:<div className="table-wrap"><table className="table"><thead><tr><th>Plano</th><th>Status</th><th>Data</th></tr></thead><tbody>{subscriptions.map(x=><tr key={x.id}><td>{x.plan_code.toUpperCase()}</td><td>{labels[x.status]??x.status}</td><td>{new Date(x.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div>}
    </article>
  </DashboardShell>;
}
