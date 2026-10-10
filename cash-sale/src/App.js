import {useState,useEffect,useCallback,useRef}from 'react';
import {supabase,authClient} from './supabaseClient';
import './App.css';

const METHODS=[['cash','Cash'],['airtel','Airtel Money'],['mtn','MTN MoMo'],['bank','Bank']];
const fmt=n=>'ZMW '+Number(n||0).toLocaleString('en',{maximumFractionDigits:2});
const dayRange=d=>{const s=new Date(d+'T00:00:00');const e=new Date(s);e.setDate(e.getDate()+1);return[s.toISOString(),e.toISOString()]};
const today=()=>new Date().toLocaleDateString('en-CA');

/* ---------- SVG Icons ---------- */
const I={
  dash:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  sell:<><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.5a1 1 0 0 0 1 .5h8.8a1 1 0 0 0 1-.8L20.5 7H6"/></>,
  ret:<><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></>,
  cash:<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></>,
  rep:<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx=".5"/><rect x="12" y="8" width="3" height="10" rx=".5"/><rect x="17" y="5" width="3" height="13" rx=".5"/></>,
  stock:<><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></>,
  staff:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.5a5.5 5.5 0 0 1 5.5 5.5"/></>,
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon:<><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></>,
  logout:<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  plus:<><path d="M12 5v14M5 12h14"/></>,
  minus:<><path d="M5 12h14"/></>,
  x:<><path d="M18 6 6 18M6 6l12 12"/></>,
  check:<><path d="M20 6 9 17l-5-5"/></>,
  printer:<><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></>,
  download:<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
  edit:<><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>,
  trash:<><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  box:<><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></>,
  alert:<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
  refresh:<><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></>,
  barcode:<><path d="M3 5v14"/><path d="M7 5v14"/><path d="M11 5v14"/><path d="M15 5v14"/><path d="M19 5v14"/></>,
  target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
  zap:<><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></>,
};
const Icon=({n,s=18})=>(<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{I[n]}</svg>);

/* ---------- Payment Method Brand Icons ---------- */
const LOGO_PATHS={
  cash:'/logos/cash.jpg',
  airtel:'/logos/airtel.png',
  mtn:'/logos/pay-mtn.png',
  bank:'/logos/visa.png',
};
const PayIcon=({method,s=20})=>{
  const src=LOGO_PATHS[method];
  if(src)return <img src={src} alt={method} width={s} height={s} className="pay-logo"/>;
  return null;
};

/* Payment method badge with icon + label */
const PayBadge=({method,label})=>(
  <span className="pay-badge">
    <PayIcon method={method} s={18}/>
    <span>{label||label_(method)}</span>
  </span>
);
const label_=k=>METHODS.find(m=>m[0]===k)[1];

/* ---------- Login ---------- */
function Login(){
  const[email,setE]=useState('');const[pw,setP]=useState('');const[err,setErr]=useState('');const[up,setUp]=useState(false);const[busy,setBusy]=useState(false);
  const go=async e=>{e.preventDefault();setErr('');setBusy(true);
    const{error}=up?await supabase.auth.signUp({email,password:pw}):await supabase.auth.signInWithPassword({email,password:pw});
    setBusy(false);if(error)setErr(error.message)};
  return <div className="login"><form className="card" onSubmit={go}>
    <div className="logo"><span className="logo-icon"><Icon n="sell" s={20}/></span>Shop<i>Desk</i></div>
    <p className="login-sub">Sign in to start selling.</p>
    <input type="email" placeholder="Email address" value={email} onChange={e=>setE(e.target.value)} required autoFocus/>
    <input type="password" placeholder="Password" value={pw} onChange={e=>setP(e.target.value)} required minLength={6}/>
    {err&&<div className="err">{err}</div>}
    <button className="btn" disabled={busy}>{busy?'Please wait...':up?'Create owner account':'Sign in'}</button>
    <button type="button" className="btn ghost" onClick={()=>setUp(!up)}>{up?'I already have an account':'First time? Create the owner account'}</button>
    {up&&<p className="note">This only works once for the very first account. After that, the owner or a supervisor creates every other login from the Staff tab.</p>}
  </form></div>;
}

/* ---------- Hooks & Helpers ---------- */
const pn=p=>p.variant?`${p.name} - ${p.variant}`:p.name;
const label=k=>METHODS.find(m=>m[0]===k)[1];

