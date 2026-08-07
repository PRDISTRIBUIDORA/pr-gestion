// ============================================================
//  API Cobranzas — ahora habla con SUPABASE (antes: Apps Script)
//  El frontend (pages/cobranzas.js) NO cambia: sigue llamando a
//  /api/sheets-cobranzas con las mismas acciones y nombres.
//  Este archivo traduce entre los nombres del frontend (formaPago,
//  diasDeuda) y los de Supabase (forma_pago, dias_deuda).
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const config = { maxDuration: 60 };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuración por "hoja" (sheet del frontend -> tabla de Supabase).
// cols   = columnas reales de la tabla (sin id ni created_at, que son automáticas).
// num/int/date = para convertir el tipo de dato antes de guardar.
// map    = nombre-del-frontend : nombre-en-supabase (solo donde difieren).
const TABLES = {
  Clientes:     { table: "clientes",     cols: ["codigo","nombre","localidad"],
                  num: [], int: [], date: [], map: {} },
  Deudores:     { table: "deudores",     cols: ["codigo","nombre","localidad","saldo"],
                  num: ["saldo"], int: [], date: [], map: {} },
  Comprobantes: { table: "comprobantes", cols: ["codigo","cliente","fecha","comprobante","importe"],
                  num: ["importe"], int: [], date: ["fecha"], map: {} },
  Cobros:       { table: "cobros",       cols: ["codigo","cliente","localidad","monto","forma_pago","cobrador","notas","dias_deuda","saldo","fecha"],
                  num: ["monto","saldo"], int: ["dias_deuda"], date: ["fecha"],
                  map: { formaPago: "forma_pago", diasDeuda: "dias_deuda" } },
  Visitas:      { table: "visitas",      cols: ["codigo","cliente","localidad","estado","cobrador","notas","fecha"],
                  num: [], int: [], date: ["fecha"], map: {} },
  Cobranzas:    { table: "cobranzas",    cols: ["codigo","cliente","monto","fecha_vencimiento","estado","cobrador","notas"],
                  num: ["monto"], int: [], date: ["fecha_vencimiento"],
                  map: { fechaVencimiento: "fecha_vencimiento" } },
};

function coerce(cfg, key, val) {
  if (cfg.num.includes(key))  { if (val === "" || val == null) return null; const n = Number(String(val).replace(",", ".")); return isNaN(n) ? null : n; }
  if (cfg.int.includes(key))  { if (val === "" || val == null) return null; const n = parseInt(String(val), 10); return isNaN(n) ? null : n; }
  if (cfg.date.includes(key)) { if (val === "" || val == null) return null; return String(val).slice(0, 10); }
  return val;
}

// Objeto del frontend -> fila lista para Supabase (solo columnas válidas)
function toDb(cfg, obj) {
  const out = {};
  for (const rawKey in obj) {
    const dbKey = cfg.map[rawKey] || rawKey;
    if (!cfg.cols.includes(dbKey)) continue; // ignora id, created_at, dias, etc.
    out[dbKey] = coerce(cfg, dbKey, obj[rawKey]);
  }
  return out;
}

// Fila de Supabase -> objeto para el frontend (renombra a camelCase)
function toClient(cfg, row) {
  const rev = {};
  for (const k in cfg.map) rev[cfg.map[k]] = k;
  const out = {};
  for (const k in row) out[rev[k] || k] = row[k];
  return out;
}

// Trae TODAS las filas (paginando de a 1000, por si una tabla crece)
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

  try {
    // -------- LECTURA --------
    if (req.method === "GET") {
      const { action, sheet } = req.query;
      if (action !== "getData") return res.status(400).json({ error: "Acción GET no soportada: " + action });
      const cfg = TABLES[sheet];
      if (!cfg) return res.status(400).json({ error: "Hoja desconocida: " + sheet });
      const rows = await fetchAll(cfg.table);
      return res.status(200).json({ ok: true, data: rows.map((r) => toClient(cfg, r)) });
    }

    // -------- ESCRITURA --------
    if (req.method === "POST") {
      const { action, sheet, data, id, rows } = req.body || {};
      const cfg = TABLES[sheet];
      if (!cfg) return res.status(400).json({ error: "Hoja desconocida: " + sheet });

      if (action === "addRow") {
        const { data: ins, error } = await supabase.from(cfg.table).insert(toDb(cfg, data || {})).select().single();
        if (error) throw error;
        return res.status(200).json({ ok: true, data: toClient(cfg, ins) });
      }

      if (action === "updateRow") {
        const { error } = await supabase.from(cfg.table).update(toDb(cfg, data || {})).eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === "deleteRow") {
        const { error } = await supabase.from(cfg.table).delete().eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === "bulkUpsert") {
        // Actualiza si ya existe (mismo codigo), inserta si es nuevo — en una sola operación.
        const existing = await fetchAll(cfg.table);
        const byCodigo = new Map();
        existing.forEach((e) => { if (e.codigo != null && e.codigo !== "") byCodigo.set(String(e.codigo), e.id); });

        const seenIds = new Set();
        const payload = [];
        let added = 0, updated = 0;
        for (const r of (rows || [])) {
          const db = toDb(cfg, r);
          const key = db.codigo != null && db.codigo !== "" ? String(db.codigo) : null;
          if (key && byCodigo.has(key)) {
            db.id = byCodigo.get(key);
            if (seenIds.has(db.id)) continue; // evita conflicto por codigo repetido en el mismo lote
            seenIds.add(db.id);
            updated++;
          } else {
            db.id = randomUUID(); // fila nueva: le generamos un id para no mandar null
            added++;
          }
          payload.push(db);
        }
        if (payload.length) {
          const { error } = await supabase.from(cfg.table).upsert(payload);
          if (error) throw error;
        }
        return res.status(200).json({ ok: true, added, updated });
      }

      if (action === "clearAndInsert") {
        const { error: delErr } = await supabase.from(cfg.table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) throw delErr;
        const payload = (rows || []).map((r) => toDb(cfg, r));
        let inserted = 0;
        for (let i = 0; i < payload.length; i += 500) {
          const chunk = payload.slice(i, i + 500);
          const { error } = await supabase.from(cfg.table).insert(chunk);
          if (error) throw error;
          inserted += chunk.length;
        }
        return res.status(200).json({ ok: true, inserted });
      }

      return res.status(400).json({ error: "Acción no soportada: " + action });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[API/sheets-cobranzas]", error);
    res.status(500).json({ error: error.message || String(error) });
  }
}
