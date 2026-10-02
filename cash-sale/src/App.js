import {useState,useEffect,useCallback} from 'react';
import {supabase,authClient} from './supabaseClient';
import './App.css';

const METHODS=[['cash','Cash'],['airtel','Airtel Money'],['mtn','MTN MoMo'],['bank','Bank']];
const fmt=n=>'ZMW '+Number(n||0).toLocaleString('en',{maximumFractionDigits:2});
const dayRange=d=>{const s=new Date(d+'T00:00:00');const e=new Date(s);e.setDate(e.getDate()+1);return[s.toISOString(),e.toISOString()]};
const today=()=>new Date().toLocaleDateString('en-CA');

function Login(){
  const[email,setE]=useState('');const[pw,setP]=useState('');const[err,setErr]=useState('');const[up,setUp]=useState(false);
  const go=async e=>{e.preventDefault();setErr('');
    const{error}=up?await supabase.auth.signUp({email,password:pw}):await supabase.auth.signInWithPassword({email,password:pw});
    if(error)setErr(error.message)};
  return <div className="login"><form className="card" onSubmit={go}>
    <h1 style={{fontSize:34}}>Shop<span style={{color:'var(--brand)'}}>Desk</span></h1>
    <p style={{margin:0,color:'var(--mute)'}}>Sign in to start selling.</p>
    <input type="email" placeholder="Email" value={email} onChange={e=>setE(e.target.value)} required/>
    <input type="password" placeholder="Password" value={pw} onChange={e=>setP(e.target.value)} required minLength={6}/>
    {err&&<div className="err">{err}</div>}
    <button className="btn">{up?'Create owner account':'Sign in'}</button>
    <button type="button" className="btn ghost" onClick={()=>setUp(!up)}>{up?'I already have an account':'First time setting up? Create the owner account'}</button>
    {up&&<p className="note">This only works once, for the very first account. After that, the owner or a supervisor creates every other login from the Staff tab.</p>}
  </form></div>;
}

const pn=p=>p.variant?`${p.name} - ${p.variant}`:p.name;
const label=k=>METHODS.find(m=>m[0]===k)[1];

function useDay(date){
  const[d,setD]=useState({sales:[],refs:[]});
  useEffect(()=>{const[s,e]=dayRange(date);
    Promise.all([supabase.from('sales').select('*,payments(*),profiles(name)').gte('created_at',s).lt('created_at',e).order('created_at',{ascending:false}),
      supabase.from('sale_returns').select('*').eq('status','approved').gte('created_at',s).lt('created_at',e)])
    .then(([a,b])=>setD({sales:a.data||[],refs:b.data||[]}))},[date]);
  const by={cash:0,airtel:0,mtn:0,bank:0};
  d.sales.forEach(s=>s.payments.forEach(p=>{by[p.method]+=Number(p.amount)}));
  d.refs.forEach(r=>{by[r.method]-=Number(r.amount)});
  return{...d,by,gross:d.sales.reduce((a,s)=>a+Number(s.total),0),refunded:d.refs.reduce((a,r)=>a+Number(r.amount),0),net:Object.values(by).reduce((a,b)=>a+b,0)};
}