/* Realtime hook — keeps data fresh across devices */
function useRealtime(table,onEvent){
  useEffect(()=>{
    const ch=supabase.channel('rt-'+table)
      .on('postgres_changes',{event:'*',schema:'public',table},onEvent)
      .subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[table]);
}

function useDay(date){
  const[d,setD]=useState({sales:[],refs:[]});
  const load=useCallback(()=>{const[s,e]=dayRange(date);
    Promise.all([supabase.from('sales').select('*,payments(*),profiles(name)').gte('created_at',s).lt('created_at',e).order('created_at',{ascending:false}),
      supabase.from('sale_returns').select('*').eq('status','approved').gte('created_at',s).lt('created_at',e)])
    .then(([a,b])=>setD({sales:a.data||[],refs:b.data||[]}))},[date]);
  useEffect(()=>{load()},[load]);
  // Realtime: reload when sales or returns change
  useRealtime('sales',load);
  useRealtime('sale_returns',load);
  const by={cash:0,airtel:0,mtn:0,bank:0};
  d.sales.forEach(s=>s.payments.forEach(p=>{by[p.method]+=Number(p.amount)}));
  d.refs.forEach(r=>{by[r.method]-=Number(r.amount)});
  return{...d,by,gross:d.sales.reduce((a,s)=>a+Number(s.total),0),refunded:d.refs.reduce((a,r)=>a+Number(r.amount),0),net:Object.values(by).reduce((a,b)=>a+b,0)};
}

/* Settings hook for receipt customization */
function useSettings(){
  const[s,setS]=useState({shop_name:'ShopDesk',shop_address:'',shop_phone:'',receipt_footer:'Thank you for your business!'});
  const load=useCallback(()=>supabase.from('settings').select('*').then(({data})=>{
    if(data&&data.length){const o={};data.forEach(r=>o[r.key]=r.value);setS(o)}}),[]);
  useEffect(()=>{load()},[load]);
  return{settings:s,reload:load};
}

/* Sales targets hook */
function useTargets(){
  const[t,setT]=useState(null);
  const load=useCallback(()=>supabase.from('sales_targets').select('*').order('created_at').limit(1)
    .then(({data})=>setT(data&&data[0]?data[0]:null)),[]);
  useEffect(()=>{load()},[load]);
  useRealtime('sales_targets',load);
  return{target:t,reload:load};
}

/* ---------- Dashboard ---------- */
function Dashboard({profile,settings}){
  const[date,setDate]=useState(today());const[low,setLow]=useState([]);
  const{sales,by,net,refunded}=useDay(date);
  const{target}=useTargets();
  const[showSettings,setShowSettings]=useState(false);
  const[showTarget,setShowTarget]=useState(false);
  useEffect(()=>{if(profile.role==='owner')supabase.from('products').select('*').then(({data})=>setLow((data||[]).filter(p=>p.stock<=p.low_at)))},[profile.role]);
  useRealtime('products',()=>{if(profile.role==='owner')supabase.from('products').select('*').then(({data})=>setLow((data||[]).filter(p=>p.stock<=p.low_at)))});
  const pct=k=>net>0?Math.max(0,Math.round(by[k]/net*100)):0;
  const cashiers={};sales.forEach(s=>{const n=s.profiles?.name||'-';cashiers[n]=(cashiers[n]||0)+Number(s.total)});
  const targetPct=target?Math.min(100,Math.round(net/target.target_amount*100)):0;
  return <>
    <div className="top"><h2>Dashboard</h2><div className="top-actions">
      <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      {profile.role==='owner'&&<button className="btn ghost sm" onClick={()=>setShowSettings(true)}><Icon n="settings" s={16}/> Receipt settings</button>}
    </div></div>
    <div className="card hero"><p>Net sales on {date}</p><div className="num">{fmt(net)}</div>
      <p>{sales.length} sale{sales.length===1?'':'s'}{refunded>0&&` — ${fmt(refunded)} refunded`}</p>
      <div className="seg">{METHODS.map(([k])=><span key={k} style={{width:pct(k)+'%',background:`var(--${k})`}}/>)}</div></div>
    {target&&profile.role!=='cashier'&&<div className="card target-card">
      <div className="target-header"><h3><Icon n="target" s={18}/> Daily target</h3>
        {profile.role==='owner'&&<button className="btn ghost sm" onClick={()=>setShowTarget(true)}><Icon n="edit" s={14}/> Edit</button>}</div>
      <div className="target-progress"><div className="target-bar" style={{width:targetPct+'%'}}/></div>
      <p className="target-text">{fmt(net)} of {fmt(target.target_amount)} — {targetPct}%</p>
    </div>}
    <div className="grid4">{METHODS.map(([k,l])=><div key={k} className="card tile" style={{'--c':`var(--${k})`}}>
      <PayIcon method={k} s={36}/><div className="num">{fmt(by[k])}</div><em>{pct(k)}% of sales</em></div>)}</div>
    <div className="two">
      <div className="card"><h3>Recent sales</h3><table><tbody>
        {sales.slice(0,8).map(s=><tr key={s.id}><td>{new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
         <td>{s.payments.map(p=>label(p.method)).join(' + ')}</td><td style={{textAlign:'right',fontWeight:600}}>{fmt(s.total)}</td></tr>)}
        {!sales.length&&<tr><td className="empty">No sales yet. Open the Sell tab to make the first one.</td></tr>}</tbody></table></div>
      {profile.role!=='cashier'&&<div className="card"><h3>Sales by cashier</h3><table><tbody>
        {Object.entries(cashiers).map(([n,t])=><tr key={n}><td>{n}</td><td style={{textAlign:'right',fontWeight:600}}>{fmt(t)}</td></tr>)}</tbody></table></div>}
      {profile.role==='owner'&&<div className="card"><h3>Running low</h3><table><tbody>
        {low.map(p=><tr key={p.id}><td>{pn(p)}</td><td className="low" style={{textAlign:'right'}}>{p.stock} left</td></tr>)}
        {!low.length&&<tr><td className="empty">All items are well stocked.</td></tr>}</tbody></table></div>}
    </div>
    {showSettings&&<SettingsModal settings={settings} onClose={()=>setShowSettings(false)}/>}
    {showTarget&&<TargetModal target={target} onClose={()=>setShowTarget(false)}/>}
  </>;
}

/* ---------- Settings Modal (Receipt customization) ---------- */
function SettingsModal({settings,onClose}){
  const[f,setF]=useState({...settings});
  const[busy,setBusy]=useState(false);
  const set=k=>e=>setF({...f,[k]:e.target.value});
  const save=async e=>{e.preventDefault();setBusy(true);
    for(const[k,v]of Object.entries(f)){
      await supabase.from('settings').upsert({key:k,value:v});
    }
    setBusy(false);onClose()};
  return <div className="modal"><form className="card" onSubmit={save}>
    <h3><Icon n="settings" s={18}/> Receipt Settings</h3>
    <label>Shop name<input value={f.shop_name||''} onChange={set('shop_name')} required/></label>
    <label>Address<input value={f.shop_address||''} onChange={set('shop_address')} placeholder="Street, City"/></label>
    <label>Phone<input value={f.shop_phone||''} onChange={set('shop_phone')} placeholder="+260..."/></label>
    <label>Receipt footer<textarea value={f.receipt_footer||''} onChange={set('receipt_footer')} rows={2}/></label>
    <button className="btn" disabled={busy}>{busy?'Saving...':'Save settings'}</button>
    <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
  </form></div>;
}

/* ---------- Target Modal ---------- */
function TargetModal({target,onClose}){
  const[amount,setAmount]=useState(target?target.target_amount:'');
  const[busy,setBusy]=useState(false);
  const save=async e=>{e.preventDefault();setBusy(true);
    if(target){await supabase.from('sales_targets').update({target_amount:+amount}).eq('id',target.id)}
    else{await supabase.from('sales_targets').insert({period_type:'daily',target_amount:+amount})}
    setBusy(false);onClose()};
  return <div className="modal"><form className="card" onSubmit={save}>
    <h3><Icon n="target" s={18}/> Daily Sales Target</h3>
    <p className="note">Set a daily sales goal. Progress will show on the dashboard.</p>
    <label>Target amount (ZMW)<input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} required/></label>
    <button className="btn" disabled={busy}>{busy?'Saving...':'Save target'}</button>
    <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
  </form></div>;
}

/* ---------- Sell (POS) with Barcode ---------- */
function Sell({profile,toast,settings}){
  const[prods,setProds]=useState([]);const[cart,setCart]=useState({});const[pays,setPays]=useState([{m:'cash',a:''}]);
  const[q,setQ]=useState('');const[busy,setBusy]=useState(false);const[rc,setRc]=useState(null);
  const[barcode,setBarcode]=useState('');const[bcMsg,setBcMsg]=useState('');
  const bcTimer=useRef(null);
  const load=useCallback(()=>supabase.from('products').select('*').eq('active',true).order('name').then(({data})=>setProds(data||[])),[]);
  useEffect(()=>{load()},[load]);
  useRealtime('products',load);
  const add=(p,d=1)=>setCart(c=>{const n=(c[p.id]||0)+d;const x={...c};if(n<=0)delete x[p.id];else if(n<=p.stock)x[p.id]=n;return x});
  const items=prods.filter(p=>cart[p.id]);const total=items.reduce((a,p)=>a+p.price*cart[p.id],0);
  const single=pays.length===1;const left=total-(single?total:pays.reduce((s,p)=>s+(+p.a||0),0));
  const setPay=(i,k,v)=>setPays(ps=>ps.map((p,j)=>j===i?{...p,[k]:v}:p));

  /* Barcode scanner: USB scanners type fast then press Enter */
  const onBarcodeKey=e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const code=barcode.trim();
      if(!code)return;
      const prod=prods.find(p=>p.barcode===code);
      if(prod){add(prod);setBcMsg('')}
      else setBcMsg('No product with barcode: '+code);
      setBarcode('');
    }
  };
  const onBarcodeChange=e=>{
    setBarcode(e.target.value);
    if(bcTimer.current)clearTimeout(bcTimer.current);
    bcTimer.current=setTimeout(()=>setBcMsg(''),3000);
  };

  const charge=async()=>{setBusy(true);
    const payments=single?[{method:pays[0].m,amount:total}]:pays.filter(p=>+p.a>0).map(p=>({method:p.m,amount:+p.a}));
    const{error}=await supabase.rpc('create_sale',{p_items:items.map(p=>({id:p.id,qty:cart[p.id]})),p_payments:payments});
    setBusy(false);if(error)return toast(error.message);
    setRc({items:items.map(p=>({...p,qty:cart[p.id]})),total,payments,at:new Date().toLocaleString()});
    setCart({});setPays([{m:'cash',a:''}]);load();toast('Sale saved');setTimeout(()=>window.print(),300)};
  const sn=settings.shop_name||'ShopDesk';
  const sa=settings.shop_address||'';
  const sp=settings.shop_phone||'';
  const sf=settings.receipt_footer||'Thank you!';
  return <>
    <div className="top"><h2>Sell</h2><div className="top-actions">
      <input className="search-input" placeholder="Search products..." value={q} onChange={e=>setQ(e.target.value)}/>
      <div className="barcode-wrap">
        <input className="barcode-input" placeholder="Scan barcode..." value={barcode} onChange={onBarcodeChange} onKeyDown={onBarcodeKey} autoComplete="off"/>
        {bcMsg&&<span className="err" style={{fontSize:12}}>{bcMsg}</span>}
      </div>
    </div></div>
  <div className="pos"><div className="prods">
    {prods.filter(p=>pn(p).toLowerCase().includes(q.toLowerCase())).map(p=>
      <button key={p.id} className="prod" disabled={p.stock<1} onClick={()=>add(p)}><b>{p.name}</b>{p.variant&&<small>{p.variant}</small>}
        <span className="price">{fmt(p.price)}</span><small className={p.stock<=p.low_at?'stock low':'stock'}>{p.stock} in stock</small></button>)}
    {!prods.length&&<p className="empty">No products yet. The owner can add them in the Stock tab.</p>}</div>
  <div className="card cart"><h3>Current sale</h3>
    {items.map(p=><div className="line" key={p.id}><span>{pn(p)}</span><span className="q">
      <button onClick={()=>add(p,-1)}><Icon n="minus" s={14}/></button> {cart[p.id]} <button onClick={()=>add(p)}><Icon n="plus" s={14}/></button></span></div>)}
    {!items.length&&<p style={{color:'var(--mute)'}}>Tap a product to add it.</p>}
    <div style={{margin:'14px 0'}}>{pays.map((p,i)=><div className="row" key={i}>
      <select value={p.m} onChange={e=>setPay(i,'m',e.target.value)}>{METHODS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
      <input type="number" placeholder="Amount" disabled={single} value={single?total:p.a} onChange={e=>setPay(i,'a',e.target.value)}/>
      {!single&&<button className="btn ghost sm" onClick={()=>setPays(ps=>ps.filter((_,j)=>j!==i))}><Icon n="x" s={14}/></button>}</div>)}
      <button className="btn ghost sm" onClick={()=>setPays(ps=>[...ps,{m:'airtel',a:ps.length===1?String(Math.max(0,left)):''}])}>Split payment</button>
      {!single&&<p className={left?'err':'ok'}>{left?`Still to pay: ${fmt(left)}`:'Payments match the total'}</p>}</div>
    <div className="total"><span>Total</span><span>{fmt(total)}</span></div>
    <button className="btn" style={{width:'100%',marginTop:'12px',justifyContent:'center'}} disabled={!items.length||busy||left!==0} onClick={charge}><Icon n="printer" s={16}/>{busy?'Saving...':'Charge & print receipt'}</button></div></div>
  {rc&&<div className="receipt">
    <div style={{textAlign:'center',marginBottom:12}}>
      <b style={{fontSize:16}}>{sn}</b>
      {sa&&<div>{sa}</div>}
      {sp&&<div>{sp}</div>}
    </div>
    <div>{rc.at}</div>
    <div>Served by {profile.name}</div>
    <hr/>
    {rc.items.map(i=><div key={i.id}>{i.qty} x {pn(i)} — {fmt(i.price*i.qty)}</div>)}
    <hr/>
    <b>Total {fmt(rc.total)}</b>
    {rc.payments.map((p,i)=><div key={i}>{label(p.method)}: {fmt(p.amount)}</div>)}
    <div style={{textAlign:'center',marginTop:12}}>{sf}</div>
  </div>}</>;
}

