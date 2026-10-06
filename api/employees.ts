export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const FIRESTORE_ROSTER_URL = "https://firestore.googleapis.com/v1/projects/ftw-wbs/databases/(default)/documents/directory/roster";

  if (req.method === "GET") {
    try {
      const resp = await fetch(FIRESTORE_ROSTER_URL);
      if (!resp.ok) {
        return res.status(200).json({});
      }
      const data = await resp.json();
      const rosterField = data?.fields?.roster?.mapValue?.fields;
      if (!rosterField) {
        return res.status(200).json({});
      }

      const result: Record<string, { nama: string; jabatan: string; dept: string }> = {};
      for (const [nik, val] of Object.entries(rosterField) as [string, any][]) {
        const itemFields = val?.mapValue?.fields || {};
        result[nik] = {
          nama: itemFields.nama?.stringValue || "",
          jabatan: itemFields.jabatan?.stringValue || "",
          dept: itemFields.dept?.stringValue || ""
        };
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/employees GET error]", err);
      return res.status(500).json({ error: "Failed to fetch employees", details: err.message });
    }
  }

  if (req.method === "POST") {
    try {
      const employees = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!employees || typeof employees !== "object") {
        return res.status(400).json({ error: "Invalid employee data" });
      }

      const rosterMapFields: any = {};
      let count = 0;
      for (const [nik, info] of Object.entries(employees) as [string, any][]) {
        if (!info) continue;
        rosterMapFields[nik] = {
          mapValue: {
            fields: {
              nama: { stringValue: info.nama || "" },
              jabatan: { stringValue: info.jabatan || "" },
              dept: { stringValue: info.dept || "" }
            }
          }
        };
        count++;
      }

      const payload = {
        fields: {
          count: { integerValue: String(count) },
          updatedAt: { stringValue: new Date().toISOString() },
          roster: {
            mapValue: {
              fields: rosterMapFields
            }
          }
        }
      };

      const patchResp = await fetch(FIRESTORE_ROSTER_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!patchResp.ok) {
        throw new Error(`Failed to save roster to Firestore: ${await patchResp.text()}`);
      }

      return res.status(200).json({ success: true, count });
    } catch (err: any) {
      console.error("[Vercel /api/employees POST error]", err);
      return res.status(500).json({ error: "Failed to save employees", details: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
