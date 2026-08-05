// ============================================================
//  API Pedidos — ahora habla con SUPABASE (antes: Apps Script)
//  El frontend (pages/pedidos.js) NO cambia: sigue llamando a
//  /api/sheets-pedidos con las mismas acciones.
//  Maneja 3 cosas: pedidos, articulos (lista de precios) y stock.
// ============================================================
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ---- PEDIDOS: mapeo de nombres frontend <-> supabase (solo donde difieren)
const PED_MAP_TO_DB     = { estadoReparto: "estado_reparto", fechaReparto: "fecha_reparto" };
const PED_MAP_TO_CLIENT = { estado_reparto: "estadoReparto", fecha_reparto: "fechaReparto" };
const PED_COLS = ["id","vendedor","cliente","tipo","promo","urgente","items","total","fecha","estado","estado_reparto","fecha_reparto","transporte"];

function pedToDb(obj) {
  const out = {};
  for (const k in obj) {
    const dk = PED_MAP_TO_DB[k] || k;
    if (!PED_COLS.includes(dk)) continue;
    let v = obj[k];
    if (dk === "id")           v = v == null ? null : String(v);
    else if (dk === "total")   v = (v === "" || v == null) ? 0 : Number(v);
    else if (dk === "urgente") v = !!v;
    out[dk] = v;
  }
  return out;
}
function pedToClient(row) {
  const out = {};
  for (const k in row) out[PED_MAP_TO_CLIENT[k] || k] = row[k];
  if (out.total != null) out.total = Number(out.total);
  return out;
}

// ---- ARTICULOS
function artToDb(o) {
  return {
    id:        o.id == null ? null : String(o.id),
    codigo:    o.codigo == null ? "" : String(o.codigo),
    nombre:    o.nombre == null ? "" : String(o.nombre),
    precio:    (o.precio === "" || o.precio == null) ? 0 : Number(o.precio),
    proveedor: o.proveedor == null ? "" : String(o.proveedor),
  };
}
function artToClient(r) {
  return { id: r.id, codigo: r.codigo, nombre: r.nombre, precio: Number(r.precio), proveedor: r.proveedor };
}

async function fetchAll(table) {
  const pageSize = 1000;
  let from = 0, all = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action;

  try {
    // ---------------- LECTURA (GET) ----------------
    if (req.method === "GET") {
      if (action === "getPedidos") {
        const rows = await fetchAll("pedidos");
        return res.status(200).json(rows.map(pedToClient));
      }
      if (action === "getArticulos") {
        const rows = await fetchAll("articulos");
        return res.status(200).json(rows.map(artToClient));
      }
      if (action === "getStock") {
        const rows = await fetchAll("stock");
        const map = {};
        rows.forEach((r) => { map[r.codigo] = Number(r.cantidad); });
        return res.status(200).json(map);
      }
      return res.status(400).json({ error: "Acción GET desconocida: " + action });
    }

    // ---------------- ESCRITURA (POST) ----------------
    const body = req.body || {};

    if (action === "addPedido") {
      const { error } = await supabase.from("pedidos").insert(pedToDb(body));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "updEstado" || action === "updReparto" || action === "updateOrder") {
      const payload = pedToDb(body);
      const id = payload.id;
      delete payload.id;
      const { error } = await supabase.from("pedidos").update(payload).eq("id", String(id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "deleteOrder") {
      const { error } = await supabase.from("pedidos").delete().eq("id", String(body.id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "saveArticulo") {
      const { error } = await supabase.from("articulos").upsert(artToDb(body), { onConflict: "id" });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "deleteArticulo") {
      const { error } = await supabase.from("articulos").delete().eq("id", String(body.id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "importArticulos") {
      // body es el array COMPLETO de artículos -> reemplaza la tabla
      const seen = new Set();
      const rows = [];
      for (const o of (Array.isArray(body) ? body : [])) {
        const r = artToDb(o);
        if (r.id == null || seen.has(r.id)) continue;
        seen.add(r.id);
        rows.push(r);
      }
      const { error: delErr } = await supabase.from("articulos").delete().neq("id", "___none___");
      if (delErr) throw delErr;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("articulos").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      return res.status(200).json({ ok: true, inserted });
    }

    if (action === "saveStock") {
      // body es el mapa completo { codigo: cantidad }
      const rows = Object.entries(body).map(([codigo, cantidad]) => ({
        codigo: String(codigo),
        cantidad: parseInt(cantidad, 10) || 0,
      }));
      if (rows.length) {
        const { error } = await supabase.from("stock").upsert(rows, { onConflict: "codigo" });
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción POST desconocida: " + action });
  } catch (error) {
    console.error("[API/sheets-pedidos]", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