/* ---------- Returns ---------- */
function Returns({profile,toast}){
  const[recent,setRecent]=useState([]);const[list,setList]=useState([]);const[pick,setPick]=useState(null);
  const[f,setF]=useState({qty:1,reason:'',method:'cash'});const[dec,setDec]=useState(null);const[cred,setCred]=useState({email:'',pw:''});
  const boss=profile.role!=='cashier';
  const load=useCallback(async()=>{
    const a=await supabase.from('sales').select('*,sale_items(*)').order('created_at',{ascending:false}).limit(10);
    const b=await supabase.from('sale_returns').select('*,sale_items(name),profiles!requested_by(name)').order('created_at',{ascending:false}).limit(30);
    setRecent(a.data||[]);setList(b.data||[])},[]);
  useEffect(()=>{load()},[load]);
  useRealtime('sales',load);
  useRealtime('sale_returns',load);
  const request=async e=>{e.preventDefault();
    if(f.qty<1||f.qty>pick.qty)return toast(`Quantity must be 1 to ${pick.qty}`);
    const{error}=await supabase.from('sale_returns').insert({sale_item_id:pick.id,product_id:pick.product_id,qty:+f.qty,amount:pick.price*f.qty,reason:f.reason,method:f.method});
    if(error)return toast(error.message);setPick(null);setF({qty:1,reason:'',method:'cash'});load();toast('Return sent for approval')};
  const decide=async(id,ok,c=supabase)=>{const{error}=await c.rpc('decide_return',{p_id:id,p_ok:ok});
    if(error)toast(error.message);else toast(ok?'Return approved, stock restored':'Return rejected');load()};
  const supDecide=async e=>{e.preventDefault();const c=authClient();
    const{error}=await c.auth.signInWithPassword({email:cred.email,password:cred.pw});
    if(error)return toast('Supervisor email or password is wrong');
    await decide(dec.id,dec.ok,c);await c.auth.signOut();setDec(null);setCred({email:'',pw:''})};
  return <><div className="top"><h2>Returns</h2></div>
  <div className="two"><div className="card"><h3>Start a return</h3><p className="note" style={{marginBottom:'12px'}}>Pick the item the customer is bringing back.</p>
    {recent.map(s=><div key={s.id} style={{marginTop:10}}><small style={{color:'var(--mute)'}}>{new Date(s.created_at).toLocaleString()} — {fmt(s.total)}</small>
      {s.sale_items.map(i=><div className="line" key={i.id}><span>{i.qty} x {i.name}</span><button className="btn ghost sm" onClick={()=>setPick(i)}>Return</button></div>)}</div>)}</div>
  <div className="card"><h3>Requests</h3><table><tbody>
    {list.map(r=><tr key={r.id}><td>{r.qty} x {r.sale_items?.name}<br/><small style={{color:'var(--mute)'}}>{r.reason||'No reason given'} — by {r.profiles?.name}</small></td>
      <td>{fmt(r.amount)}<br/><span className={'pill '+r.status}>{r.status}</span></td>
      <td>{r.status==='pending'&&<><button className="btn sm" onClick={()=>boss?decide(r.id,true):setDec({id:r.id,ok:true})}>Approve</button>{' '}
      <button className="btn ghost sm" onClick={()=>boss?decide(r.id,false):setDec({id:r.id,ok:false})}>Reject</button></>}</td></tr>)}
    {!list.length&&<tr><td className="empty">No returns yet.</td></tr>}</tbody></table></div></div>
  {pick&&<div className="modal"><form className="card" onSubmit={request}><h3>Return {pick.name}</h3>
    <input type="number" min="1" max={pick.qty} value={f.qty} onChange={e=>setF({...f,qty:e.target.value})}/>
    <input placeholder="Reason" value={f.reason} onChange={e=>setF({...f,reason:e.target.value})} required/>
    <select value={f.method} onChange={e=>setF({...f,method:e.target.value})}>{METHODS.map(([k,l])=><option key={k} value={k}>Refund by {l}</option>)}</select>
    <b>Refund {fmt(pick.price*f.qty)}</b><button className="btn">Send for approval</button><button type="button" className="btn ghost" onClick={()=>setPick(null)}>Cancel</button></form></div>}
  {dec&&<div className="modal"><form className="card" onSubmit={supDecide}><h3>Supervisor approval</h3>
    <input type="email" placeholder="Supervisor email" value={cred.email} onChange={e=>setCred({...cred,email:e.target.value})} required/>
    <input type="password" placeholder="Supervisor password" value={cred.pw} onChange={e=>setCred({...cred,pw:e.target.value})} required/>
    <button className="btn">{dec.ok?'Approve return':'Reject return'}</button><button type="button" className="btn ghost" onClick={()=>setDec(null)}>Cancel</button></form></div>}</>;
}

