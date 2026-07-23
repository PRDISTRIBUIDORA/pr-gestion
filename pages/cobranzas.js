import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

async function apiGet(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/sheets-cobranzas?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(body) {
  const res = await fetch("/api/sheets-cobranzas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const COBRADORES = ["Juan", "Antonella", "Sabrina"];
const FORMAS_PAGO = ["Efectivo", "Transferencia", "Cheque"];
const ESTADOS_VISITA = ["Visitado", "Telefónico", "Ocupado", "Cerrado"];
const fmt = (n) => Number(n||0).toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const today = () => new Date().toISOString().split("T")[0];

const S = {
  page:     {minHeight:"100vh",background:"#080b10",color:"#e2e8f0",fontFamily:"'DM Sans',system-ui,sans-serif"},
  card:     {background:"#161b22",border:"1px solid rgba(255,255,255,.08)",borderRadius:14},
  input:    {width:"100%",background:"#1e2530",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px 12px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"},
  label:    {display:"block",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5},
  btnPri:   {background:"#eab308",color:"#000",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"},
  btnGhost: {background:"transparent",color:"#94a3b8",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer"},
  btnDanger:{background:"#7f1d1d22",color:"#f87171",border:"1px solid #ef444433",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"},
  btnGreen: {background:"#06522233",color:"#34d399",border:"1px solid #10b98133",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"},
  th:       {textAlign:"left",padding:"10px 14px",fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"},
  td:       {padding:"11px 14px",fontSize:13,color:"#cbd5e1",borderBottom:"1px solid rgba(255,255,255,.04)"},
};

function DiaBadge({ dias }) {
  const color  = dias > 60 ? "#f87171" : dias > 30 ? "#fbbf24" : "#34d399";
  const bg     = dias > 60 ? "#7f1d1d22" : dias > 30 ? "#92400e22" : "#06522222";
  const border = dias > 60 ? "#ef444433" : dias > 30 ? "#d9770633" : "#10b98133";
  return <span style={{background:bg,color,border:`1px solid ${border}`,padding:"2px 8px",borderRadius:99,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{dias}</span>;
}

function EstadoBadge({ estado }) {
  const colors = {Visitado:"#34d399","Telefónico":"#38bdf8",Ocupado:"#fbbf24",Cerrado:"#f87171"};
  const bgs    = {Visitado:"#06522218","Telefónico":"#0c344918",Ocupado:"#92400e18",Cerrado:"#7f1d1d18"};
  const c = colors[estado]||"#94a3b8";
  return <span style={{background:bgs[estado]||"#1f293718",color:c,border:`1px solid ${c}33`,padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:600}}>{estado}</span>;
}

function StatCard({ label, value, sub, color="amber" }) {
  const c = {amber:"#fbbf24",emerald:"#34d399",red:"#f87171",sky:"#38bdf8",purple:"#c084fc"}[color];
  return <div style={{...S.card,padding:"14px 16px",flex:1,minWidth:110,border:`1px solid ${c}22`}}>
    <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,marginBottom:6}}>{label}</div>
    <div style={{fontSize:20,fontWeight:800,color:c,marginBottom:1}}>{value}</div>
    {sub && <div style={{fontSize:11,color:"#475569"}}>{sub}</div>}
  </div>;
}

function Modal({ title, onClose, children }) {
  return <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{...S.card,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <span style={{fontWeight:700,color:"#fff",fontSize:14}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:18}}>✕</button>
      </div>
      <div style={{padding:18}}>{children}</div>
    </div>
  </div>;
}

function Field({ label, children }) {
  return <div style={{marginBottom:13}}><label style={S.label}>{label}</label>{children}</div>;
}

function ClienteSearch({ clientes, value, onChange }) {
  const [q, setQ] = useState(value||"");
  const [open, setOpen] = useState(false);
  const ql = q.toLowerCase();
  const qTrim = q.trim();
  const filtered = q.length > 0 ? clientes.filter(c =>
    String(c.nombre||"").toLowerCase().includes(ql) ||
    String(c.localidad||"").toLowerCase().includes(ql) ||
    String(c.codigo||"").includes(q)
  ).slice(0, 20) : [];
  const selected = clientes.find(c => c.nombre === value);
  const exactMatch = qTrim && filtered.some(c => String(c.nombre||"").toLowerCase().trim() === qTrim.toLowerCase());
  const usarLibre = () => { onChange(qTrim, "", ""); setQ(qTrim); setOpen(false); };
  return <div style={{position:"relative"}}>
    <input
      style={{...S.input, borderColor: value ? "#eab30860" : undefined}}
      value={open ? q : (value || "")}
      placeholder="Escribí para buscar cliente…"
      onFocus={()=>{ setOpen(true); setQ(""); }}
      onBlur={()=>setTimeout(()=>setOpen(false),200)}
      onChange={e=>{ setQ(e.target.value); setOpen(true); }}
      onKeyDown={e=>{ if(e.key==="Enter" && qTrim && !exactMatch){ e.preventDefault(); usarLibre(); } }}
    />
    {value && !open && <div style={{fontSize:11,color:"#64748b",marginTop:3}}>{selected?.localidad}</div>}
    {open && q.length > 0 && <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"#1e2530",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,maxHeight:240,overflowY:"auto",marginTop:2}}>
      {filtered.map(c => <div key={c.id}
          onMouseDown={()=>{ onChange(c.nombre, c.localidad||"", c.codigo||""); setQ(c.nombre); setOpen(false); }}
          style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.05)",fontSize:13,color:"#fff"}}
        >
          <span style={{fontWeight:600}}>{c.nombre}</span>
          <span style={{color:"#64748b",fontSize:11,marginLeft:8}}>{c.localidad}</span>
        </div>)}
      {qTrim && !exactMatch && <div
        onMouseDown={usarLibre}
        style={{padding:"11px 14px",cursor:"pointer",fontSize:13,color:"#34d399",background:"#06522215",borderTop:filtered.length>0?"1px solid rgba(255,255,255,.08)":"none",fontWeight:700}}
      >
        ➕ Usar &quot;{qTrim}&quot; como nuevo cliente
      </div>}
    </div>}
  </div>;
}

function parseClientesExcel(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:"" });
  return rows.filter(r => {
    const codigo = String(r[0]||"").trim();
    const nombre = String(r[1]||"").trim();
    return codigo && nombre && !isNaN(Number(codigo)) && codigo !== "0";
  }).map(r => ({ codigo:String(r[0]).trim(), nombre:String(r[1]).trim(), localidad:String(r[2]||"").trim() }));
}

function parseFechaCell(cell) {
  if (cell === null || cell === undefined || cell === "") return "";
  if (cell instanceof Date) {
    return `${cell.getFullYear()}-${String(cell.getMonth()+1).padStart(2,"0")}-${String(cell.getDate()).padStart(2,"0")}`;
  }
  if (typeof cell === "number" && cell > 40000) {
    const d = XLSX.SSF.parse_date_code(cell);
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(cell).trim();
  if (!s) return "";
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split("-");
    return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }
  return s;
}

function parseDeudoresExcel(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:"" });
  const deudores = [], comprobantes = [];
  let current = null;
  const toNum = (v) => parseFloat(String(v||"0").replace(/[^\d.,\-]/g,"").replace(",",".")) || 0;

  for (const row of rows) {
    const colA = String(row[0]||"").trim();
    const colB = String(row[1]||"").trim();
    if (["cliente","nombre","detalle","fecha","comprobante","monto","saldo"].includes(colA.toLowerCase())) continue;

    if (colA && !isNaN(Number(colA)) && Number(colA) > 0 && colB && isNaN(Number(colB))) {
      const saldo = toNum(row[3]);
      let localidad = "";
      for (let i = Math.min(row.length-1, 8); i >= 4; i--) {
        const v = String(row[i]||"").trim();
        if (v && isNaN(Number(v)) && !["entre ríos","corrientes","buenos aires","santa fe","córdoba","mendoza"].includes(v.toLowerCase())) { localidad = v; break; }
      }
      if (!localidad) localidad = String(row[5]||row[4]||"").trim();
      current = { codigo:colA, nombre:colB.replace(/^\+\s*/,""), saldo, localidad };
      deudores.push(current);
    }
    else if (colA && isNaN(Number(colA)) && colA.length > 2) {
      let saldo = 0;
      for (let i = 2; i < Math.min(row.length, 8); i++) { const v = toNum(row[i]); if (v > 0) { saldo = v; break; } }
      let localidad = "";
      for (let i = Math.min(row.length-1, 9); i >= 3; i--) {
        const v = String(row[i]||"").trim();
        if (v && isNaN(Number(v)) && v.length > 2 && !["entre ríos","corrientes","buenos aires","santa fe","córdoba","mendoza","misiones","formosa"].includes(v.toLowerCase())) { localidad = v; break; }
      }
      current = { codigo:null, nombre:colA.replace(/^\+\s*/,""), saldo, localidad };
      deudores.push(current);
    }
    else if (colB && !isNaN(Number(colB)) && Number(colB) > 0 && colA === "") {
      const codigo = colB;
      if (current && !current.codigo) current.codigo = codigo;
      const fecha = parseFechaCell(row[2]);
      let importe = 0;
      for (let i = row.length - 1; i >= 4; i--) { const v = toNum(row[i]); if (v > 0) { importe = v; break; } }
      if (current && fecha) comprobantes.push({ codigo, cliente:current.nombre, fecha, comprobante:String(row[3]||""), importe });
    }
    else if (colA === "" && colB === "" && !isNaN(Number(String(row[2]||"").trim())) && Number(String(row[2]||"").trim()) > 0) {
      const codigo = String(row[2]).trim();
      if (current && !current.codigo) current.codigo = codigo;
      const fecha = parseFechaCell(row[3]);
      let importe = 0;
      for (let i = row.length - 1; i >= 5; i--) { const v = toNum(row[i]); if (v > 0) { importe = v; break; } }
      if (current && fecha) comprobantes.push({ codigo, cliente:current.nombre, fecha, comprobante:String(row[4]||""), importe });
    }
  }
  return { deudores, comprobantes };
}

function calcDias(fechaStr) {
  if (!fechaStr) return 0;
  let s = String(fechaStr).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) s = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const fecha = new Date(s);
  if (isNaN(fecha)) return 0;
  return Math.floor((Date.now() - fecha) / 86400000);
}

function exportResumen(cobros, visitas, clientes) {
  const wb = XLSX.utils.book_new();
  const fechaHoy = new Date().toLocaleDateString("es-AR");
  const saldoTotal = clientes.reduce((a,c)=>a+(Number(c.saldo)||0),0);
  const resData = [
    [`RESUMEN SEMANAL — ${fechaHoy}`],[],
    ["CARTERA TOTAL", saldoTotal],
    ["Saldo +60 días", clientes.filter(c=>c.dias>60).reduce((a,c)=>a+(Number(c.saldo)||0),0)],
    ["Saldo 30-60 días", clientes.filter(c=>c.dias>30&&c.dias<=60).reduce((a,c)=>a+(Number(c.saldo)||0),0)],
    ["Saldo <30 días", clientes.filter(c=>c.dias<=30).reduce((a,c)=>a+(Number(c.saldo)||0),0)],
    [],[],
    ["COBROS"],[],
    ["Vendedor","Cliente","Monto","Forma pago","Categoría días","Notas","Fecha"],
    ...cobros.map(c=>[c.cobrador,c.cliente,Number(c.monto)||0,c.formaPago,c.diasDeuda,c.notas||"",c.fecha||""]),
    [],[],
    ["VISITAS"],[],
    ["Vendedor","Cliente","Estado","Notas","Fecha"],
    ...visitas.map(v=>[v.cobrador,v.cliente,v.estado,v.notas||"",v.fecha||""]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resData), "Resumen");
  const porVendedor = [["Vendedor","Visitas","Cobros","<30 días","30-60 días","+60 días","Total cobrado"]];
  COBRADORES.forEach(nombre => {
    const cc = cobros.filter(c=>c.cobrador===nombre);
    const vv = visitas.filter(v=>v.cobrador===nombre);
    porVendedor.push([nombre, vv.length, cc.length,
      cc.filter(c=>c.diasDeuda<=30).reduce((a,c)=>a+Number(c.monto),0),
      cc.filter(c=>c.diasDeuda>30&&c.diasDeuda<=60).reduce((a,c)=>a+Number(c.monto),0),
      cc.filter(c=>c.diasDeuda>60).reduce((a,c)=>a+Number(c.monto),0),
      cc.reduce((a,c)=>a+Number(c.monto),0),
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(porVendedor), "Por Vendedor");
  const codigosAcc = new Set(), nombresAcc = new Set();
  const normN = (n) => String(n||"").toLowerCase().trim();
  cobros.forEach(c => { if (c.codigo) codigosAcc.add(String(c.codigo)); if (c.cliente) nombresAcc.add(normN(c.cliente)); });
  visitas.forEach(v => { if (v.codigo) codigosAcc.add(String(v.codigo)); if (v.cliente) nombresAcc.add(normN(v.cliente)); });
  const sinAccion = clientes.filter(c => {
    if (c.codigo && codigosAcc.has(String(c.codigo))) return false;
    if (c.nombre && nombresAcc.has(normN(c.nombre))) return false;
    return true;
  }).sort((a,b) => (b.dias||0) - (a.dias||0));
  const sinAccionData = [
    ["CLIENTES SIN ACCIÓN — sin cobros ni visitas esta semana"],[],
    ["Total clientes sin acción", sinAccion.length],
    ["Saldo total sin trabajar", sinAccion.reduce((a,c)=>a+(Number(c.saldo)||0),0)],
    [],
    ["Código","Cliente","Localidad","Días","Saldo"],
    ...sinAccion.map(c=>[c.codigo||"", c.nombre||"", c.localidad||"", c.dias||0, Number(c.saldo)||0]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sinAccionData), "Sin Acción");
  XLSX.writeFile(wb, `Resumen_${fechaHoy.replace(/\//g,"-")}.xlsx`);
}
function TablaCobroRows({ rows, isAdmin, onEdit, onDelete }) {
  if (rows.length === 0) return null;
  return <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        {["Cliente","Monto","Forma pago","Días","Vendedor","Notas",""].map(h=><th key={h} style={S.th}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows.map(c=><tr key={c.id}>
          <td style={{...S.td,color:"#fff",fontWeight:600}}>{c.cliente}</td>
          <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontWeight:700}}>{fmt(c.monto)}</td>
          <td style={{...S.td,color:"#94a3b8"}}>{c.formaPago}</td>
          <td style={S.td}><DiaBadge dias={Number(c.diasDeuda)||0} /></td>
          <td style={{...S.td,color:"#94a3b8"}}>{c.cobrador}</td>
          <td style={{...S.td,color:"#475569",fontSize:12}}>{c.notas||"—"}</td>
          <td style={S.td}><div style={{display:"flex",gap:5}}>
            <button style={S.btnGhost} onClick={()=>onEdit(c)}>✏️</button>
            {isAdmin && <button style={S.btnDanger} onClick={()=>onDelete(c.id)}>🗑</button>}
          </div></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function CobrosLista({ cobros, isAdmin, onEdit, onDelete }) {
  const [verAnteriores, setVerAnteriores] = useState(false);
  const hoy = today();
  const normFecha = (f) => f ? String(f).split("T")[0] : "";
  const deHoy = cobros.filter(c => normFecha(c.fecha) === hoy);
  const anteriores = cobros.filter(c => normFecha(c.fecha) !== hoy);
  return <div>
    {deHoy.length === 0
      ? <div style={{padding:"20px 18px",textAlign:"center",color:"#475569",fontSize:13}}>Sin cobros registrados hoy</div>
      : <TablaCobroRows rows={deHoy} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />}
    {anteriores.length > 0 && <div>
      <button onClick={()=>setVerAnteriores(v=>!v)} style={{width:"100%",padding:"10px 18px",background:"rgba(255,255,255,.03)",border:"none",borderTop:"1px solid rgba(255,255,255,.07)",color:"#475569",fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10}}>{verAnteriores?"▼":"▶"}</span>
        {verAnteriores?"Ocultar":"Ver"} cobros anteriores ({anteriores.length})
      </button>
      {verAnteriores && <TablaCobroRows rows={anteriores} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />}
    </div>}
  </div>;
}

function TablaVisitasRows({ rows, isAdmin, onEdit, onDelete }) {
  if (rows.length === 0) return null;
  return <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        {["Cliente","Localidad","Estado","Vendedor","Notas","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows.map(r=><tr key={r.id}>
          <td style={{...S.td,color:"#fff",fontWeight:600}}>{r.cliente}</td>
          <td style={{...S.td,color:"#64748b",fontSize:12}}>{r.localidad||"—"}</td>
          <td style={S.td}><EstadoBadge estado={r.estado} /></td>
          <td style={{...S.td,color:"#94a3b8"}}>{r.cobrador||"—"}</td>
          <td style={{...S.td,color:"#475569",fontSize:12,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.notas||"—"}</td>
          <td style={S.td}><div style={{display:"flex",gap:5}}>
            <button style={S.btnGhost} onClick={()=>onEdit(r)}>✏️</button>
            {isAdmin && <button style={S.btnDanger} onClick={()=>onDelete(r.id)}>🗑</button>}
          </div></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function VisitasLista({ rows, isAdmin, onEdit, onDelete }) {
  const [verAnteriores, setVerAnteriores] = useState(false);
  const hoy = today();
  const normFecha = (f) => f ? String(f).split("T")[0] : "";
  const deHoy = rows.filter(r => normFecha(r.fecha) === hoy);
  const anteriores = rows.filter(r => normFecha(r.fecha) !== hoy);
  return <div>
    {deHoy.length === 0
      ? <div style={{padding:"20px 18px",textAlign:"center",color:"#475569",fontSize:13}}>Sin visitas registradas hoy</div>
      : <TablaVisitasRows rows={deHoy} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />}
    {anteriores.length > 0 && <div>
      <button onClick={()=>setVerAnteriores(v=>!v)} style={{width:"100%",padding:"10px 18px",background:"rgba(255,255,255,.03)",border:"none",borderTop:"1px solid rgba(255,255,255,.07)",color:"#475569",fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10}}>{verAnteriores?"▼":"▶"}</span>
        {verAnteriores?"Ocultar":"Ver"} visitas anteriores ({anteriores.length})
      </button>
      {verAnteriores && <TablaVisitasRows rows={anteriores} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />}
    </div>}
  </div>;
}

function DeudoresTab({ isAdmin }) {
  const [clientes, setClientes] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verConAccion, setVerConAccion] = useState(false);
  const [modalCobro, setModalCobro] = useState(null);
  const [modalVisita, setModalVisita] = useState(null);
  const [editCobro, setEditCobro] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rd, rc, rv, rcomp] = await Promise.all([
        apiGet({action:"getData",sheet:"Deudores"}),
        apiGet({action:"getData",sheet:"Cobros"}),
        apiGet({action:"getData",sheet:"Visitas"}),
        apiGet({action:"getData",sheet:"Comprobantes"}),
      ]);
      const deudores = Array.isArray(rd.data) ? rd.data : [];
      const comp = Array.isArray(rcomp.data) ? rcomp.data : [];
      const clientesConDias = deudores.map(d => {
        const compCliente = comp.filter(c => String(c.codigo) === String(d.codigo));
        let dias = 0;
        if (compCliente.length > 0) {
          const oldest = compCliente.reduce((a,c) => calcDias(c.fecha) > calcDias(a.fecha) ? c : a);
          dias = calcDias(oldest.fecha);
        }
        return { ...d, dias, saldo: Number(d.saldo)||0 };
      });
      setClientes(clientesConDias);
      setCobros(Array.isArray(rc.data) ? rc.data : []);
      setVisitas(Array.isArray(rv.data) ? rv.data : []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const codigosConAccion = new Set();
  const nombresConAccion = new Set();
  const normNombre = (n) => String(n||"").toLowerCase().trim();
  cobros.forEach(c => { if (c.codigo) codigosConAccion.add(String(c.codigo)); if (c.cliente) nombresConAccion.add(normNombre(c.cliente)); });
  visitas.forEach(v => { if (v.codigo) codigosConAccion.add(String(v.codigo)); if (v.cliente) nombresConAccion.add(normNombre(v.cliente)); });
  const tieneAccion = (cli) => {
    if (cli.codigo && codigosConAccion.has(String(cli.codigo))) return true;
    if (cli.nombre && nombresConAccion.has(normNombre(cli.nombre))) return true;
    return false;
  };

  const clientesVisibles = verConAccion ? clientes : clientes.filter(c => !tieneAccion(c));
  const cantConAccion = clientes.filter(tieneAccion).length;

  const mas60     = clientesVisibles.filter(c => c.dias > 60).sort((a,b) => b.dias - a.dias);
  const entre3060 = clientesVisibles.filter(c => c.dias > 30 && c.dias <= 60).sort((a,b) => b.dias - a.dias);
  const menos30   = clientesVisibles.filter(c => c.dias <= 30).sort((a,b) => b.dias - a.dias);

  const sl = search.toLowerCase();
  const filtrados = search ? clientes.filter(c =>
    String(c.nombre||"").toLowerCase().includes(sl) ||
    String(c.localidad||"").toLowerCase().includes(sl) ||
    String(c.codigo||"").includes(search)
  ) : null;

  const abrirCobro = (cliente) => {
    setForm({ cliente:cliente.nombre, codigo:cliente.codigo, localidad:cliente.localidad||"", monto:"", formaPago:"", cobrador:"", notas:"", diasDeuda:cliente.dias, saldo:cliente.saldo });
    setModalCobro(cliente);
  };

  const abrirVisita = (cliente) => {
    setForm({ cliente:cliente.nombre, codigo:cliente.codigo, localidad:cliente.localidad||"", estado:"Visitado", cobrador:"", notas:"" });
    setModalVisita(cliente);
  };

  const guardarVisita = async () => {
    if (!form.cobrador || !form.estado) return;
    setSaving(true);
    try {
      await apiPost({action:"addRow", sheet:"Visitas", data:{...form, fecha:today()}});
      setModalVisita(null); await load();
    } catch(e) { alert("Error: "+e.message); }
    finally { setSaving(false); }
  };

  const guardarCobro = async () => {
    if (!form.monto || !form.cobrador || !form.formaPago) return;
    setSaving(true);
    try {
      await apiPost({action:"addRow", sheet:"Cobros", data:{...form, fecha:today()}});
      setModalCobro(null); await load();
    } catch(e) { alert("Error: "+e.message); }
    finally { setSaving(false); }
  };

  const guardarEdicion = async () => {
    setSaving(true);
    try {
      await apiPost({action:"updateRow", sheet:"Cobros", id:editCobro.id, data:form});
      setEditCobro(null); await load();
    } catch(e) { alert("Error: "+e.message); }
    finally { setSaving(false); }
  };

  const eliminarCobro = async (id) => {
    if (!confirm("¿Eliminar este cobro?")) return;
    try { await apiPost({action:"deleteRow", sheet:"Cobros", id}); await load(); }
    catch(e) { alert("Error: "+e.message); }
  };

  const saldoTotal = clientes.reduce((a,c)=>a+c.saldo,0);

  const Grupo = ({ titulo, lista, color }) => {
    const c = {red:"#f87171",amber:"#fbbf24",emerald:"#34d399"}[color];
    if (lista.length === 0) return null;
    return <div style={{...S.card,overflow:"hidden",border:`1px solid ${c}22`,marginBottom:14}}>
      <div style={{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",justifyContent:"space-between",background:`${c}08`}}>
        <div>
          <span style={{fontWeight:700,color:c,fontSize:14}}>{titulo}</span>
          <span style={{fontSize:12,color:"#475569",marginLeft:10}}>{lista.length} clientes</span>
        </div>
        <span style={{fontFamily:"monospace",fontWeight:700,color:c,fontSize:15}}>{fmt(lista.reduce((a,r)=>a+r.saldo,0))}</span>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
            {["Código","Cliente","Localidad","Días","Saldo",""].map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {lista.map(c=><tr key={c.id}>
              <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontSize:11}}>{c.codigo}</td>
              <td style={{...S.td,color:"#fff",fontWeight:600}}>
                {c.nombre}
                {tieneAccion(c) && <span style={{marginLeft:8,fontSize:10,color:"#34d399",background:"#06522233",border:"1px solid #10b98155",padding:"2px 6px",borderRadius:99,fontWeight:700}}>✓ CARGADO</span>}
              </td>
              <td style={{...S.td,color:"#64748b",fontSize:12}}>{c.localidad||"—"}</td>
              <td style={S.td}><DiaBadge dias={c.dias} /></td>
              <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontWeight:700}}>{fmt(c.saldo)}</td>
              <td style={S.td}>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <button onClick={()=>abrirCobro(c)} style={{background:"#eab30820",color:"#fbbf24",border:"1px solid #eab30840",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>
                    💰 Cobro
                  </button>
                  <button onClick={()=>abrirVisita(c)} style={{background:"#38bdf820",color:"#38bdf8",border:"1px solid #38bdf840",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>
                    📍 Visita
                  </button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
  };

  if (loading) return <div style={{padding:40,textAlign:"center",color:"#475569"}}>Cargando…</div>;

  return <div>
    <div style={{...S.card,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>Saldo total cartera</div>
        <div style={{fontSize:24,fontWeight:800,color:"#fff",marginTop:2}}>{fmt(saldoTotal)}</div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#f87171",fontWeight:700,textTransform:"uppercase"}}>+60 días</div>
          <div style={{fontSize:15,fontWeight:700,color:"#f87171",fontFamily:"monospace"}}>{fmt(mas60.reduce((a,c)=>a+c.saldo,0))}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#fbbf24",fontWeight:700,textTransform:"uppercase"}}>30-60 días</div>
          <div style={{fontSize:15,fontWeight:700,color:"#fbbf24",fontFamily:"monospace"}}>{fmt(entre3060.reduce((a,c)=>a+c.saldo,0))}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#34d399",fontWeight:700,textTransform:"uppercase"}}>&lt;30 días</div>
          <div style={{fontSize:15,fontWeight:700,color:"#34d399",fontFamily:"monospace"}}>{fmt(menos30.reduce((a,c)=>a+c.saldo,0))}</div>
        </div>
      </div>
    </div>

    <div style={{marginBottom:16}}>
      <input style={S.input} placeholder="🔍 Buscar cliente por nombre, localidad o código…" value={search} onChange={e=>setSearch(e.target.value)} />
    </div>

    {cantConAccion > 0 && !search && <div style={{marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(52,211,153,.06)",border:"1px solid #10b98122",borderRadius:8,flexWrap:"wrap",gap:8}}>
      <div style={{fontSize:12,color:"#94a3b8"}}>
        <span style={{color:"#34d399",fontWeight:700}}>{cantConAccion} clientes</span> con acción registrada esta semana (ocultos de la lista)
      </div>
      <button onClick={()=>setVerConAccion(v=>!v)} style={{background:verConAccion?"#10b98133":"transparent",color:"#34d399",border:"1px solid #10b98155",borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:600}}>
        {verConAccion ? "🙈 Ocultarlos de nuevo" : "👁 Ver clientes con acción"}
      </button>
    </div>}

    {filtrados && <div style={{...S.card,overflow:"hidden",marginBottom:16}}>
      <div style={{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,.07)",fontWeight:700,color:"#fff"}}>
        Resultados para "{search}" — {filtrados.length} clientes
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
            {["Código","Cliente","Localidad","Días","Saldo",""].map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtrados.length === 0
              ? <tr><td colSpan={6} style={{...S.td,textAlign:"center",color:"#475569"}}>Sin resultados</td></tr>
              : filtrados.map(c=><tr key={c.id}>
                <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontSize:11}}>{c.codigo}</td>
                <td style={{...S.td,color:"#fff",fontWeight:600}}>
                  {c.nombre}
                  {tieneAccion(c) && <span style={{marginLeft:8,fontSize:10,color:"#34d399",background:"#06522233",border:"1px solid #10b98155",padding:"2px 6px",borderRadius:99,fontWeight:700}}>✓ CARGADO</span>}
                </td>
                <td style={{...S.td,color:"#64748b",fontSize:12}}>{c.localidad||"—"}</td>
                <td style={S.td}><DiaBadge dias={c.dias} /></td>
                <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontWeight:700}}>{fmt(c.saldo)}</td>
                <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontWeight:700}}>{fmt(c.saldo)}</td>
                <td style={S.td}>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <button onClick={()=>abrirCobro(c)} style={{background:"#eab30820",color:"#fbbf24",border:"1px solid #eab30840",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>💰 Cobro</button>
                    <button onClick={()=>abrirVisita(c)} style={{background:"#38bdf820",color:"#38bdf8",border:"1px solid #38bdf840",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>📍 Visita</button>
                  </div>
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>}

    {!filtrados && <>
      <Grupo titulo="🔴 Más de 60 días — PRIORIDAD ALTA" lista={mas60} color="red" />
      <Grupo titulo="🟡 Entre 30 y 60 días" lista={entre3060} color="amber" />
      <Grupo titulo="🟢 Menos de 30 días" lista={menos30} color="emerald" />
    </>}

    <div style={{...S.card,overflow:"hidden",marginTop:8}}>
      <div style={{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,.07)",fontWeight:700,color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span>💰 Cobros registrados ({cobros.length})</span>
        <span style={{fontSize:13,color:"#fbbf24",fontFamily:"monospace"}}>{fmt(cobros.reduce((a,c)=>a+Number(c.monto),0))}</span>
      </div>
      {cobros.length === 0
        ? <div style={{padding:32,textAlign:"center",color:"#475569",fontSize:13}}>Sin cobros registrados aún</div>
        : <CobrosLista cobros={cobros} isAdmin={isAdmin} onEdit={c=>{setForm({...c});setEditCobro(c);}} onDelete={eliminarCobro} />}
    </div>

    {modalCobro && <Modal title={`Registrar cobro — ${modalCobro.nombre}`} onClose={()=>setModalCobro(null)}>
      <div style={{...S.card,padding:"10px 14px",marginBottom:14,background:modalCobro.dias>60?"#7f1d1d22":modalCobro.dias>30?"#92400e22":"#06522222"}}>
        <div style={{fontSize:12,color:"#94a3b8"}}>Categoría detectada automáticamente</div>
        <div style={{marginTop:4}}><DiaBadge dias={modalCobro.dias} /> <span style={{fontSize:12,color:"#64748b",marginLeft:8}}>Saldo total: {fmt(modalCobro.saldo)}</span></div>
      </div>
      <Field label="Monto cobrado *"><input style={S.input} type="number" value={form.monto||""} onChange={e=>setForm(p=>({...p,monto:e.target.value}))} placeholder="0" autoFocus /></Field>
      <Field label="Forma de pago *">
        <select style={S.input} value={form.formaPago||""} onChange={e=>setForm(p=>({...p,formaPago:e.target.value}))}>
          <option value="">— Seleccionar —</option>
          {FORMAS_PAGO.map(f=><option key={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Vendedor *">
        <select style={S.input} value={form.cobrador||""} onChange={e=>setForm(p=>({...p,cobrador:e.target.value}))}>
          <option value="">— Seleccionar —</option>
          {COBRADORES.map(c=><option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Notas"><textarea style={{...S.input,height:60,resize:"none"}} value={form.notas||""} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} /></Field>
      <div style={{display:"flex",gap:10}}>
        <button style={{...S.btnGhost,flex:1}} onClick={()=>setModalCobro(null)}>Cancelar</button>
        <button style={{...S.btnPri,flex:1}} disabled={saving||!form.monto||!form.cobrador||!form.formaPago} onClick={guardarCobro}>{saving?"Guardando…":"Guardar cobro"}</button>
      </div>
    </Modal>}

    {modalVisita && <Modal title={`Registrar visita — ${modalVisita.nombre}`} onClose={()=>setModalVisita(null)}>
      <div style={{...S.card,padding:"10px 14px",marginBottom:14,background:"#0c344922",border:"1px solid #38bdf833"}}>
        <div style={{fontSize:12,color:"#94a3b8"}}>Cliente</div>
        <div style={{marginTop:4,color:"#fff",fontWeight:600,fontSize:14}}>{modalVisita.nombre}</div>
        <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{modalVisita.localidad||"—"} · Saldo: {fmt(modalVisita.saldo)}</div>
      </div>
      <Field label="Estado *">
        <select style={S.input} value={form.estado||"Visitado"} onChange={e=>setForm(p=>({...p,estado:e.target.value}))} autoFocus>
          {ESTADOS_VISITA.map(e=><option key={e}>{e}</option>)}
        </select>
      </Field>
      <Field label="Vendedor *">
        <select style={S.input} value={form.cobrador||""} onChange={e=>setForm(p=>({...p,cobrador:e.target.value}))}>
          <option value="">— Seleccionar —</option>
          {COBRADORES.map(c=><option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Notas"><textarea style={{...S.input,height:60,resize:"none"}} value={form.notas||""} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Observaciones, compromisos de pago, etc." /></Field>
      <div style={{display:"flex",gap:10}}>
        <button style={{...S.btnGhost,flex:1}} onClick={()=>setModalVisita(null)}>Cancelar</button>
        <button style={{...S.btnPri,flex:1,background:"#38bdf8",color:"#000"}} disabled={saving||!form.cobrador||!form.estado} onClick={guardarVisita}>{saving?"Guardando…":"Guardar visita"}</button>
      </div>
    </Modal>}

    {editCobro && <Modal title="Editar cobro" onClose={()=>setEditCobro(null)}>
      <Field label="Monto *"><input style={S.input} type="number" value={form.monto||""} onChange={e=>setForm(p=>({...p,monto:e.target.value}))} /></Field>
      <Field label="Forma de pago *">
        <select style={S.input} value={form.formaPago||""} onChange={e=>setForm(p=>({...p,formaPago:e.target.value}))}>
          <option value="">— Seleccionar —</option>
          {FORMAS_PAGO.map(f=><option key={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Vendedor *">
        <select style={S.input} value={form.cobrador||""} onChange={e=>setForm(p=>({...p,cobrador:e.target.value}))}>
          <option value="">— Seleccionar —</option>
          {COBRADORES.map(c=><option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Notas"><textarea style={{...S.input,height:60,resize:"none"}} value={form.notas||""} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} /></Field>
      <div style={{display:"flex",gap:10}}>
        <button style={{...S.btnGhost,flex:1}} onClick={()=>setEditCobro(null)}>Cancelar</button>
        <button style={{...S.btnPri,flex:1}} disabled={saving} onClick={guardarEdicion}>{saving?"Guardando…":"Guardar cambios"}</button>
      </div>
    </Modal>}
  </div>;
}
function VisitasTab({ isAdmin }) {
  const [rows, setRows] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rv, rc, rd] = await Promise.all([
        apiGet({action:"getData",sheet:"Visitas"}),
        apiGet({action:"getData",sheet:"Clientes"}),
        apiGet({action:"getData",sheet:"Deudores"}),
      ]);
      setRows(Array.isArray(rv.data)?rv.data:[]);
      // Merge Clientes + Deudores para tener la lista completa en el buscador
      const cli = Array.isArray(rc.data)?rc.data:[];
      const deu = Array.isArray(rd.data)?rd.data:[];
      const seenCodigos = new Set();
      const seenNombres = new Set();
      const normN = (n) => String(n||"").toLowerCase().trim();
      const merged = [];
      cli.forEach(c => {
        const cod = c.codigo ? String(c.codigo) : "";
        const nom = normN(c.nombre);
        if (cod && seenCodigos.has(cod)) return;
        if (!cod && nom && seenNombres.has(nom)) return;
        if (cod) seenCodigos.add(cod);
        if (nom) seenNombres.add(nom);
        merged.push(c);
      });
      deu.forEach(d => {
        const cod = d.codigo ? String(d.codigo) : "";
        const nom = normN(d.nombre);
        if (cod && seenCodigos.has(cod)) return;
        if (!cod && nom && seenNombres.has(nom)) return;
        if (cod) seenCodigos.add(cod);
        if (nom) seenNombres.add(nom);
        merged.push({ id:"d-"+(d.id||d.codigo||nom), codigo:d.codigo, nombre:d.nombre, localidad:d.localidad });
      });
      setClientes(merged);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sl = search.toLowerCase();
  const filtered = rows.filter(r => String(r.cliente||"").toLowerCase().includes(sl) || String(r.localidad||"").toLowerCase().includes(sl));

  const save = async () => {
    if (!form.cliente) return;
    setSaving(true);
    try {
      if (modal === "add") await apiPost({action:"addRow",sheet:"Visitas",data:{...form,fecha:today()}});
      else await apiPost({action:"updateRow",sheet:"Visitas",id:modal.id,data:form});
      setModal(null); await load();
    } catch(e) { alert("Error: "+e.message); }
    finally { setSaving(false); }
  };

  return <div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <StatCard label="Total" value={rows.length} color="sky" />
      <StatCard label="Visitado" value={rows.filter(r=>r.estado==="Visitado").length} color="emerald" />
      <StatCard label="Telefónico" value={rows.filter(r=>r.estado==="Telefónico").length} color="sky" />
      <StatCard label="Ocupado/Cerrado" value={rows.filter(r=>["Ocupado","Cerrado"].includes(r.estado)).length} color="red" />
    </div>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <input style={{...S.input,flex:1}} placeholder="🔍 Buscar cliente…" value={search} onChange={e=>setSearch(e.target.value)} />
      <button style={S.btnPri} onClick={()=>{ setForm({cliente:"",codigo:"",localidad:"",estado:"Visitado",cobrador:"",notas:""}); setModal("add"); }}>+ Nueva visita</button>
    </div>
    <div style={{...S.card,overflow:"hidden"}}>
      {loading
        ? <div style={{padding:40,textAlign:"center",color:"#475569"}}>Cargando…</div>
        : <VisitasLista rows={filtered} isAdmin={isAdmin}
            onEdit={r=>{setForm({...r});setModal(r);}}
            onDelete={async id=>{ if(confirm("¿Eliminar?")){ await apiPost({action:"deleteRow",sheet:"Visitas",id}); load(); } }} />}
    </div>

    {modal && <Modal title={modal==="add"?"Nueva visita":"Editar visita"} onClose={()=>setModal(null)}>
      <Field label="Cliente *">
        {clientes.length > 0
          ? <ClienteSearch clientes={clientes} value={form.cliente||""} onChange={(nombre,localidad,codigo)=>setForm(p=>({...p,cliente:nombre,localidad,codigo}))} />
          : <input style={S.input} value={form.cliente||""} onChange={e=>setForm(p=>({...p,cliente:e.target.value}))} />}
      </Field>
      <Field label="Estado">
        <select style={S.input} value={form.estado||"Visitado"} onChange={e=>setForm(p=>({...p,estado:e.target.value}))}>
          {ESTADOS_VISITA.map(e=><option key={e}>{e}</option>)}
        </select>
      </Field>
      <Field label="Vendedor">
        <select style={S.input} value={form.cobrador||""} onChange={e=>setForm(p=>({...p,cobrador:e.target.value}))}>
          <option value="">— Seleccionar —</option>
          {COBRADORES.map(c=><option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Notas"><textarea style={{...S.input,height:60,resize:"none"}} value={form.notas||""} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} /></Field>
      <div style={{display:"flex",gap:10}}>
        <button style={{...S.btnGhost,flex:1}} onClick={()=>setModal(null)}>Cancelar</button>
        <button style={{...S.btnPri,flex:1}} disabled={saving||!form.cliente} onClick={save}>{saving?"Guardando…":"Guardar"}</button>
      </div>
    </Modal>}
  </div>;
}

function ClientesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiGet({action:"getData",sheet:"Clientes"}); setRows(Array.isArray(r.data)?r.data:[]); }
    catch(e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sl = search.toLowerCase();
  const filtered = rows.filter(r => String(r.nombre||"").toLowerCase().includes(sl) || String(r.localidad||"").toLowerCase().includes(sl) || String(r.codigo||"").includes(search));

  const save = async () => {
    if (!form.nombre) return; setSaving(true);
    try {
      if (modal==="add") await apiPost({action:"addRow",sheet:"Clientes",data:form});
      else await apiPost({action:"updateRow",sheet:"Clientes",id:modal.id,data:form});
      setModal(null); await load();
    } catch(e) { alert("Error: "+e.message); } finally { setSaving(false); }
  };

  return <div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <input style={{...S.input,flex:1,minWidth:180}} placeholder="🔍 Buscar…" value={search} onChange={e=>setSearch(e.target.value)} />
      <button style={S.btnPri} onClick={()=>{ setForm({codigo:"",nombre:"",localidad:""}); setModal("add"); }}>+ Nuevo cliente</button>
    </div>
    <div style={{...S.card,overflow:"hidden"}}>
      {loading ? <div style={{padding:40,textAlign:"center",color:"#475569"}}>Cargando…</div> :
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          {["Código","Nombre","Localidad","Acciones"].map(h=><th key={h} style={S.th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.length===0
            ? <tr><td colSpan={4} style={{...S.td,textAlign:"center",padding:32,color:"#475569"}}>Sin clientes</td></tr>
            : filtered.map(r=><tr key={r.id}>
              <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace"}}>{r.codigo||"—"}</td>
              <td style={{...S.td,color:"#fff",fontWeight:600}}>{r.nombre}</td>
              <td style={S.td}>{r.localidad||"—"}</td>
              <td style={S.td}><div style={{display:"flex",gap:5}}>
                <button style={S.btnGhost} onClick={()=>{ setForm({...r}); setModal(r); }}>✏️</button>
                <button style={S.btnDanger} onClick={async()=>{ if(confirm("¿Eliminar?")){ await apiPost({action:"deleteRow",sheet:"Clientes",id:r.id}); load(); } }}>🗑</button>
              </div></td>
            </tr>)}
        </tbody>
      </table>}
    </div>
    {modal && <Modal title={modal==="add"?"Nuevo cliente":"Editar cliente"} onClose={()=>setModal(null)}>
      <Field label="Código"><input style={S.input} value={form.codigo||""} onChange={e=>setForm(p=>({...p,codigo:e.target.value}))} placeholder="Ej: 3156" /></Field>
      <Field label="Nombre *"><input style={S.input} value={form.nombre||""} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Nombre del cliente" /></Field>
      <Field label="Localidad"><input style={S.input} value={form.localidad||""} onChange={e=>setForm(p=>({...p,localidad:e.target.value}))} placeholder="Ciudad" /></Field>
      <div style={{display:"flex",gap:10}}>
        <button style={{...S.btnGhost,flex:1}} onClick={()=>setModal(null)}>Cancelar</button>
        <button style={{...S.btnPri,flex:1}} disabled={saving||!form.nombre} onClick={save}>{saving?"Guardando…":"Guardar"}</button>
      </div>
    </Modal>}
  </div>;
}

function ImportarTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const refCli = useRef(), refDeu = useRef();

  const importarClientes = async (file) => {
    setLoading(true); setStatus(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const clientes = parseClientesExcel(wb);
      if (!clientes.length) throw new Error("No se encontraron clientes");
      const res = await apiPost({action:"bulkUpsert",sheet:"Clientes",rows:clientes});
      setStatus({type:"success", msg:`✅ ${res.added} nuevos, ${res.updated} actualizados`});
    } catch(e) { setStatus({type:"error",msg:"❌ "+e.message}); }
    finally { setLoading(false); }
  };

  const importarDeudores = async (file) => {
    setLoading(true); setStatus(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const { deudores, comprobantes } = parseDeudoresExcel(wb);
      if (!deudores.length) throw new Error("No se encontraron deudores");
      if (!comprobantes.length) throw new Error(`Se encontraron ${deudores.length} deudores pero 0 comprobantes — revisar formato del Excel`);
      await apiPost({action:"bulkUpsert",sheet:"Deudores",rows:deudores});
      await apiPost({action:"clearAndInsert",sheet:"Comprobantes",rows:comprobantes});
      setStatus({type:"success", msg:`✅ ${deudores.length} deudores actualizados, ${comprobantes.length} comprobantes cargados`});
    } catch(e) { setStatus({type:"error",msg:"❌ "+e.message}); }
    finally { setLoading(false); }
  };

  return <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={S.card}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{fontWeight:700,color:"#fff",fontSize:14}}>👥 Importar lista de Clientes</div>
        <div style={{fontSize:12,color:"#475569",marginTop:3}}>Excel con columnas: Código | Nombre | Localidad</div>
      </div>
      <div style={{padding:18}}>
        <input ref={refCli} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&importarClientes(e.target.files[0])} />
        <button style={{...S.btnPri,opacity:loading?0.5:1}} disabled={loading} onClick={()=>refCli.current?.click()}>📂 Seleccionar Excel</button>
        <p style={{fontSize:11,color:"#475569",margin:"8px 0 0"}}>Si el cliente ya existe (mismo código), actualiza sus datos.</p>
      </div>
    </div>
    <div style={S.card}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{fontWeight:700,color:"#fff",fontSize:14}}>💰 Importar Deudores / Comprobantes</div>
        <div style={{fontSize:12,color:"#475569",marginTop:3}}>Excel exportado de tu sistema — formato agrupado por cliente</div>
      </div>
      <div style={{padding:18}}>
        <div style={{...S.card,padding:12,marginBottom:14,background:"#eab30808",border:"1px solid #eab30833"}}>
          <p style={{fontSize:12,color:"#fbbf24",margin:0,fontWeight:600}}>⚠️ Exportá el resumen ANTES de importar</p>
          <p style={{fontSize:11,color:"#92400e",margin:"4px 0 0"}}>Los comprobantes anteriores serán reemplazados.</p>
        </div>
        <input ref={refDeu} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&importarDeudores(e.target.files[0])} />
        <button style={{...S.btnPri,opacity:loading?0.5:1}} disabled={loading} onClick={()=>refDeu.current?.click()}>📂 Seleccionar Excel</button>
      </div>
    </div>
    {loading && <div style={{...S.card,padding:16,textAlign:"center",color:"#fbbf24"}}>⏳ Procesando…</div>}
    {status && <div style={{...S.card,padding:16,color:status.type==="success"?"#34d399":"#f87171",background:status.type==="success"?"#06522210":"#7f1d1d10"}}>{status.msg}</div>}
  </div>;
}

function ResumenTab() {
  const [cobros, setCobros] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rc, rv, rd, rcomp] = await Promise.all([
        apiGet({action:"getData",sheet:"Cobros"}),
        apiGet({action:"getData",sheet:"Visitas"}),
        apiGet({action:"getData",sheet:"Deudores"}),
        apiGet({action:"getData",sheet:"Comprobantes"}),
      ]);
      const deudores = Array.isArray(rd.data)?rd.data:[];
      const comp = Array.isArray(rcomp.data)?rcomp.data:[];
      const clientesConDias = deudores.map(d => {
        const compCliente = comp.filter(c=>String(c.codigo)===String(d.codigo));
        let dias = 0;
        if (compCliente.length > 0) {
          const oldest = compCliente.reduce((a,c)=>calcDias(c.fecha)>calcDias(a.fecha)?c:a);
          dias = calcDias(oldest.fecha);
        }
        return {...d, dias, saldo:Number(d.saldo)||0};
      });
      setCobros(Array.isArray(rc.data)?rc.data:[]);
      setVisitas(Array.isArray(rv.data)?rv.data:[]);
      setClientes(clientesConDias);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{padding:40,textAlign:"center",color:"#475569"}}>Cargando resumen…</div>;

  const saldoTotal    = clientes.reduce((a,c)=>a+c.saldo,0);
  const saldoMas60    = clientes.filter(c=>c.dias>60).reduce((a,c)=>a+c.saldo,0);
  const saldo3060     = clientes.filter(c=>c.dias>30&&c.dias<=60).reduce((a,c)=>a+c.saldo,0);
  const saldoMenos30  = clientes.filter(c=>c.dias<=30).reduce((a,c)=>a+c.saldo,0);
  const cobradoMas60   = cobros.filter(c=>Number(c.diasDeuda)>60).reduce((a,c)=>a+Number(c.monto),0);
  const cobrado3060    = cobros.filter(c=>Number(c.diasDeuda)>30&&Number(c.diasDeuda)<=60).reduce((a,c)=>a+Number(c.monto),0);
  const cobradoMenos30 = cobros.filter(c=>Number(c.diasDeuda)<=30).reduce((a,c)=>a+Number(c.monto),0);
  const cobradoTotal   = cobradoMas60+cobrado3060+cobradoMenos30;

  const resumen = COBRADORES.map(nombre => ({
    nombre,
    cobros:    cobros.filter(c=>c.cobrador===nombre),
    visitas:   visitas.filter(v=>v.cobrador===nombre),
    menos30:   cobros.filter(c=>c.cobrador===nombre&&Number(c.diasDeuda)<=30).reduce((a,c)=>a+Number(c.monto),0),
    entre3060: cobros.filter(c=>c.cobrador===nombre&&Number(c.diasDeuda)>30&&Number(c.diasDeuda)<=60).reduce((a,c)=>a+Number(c.monto),0),
    mas60:     cobros.filter(c=>c.cobrador===nombre&&Number(c.diasDeuda)>60).reduce((a,c)=>a+Number(c.monto),0),
  }));

  const codigosAcc = new Set();
  const nombresAcc = new Set();
  const normN = (n) => String(n||"").toLowerCase().trim();
  cobros.forEach(c => { if (c.codigo) codigosAcc.add(String(c.codigo)); if (c.cliente) nombresAcc.add(normN(c.cliente)); });
  visitas.forEach(v => { if (v.codigo) codigosAcc.add(String(v.codigo)); if (v.cliente) nombresAcc.add(normN(v.cliente)); });
  const sinAccion = clientes.filter(c => {
    if (c.codigo && codigosAcc.has(String(c.codigo))) return false;
    if (c.nombre && nombresAcc.has(normN(c.nombre))) return false;
    return true;
  }).sort((a,b) => b.dias - a.dias);
  const saldoSinAccion = sinAccion.reduce((a,c)=>a+c.saldo,0);

  const cerrarSemana = async () => {
    exportResumen(cobros, visitas, clientes);
    setTimeout(() => {
      const ok = confirm("✅ Excel exportado.\n\n¿Querés limpiar los cobros y visitas de la semana para empezar de cero?\n\nEsta acción no se puede deshacer.");
      if (!ok) return;
      Promise.all([
        apiPost({action:"clearAndInsert", sheet:"Cobros", rows:[]}),
        apiPost({action:"clearAndInsert", sheet:"Visitas", rows:[]}),
      ]).then(() => {
        alert("✅ Semana cerrada. Cobros y visitas limpiados.");
        load();
      }).catch(e => alert("Error al limpiar: " + e.message));
    }, 500);
  };

  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{...S.card,padding:16,background:"#0d1117",border:"1px solid #eab30833",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:11,color:"#eab308",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>📋 Resumen semanal</div>
        <div style={{fontSize:17,color:"#fff",fontWeight:800}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
      </div>
      <button style={{...S.btnGreen,background:"#7f1d1d22",color:"#f87171",border:"1px solid #ef444433"}} onClick={cerrarSemana}>🔒 Cerrar semana</button>
    </div>

    <div style={{...S.card,padding:"16px 20px",border:"1px solid rgba(255,255,255,.12)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>Saldo total cartera</div>
        <div style={{fontSize:26,fontWeight:800,color:"#fff",marginTop:4}}>{fmt(saldoTotal)}</div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#f87171",fontWeight:700,textTransform:"uppercase"}}>+60 días</div>
          <div style={{fontSize:15,fontWeight:700,color:"#f87171",fontFamily:"monospace"}}>{fmt(saldoMas60)}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#fbbf24",fontWeight:700,textTransform:"uppercase"}}>30-60 días</div>
          <div style={{fontSize:15,fontWeight:700,color:"#fbbf24",fontFamily:"monospace"}}>{fmt(saldo3060)}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#34d399",fontWeight:700,textTransform:"uppercase"}}>&lt;30 días</div>
          <div style={{fontSize:15,fontWeight:700,color:"#34d399",fontFamily:"monospace"}}>{fmt(saldoMenos30)}</div>
        </div>
      </div>
    </div>

    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <StatCard label="Total cobrado" value={fmt(cobradoTotal)} color="emerald" />
      <StatCard label="Cobrado +60 días" value={fmt(cobradoMas60)} sub={`Saldo: ${fmt(saldoMas60)}`} color="red" />
      <StatCard label="Cobrado 30-60 días" value={fmt(cobrado3060)} sub={`Saldo: ${fmt(saldo3060)}`} color="amber" />
      <StatCard label="Cobrado <30 días" value={fmt(cobradoMenos30)} sub={`Saldo: ${fmt(saldoMenos30)}`} color="sky" />
    </div>

    <div style={S.card}>
      <div style={{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,.07)",fontWeight:700,color:"#fff",fontSize:14}}>👥 Totales por vendedor</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
            {["Vendedor","📍 Visitas","💰 Cobros","🟢 <30 días","🟡 30-60 días","🔴 +60 días","Total cobrado"].map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {resumen.map(r=><tr key={r.nombre}>
              <td style={{...S.td,color:"#fff",fontWeight:600}}>{r.nombre}</td>
              <td style={{...S.td,color:"#38bdf8",fontFamily:"monospace",fontWeight:700}}>{r.visitas.length}</td>
              <td style={{...S.td,color:"#c084fc",fontFamily:"monospace",fontWeight:700}}>{r.cobros.length}</td>
              <td style={{...S.td,color:"#34d399",fontFamily:"monospace"}}>{fmt(r.menos30)}</td>
              <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace"}}>{fmt(r.entre3060)}</td>
              <td style={{...S.td,color:"#f87171",fontFamily:"monospace"}}>{fmt(r.mas60)}</td>
              <td style={{...S.td,color:"#fff",fontFamily:"monospace",fontWeight:700}}>{fmt(r.menos30+r.entre3060+r.mas60)}</td>
            </tr>)}
            <tr style={{borderTop:"2px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.02)"}}>
              <td style={{...S.td,color:"#fff",fontWeight:700}}>TOTAL</td>
              <td style={{...S.td,color:"#38bdf8",fontFamily:"monospace",fontWeight:700}}>{visitas.length}</td>
              <td style={{...S.td,color:"#c084fc",fontFamily:"monospace",fontWeight:700}}>{cobros.length}</td>
              <td style={{...S.td,color:"#34d399",fontFamily:"monospace",fontWeight:700}}>{fmt(cobradoMenos30)}</td>
              <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontWeight:700}}>{fmt(cobrado3060)}</td>
              <td style={{...S.td,color:"#f87171",fontFamily:"monospace",fontWeight:700}}>{fmt(cobradoMas60)}</td>
              <td style={{...S.td,color:"#fff",fontFamily:"monospace",fontWeight:700}}>{fmt(cobradoTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style={{...S.card,overflow:"hidden",border:"1px solid #f8717133"}}>
      <div style={{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,.07)",background:"#f8717108",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div>
          <span style={{fontWeight:700,color:"#f87171",fontSize:14}}>⚠️ Clientes SIN ACCIÓN</span>
          <span style={{fontSize:12,color:"#475569",marginLeft:10}}>{sinAccion.length} clientes · sin cobros ni visitas esta semana</span>
        </div>
        <span style={{fontFamily:"monospace",fontWeight:700,color:"#f87171",fontSize:14}}>{fmt(saldoSinAccion)}</span>
      </div>
      {sinAccion.length === 0
        ? <div style={{padding:24,textAlign:"center",color:"#34d399",fontSize:13,fontWeight:600}}>✅ Todos los clientes tuvieron alguna acción esta semana</div>
        : <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead style={{position:"sticky",top:0,background:"#161b22",zIndex:1}}><tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
              {["Código","Cliente","Localidad","Días","Saldo"].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {sinAccion.map(c=><tr key={c.id}>
                <td style={{...S.td,color:"#fbbf24",fontFamily:"monospace",fontSize:11}}>{c.codigo||"—"}</td>
                <td style={{...S.td,color:"#fff",fontWeight:600}}>{c.nombre}</td>
                <td style={{...S.td,color:"#64748b",fontSize:12}}>{c.localidad||"—"}</td>
                <td style={S.td}><DiaBadge dias={c.dias} /></td>
                <td style={{...S.td,color:"#f87171",fontFamily:"monospace",fontWeight:700}}>{fmt(c.saldo)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      }
    </div>
  </div>;
}

export default function CobranzasApp({ user, onLogout }) {
  const isAdmin = user && (user.role === "admin");
  const [tab, setTab] = useState("deudores");

  const TABS_CHICOS = [
    {id:"deudores", icon:"🔴", label:"Deudores"},
    {id:"visitas",  icon:"📍", label:"Visitas"},
  ];
  const TABS_ADMIN = [
    ...TABS_CHICOS,
    {id:"clientes", icon:"👥", label:"Clientes"},
    {id:"importar", icon:"📂", label:"Importar"},
    {id:"resumen",  icon:"📋", label:"Resumen"},
  ];
  const tabs = isAdmin ? TABS_ADMIN : TABS_CHICOS;

  return (
    <div style={S.page}>
      <div style={{background:"rgba(13,17,23,.95)",borderBottom:"1px solid rgba(255,255,255,.07)",padding:"0 16px",position:"sticky",top:0,zIndex:40}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,flexWrap:"wrap",gap:6}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,background:"#eab30822",border:"1px solid #eab30840",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>💼</div>
            <div>
              <div style={{fontWeight:800,color:"#fff",fontSize:13,lineHeight:1}}>Cobranzas & Visitas</div>
              <div style={{fontSize:10,color:"#475569",marginTop:2}}>{isAdmin?"👑 Administrador":user?.name||""}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:tab===t.id?"1px solid #eab30840":"1px solid transparent",background:tab===t.id?"#eab30815":"transparent",color:tab===t.id?"#fbbf24":"#64748b"}}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
            <button onClick={onLogout} style={{...S.btnGhost,fontSize:11,padding:"5px 10px",marginLeft:6}}>← Menú</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px"}}>
        <div style={{marginBottom:18}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"#fff",margin:0,marginBottom:3}}>
            {tabs.find(t=>t.id===tab)?.icon} {tabs.find(t=>t.id===tab)?.label}
          </h2>
        </div>
        {tab==="deudores" && <DeudoresTab isAdmin={isAdmin} />}
        {tab==="visitas"  && <VisitasTab isAdmin={isAdmin} />}
        {tab==="clientes" && isAdmin && <ClientesTab />}
        {tab==="importar" && isAdmin && <ImportarTab />}
        {tab==="resumen"  && isAdmin && <ResumenTab />}
      </div>
    </div>
  );
}