function Dashboard({profile}){
  const[date,setDate]=useState(today());const[low,setLow]=useState([]);const{sales,by,net,refunded}=useDay(date);
  useEffect(()=>{if(profile.role==='owner')supabase.from('products').select('*').then(({data})=>setLow((data||[]).filter(p=>p.stock<=p.low_at)))},[profile.role]);
  const pct=k=>net>0?Math.max(0,Math.round(by[k]/net*100)):0;
  const cashiers={};sales.forEach(s=>{const n=s.profiles?.name||'-';cashiers[n]=(cashiers[n]||0)+Number(s.total)});
  return <>
    <div className="top"><h2>Dashboard</h2><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:'auto'}}/></div>
    <div className="card hero"><p>Net sales on {date}</p><div className="num">{fmt(net)}</div>
      <p>{sales.length} sale{sales.length===1?'':'s'}{refunded>0&&` - ${fmt(refunded)} refunded`}</p>
      <div className="seg">{METHODS.map(([k])=><span key={k} style={{width:pct(k)+'%',background:`var(--${k})`}}/>)}</div></div>
    <div className="grid4">{METHODS.map(([k,l])=><div key={k} className="card tile" style={{'--c':`var(--${k})`}}>
      <small>{l}</small><div className="num">{fmt(by[k])}</div><em>{pct(k)}% of sales</em></div>)}</div>
    <div className="two">
      <div className="card"><h3>Recent sales</h3><table><tbody>
        {sales.slice(0,8).map(s=><tr key={s.id}><td>{new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
        <td>{s.payments.map(p=>label(p.method)).join(' + ')}</td><td style={{textAlign:'right'}}>{fmt(s.total)}</td></tr>)}
        {!sales.length&&<tr><td>No sales yet. Open the Sell tab to make the first one.</td></tr>}</tbody></table></div>
      {profile.role!=='cashier'&&<div className="card"><h3>Sales by cashier</h3><table><tbody>
        {Object.entries(cashiers).map(([n,t])=><tr key={n}><td>{n}</td><td style={{textAlign:'right'}}>{fmt(t)}</td></tr>)}</tbody></table></div>}
      {profile.role==='owner'&&<div className="card"><h3>Running low</h3><table><tbody>
        {low.map(p=><tr key={p.id}><td>{pn(p)}</td><td className="low" style={{textAlign:'right'}}>{p.stock} left</td></tr>)}
        {!low.length&&<tr><td>All items are well stocked.</td></tr>}</tbody></table></div>}
    </div></>;
}

function Sell({profile,toast}){
  const[prods,setProds]=useState([]);const[cart,setCart]=useState({});const[pays,setPays]=useState([{m:'cash',a:''}]);
  const[q,setQ]=useState('');const[busy,setBusy]=useState(false);const[rc,setRc]=useState(null);
  const load=useCallback(()=>supabase.from('products').select('*').eq('active',true).order('name').then(({data})=>setProds(data||[])),[]);
  useEffect(()=>{load()},[load]);
  const add=(p,d=1)=>setCart(c=>{const n=(c[p.id]||0)+d;const x={...c};if(n<=0)delete x[p.id];else if(n<=p.stock)x[p.id]=n;return x});
  const items=prods.filter(p=>cart[p.id]);const total=items.reduce((a,p)=>a+p.price*cart[p.id],0);
  const single=pays.length===1;const left=total-(single?total:pays.reduce((s,p)=>s+(+p.a||0),0));
  const setPay=(i,k,v)=>setPays(ps=>ps.map((p,j)=>j===i?{...p,[k]:v}:p));
  const charge=async()=>{setBusy(true);
    const payments=single?[{method:pays[0].m,amount:total}]:pays.filter(p=>+p.a>0).map(p=>({method:p.m,amount:+p.a}));
    const{error}=await supabase.rpc('create_sale',{p_items:items.map(p=>({id:p.id,qty:cart[p.id]})),p_payments:payments});
    setBusy(false);if(error)return toast(error.message);
    setRc({items:items.map(p=>({...p,qty:cart[p.id]})),total,payments,at:new Date().toLocaleString()});
    setCart({});setPays([{m:'cash',a:''}]);load();toast('Sale saved');setTimeout(()=>window.print(),300)};
  return <><div className="top"><h2>Sell</h2><input placeholder="Search products" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:260}}/></div>
  <div className="pos"><div className="prods">
    {prods.filter(p=>pn(p).toLowerCase().includes(q.toLowerCase())).map(p=>
      <button key={p.id} className="prod" disabled={p.stock<1} onClick={()=>add(p)}><b>{p.name}</b>{p.variant&&<small>{p.variant}</small>}
        <span>{fmt(p.price)}</span><small className={p.stock<=p.low_at?'low':''}>{p.stock} in stock</small></button>)}
    {!prods.length&&<p>No products yet. The owner can add them in the Stock tab.</p>}</div>
  <div className="card cart"><h3>Current sale</h3>
    {items.map(p=><div className="line" key={p.id}><span>{pn(p)}</span><span className="q">
      <button onClick={()=>add(p,-1)}>-</button> {cart[p.id]} <button onClick={()=>add(p)}>+</button></span></div>)}
    {!items.length&&<p style={{color:'var(--mute)'}}>Tap a product to add it.</p>}
    <div style={{margin:'14px 0'}}>{pays.map((p,i)=><div className="row" key={i}>
      <select value={p.m} onChange={e=>setPay(i,'m',e.target.value)}>{METHODS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
      <input type="number" placeholder="Amount" disabled={single} value={single?total:p.a} onChange={e=>setPay(i,'a',e.target.value)}/>
      {!single&&<button className="btn ghost" onClick={()=>setPays(ps=>ps.filter((_,j)=>j!==i))}>x</button>}</div>)}
      <button className="btn ghost" onClick={()=>setPays(ps=>[...ps,{m:'airtel',a:ps.length===1?String(Math.max(0,left)):''}])}>Split payment</button>
      {!single&&<p className={left?'err':'ok'}>{left?`Still to pay: ${fmt(left)}`:'Payments match the total'}</p>}</div>
    <div className="total"><span>Total</span><span>{fmt(total)}</span></div><br/>
    <button className="btn" style={{width:'100%'}} disabled={!items.length||busy||left!==0} onClick={charge}>{busy?'Saving...':'Charge and print receipt'}</button></div></div>
  {rc&&<div className="receipt"><h3>ShopDesk receipt</h3><p>{rc.at}<br/>Served by {profile.name}</p>
    {rc.items.map(i=><div key={i.id}>{i.qty} x {pn(i)} - {fmt(i.price*i.qty)}</div>)}
    <hr/><b>Total {fmt(rc.total)}</b>{rc.payments.map((p,i)=><div key={i}>{label(p.method)}: {fmt(p.amount)}</div>)}<p>Thank you!</p></div>}</>;
}