/* ---------- Cash-up ---------- */
function CashUp({toast}){
  const[date,setDate]=useState(today());const day=useDay(date);const[c,setC]=useState({});const[note,setNote]=useState('');const[hist,setHist]=useState([]);
  const load=useCallback(()=>supabase.from('cash_ups').select('*,profiles(name)').order('created_at',{ascending:false}).limit(8).then(({data})=>setHist(data||[])),[]);
  useEffect(()=>{load()},[load]);
  useRealtime('cash_ups',load);
  const diff=k=>(+c[k]||0)-day.by[k];
  const save=async()=>{const counted={};METHODS.forEach(([k])=>{counted[k]=+c[k]||0});
    const{error}=await supabase.from('cash_ups').insert({day:date,expected:day.by,counted,note});
    if(error)return toast(error.message);setC({});setNote('');load();toast('Cash-up saved')};
  return <><div className="top"><h2>Cash-up</h2><div className="top-actions"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div>
  <div className="two"><div className="card"><h3>Count what you have</h3><table><thead><tr><th>Method</th><th>Expected</th><th>Counted</th><th>Difference</th></tr></thead><tbody>
    {METHODS.map(([k,l])=><tr key={k}><td>{l}</td><td>{fmt(day.by[k])}</td>
      <td><input type="number" value={c[k]??''} onChange={e=>setC({...c,[k]:e.target.value})} style={{width:100}}/></td>
      <td className={diff(k)?'err':'ok'}>{c[k]===undefined?'—':diff(k)===0?'Balanced':fmt(diff(k))}</td></tr>)}</tbody></table><br/>
    <input placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/><br/><br/>
    <button className="btn" onClick={save}>Save cash-up</button></div>
  <div className="card"><h3>Past cash-ups</h3><table><tbody>{hist.map(h=>{const off=METHODS.reduce((a,[k])=>a+(h.counted[k]-h.expected[k]),0);
    return <tr key={h.id}><td>{h.day}<br/><small style={{color:'var(--mute)'}}>{h.profiles?.name}</small></td><td className={off?'err':'ok'}>{off?`Off by ${fmt(off)}`:'Balanced'}</td></tr>})}
    {!hist.length&&<tr><td className="empty">No cash-ups saved yet.</td></tr>}</tbody></table></div></div></>;
}

