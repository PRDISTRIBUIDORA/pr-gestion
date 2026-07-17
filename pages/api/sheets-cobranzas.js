const SHEET_URL = "https://script.google.com/macros/s/AKfycbzMYA_Kj6JlKtxAXE3MSXa1rcUtGyx1qf_EqjUe0xohUaP6fkcJWo1wMqvkADL2UYvFbw/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    if (req.method === "GET") {
      const params = new URLSearchParams(req.query).toString();
      const url = params ? `${SHEET_URL}?${params}` : SHEET_URL;
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`Sheets error: ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const response = await fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify(req.body),
      });
      if (!response.ok) throw new Error(`Sheets error: ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data);
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[API/sheets-cobranzas]", error);
    res.status(500).json({ error: error.message });
  }
}