function Returns({profile,toast}){
  const[recent,setRecent]=useState([]);const[list,setList]=useState([]);const[pick,setPick]=useState(null);
  const[f,setF]=useState({qty:1,reason:'',method:'cash'});const[dec,setDec]=useState(null);const[cred,setCred]=useState({email:'',pw:''});
  const boss=profile.role!=='cashier';
  const load=useCallback(async()=>{
    const a=await supabase.from('sales').select('*,sale_items(*)').order('created_at',{ascending:false}).limit(10);
    const b=await supabase.from('sale_returns').select('*,sale_items(name),profiles!requested_by(name)').order('created_at',{ascending:false}).limit(30);
    setRecent(a.data||[]);setList(b.data||[])},[]);
  useEffect(()=>{load()},[load]);
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
  <div className="two"><div className="card"><h3>Start a return</h3><small style={{color:'var(--mute)'}}>Pick the item the customer is bringing back.</small>
    {recent.map(s=><div key={s.id} style={{marginTop:10}}><small>{new Date(s.created_at).toLocaleString()} - {fmt(s.total)}</small>
      {s.sale_items.map(i=><div className="line" key={i.id}><span>{i.qty} x {i.name}</span><button className="btn ghost" onClick={()=>setPick(i)}>Return</button></div>)}</div>)}</div>
  <div className="card"><h3>Requests</h3><table><tbody>
    {list.map(r=><tr key={r.id}><td>{r.qty} x {r.sale_items?.name}<br/><small style={{color:'var(--mute)'}}>{r.reason||'No reason given'} - by {r.profiles?.name}</small></td>
      <td>{fmt(r.amount)}<br/><span className={'pill '+r.status}>{r.status}</span></td>
      <td>{r.status==='pending'&&<><button className="btn" onClick={()=>boss?decide(r.id,true):setDec({id:r.id,ok:true})}>Approve</button>{' '}
        <button className="btn ghost" onClick={()=>boss?decide(r.id,false):setDec({id:r.id,ok:false})}>Reject</button></>}</td></tr>)}
    {!list.length&&<tr><td>No returns yet.</td></tr>}</tbody></table></div></div>
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

function CashUp({toast}){
  const[date,setDate]=useState(today());const day=useDay(date);const[c,setC]=useState({});const[note,setNote]=useState('');const[hist,setHist]=useState([]);
  const load=useCallback(()=>supabase.from('cash_ups').select('*,profiles(name)').order('created_at',{ascending:false}).limit(8).then(({data})=>setHist(data||[])),[]);
  useEffect(()=>{load()},[load]);
  const diff=k=>(+c[k]||0)-day.by[k];
  const save=async()=>{const counted={};METHODS.forEach(([k])=>{counted[k]=+c[k]||0});
    const{error}=await supabase.from('cash_ups').insert({day:date,expected:day.by,counted,note});
    if(error)return toast(error.message);setC({});setNote('');load();toast('Cash-up saved')};
  return <><div className="top"><h2>Cash-up</h2><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:'auto'}}/></div>
  <div className="two"><div className="card"><h3>Count what you have</h3><table><thead><tr><th>Method</th><th>Expected</th><th>Counted</th><th>Difference</th></tr></thead><tbody>
    {METHODS.map(([k,l])=><tr key={k}><td>{l}</td><td>{fmt(day.by[k])}</td>
      <td><input type="number" value={c[k]??''} onChange={e=>setC({...c,[k]:e.target.value})} style={{width:100}}/></td>
      <td className={diff(k)?'err':'ok'}>{c[k]===undefined?'-':diff(k)===0?'Balanced':fmt(diff(k))}</td></tr>)}</tbody></table><br/>
    <input placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)}/><br/><br/>
    <button className="btn" onClick={save}>Save cash-up</button></div>
  <div className="card"><h3>Past cash-ups</h3><table><tbody>{hist.map(h=>{const off=METHODS.reduce((a,[k])=>a+(h.counted[k]-h.expected[k]),0);
    return <tr key={h.id}><td>{h.day}<br/><small style={{color:'var(--mute)'}}>{h.profiles?.name}</small></td><td className={off?'err':'ok'}>{off?`Off by ${fmt(off)}`:'Balanced'}</td></tr>})}
    {!hist.length&&<tr><td>No cash-ups saved yet.</td></tr>}</tbody></table></div></div></>;
}