/* ---------- Stock ---------- */
function Row({p,save,toast}){
  const[e,setE]=useState({name:p.name,variant:p.variant||'',price:p.price,low_at:p.low_at,barcode:p.barcode||''});
  const[edit,setEdit]=useState(false);
  const commit=async()=>{const{error}=await save(p.id,{name:e.name,variant:e.variant||null,price:+e.price,low_at:+e.low_at,barcode:e.barcode||null});
    if(error)return toast(error.message);setEdit(false)};
  const restock=async()=>{const n=parseInt(prompt(`Add how many units of ${pn(p)}?`),10);if(!n)return;
    const{error}=await save(p.id,{stock:p.stock+n});if(error)toast(error.message)};
  const toggle=async()=>{const{error}=await save(p.id,{active:!p.active});if(error)toast(error.message)};
  if(edit)return <tr><td><input value={e.name} onChange={x=>setE({...e,name:x.target.value})}/><input placeholder="Variant" value={e.variant} onChange={x=>setE({...e,variant:x.target.value})} style={{marginTop:4}}/></td>
    <td><input type="number" value={e.price} onChange={x=>setE({...e,price:x.target.value})} style={{width:90}}/></td>
    <td>{p.stock}</td><td><input type="number" value={e.low_at} onChange={x=>setE({...e,low_at:x.target.value})} style={{width:70}}/></td>
    <td><input placeholder="Barcode" value={e.barcode} onChange={x=>setE({...e,barcode:x.target.value})} style={{width:110}}/></td>
    <td><button className="btn sm" onClick={commit}>Save</button> <button className="btn ghost sm" onClick={()=>setEdit(false)}>Cancel</button></td></tr>;
  return <tr style={p.active?{}:{opacity:.5}}><td>{pn(p)}</td><td style={{fontWeight:600}}>{fmt(p.price)}</td>
    <td className={p.stock<=p.low_at?'low':''}>{p.stock}</td><td>{p.low_at}</td>
    <td style={{color:'var(--mute)',fontSize:12}}>{p.barcode||'—'}</td>
    <td><button className="btn ghost sm" onClick={()=>setEdit(true)}><Icon n="edit" s={13}/> Edit</button>{' '}
    <button className="btn ghost sm" onClick={restock}><Icon n="plus" s={13}/> Restock</button>{' '}
    <button className="btn ghost sm" onClick={toggle}>{p.active?'Retire':'Reactivate'}</button></td></tr>;
}

