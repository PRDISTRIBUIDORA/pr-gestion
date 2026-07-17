import { useState, useEffect, useCallback } from "react";

const PROVEEDORES = ["TODOS","BECHLAB","ESPERANZA","SEDAPIC","ELMER","EVOLUTION PETS","OZI","OZICOS"];
const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes"];
const TRANSPORTES = ["MOSTTO","LAL","CLIENTE"];

const INIT_PRODUCTS = [];

async function apiGet(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`/api/sheets-pedidos?${qs}`);
  return r.json();
}
async function apiPost(action, body = {}) {
  const r = await fetch(`/api/sheets-pedidos?action=${action}`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body),
  });
  return r.json();
}

const today = () => {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
};
const parseFecha = (fechaStr) => {
  if (!fechaStr) return "";
  if (fechaStr.includes("T")) {
    const p = fechaStr.split("T")[0].split("-");
    return `${parseInt(p[2])}/${parseInt(p[1])}/${p[0]}`;
  }
  return fechaStr.split(",")[0].trim();
};
const dateOf = (o) => parseFecha(o.fecha);
const groupByDate = (orders) => {
  const map = {};
  orders.forEach(o => { const d = dateOf(o); if (!map[d]) map[d] = []; map[d].push(o); });
  return Object.entries(map).sort((a,b) => {
    const toNum = s => { const p=s.split("/"); return p[2]+p[1].padStart(2,"0")+p[0].padStart(2,"0"); };
    return toNum(b[0]).localeCompare(toNum(a[0]));
  });
};

// Cantidad destacada: número grande y en negrita
function QtyBadge({ qty, color = "#1e3a5f" }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      minWidth:34, height:26, padding:"0 8px", marginLeft:6,
      background:color, color:"#fff", borderRadius:8,
      fontWeight:800, fontSize:16, lineHeight:1, flexShrink:0
    }}>×{qty}</span>
  );
}