function Row({p,save,toast}){
  const[e,setE]=useState({name:p.name,variant:p.variant||'',price:p.price,low_at:p.low_at});
  const[edit,setEdit]=useState(false);
  const commit=async()=>{const{error}=await save(p.id,{name:e.name,variant:e.variant||null,price:+e.price,low_at:+e.low_at});
    if(error)return toast(error.message);setEdit(false)};
  const restock=async()=>{const n=parseInt(prompt(`Add how many units of ${pn(p)}?`),10);if(!n)return;
    const{error}=await save(p.id,{stock:p.stock+n});if(error)toast(error.message)};
  const toggle=async()=>{const{error}=await save(p.id,{active:!p.active});if(error)toast(error.message)};
  if(edit)return <tr><td><input value={e.name} onChange={x=>setE({...e,name:x.target.value})}/><input placeholder="Variant" value={e.variant} onChange={x=>setE({...e,variant:x.target.value})} style={{marginTop:4}}/></td>
    <td><input type="number" value={e.price} onChange={x=>setE({...e,price:x.target.value})} style={{width:90}}/></td>
    <td>{p.stock}</td><td><input type="number" value={e.low_at} onChange={x=>setE({...e,low_at:x.target.value})} style={{width:70}}/></td>
    <td><button className="btn" onClick={commit}>Save</button> <button className="btn ghost" onClick={()=>setEdit(false)}>Cancel</button></td></tr>;
  return <tr style={p.active?{}:{opacity:.5}}><td>{pn(p)}</td><td>{fmt(p.price)}</td>
    <td className={p.stock<=p.low_at?'low':''}>{p.stock}</td><td>{p.low_at}</td>
    <td><button className="btn ghost" onClick={()=>setEdit(true)}>Edit</button>{' '}
    <button className="btn ghost" onClick={restock}>Restock</button>{' '}
    <button className="btn ghost" onClick={toggle}>{p.active?'Retire':'Reactivate'}</button></td></tr>;
}