function Stock({toast}){
  const[prods,setProds]=useState([]);const[f,setF]=useState({name:'',variant:'',price:'',stock:'',low_at:'5',barcode:''});
  const load=useCallback(()=>supabase.from('products').select('*').order('name').then(({data})=>setProds(data||[])),[]);
  useEffect(()=>{load()},[load]);
  useRealtime('products',load);
  const add=async e=>{e.preventDefault();const{error}=await supabase.from('products').insert({name:f.name,variant:f.variant||null,price:+f.price,stock:+f.stock,low_at:+f.low_at||5,barcode:f.barcode||null});
    if(error)return toast(error.message);setF({name:'',variant:'',price:'',stock:'',low_at:'5',barcode:''});load();toast('Product added')};
  const save=async(id,patch)=>{const r=await supabase.from('products').update(patch).eq('id',id);if(!r.error)load();return r};
  const set=k=>e=>setF({...f,[k]:e.target.value});
  return <><div className="top"><h2>Stock</h2></div>
  <form className="card" onSubmit={add} style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1fr auto',gap:10,marginBottom:16}}>
    <input placeholder="Product name" value={f.name} onChange={set('name')} required/><input placeholder="Variant" value={f.variant} onChange={set('variant')}/>
    <input type="number" placeholder="Price" value={f.price} onChange={set('price')} required/><input type="number" placeholder="Qty" value={f.stock} onChange={set('stock')} required/>
    <input type="number" placeholder="Low at" value={f.low_at} onChange={set('low_at')}/>
    <input placeholder="Barcode" value={f.barcode} onChange={set('barcode')}/>
    <button className="btn"><Icon n="plus" s={16}/> Add product</button></form>
  <div className="card"><table><thead><tr><th>Product</th><th>Price</th><th>In stock</th><th>Low at</th><th>Barcode</th><th/></tr></thead><tbody>
    {prods.map(p=><Row key={p.id} p={p} save={save} toast={toast}/>)}
    {!prods.length&&<tr><td className="empty">No products yet. Add your first one above.</td></tr>}</tbody></table></div></>;
}

