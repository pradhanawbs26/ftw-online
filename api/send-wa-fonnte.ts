export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const token = (body.token || "iNfrBRnqQj4izhPo4PKL").trim();
    const target = (body.target || "120363042234367353@g.us").trim();
    const message = (body.message || "").trim();

    if (!message) {
      return res.status(400).json({ success: false, error: "Pesan WhatsApp tidak boleh kosong." });
    }

    const params = new URLSearchParams();
    params.append("target", target);
    params.append("message", message);
    params.append("countryCode", "62");

    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": token },
      body: params
    });

    const text = await fonnteRes.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (fonnteRes.ok && data.status === true) {
      return res.status(200).json({
        success: true,
        message: `Pesan WhatsApp berhasil dikirim ke ${target}`,
        data
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.reason || data.message || "Gagal mengirim pesan melalui Fonnte",
        details: data
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