function FormPedido({ vendedorName, products, stock, color, onSaved }) {
  const [syncing, setSyncing] = useState(false);
  const [cliente, setCliente] = useState("");
  const [tipo, setTipo] = useState("pedido");
  const [promo, setPromo] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [prov, setProv] = useState("TODOS");
  const [showRes, setShowRes] = useState(null);

  const allP = products.length > 0 ? products : INIT_PRODUCTS;
  const filtered = allP.filter(p => {
    const mP = prov==="TODOS"||p.proveedor===prov;
    const q = search.toLowerCase();
    return mP && (!q || p.nombre.toLowerCase().includes(q) || String(p.codigo).toLowerCase().includes(q));
  });

  const addItem = p => setItems(prev => { const ex=prev.find(i=>i.id===p.id); if(ex) return prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i); return [...prev,{...p,qty:1}]; });
  const updQty = (id,val) => { const qty=parseInt(val)||0; if(qty<=0) setItems(prev=>prev.filter(i=>i.id!==id)); else setItems(prev=>prev.map(i=>i.id===id?{...i,qty}:i)); };
  const total = items.reduce((s,i)=>s+i.precio*i.qty,0);

  const enviar = async () => {
    if (!cliente.trim()||items.length===0) return alert("Completá cliente y al menos un artículo");
    setSyncing(true);
    const o = { id:Date.now(), vendedor:vendedorName, cliente:cliente.trim(), tipo, promo, urgente, items, total, fecha:new Date().toLocaleString("es-AR"), estado:"pendiente", estadoReparto:"", fechaReparto:"", transporte:"" };
    await apiPost("addPedido", o);
    setShowRes(o); setCliente(""); setPromo(""); setItems([]); setUrgente(false); setTipo("pedido"); setSearch(""); setProv("TODOS");
    setSyncing(false);
  };

  const txtWA = o => {
    const lines = o.items.map(i=>`• ${i.nombre} x${i.qty} — $${(i.precio*i.qty).toLocaleString("es-AR")}`).join("\n");
    return `*${o.tipo.toUpperCase()} — ${o.cliente}*\n${o.urgente?"🔴 URGENTE":"🟢 Puede esperar"}\nVendedor: ${o.vendedor}\nFecha: ${o.fecha}\n${o.promo?`Promo: ${o.promo}\n`:""}\n${lines}\n\n*TOTAL: $${o.total.toLocaleString("es-AR")}*`;
  };

  return (
    <div>
      <div style={cd}>
        <label style={lb}>Cliente</label>
        <input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nombre del cliente" style={iS} />
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}><label style={lb}>Tipo</label>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} style={iS}>
              <option value="pedido">📦 Pedido</option>
              <option value="presupuesto">📄 Presupuesto</option>
            </select>
          </div>
          <div style={{flex:1}}><label style={lb}>Prioridad</label>
            <div style={{display:"flex",gap:6,marginTop:4}}>
              <button onClick={()=>setUrgente(true)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`2px solid ${urgente?"#e53935":"#ddd"}`,background:urgente?"#fdecea":"#fff",color:urgente?"#e53935":"#888",cursor:"pointer",fontSize:12}}>🔴 Urgente</button>
              <button onClick={()=>setUrgente(false)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`2px solid ${!urgente?"#43a047":"#ddd"}`,background:!urgente?"#e8f5e9":"#fff",color:!urgente?"#43a047":"#888",cursor:"pointer",fontSize:12}}>🟢 Espera</button>
            </div>
          </div>
        </div>
        <label style={lb}>Promoción / Aclaración</label>
        <input value={promo} onChange={e=>setPromo(e.target.value)} placeholder="Ej: 10% dto, precio especial..." style={iS} />
      </div>
      <div style={cd}>
        <label style={lb}>Proveedor</label>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
          {PROVEEDORES.map(p=><button key={p} onClick={()=>setProv(p)} style={chip(prov===p,color)}>{p}</button>)}
        </div>
        <label style={lb}>Buscar artículo</label>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o código..." style={iS} />
        <div style={{maxHeight:220,overflowY:"auto"}}>
          {filtered.slice(0,80).map(p=>{
            const st=stock[p.codigo]??stock[p.id];
            return (
              <div key={p.id} onClick={()=>addItem(p)} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 10px",borderRadius:8,marginBottom:4,background:"#f8fafc",cursor:"pointer",border:"1px solid #e8edf5"}}>
                <div style={{flex:1,minWidth:0,marginRight:8}}>
                  <b style={{fontSize:12,display:"block",lineHeight:1.4,wordBreak:"break-word"}}>{p.nombre}</b>
                  <div style={{fontSize:10,color:"#888"}}>{p.codigo} · {p.proveedor}{st!==undefined?` · Stock: ${st}`:""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:700,color,fontSize:12}}>${p.precio.toLocaleString("es-AR")}</div>
                  <div style={{fontSize:10,color:"#43a047"}}>+ agregar</div>
                </div>
              </div>
            );
          })}
          {filtered.length>80&&<p style={{fontSize:11,color:"#888",textAlign:"center"}}>Acotar búsqueda</p>}
        </div>
      </div>
      {items.length>0&&(
        <div style={cd}>
          <b style={{fontSize:14,color}}>Artículos seleccionados</b>
          {items.map(i=>(
            <div key={i.id} style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"8px",background:"#f0f4ff",borderRadius:8}}>
              <div style={{flex:1,minWidth:0}}>
                <b style={{fontSize:12,display:"block",lineHeight:1.4,wordBreak:"break-word"}}>{i.nombre}</b>
                <span style={{color:"#888",fontSize:11}}>${i.precio.toLocaleString("es-AR")} c/u</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>updQty(i.id,i.qty-1)} style={qB}>−</button>
                <input type="number" value={i.qty} onChange={e=>updQty(i.id,e.target.value)} style={{width:48,textAlign:"center",fontWeight:700,fontSize:15,border:"1px solid #ddd",borderRadius:8,padding:"4px 0"}} />
                <button onClick={()=>updQty(i.id,i.qty+1)} style={qB}>+</button>
              </div>
              <div style={{fontWeight:700,color,fontSize:12,minWidth:65,textAlign:"right"}}>${(i.precio*i.qty).toLocaleString("es-AR")}</div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:12,padding:"10px 0",borderTop:"2px solid #e8edf5"}}>
            <b>Total</b><b style={{color}}>${total.toLocaleString("es-AR")}</b>
          </div>
          <button onClick={enviar} disabled={syncing} style={bP(color)}>{syncing?"Enviando...":tipo==="pedido"?"📦 Enviar pedido":"📄 Enviar presupuesto"}</button>
        </div>
      )}
      {showRes&&(
        <Modal onClose={()=>{setShowRes(null);onSaved&&onSaved();}}>
          <h3 style={{marginTop:0,color}}>✅ {showRes.tipo.charAt(0).toUpperCase()+showRes.tipo.slice(1)} guardado</h3>
          <p style={{fontSize:13,color:"#555"}}>Cliente: <b>{showRes.cliente}</b> · Total: <b>${showRes.total.toLocaleString("es-AR")}</b></p>
          <a href={`https://wa.me/?text=${encodeURIComponent(txtWA(showRes))}`} target="_blank" rel="noreferrer"
            style={{display:"block",textAlign:"center",background:"#25D366",color:"#fff",borderRadius:10,padding:"14px 0",textDecoration:"none",fontWeight:700,marginBottom:8}}>
            📱 Mandar por WhatsApp
          </a>
          <button onClick={()=>{setShowRes(null);onSaved&&onSaved();}} style={{...bP(color),marginBottom:8}}>➕ Cargar otro pedido</button>
        </Modal>
      )}
    </div>
  );
}

function VendedorApp({ user, onLogout }) {
  const [tab, setTab] = useState("nuevo");
  const [orders, setOrders] = useState([]);
  const [stock, setStock] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [prov, setProv] = useState("TODOS");
  const color = user.color;

  const refresh = useCallback(async () => {
    try {
      const [o,s,a] = await Promise.all([apiGet({action:"getPedidos"}),apiGet({action:"getStock"}),apiGet({action:"getArticulos"})]);
      if(Array.isArray(o)) setOrders(o);
      if(s&&!s.error) setStock(s);
      if(Array.isArray(a)&&a.length>0) setProducts(a);
    } catch(e){console.error(e);}
    setLoading(false);
  },[]);

  useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t);},[refresh]);

  const allP = products.length>0?products:INIT_PRODUCTS;
  const filtP = allP.filter(p=>{const mP=prov==="TODOS"||p.proveedor===prov;const q=search.toLowerCase();return mP&&(!q||p.nombre.toLowerCase().includes(q)||String(p.codigo).toLowerCase().includes(q));});
  const myOrders = orders.filter(o=>o.vendedor===user.name);

  if(loading) return <Loader/>;

  return (
    <div style={{maxWidth:500,margin:"0 auto",fontFamily:"sans-serif",background:"#f4f6fb",minHeight:"100vh"}}>
      <Header user={user} onLogout={onLogout}/>
      <Tabs tabs={["nuevo","mis-pedidos","precios"]} labels={["➕ Nuevo",`📋 Mis (${myOrders.length})`,"💲 Precios"]} active={tab} onChange={setTab} color={color}/>
      <div style={{padding:16}}>
        {tab==="nuevo"&&<FormPedido vendedorName={user.name} products={products} stock={stock}