/* ---------- Staff ---------- */
function Staff({profile,toast}){
  const[staff,setStaff]=useState([]);const[busy,setBusy]=useState(false);
  const[f,setF]=useState({name:'',email:'',password:'',role:'cashier'});
  const load=useCallback(()=>supabase.from('profiles').select('*').order('name').then(({data})=>setStaff(data||[])),[]);
  useEffect(()=>{load()},[load]);
  useRealtime('profiles',load);
  const set=k=>e=>setF({...f,[k]:e.target.value});

  const create=async e=>{e.preventDefault();setBusy(true);
    const{data:{session}}=await supabase.auth.getSession();
    try{
      const res=await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-staff`,{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(f)});
      const data=await res.json();
      if(!res.ok||data.error)throw new Error(data.error||'Could not create the account');
      setF({name:'',email:'',password:'',role:'cashier'});load();toast(`Account created for ${f.email}`);
    }catch(err){toast(err.message)}
    setBusy(false)};

  const toggleDisabled=async s=>{const{error}=await supabase.rpc('set_disabled',{p_id:s.id,p_disabled:!s.disabled});
    if(error)return toast(error.message);load();toast(s.disabled?`${s.name} re-enabled`:`${s.name} disabled`)};

  const resetPw=async s=>{if(!s.email)return toast('No email on file for this account');
    const{error}=await supabase.auth.resetPasswordForEmail(s.email,{redirectTo:window.location.origin});
    toast(error?error.message:`Password reset email sent to ${s.email}`)};

  const changeRole=async(id,role)=>{const{error}=await supabase.from('profiles').update({role}).eq('id',id);
    if(error)return toast(error.message);load();toast('Role updated')};

  return <><div className="top"><h2>Staff</h2></div>
  <form className="card" onSubmit={create} style={{display:'grid',gridTemplateColumns:'1.3fr 1.6fr 1.2fr 1fr auto',gap:10,marginBottom:16}}>
    <input placeholder="Full name" value={f.name} onChange={set('name')} required/>
    <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required/>
    <input type="password" placeholder="Temporary password" value={f.password} onChange={set('password')} required minLength={6}/>
    <select value={f.role} onChange={set('role')}>
      <option value="cashier">Cashier</option>
      {profile.role==='owner'&&<option value="supervisor">Supervisor</option>}
    </select>
    <button className="btn" disabled={busy}>{busy?'Creating...':'Create account'}</button>
  </form>
  <div className="note" style={{marginBottom:14}}>New staff sign in with this email and temporary password, then can reset it anytime. Self sign-up is disabled for everyone except the very first owner account.</div>
  <div className="card"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th/></tr></thead><tbody>
    {staff.map(s=><tr key={s.id} style={s.disabled?{opacity:.5}:{}}><td>{s.name}<br/><small style={{color:'var(--mute)'}}>{s.email}</small></td>
      <td>{s.role==='owner'?'Owner':<select value={s.role} onChange={e=>changeRole(s.id,e.target.value)} style={{width:'auto'}} disabled={profile.role!=='owner'}>
        <option value="cashier">Cashier</option><option value="supervisor">Supervisor</option></select>}</td>
      <td><span className={'pill '+(s.disabled?'disabled':'active')}>{s.disabled?'Disabled':'Active'}</span></td>
      <td>{s.role!=='owner'&&<button className="btn ghost sm" onClick={()=>toggleDisabled(s)}>{s.disabled?'Enable':'Disable'}</button>}{' '}
        <button className="btn ghost sm" onClick={()=>resetPw(s)}>Reset password</button></td></tr>)}
    {!staff.length&&<tr><td className="empty">No staff accounts yet.</td></tr>}</tbody></table></div></>;
}

/* ---------- Reports ---------- */
function toCSV(rows,headers){const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  return[headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n')}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}

function Reports({toast}){
  const[from,setFrom]=useState(today());const[to,setTo]=useState(today());const[rows,setRows]=useState([]);
  const run=useCallback(()=>{const[s]=dayRange(from);const[,e]=dayRange(to);
    supabase.from('sales').select('*,payments(*),sale_items(*),profiles(name)').gte('created_at',s).lt('created_at',e)
      .order('created_at',{ascending:false}).then(({data,error})=>error?toast(error.message):setRows(data||[]))},[from,to,toast]);
  useEffect(()=>{run()},[run]);
  useRealtime('sales',run);
  const total=rows.reduce((a,r)=>a+Number(r.total),0);
  const byMethod={};rows.forEach(r=>r.payments.forEach(p=>{byMethod[p.method]=(byMethod[p.method]||0)+Number(p.amount)}));
  const byProduct={};rows.forEach(r=>r.sale_items.forEach(i=>{byProduct[i.name]=(byProduct[i.name]||0)+i.qty}));
  const top=Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const exportCSV=()=>download(`sales_${from}_to_${to}.csv`,toCSV(rows.map(r=>({date:new Date(r.created_at).toLocaleString(),cashier:r.profiles?.name,
    methods:r.payments.map(p=>`${label(p.method)} ${p.amount}`).join(' + '),total:r.total})),['date','cashier','methods','total']));
  return <><div className="top"><h2>Reports</h2>
    <div className="top-actions"><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
    <input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
    <button className="btn ghost" onClick={exportCSV} disabled={!rows.length}><Icon n="download" s={16}/> Export CSV</button></div></div>
  <div className="card hero"><p>Total sales, {from} to {to}</p><div className="num">{fmt(total)}</div><p>{rows.length} sale{rows.length===1?'':'s'}</p></div>
  <div className="two">
    <div className="card"><h3>By payment method</h3><table><tbody>
      {METHODS.map(([k,l])=><tr key={k}><td>{l}</td><td style={{textAlign:'right',fontWeight:600}}>{fmt(byMethod[k]||0)}</td></tr>)}</tbody></table></div>
    <div className="card"><h3>Top products</h3><table><tbody>
      {top.map(([n,q])=><tr key={n}><td>{n}</td><td style={{textAlign:'right',fontWeight:600}}>{q} sold</td></tr>)}
      {!top.length&&<tr><td className="empty">No sales in this range.</td></tr>}</tbody></table></div>
  </div></>;
}

/* ---------- App Shell ---------- */
export default function App(){
  const[theme,setTheme]=useState(()=>{try{return localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch{return'light'}});
  const[session,setSession]=useState(null);const[profile,setProfile]=useState(null);const[tab,setTab]=useState('dash');const[msg,setMsg]=useState('');
  const[collapsed,setCollapsed]=useState(false);
  const{settings,reload:reloadSettings}=useSettings();
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('theme',theme)}catch{}},[theme]);
  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));
    const{data:l}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>l.subscription.unsubscribe()},[]);
  const[blocked,setBlocked]=useState('');
  useEffect(()=>{if(!session)return setProfile(null);
    supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle().then(({data})=>{
      if(!data){setBlocked('We could not find your account profile. Please sign in again, or ask your owner to recreate it.');supabase.auth.signOut();setProfile(null);}
      else if(data.disabled){setBlocked('This account has been disabled. Contact your owner or supervisor.');supabase.auth.signOut();setProfile(null);}
      else setProfile(data)})},[session]);
  const toast=t=>{setMsg(t);setTimeout(()=>setMsg(''),3500)};
  const toggle=<button className="btn ghost sm" onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Toggle theme">{theme==='dark'?<Icon n="sun" s={16}/>:<Icon n="moon" s={16}/>}</button>;
  if(!session)return <><div style={{position:'fixed',top:16,right:16,zIndex:10}}>{toggle}</div>{blocked&&<div className="login" style={{position:'fixed',inset:0}}><div className="card err" style={{maxWidth:360}}>{blocked}</div></div>}<Login/></>;
  if(!profile)return <div className="login"><div className="card" style={{textAlign:'center'}}><p>Loading your workspace...</p></div></div>;
  const r=profile.role;
  const tabs=[['dash','Dashboard','dash'],['sell','Sell','sell'],['ret','Returns','ret'],...(r!=='cashier'?[['cash','Cash-up','cash'],['rep','Reports','rep']]:[]),...(r==='owner'?[['stock','Stock','stock'],['staff','Staff','staff']]:[])];
  const initials=profile.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return <div className="shell"><aside className={'side'+(collapsed?' collapsed':'')}>
    <div className="side-header">
      <div className="logo"><span className="logo-icon"><Icon n="sell" s={20}/></span>{!collapsed&&<span>Shop<i>Desk</i></span>}</div>
      <button className="collapse-btn" onClick={()=>setCollapsed(!collapsed)} title={collapsed?'Expand':'Collapse'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed?<><path d="m15 18-6-6 6-6"/></>:<><path d="m9 18 6-6-6-6"/></>}
        </svg>
      </button>
    </div>
    {tabs.map(([k,l,ic])=><button key={k} className={'nav'+(tab===k?' on':'')} onClick={()=>setTab(k)} title={collapsed?l:''}><Icon n={ic} s={20}/>{!collapsed&&l}</button>)}
    <div className="side-footer">
      {!collapsed&&<div className="me"><span className="me-avatar">{initials}</span><div><b>{profile.name}</b><span>{r}</span></div></div>}
      {toggle}
      {!collapsed&&<button className="btn ghost sm" onClick={()=>supabase.auth.signOut()}><Icon n="logout" s={14}/> Sign out</button>}</div></aside>
    <main className="main">{tab==='dash'&&<Dashboard profile={profile} settings={settings}/>}{tab==='sell'&&<Sell profile={profile} toast={toast} settings={settings}/>}
    {tab==='ret'&&<Returns profile={profile} toast={toast}/>}{tab==='cash'&&r!=='cashier'&&<CashUp toast={toast}/>}
    {tab==='rep'&&r!=='cashier'&&<Reports toast={toast}/>}
    {tab==='stock'&&r==='owner'&&<Stock toast={toast}/>}{tab==='staff'&&r==='owner'&&<Staff profile={profile} toast={toast}/>}</main>{msg&&<div className="toast">{msg}</div>}</div>;
}
