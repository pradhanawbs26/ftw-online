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
    const record = body.record;
    if (!record) {
      return res.status(400).json({ success: false, error: "Data laporan tidak ditemukan." });
    }

    const token = (body.token || "iNfrBRnqQj4izhPo4PKL").trim();
    const target = (body.target || "120363042234367353@g.us").trim();

    let statusLabel = "FIT TO WORK";
    let statusIcon = "✅";
    let tindakan = "Karyawan diizinkan bekerja normal sesuai standar keselamatan.";

    if (record.finalDecision === "UNFIT") {
      statusLabel = "UNFIT / TIDAK FIT BEKERJA";
      statusIcon = "⛔";
      tindakan = "Karyawan TIDAK DIIZINKAN bekerja/mengoperasikan unit. Pengawas/Supervisor wajib segera mengarahkan karyawan ke klinik/ruang istirahat dan menyiapkan operator pengganti.";
    } else if (record.finalDecision === "REST_BEFORE_WORK") {
      statusLabel = "BUTUH ISTIRAHAT SEBELUM BEKERJA";
      statusIcon = "⚠️";
      tindakan = "Karyawan WAJIB istirahat tambahan sebelum bekerja. Lakukan evaluasi ulang kondisi fisik sebelum diizinkan mengoperasikan unit/alat berat.";
    } else if (record.finalDecision === "FIT_CONDITIONAL" || record.consumesObat || record.hasPersonalProblem) {
      statusLabel = "BUTUH PENGAWASAN KHUSUS (FIT DENGAN CATATAN)";
      statusIcon = "⚠️";
      tindakan = "Karyawan diizinkan bekerja HANYA dengan PENGAWASAN KETAT oleh Pengawas/Supervisor shift berjalan terkait konsumsi obat/kondisi fisik.";
    }

    const message = `🚨 *NOTIFIKASI FIT TO WORK (WBS)* 🚨\n━━━━━━━━━━━━━━━━━━━━━\n${statusIcon} *STATUS: ${statusLabel}*\n\n👤 *Data Karyawan:*\n• *Nama:* ${record.nama || "-"}\n• *NIK:* ${record.nik || "-"}\n• *Departemen:* ${record.dept || "-"}\n• *Jabatan:* ${record.jabatan || "-"}\n• *Waktu Lapor:* ${record.tanggalPengisian || "-"} pukul ${record.jamPengisian || "-"}\n\n💤 *Parameter Tidur & Kelelahan:*\n• *Total Tidur 12 Jam:* ${record.totalSleep12 ?? "-"} Jam\n• *Total Tidur 36 Jam:* ${record.totalSleep36 ?? "-"} Jam\n• *Fatigue Score:* ${record.totalFatigueScore ?? "-"} (${record.fatigueCategory || "-"})\n• *Readiness Score:* ${record.readinessScore ?? "-"}%\n\n📋 *Catatan Khusus:*\n• *Konsumsi Obat:* ${record.consumesObat ? "⚠️ YA (Perlu Perhatian)" : "Tidak"}\n• *Masalah Pribadi:* ${record.hasPersonalProblem ? "⚠️ YA (Berpotensi Distraksi)" : "Tidak"}\n\n📢 *Rekomendasi Tindakan Pengawas:*\n${tindakan}\n━━━━━━━━━━━━━━━━━━━━━\n_Sistem Fit to Work Online PT. Wahana Bara Sentosa_`;

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
        message: `Alert untuk ${record.nama} berhasil dikirim ke ${target}`,
        data
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.reason || data.message || "Gagal mengirim ke Fonnte",
        details: data
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
