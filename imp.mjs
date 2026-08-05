import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const KEY = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
const API='https://public-api2.ploomes.com';
async function get(p){const r=await fetch(API+p,{headers:{'User-Key':KEY,Accept:'application/json'}});const t=await r.text();if(!r.ok)throw new Error(r.status+': '+t.slice(0,300));return t?JSON.parse(t):{};}
const norm=s=>(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const since=new Date(Date.now()-365*86400000).toISOString();
let deals=[],skip=0;console.log('fetching...');
for(let i=0;i<20;i++){const j=await get(`/Deals?$filter=StatusId eq 2 and FinishDate ge ${since}&$expand=Contact($expand=City),Owner&$orderby=FinishDate desc&$top=300&$skip=${skip}`);const b=j?.value??[];deals.push(...b);console.log('page',i,b.length);if(b.length<300)break;skip+=300;}
const {data:sellers}=await admin.from('sales_sellers').select('id,name,profile_id,active');
const {data:pusers}=await admin.from('ploomes_users').select('ploomes_id,name,seller_id,profile_id');
const byName=new Map(),byProfile=new Map(),byPid=new Map();
for(const s of sellers??[]){byName.set(norm(s.name),s.id);if(s.profile_id)byProfile.set(s.profile_id,s.id);}
for(const u of pusers??[]){const sid=u.seller_id??(u.profile_id?byProfile.get(u.profile_id):null)??byName.get(norm(u.name));if(sid)byPid.set(Number(u.ploomes_id),sid);}
let created=0;const unmatched=new Set();
async function resolve(oid,on){if(oid&&byPid.has(oid))return byPid.get(oid);const n=norm(on);if(n&&byName.has(n)){const s=byName.get(n);if(oid)byPid.set(oid,s);return s;}
if(on){const {data,error}=await admin.from('sales_sellers').insert({name:on.trim(),active:true}).select('id').single();if(!error&&data){created++;byName.set(n,data.id);if(oid)byPid.set(oid,data.id);return data.id;}unmatched.add(on);}return null;}
const {data:existing}=await admin.from('manual_sales').select('id,ploomes_deal_id').not('ploomes_deal_id','is',null).range(0,49999);
const em=new Map((existing??[]).map(e=>[Number(e.ploomes_deal_id),e.id]));
let ins=0,upd=0;
for(const d of deals){const id=Number(d?.Id);if(!id)continue;const amount=Number(d?.Amount??0);if(!(amount>0))continue;
const on=d?.Owner?.Name??null;const sid=await resolve(d?.OwnerId??null,on);
const f=d?.FinishDate??d?.LastUpdateDate??d?.CreateDate;
const p={seller_id:sid,sale_date:f?new Date(f).toISOString().slice(0,10):new Date().toISOString().slice(0,10),amount,city:d?.Contact?.City?.Name??null,notes:d?.Title?`Ploomes: ${d.Title}`:'Importado do Ploomes',ploomes_deal_id:id,ploomes_owner_name:on,updated_at:new Date().toISOString()};
const found=em.get(id);
if(found){const{error}=await admin.from('manual_sales').update(p).eq('id',found);if(!error)upd++;else console.log('upd err',error.message);}
else{const{error}=await admin.from('manual_sales').insert(p);if(!error)ins++;else console.log('ins err',error.message);}}
console.log(JSON.stringify({fetched:deals.length,ins,upd,created,unmatched:[...unmatched]}));
