import { useState } from "react";
import Head from "next/head";
import PedidosApp from "./pedidos";
import CobranzasApp from "./cobranzas";

// Usuarios y contraseñas. role define qué módulos ve cada uno.
const USUARIOS = [
  { key:"ariel",     name:"Ariel",     pass:"ADMINPR2024", role:"admin",      modulos:["pedidos","cobranzas"] },
  { key:"antonella", name:"Antonella", pass:"ANTO2019",    role:"admin",      modulos:["pedidos","cobranzas"] },
  { key:"juan",      name:"Juan",      pass:"JUAN2022",    role:"vendedor",   modulos:["pedidos","cobranzas"] },
  { key:"sabrina",   name:"Sabrina",   pass:"SABRI2025",   role:"vendedor",   modulos:["pedidos","cobranzas"] },
  { key:"reparto",   name:"Reparto",   pass:"REPARTO2018", role:"repartidor", modulos:["pedidos"] },
];

const bg = "#0f1420";

function Login({ onLogin }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const ingresar = () => {
    const u = USUARIOS.find(x => x.name.toLowerCase() === name.trim().toLowerCase());
    if (!u) { setErr("Usuario no encontrado"); return; }
    if (pass !== u.pass) { setErr("Contraseña incorrecta"); return; }
    onLogin(u);
  };

  return (
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:340}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44}}>🐾</div>
          <h2 style={{color:"#fff",margin:"8px 0 2px"}}>PR Distribuidora</h2>
          <p style={{color:"rgba(255,255,255,.45)",fontSize:13,margin:0}}>Ingresá con tu usuario y contraseña</p>
        </div>
        <div style={{background:"#1a2130",borderRadius:16,padding:24,border:"1px solid rgba(255,255,255,.08)"}}>
          <label style={lbl}>Usuario</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" style={inp}
            onKeyDown={e=>e.key==="Enter"&&ingresar()} />
          <label style={lbl}>Contraseña</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Contraseña" style={inp}
            onKeyDown={e=>e.key==="Enter"&&ingresar()} />
          {err && <p style={{color:"#f87171",fontSize:12,margin:"2px 0 10px"}}>{err}</p>}
          <button onClick={ingresar} style={btn}>Ingresar</button>
        </div>
      </div>
    </div>
  );
}

function Menu({ user, onPick, onLogout }) {
  const disponibles = user.modulos;
  return (
    <div style={{minHeight:"100vh",background:bg,padding:"0 20px",fontFamily:"system-ui,sans-serif"}}>
      <div style={{maxWidth:420,margin:"0 auto",paddingTop:40}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <div style={{color:"#fff",fontWeight:800,fontSize:20}}>Hola, {user.name} 👋</div>
            <div style={{color:"rgba(255,255,255,.45)",fontSize:13}}>¿Qué querés abrir?</div>
          </div>
          <button onClick={onLogout} style={{background:"transparent",border:"1px solid rgba(255,255,255,.2)",color:"#cbd5e1",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12}}>Salir</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:24}}>
          {disponibles.includes("pedidos") && (
            <button onClick={()=>onPick("pedidos")} style={tarjeta("#4a148c")}>
              <span style={{fontSize:34}}>📦</span>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:800,fontSize:17}}>Pedidos y Presupuestos</div>
                <div style={{fontSize:12,opacity:.8}}>Cargar y gestionar pedidos</div>
              </div>
            </button>
          )}
          {disponibles.includes("cobranzas") && (
            <button onClick={()=>onPick("cobranzas")} style={tarjeta("#a16207")}>
              <span style={{fontSize:34}}>💼</span>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:800,fontSize:17}}>Cobranzas y Visitas</div>
                <div style={{fontSize:12,opacity:.8}}>Deudores, cobros y visitas</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [modulo, setModulo] = useState(null);

  if (!user) return (<><Head><title>PR Distribuidora</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head><Login onLogin={u=>{ setUser(u); setModulo(u.modulos.length===1 ? u.modulos[0] : null); }} /></>);

  if (!modulo) return (<><Head><title>PR Distribuidora — Menú</title></Head><Menu user={user} onPick={setModulo} onLogout={()=>{setUser(null);setModulo(null);}} /></>);

  const volverMenu = () => {
    if (user.modulos.length === 1) { setUser(null); setModulo(null); }
    else setModulo(null);
  };

  if (modulo === "pedidos")   return <PedidosApp user={{name:user.name,role:user.role,color:userColor(user),emoji:userEmoji(user)}} onLogout={volverMenu} />;
  if (modulo === "cobranzas") return <CobranzasApp user={{name:user.name,role:user.role}} onLogout={volverMenu} />;
  return null;
}

function userColor(u){
  if(u.role==="admin") return "#4a148c";
  if(u.role==="repartidor") return "#e65100";
  return "#1565c0";
}
function userEmoji(u){
  if(u.role==="admin") return "🏢";
  if(u.role==="repartidor") return "🚚";
  return "🛒";
}

const lbl = {fontSize:12,color:"rgba(255,255,255,.5)",display:"block",marginBottom:5};
const inp = {width:"100%",padding:"11px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"#0f1420",color:"#fff",fontSize:14,marginBottom:14,boxSizing:"border-box"};
const btn = {width:"100%",padding:"12px 0",background:"#eab308",color:"#000",border:"none",borderRadius:10,fontWeight:800,fontSize:15,cursor:"pointer"};
const tarjeta = (c) => ({display:"flex",alignItems:"center",gap:16,background:c,color:"#fff",border:"none",borderRadius:16,padding:"20px 18px",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,0,0,.3)"});
