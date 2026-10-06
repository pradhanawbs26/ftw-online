export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/ftw-wbs/databases/(default)/documents";

  if (req.method === "GET") {
    try {
      const date = req.query?.date as string | undefined;
      const limit = parseInt(req.query?.limit as string || "500", 10);

      const structuredQuery: any = {
        from: [{ collectionId: "assessments" }],
        limit: Math.min(limit, 1000)
      };

      if (date) {
        structuredQuery.where = {
          fieldFilter: {
            field: { fieldPath: "tanggalPengisian" },
            op: "EQUAL",
            value: { stringValue: date }
          }
        };
      } else {
        structuredQuery.orderBy = [
          { field: { fieldPath: "timestamp" }, direction: "DESCENDING" }
        ];
      }

      const response = await fetch(`${FIRESTORE_BASE}:runQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery })
      });

      if (!response.ok) {
        throw new Error(`Firestore returned ${response.status}: ${await response.text()}`);
      }

      const items = await response.json();
      const records: any[] = [];

      for (const item of items) {
        if (item && item.document && item.document.fields) {
          const f = item.document.fields;
          const obj: any = {};
          for (const [k, v] of Object.entries(f) as [string, any][]) {
            if (v.stringValue !== undefined) obj[k] = v.stringValue;
            else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
            else if (v.doubleValue !== undefined) obj[k] = parseFloat(v.doubleValue);
            else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
            else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
          }
          records.push(obj);
        }
      }

      return res.status(200).json(records);
    } catch (err: any) {
      console.error("[Vercel /api/history GET error]", err);
      return res.status(500).json({ error: "Failed to fetch assessments", details: err.message });
    }
  }

  if (req.method === "POST") {
    try {
      const record = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!record || !record.id) {
        return res.status(400).json({ error: "Invalid record data" });
      }

      // Convert record fields to Firestore document format
      const fields: any = {};
      for (const [k, v] of Object.entries(record)) {
        if (v === undefined || v === null) continue;
        if (typeof v === "string") fields[k] = { stringValue: v };
        else if (typeof v === "number") {
          if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
          else fields[k] = { doubleValue: v };
        } else if (typeof v === "boolean") fields[k] = { booleanValue: v };
      }

      const patchUrl = `${FIRESTORE_BASE}/assessments/${encodeURIComponent(record.id)}`;
      const saveResp = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields })
      });

      if (!saveResp.ok) {
        throw new Error(`Failed to save to Firestore: ${await saveResp.text()}`);
      }

      return res.status(200).json({ success: true, id: record.id });
    } catch (err: any) {
      console.error("[Vercel /api/history POST error]", err);
      return res.status(500).json({ error: "Failed to save assessment", details: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