function Stock({toast}){
  const[prods,setProds]=useState([]);const[f,setF]=useState({name:'',variant:'',price:'',stock:'',low_at:'5'});
  const load=useCallback(()=>supabase.from('products').select('*').order('name').then(({data})=>setProds(data||[])),[]);
  useEffect(()=>{load()},[load]);
  const add=async e=>{e.preventDefault();const{error}=await supabase.from('products').insert({name:f.name,variant:f.variant||null,price:+f.price,stock:+f.stock,low_at:+f.low_at||5});
    if(error)return toast(error.message);setF({name:'',variant:'',price:'',stock:'',low_at:'5'});load();toast('Product added')};
  const save=async(id,patch)=>{const r=await supabase.from('products').update(patch).eq('id',id);if(!r.error)load();return r};
  const set=k=>e=>setF({...f,[k]:e.target.value});
  return <><div className="top"><h2>Stock</h2></div>
  <form className="card" onSubmit={add} style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr auto',gap:10,marginBottom:16}}>
    <input placeholder="Product name" value={f.name} onChange={set('name')} required/><input placeholder="Variant, e.g. Mango 20mg" value={f.variant} onChange={set('variant')}/>
    <input type="number" placeholder="Price" value={f.price} onChange={set('price')} required/><input type="number" placeholder="Qty" value={f.stock} onChange={set('stock')} required/>
    <input type="number" placeholder="Low at" value={f.low_at} onChange={set('low_at')}/>
    <button className="btn">Add product</button></form>
  <div className="card"><table><thead><tr><th>Product</th><th>Price</th><th>In stock</th><th>Low at</th><th/></tr></thead><tbody>
    {prods.map(p=><Row key={p.id} p={p} save={save} toast={toast}/>)}
    {!prods.length&&<tr><td>No products yet. Add your first one above.</td></tr>}</tbody></table></div></>;
}

function Staff({profile,toast}){
  const[staff,setStaff]=useState([]);const[busy,setBusy]=useState(false);
  const[f,setF]=useState({name:'',email:'',password:'',role:'cashier'});
  const load=useCallback(()=>supabase.from('profiles').select('*').order('name').then(({data})=>setStaff(data||[])),[]);
  useEffect(()=>{load()},[load]);
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
      <td><span className={'pill '+(s.disabled?'rejected':'approved')}>{s.disabled?'Disabled':'Active'}</span></td>
      <td>{s.role!=='owner'&&<button className="btn ghost" onClick={()=>toggleDisabled(s)}>{s.disabled?'Enable':'Disable'}</button>}{' '}
        <button className="btn ghost" onClick={()=>resetPw(s)}>Reset password</button></td></tr>)}
    {!staff.length&&<tr><td>No staff accounts yet.</td></tr>}</tbody></table></div></>;
}

function toCSV(rows,headers){const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  return[headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n')}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}

function Reports({toast}){
  const[from,setFrom]=useState(today());const[to,setTo]=useState(today());const[rows,setRows]=useState([]);
  const run=useCallback(()=>{const[s]=dayRange(from);const[,e]=dayRange(to);
    supabase.from('sales').select('*,payments(*),sale_items(*),profiles(name)').gte('created_at',s).lt('created_at',e)
      .order('created_at',{ascending:false}).then(({data,error})=>error?toast(error.message):setRows(data||[]))},[from,to,toast]);
  useEffect(()=>{run()},[run]);
  const total=rows.reduce((a,r)=>a+Number(r.total),0);
  const byMethod={};rows.forEach(r=>r.payments.forEach(p=>{byMethod[p.method]=(byMethod[p.method]||0)+Number(p.amount)}));
  const byProduct={};rows.forEach(r=>r.sale_items.forEach(i=>{byProduct[i.name]=(byProduct[i.name]||0)+i.qty}));
  const top=Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const exportCSV=()=>download(`sales_${from}_to_${to}.csv`,toCSV(rows.map(r=>({date:new Date(r.created_at).toLocaleString(),cashier:r.profiles?.name,
    methods:r.payments.map(p=>`${label(p.method)} ${p.amount}`).join(' + '),total:r.total})),['date','cashier','methods','total']));
  return <><div className="top"><h2>Reports</h2>
    <span style={{display:'flex',gap:8}}><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:'auto'}}/>
    <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{width:'auto'}}/>
    <button className="btn ghost" onClick={exportCSV} disabled={!rows.length}>Export CSV</button></span></div>
  <div className="card hero"><p>Total sales, {from} to {to}</p><div className="num">{fmt(total)}</div><p>{rows.length} sale{rows.length===1?'':'s'}</p></div>
  <div className="two">
    <div className="card"><h3>By payment method</h3><table><tbody>
      {METHODS.map(([k,l])=><tr key={k}><td>{l}</td><td style={{textAlign:'right'}}>{fmt(byMethod[k]||0)}</td></tr>)}</tbody></table></div>
    <div className="card"><h3>Top products</h3><table><tbody>
      {top.map(([n,q])=><tr key={n}><td>{n}</td><td style={{textAlign:'right'}}>{q} sold</td></tr>)}
      {!top.length&&<tr><td>No sales in this range.</td></tr>}</tbody></table></div>
  </div></>;
}

export default function App(){
  const[theme,setTheme]=useState(()=>{try{return localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch{return'light'}});
  const[session,setSession]=useState(null);const[profile,setProfile]=useState(null);const[tab,setTab]=useState('dash');const[msg,setMsg]=useState('');
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('theme',theme)}catch{}},[theme]);
  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));
    const{data:l}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>l.subscription.unsubscribe()},[]);
  const[blocked,setBlocked]=useState('');
  useEffect(()=>{if(!session)return setProfile(null);
    supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>{
      if(data?.disabled){setBlocked('This account has been disabled. Contact your owner or supervisor.');supabase.auth.signOut();setProfile(null);}
      else setProfile(data)})},[session]);
  const toast=t=>{setMsg(t);setTimeout(()=>setMsg(''),3500)};
  const toggle=<button className="btn ghost" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'Light mode':'Dark mode'}</button>;
  if(!session)return <><div style={{position:'fixed',top:16,right:16}}>{toggle}</div>{blocked&&<div className="login" style={{position:'fixed',inset:0}}><div className="card err" style={{maxWidth:360}}>{blocked}</div></div>}<Login/></>;
  if(!profile)return <div className="login">Loading...</div>;
  const r=profile.role;const tabs=[['dash','Dashboard'],['sell','Sell'],['ret','Returns'],...(r!=='cashier'?[['cash','Cash-up'],['rep','Reports']]:[]),...(r==='owner'?[['stock','Stock'],['staff','Staff']]:[])];
  return <div className="shell"><aside className="side"><div className="logo">Shop<i>Desk</i></div>
    {tabs.map(([k,l])=><button key={k} className={'nav'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}
    <div className="me"><b>{profile.name}</b>{r}</div>{toggle}
    <button className="btn ghost" onClick={()=>supabase.auth.signOut()} style={{marginTop:8}}>Sign out</button></aside>
    <main className="main">{tab==='dash'&&<Dashboard profile={profile}/>}{tab==='sell'&&<Sell profile={profile} toast={toast}/>}
    {tab==='ret'&&<Returns profile={profile} toast={toast}/>}{tab==='cash'&&r!=='cashier'&&<CashUp toast={toast}/>}
    {tab==='rep'&&r!=='cashier'&&<Reports toast={toast}/>}
    {tab==='stock'&&r==='owner'&&<Stock toast={toast}/>}{tab==='staff'&&r==='owner'&&<Staff profile={profile} toast={toast}/>}</main>{msg&&<div className="toast">{msg}</div>}</div>;
}
