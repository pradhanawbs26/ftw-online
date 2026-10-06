import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Path to data storage
const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");

// List of Google AI Studio dummy/demo employee NIKs that must be completely excluded
const DUMMY_NIKS_TO_PURGE = ["88204911", "A0483", "A5021", "A8274", "A0912", "A3821", "88112233", "88556677"];
const DEFAULT_EMPLOYEES: Record<string, { nama: string; jabatan: string; dept: string }> = {};

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

const DEFAULT_CONFIG = {
  spreadsheetId: "15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI",
  webhookUrl: "",
  fonnteToken: "iNfrBRnqQj4izhPo4PKL",
  fonnteTarget: "120363042234367353@g.us",
  fonnteEnabled: true,
  fonnteAlertUnfit: true,
  fonnteAlertRest: true,
  fonnteAlertConditional: true
};

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
} else {
  try {
    const existing = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    const merged = {
      ...DEFAULT_CONFIG,
      ...existing,
      fonnteToken: (existing.fonnteToken && String(existing.fonnteToken).trim()) ? existing.fonnteToken : DEFAULT_CONFIG.fonnteToken,
      fonnteTarget: (existing.fonnteTarget && String(existing.fonnteTarget).trim()) ? existing.fonnteTarget : DEFAULT_CONFIG.fonnteTarget
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  } catch (e) {}
}

if (!fs.existsSync(EMPLOYEES_FILE)) {
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify({}, null, 2));
} else {
  // Purge any dummy records from existing employees.json
  try {
    const raw = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
    const emp = JSON.parse(raw);
    let changed = false;
    for (const d of DUMMY_NIKS_TO_PURGE) {
      if (emp[d]) {
        delete emp[d];
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(emp, null, 2));
      console.log("[Clean-Up] Successfully purged default dummy employees from employees.json");
    }
  } catch (e: any) {
    console.error("Failed to clean dummy employees from server file", e.message);
  }
}

// ---------------- CORPO SYNC ENGINE (GOOGLE SHEETS) ----------------

// High-performance slice-based CSV parser with quote escaping support
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let start = 0;
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c === 34) { // quote '"'
      inQuotes = !inQuotes;
    } else if (c === 44 && !inQuotes) { // comma ','
      let cell = text.slice(start, i);
      if (cell.startsWith('"') && cell.endsWith('"')) {
        cell = cell.slice(1, -1).replace(/""/g, '"');
      }
      row.push(cell);
      start = i + 1;
    } else if ((c === 10 || c === 13) && !inQuotes) { // newline '\n' or '\r'
      let cell = text.slice(start, i);
      if (cell.startsWith('"') && cell.endsWith('"')) {
        cell = cell.slice(1, -1).replace(/""/g, '"');
      }
      row.push(cell);
      if (row.length > 1 || row[0] !== '') lines.push(row);
      row = [];
      if (c === 13 && i + 1 < len && text.charCodeAt(i + 1) === 10) {
        i++;
      }
      start = i + 1;
    }
  }
  if (start < len) {
    let cell = text.slice(start);
    if (cell.startsWith('"') && cell.endsWith('"')) {
      cell = cell.slice(1, -1).replace(/""/g, '"');
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') lines.push(row);
  }
  return lines;
}

let isSyncInProgress = false;

// Public spreadsheet-based auto-hydration loader
async function syncFromGoogleSheet() {
  if (isSyncInProgress) {
    console.log("[Sync] Sync already in progress, skipping concurrent run.");
    return;
  }
  isSyncInProgress = true;
  try {
    if (!fs.existsSync(CONFIG_FILE)) return;
    const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(configData);
    const spreadsheetId = config.spreadsheetId;
    if (!spreadsheetId || spreadsheetId.trim() === "" || spreadsheetId === "YOUR_SPREADSHEET_ID") {
      console.log("[Sync] Skipping sheet sync. Spreadsheet ID is empty or generic.");
      return;
    }

    console.log(`[Sync] Triggered auto-sync with Spreadsheet ID: ${spreadsheetId}`);

    // 1. Sync Employees List (Karyawan Tab)
    try {
      const urlKaryawan = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Karyawan`;
      const resKaryawan = await fetch(urlKaryawan);
      if (resKaryawan.ok) {
        const csvText = await resKaryawan.text();
        const rows = parseCSV(csvText);
        if (rows.length > 1) {
          const firstHeader = rows[0][0] ? rows[0][0].trim().toUpperCase() : "";
          // Make sure this is indeed the Employee registry sheet
          if (firstHeader !== "NIK" && firstHeader !== "NIK/ID") {
            console.log(`[Sync] Warning: Expected 'Karyawan' sheet header starting with 'NIK', but got '${firstHeader}'. Skipping Employee sync to prevent database contamination.`);
          } else {
            const employees: Record<string, { nama: string; jabatan: string; dept: string }> = {};
            // Skip header row
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const nik = row[0] ? row[0].trim().toUpperCase() : "";
              if (nik && nik !== "NIK" && nik !== "NIK/ID") {
                employees[nik] = {
                  nama: row[1] ? row[1].trim() : "",
                  jabatan: row[2] ? row[2].trim() : "",
                  dept: row[3] ? row[3].trim() : ""
                };
              }
            }
            if (Object.keys(employees).length > 0) {
              let existingEmployees: Record<string, any> = {};
              if (fs.existsSync(EMPLOYEES_FILE)) {
                try {
                  existingEmployees = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
                } catch (e) {}
              }
              // Merge existing employees with Google Sheet employees so locally added/custom employees are NEVER lost
              const mergedEmployees = { ...existingEmployees, ...employees };
              fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(mergedEmployees, null, 2));
              console.log(`[Sync] Successfully loaded & cached ${Object.keys(mergedEmployees).length} employees (${Object.keys(employees).length} from Sheet 'Karyawan')`);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("[Sync Warning] Failed to sync employee database from sheet:", e.message);
    }

    // 2. Sync Assessment History (Laporan_Fit Tab)
    try {
      const urlHistory = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Laporan_Fit`;
      const resHistory = await fetch(urlHistory);
      if (resHistory.ok) {
        const csvText = await resHistory.text();
        const rows = parseCSV(csvText);
        if (rows.length > 1) {
          const firstHeader = rows[0][0] ? rows[0][0].trim().toUpperCase() : "";
          // Make sure this is indeed the Assessment results sheet
          if (firstHeader !== "ID" && firstHeader !== "ID LAPORAN" && firstHeader !== "ID_LAPORAN" && !firstHeader.includes("LAPORAN") && !firstHeader.includes("ID")) {
            console.log(`[Sync] Skipping 'Laporan_Fit' sheet sync. Header '${firstHeader}' does not match expected assessment headers.`);
          } else {
            // Load any existing local history records to avoid losing freshly submitted records
            let existingLocalHistory: any[] = [];
            if (fs.existsSync(HISTORY_FILE)) {
              try {
                existingLocalHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
              } catch (e) {}
            }

            const idSeenCounts = new Map<string, number>();
            const sheetRecords: any[] = [];

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length < 5) continue;
              let rawId = row[0] ? row[0].trim() : "";
              if (!rawId || rawId === "ID" || rawId === "ID LAPORAN" || rawId === "ID_LAPORAN") {
                rawId = `WBS-FTW-ROW-${i}`;
              }

              // Handle collision: never drop rows with colliding IDs, assign deterministic unique suffix
              const seenCount = (idSeenCounts.get(rawId) || 0) + 1;
              idSeenCounts.set(rawId, seenCount);
              const uniqueId = seenCount > 1 ? `${rawId}-dup${seenCount}` : rawId;

              const tanggal = row[1] ? row[1].trim() : "";
              const jam = row[2] ? row[2].trim() : "";
              const nik = row[3] ? row[3].trim().toUpperCase() : "";
              const nama = row[4] ? row[4].trim() : "";
              const jabatan = row[5] ? row[5].trim() : "";
              const dept = row[6] ? row[6].trim() : "";
              const totalSleep12 = parseFloat(row[7] ? row[7].replace(",", ".") : "0") || 0;
              const totalSleep36 = parseFloat(row[8] ? row[8].replace(",", ".") : "0") || 0;
              const consumesObat = row[9] === 'Ya / Yes' || row[9] === 'Ya' || row[9] === 'Yes' || row[9] === 'true';
              const hasPersonalProblem = row[10] === 'Ya / Yes' || row[10] === 'Ya' || row[10] === 'Yes' || row[10] === 'true';

              const totalFatigueScore = parseInt(row[11]) || 0;
              const readinessScore = Math.max(0, 100 - (totalFatigueScore * 7.5));

              let fatigueCategory = "NORMAL";
              let finalDecision = row[12] ? row[12].trim() : "";

              if (totalFatigueScore >= 12) {
                fatigueCategory = "REJECT";
                if (!finalDecision) finalDecision = "UNFIT";
              } else if (totalFatigueScore >= 9) {
                fatigueCategory = "REST";
                if (!finalDecision) finalDecision = "REST_BEFORE_WORK";
              } else if (totalFatigueScore >= 7) {
                fatigueCategory = "LAPOR";
                if (!finalDecision) finalDecision = "FIT_CONDITIONAL";
              } else {
                fatigueCategory = "NORMAL";
                if (!finalDecision) finalDecision = "FIT";
              }

              if (consumesObat || hasPersonalProblem) {
                if (finalDecision === 'FIT') {
                  finalDecision = 'FIT_CONDITIONAL';
                  fatigueCategory = "LAPOR";
                }
              }

              const record = {
                id: uniqueId,
                originalId: rawId,
                timestamp: tanggal ? `${tanggal} ${jam}`.trim() : (row[2] || ""),
                nik,
                nama,
                jabatan,
                dept,
                tanggalPengisian: tanggal,
                jamPengisian: jam,
                totalSleep12,
                totalSleep36,
                consumesObat,
                hasPersonalProblem,
                totalFatigueScore,
                readinessScore,
                fatigueCategory,
                finalDecision: finalDecision || "FIT"
              };
              sheetRecords.push(record);
            }

            // Merge local submissions that might not have landed in Google Sheets yet
            const sheetKeySet = new Set(sheetRecords.map(r => `${r.nik}__${r.tanggalPengisian}__${r.jamPengisian}`));
            const mergedHistory = [...sheetRecords];
            for (const localRec of existingLocalHistory) {
              if (!localRec || !localRec.nik) continue;
              const localKey = `${localRec.nik}__${localRec.tanggalPengisian}__${localRec.jamPengisian}`;
              if (!sheetKeySet.has(localKey)) {
                mergedHistory.push(localRec);
                sheetKeySet.add(localKey);
              }
            }

            if (mergedHistory.length > 0) {
              // Sort strictly newest-first by normalized date and time
              mergedHistory.sort((a, b) => {
                const dateA = normalizeDateStr(a.tanggalPengisian || a.timestamp || "");
                const dateB = normalizeDateStr(b.tanggalPengisian || b.timestamp || "");
                if (dateA !== dateB) return dateB.localeCompare(dateA);
                const timeA = (a.jamPengisian || "").padStart(5, "0");
                const timeB = (b.jamPengisian || "").padStart(5, "0");
                return timeB.localeCompare(timeA);
              });

              await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(mergedHistory, null, 2));
              console.log(`[Sync] Successfully loaded, merged & cached ${mergedHistory.length} assessment entries (${sheetRecords.length} from Sheet 'Laporan_Fit')`);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("[Sync Warning] Failed to sync assessment history from sheet:", e.message);
    }

  } catch (err: any) {
    console.error("[Sync Core Error] Critical sheet sync fail:", err.message);
  } finally {
    isSyncInProgress = false;
  }
}

// ---------------- REST API Endpoints ----------------

// Force-sync on demand endpoint
app.post("/api/sync-force", async (req, res) => {
  try {
    await syncFromGoogleSheet();
    res.json({ success: true, message: "System re-hydrated from Google Spreadsheet successfully." });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to force sync", details: e.message });
  }
});

// 1. Get entire assessment history
app.get("/api/history", (req, res) => {
  try {
    const data = fs.readFileSync(HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return res.json(parsed);
    }
    res.json([]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read history logs", details: error.message });
  }
});

// Helper for date normalization
function normalizeDateStr(dateStr?: string): string {
  if (!dateStr) return "";
  const clean = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return clean;
}

function timeToMinutes(tStr?: string): number {
  if (!tStr) return 0;
  const parts = String(tStr).trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// 1b. Pull NIKs and Operator assessments by Date & Shift (e.g. Shift 2: 16:00 - 18:00)
app.get("/api/ftw/shift-operators", (req, res) => {
  try {
    const rawDate = (req.query.date as string) || new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const targetDate = normalizeDateStr(rawDate);
    const shiftParam = ((req.query.shift as string) || "2").toUpperCase();
    const isShift2 = shiftParam === "2" || shiftParam === "NIGHT" || shiftParam === "MALAM";
    const timeStart = req.query.startTime ? timeToMinutes(req.query.startTime as string) : null;
    const timeEnd = req.query.endTime ? timeToMinutes(req.query.endTime as string) : null;
    const statusFilter = (req.query.status as string)?.toUpperCase();

    if (!fs.existsSync(HISTORY_FILE)) {
      res.json({
        success: true,
        query: { date: targetDate, shift: isShift2 ? "Shift 2 (Malam)" : "Shift 1 (Siang)" },
        summary: { totalSubmissions: 0, uniqueOperators: 0, fitCount: 0, unfitCount: 0 },
        nikList: [],
        fitNikList: [],
        unfitNikList: [],
        operators: []
      });
      return;
    }

    const data = fs.readFileSync(HISTORY_FILE, "utf-8");
    const history: any[] = JSON.parse(data);

    // Filter by date and shift / time
    const matched = history.filter((item: any) => {
      const itemDate = normalizeDateStr(item.tanggalPengisian || item.timestamp?.slice(0, 10));
      if (targetDate && itemDate !== targetDate) return false;

      const itemMins = timeToMinutes(item.jamPengisian);
      const itemIsDay = itemMins >= 60 && itemMins < 780; // 01:00 - 12:59
      const itemIsNight = !itemIsDay; // 13:00 - 00:59

      if (isShift2 && !itemIsNight) return false;
      if (!isShift2 && !itemIsDay) return false;

      // Optional precise time range e.g. 16:00 - 18:00
      if (timeStart !== null && itemMins < timeStart) return false;
      if (timeEnd !== null && itemMins > timeEnd) return false;

      if (statusFilter && item.finalDecision !== statusFilter) return false;

      return true;
    });

    const nikList = Array.from(new Set(matched.map((r: any) => r.nik))).filter(Boolean);
    const fitRecords = matched.filter((r: any) => r.finalDecision === "FIT" || r.finalDecision === "FIT_CONDITIONAL");
    const fitNikList = Array.from(new Set(fitRecords.map((r: any) => r.nik))).filter(Boolean);
    const unfitRecords = matched.filter((r: any) => r.finalDecision === "UNFIT" || r.finalDecision === "REST_BEFORE_WORK");
    const unfitNikList = Array.from(new Set(unfitRecords.map((r: any) => r.nik))).filter(Boolean);

    res.json({
      success: true,
      query: {
        date: targetDate,
        shift: isShift2 ? "Shift 2 (Malam)" : "Shift 1 (Siang)",
        timeRange: timeStart !== null && timeEnd !== null ? `${req.query.startTime} - ${req.query.endTime}` : "Semua jam shift",
      },
      summary: {
        totalSubmissions: matched.length,
        uniqueOperators: nikList.length,
        fitCount: fitNikList.length,
        unfitCount: unfitNikList.length
      },
      nikList,
      fitNikList,
      unfitNikList,
      operators: matched.map((r: any) => ({
        nik: r.nik,
        nama: r.nama,
        jabatan: r.jabatan,
        dept: r.dept,
        jamPengisian: r.jamPengisian,
        finalDecision: r.finalDecision,
        isFitToWork: r.finalDecision === "FIT" || r.finalDecision === "FIT_CONDITIONAL",
        readinessScore: r.readinessScore,
        totalSleep12: r.totalSleep12,
        totalSleep36: r.totalSleep36,
        id: r.id
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to query shift operators", details: error.message });
  }
});

// Helper to automatically dispatch WhatsApp alert via Fonnte Gateway for Unfit / Rest / Supervision
async function dispatchFonnteWhatsAppAlert(record: any): Promise<{ sent: boolean; message: string; details?: any }> {
  try {
    let token = "iNfrBRnqQj4izhPo4PKL";
    let target = "120363042234367353@g.us";
    let enabled = true;
    let alertUnfit = true;
    let alertRest = true;
    let alertConditional = true;

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        if (cfg.fonnteToken && String(cfg.fonnteToken).trim()) token = String(cfg.fonnteToken).trim();
        if (cfg.fonnteTarget && String(cfg.fonnteTarget).trim()) target = String(cfg.fonnteTarget).trim();
        if (cfg.fonnteEnabled !== undefined) enabled = Boolean(cfg.fonnteEnabled);
        if (cfg.fonnteAlertUnfit !== undefined) alertUnfit = Boolean(cfg.fonnteAlertUnfit);
        if (cfg.fonnteAlertRest !== undefined) alertRest = Boolean(cfg.fonnteAlertRest);
        if (cfg.fonnteAlertConditional !== undefined) alertConditional = Boolean(cfg.fonnteAlertConditional);
      } catch (e) {}
    }

    if (!enabled) {
      console.log("[Fonnte Dispatch] Skipped: Alert WA is currently disabled.");
      return { sent: false, message: "Alert WA dinonaktifkan di pengaturan." };
    }

    if (!token || !target) {
      console.warn("[Fonnte Dispatch] Skipped: Token or target missing.");
      return { sent: false, message: "Token atau Target WA Fonnte belum diatur." };
    }

    const isUnfit = record.finalDecision === "UNFIT";
    const isRest = record.finalDecision === "REST_BEFORE_WORK";
    const isConditional = record.finalDecision === "FIT_CONDITIONAL" || Boolean(record.consumesObat) || Boolean(record.hasPersonalProblem);

    const shouldNotify = (
      (isUnfit && alertUnfit) ||
      (isRest && alertRest) ||
      (isConditional && alertConditional)
    );

    if (!shouldNotify) {
      console.log(`[Fonnte Dispatch] Record ${record.id} (${record.nama}) status is ${record.finalDecision}, notification criteria not met.`);
      return { sent: false, message: "Status tidak memerlukan notifikasi darurat." };
    }

    let statusLabel = "FIT";
    let statusIcon = "✅";
    let tindakan = "Karyawan diizinkan bekerja normal sesuai standar keselamatan.";

    if (isUnfit) {
      statusLabel = "UNFIT / TIDAK FIT BEKERJA";
      statusIcon = "⛔";
      tindakan = "Karyawan TIDAK DIIZINKAN bekerja/mengoperasikan unit. Pengawas/Supervisor wajib segera mengarahkan karyawan ke klinik/ruang istirahat dan menyiapkan operator pengganti.";
    } else if (isRest) {
      statusLabel = "BUTUH ISTIRAHAT SEBELUM BEKERJA";
      statusIcon = "⚠️";
      tindakan = "Karyawan WAJIB istirahat tambahan sebelum bekerja. Lakukan evaluasi ulang kondisi fisik sebelum diizinkan mengoperasikan unit/alat berat.";
    } else if (isConditional) {
      statusLabel = "BUTUH PENGAWASAN KHUSUS (FIT DENGAN CATATAN)";
      statusIcon = "⚠️";
      tindakan = "Karyawan diizinkan bekerja HANYA dengan PENGAWASAN KETAT oleh Pengawas/Supervisor shift berjalan terkait konsumsi obat/kondisi fisik.";
    }

    const message = `🚨 *NOTIFIKASI FIT TO WORK (WBS)* 🚨\n━━━━━━━━━━━━━━━━━━━━━\n${statusIcon} *STATUS: ${statusLabel}*\n\n👤 *Data Karyawan:*\n• *Nama:* ${record.nama || "-"}\n• *NIK:* ${record.nik || "-"}\n• *Departemen:* ${record.dept || "-"}\n• *Jabatan:* ${record.jabatan || "-"}\n• *Waktu Lapor:* ${record.tanggalPengisian || "-"} pukul ${record.jamPengisian || "-"}\n\n💤 *Parameter Tidur & Kelelahan:*\n• *Total Tidur 12 Jam:* ${record.totalSleep12 ?? "-"} Jam\n• *Total Tidur 36 Jam:* ${record.totalSleep36 ?? "-"} Jam\n• *Fatigue Score:* ${record.totalFatigueScore ?? "-"} (${record.fatigueCategory || "-"})\n• *Readiness Score:* ${record.readinessScore ?? "-"}%\n\n📋 *Catatan Khusus:*\n• *Konsumsi Obat:* ${record.consumesObat ? "⚠️ YA (Perlu Perhatian)" : "Tidak"}\n• *Masalah Pribadi:* ${record.hasPersonalProblem ? "⚠️ YA (Berpotensi Distraksi)" : "Tidak"}\n\n📢 *Rekomendasi Tindakan Pengawas:*\n${tindakan}\n━━━━━━━━━━━━━━━━━━━━━\n_Sistem Fit to Work Online PT. Wahana Bara Sentosa_`;

    console.log(`[Fonnte Dispatch] Sending automated alert for ${record.nama} (${record.nik}) [${record.finalDecision}] to target: ${target}`);

    const params = new URLSearchParams();
    params.append("target", target.trim());
    params.append("message", message.trim());
    params.append("countryCode", "62");

    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": token.trim()
      },
      body: params,
      signal: AbortSignal.timeout(15000)
    });

    const responseText = await fonnteRes.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (fonnteRes.ok && responseData.status === true) {
      console.log(`[Fonnte Dispatch Success] Alert sent to ${target} for ${record.nik} (${record.nama})!`);
      return { 
        sent: true, 
        message: `Pesan WhatsApp berhasil dikirim ke grup/tujuan (${target})`,
        details: responseData 
      };
    } else {
      console.warn(`[Fonnte Dispatch Warning] Fonnte API response:`, responseData);
      return { 
        sent: false, 
        message: responseData.reason || responseData.message || responseData.error || "Gagal mengirim pesan melalui Fonnte",
        details: responseData 
      };
    }
  } catch (error: any) {
    console.error("[Fonnte Dispatch Exception]:", error.message);
    return { sent: false, message: error.message };
  }
}

// 2. Add an assessment record
app.post("/api/history", async (req, res) => {
  try {
    const newRecord = req.body;
    if (!newRecord || !newRecord.id || !newRecord.nik) {
      res.status(400).json({ error: "Invalid record data" });
      return;
    }

    const data = fs.readFileSync(HISTORY_FILE, "utf-8");
    const history = JSON.parse(data);
    
    // Check if duplicate submission exists for the same NIK, date and time
    const existingIdx = history.findIndex((r: any) => 
      (r.id === newRecord.id) || 
      (r.nik === newRecord.nik && r.tanggalPengisian === newRecord.tanggalPengisian && r.jamPengisian === newRecord.jamPengisian)
    );
    if (existingIdx === -1) {
      // If ID happens to collide with a different employee, generate unique suffix
      if (history.some((r: any) => r.id === newRecord.id)) {
        newRecord.id = `${newRecord.id}-${Date.now().toString(36)}`;
      }
      history.unshift(newRecord); // Add to the top
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } else {
      history[existingIdx] = { ...history[existingIdx], ...newRecord };
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    }

    // Centrally forward to Google Sheets App Script Webhook if configured
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
        const config = JSON.parse(configData);
        if (config.webhookUrl && config.webhookUrl.trim().startsWith("http")) {
          console.log(`Forwarding report ${newRecord.id} centrally to Google Sheets App Script: ${config.webhookUrl}`);
          fetch(config.webhookUrl.trim(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRecord)
          })
            .then(async (response) => {
              const text = await response.text();
              console.log(`Central webhook response for ${newRecord.id}: Code ${response.status}`, text);
            })
            .catch((err) => {
              console.warn(`Central webhook delivery failed for ${newRecord.id}:`, err.message);
            });
        }
      }
    } catch (whError: any) {
      console.warn("Failsafe warning: Google Sheets Webhook forwarding failed", whError.message);
    }
    
    // Automatically dispatch Fonnte WhatsApp alert for Unfit / Rest / Supervision
    let waAlertResult = { sent: false, message: "" };
    try {
      waAlertResult = await dispatchFonnteWhatsAppAlert(newRecord);
    } catch (waErr: any) {
      console.warn("[Fonnte Alert Exception during record save]:", waErr.message);
      waAlertResult = { sent: false, message: waErr.message };
    }

    res.json({ success: true, record: newRecord, waAlert: waAlertResult });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save record", details: error.message });
  }
});

// 3. Clear/purge assessment history (Admin action)
app.post("/api/history/clear", (req, res) => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
    res.json({ success: true, message: "Registry database successfully purged." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to clear history", details: error.message });
  }
});

// 4. Delete specific record
app.delete("/api/history/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = fs.readFileSync(HISTORY_FILE, "utf-8");
    let history = JSON.parse(data);
    history = history.filter((record: any) => record.id !== id);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete record", details: error.message });
  }
});

// 5. Get saved configuration (Spreadsheet ID & Webhook)
app.post("/api/sync-karyawan-webhook", async (req, res) => {
  try {
    const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(configData);
    if (!config.webhookUrl || !config.webhookUrl.trim().startsWith("http")) {
      res.status(400).json({ error: "Webhook URL belum dikonfigurasi di server pusat." });
      return;
    }
    
    const webhookUrl = config.webhookUrl.trim();
    console.log(`Pulling Karyawan registry from webhook: ${webhookUrl}`);
    const response = await fetch(webhookUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Google Web App returned status code ${response.status}`);
    }
    
    const result: any = await response.json();
    if (result && result.status === "success" && result.employees) {
      res.json({ success: true, employees: result.employees });
    } else {
      res.status(500).json({ error: "Format respon Webhook tidak valid atau data kosong.", raw: result });
    }
  } catch (error: any) {
    console.error("Failed to fetch Karyawan via webhook:", error);
    res.status(500).json({ error: "Gagal menghubungkan atau mengunduh data karyawan dari Apps Script Web App.", details: error.message });
  }
});

// Endpoints for custom employee database management
app.get("/api/employees", (req, res) => {
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const data = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
      // Ensure dummy employees are strictly excluded
      const cleanData: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (!DUMMY_NIKS_TO_PURGE.includes(k)) {
          cleanData[k] = v;
        }
      }
      res.json(cleanData);
    } else {
      res.json({});
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read employees list", details: error.message });
  }
});

// Firebase client config endpoint
app.get("/firebase-applet-config.json", (req, res, next) => {
  if (req.query.import !== undefined || req.headers.accept?.includes("text/javascript")) {
    return next();
  }
  res.json({
    apiKey: "AIzaSyBMw_xLTuTK66i2TFn6Iotg43AFvFBtxZ8",
    authDomain: "ftw-wbs.firebaseapp.com",
    projectId: "ftw-wbs",
    storageBucket: "ftw-wbs.firebasestorage.app",
    messagingSenderId: "558288446517",
    appId: "1:558288446517:web:612a2986ec377a71163d7c"
  });
});

app.post("/api/employees", (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ error: "Invalid employee data format" });
      return;
    }
    
    let currentDb: Record<string, any> = {};
    if (fs.existsSync(EMPLOYEES_FILE)) {
      try {
        currentDb = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
      } catch (e) {}
    }

    // Check if payload is a single employee: { nik, nama, jabatan, dept }
    if (payload.nik && payload.nama) {
      const cleanNik = String(payload.nik).trim().toUpperCase();
      currentDb[cleanNik] = {
        nama: String(payload.nama).trim(),
        jabatan: String(payload.jabatan || 'Staff').trim(),
        dept: String(payload.dept || 'Umum').trim()
      };
      fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(currentDb, null, 2));
      return res.json({ success: true, count: Object.keys(currentDb).length, employee: currentDb[cleanNik] });
    }

    // Otherwise payload is an employee dictionary/map
    const merged = { ...currentDb, ...payload };
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(merged, null, 2));
    res.json({ success: true, count: Object.keys(merged).length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save employees list", details: error.message });
  }
});

// Endpoint to overwrite or replace employee database completely (used for bulk overwrite)
app.put("/api/employees", (req, res) => {
  try {
    const employees = req.body;
    if (!employees || typeof employees !== "object") {
      res.status(400).json({ error: "Invalid employee data format" });
      return;
    }
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
    res.json({ success: true, count: Object.keys(employees).length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to replace employees list", details: error.message });
  }
});

// Endpoint to delete a specific employee by NIK
app.delete("/api/employees/:nik", (req, res) => {
  try {
    const nik = req.params.nik.trim().toUpperCase();
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const currentDb = JSON.parse(fs.readFileSync(EMPLOYEES_FILE, "utf-8"));
      if (currentDb[nik]) {
        delete currentDb[nik];
        fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(currentDb, null, 2));
      }
    }
    res.json({ success: true, deletedNik: nik });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete employee", details: error.message });
  }
});

app.get("/api/config", (req, res) => {
  try {
    let cfg: any = {
      spreadsheetId: "15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI",
      webhookUrl: "",
      fonnteToken: "iNfrBRnqQj4izhPo4PKL",
      fonnteTarget: "120363042234367353@g.us",
      fonnteEnabled: true,
      fonnteAlertUnfit: true,
      fonnteAlertRest: true,
      fonnteAlertConditional: true
    };
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const saved = JSON.parse(data);
      cfg = {
        ...cfg,
        ...saved,
        fonnteToken: (saved.fonnteToken && String(saved.fonnteToken).trim()) ? String(saved.fonnteToken).trim() : cfg.fonnteToken,
        fonnteTarget: (saved.fonnteTarget && String(saved.fonnteTarget).trim()) ? String(saved.fonnteTarget).trim() : cfg.fonnteTarget
      };
    }
    res.json(cfg);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read configuration", details: error.message });
  }
});

// 6. Save configuration (Spreadsheet ID, Webhook, and Fonnte WA)
app.post("/api/config", (req, res) => {
  try {
    const { 
      spreadsheetId, 
      webhookUrl,
      fonnteToken,
      fonnteTarget,
      fonnteEnabled,
      fonnteAlertUnfit,
      fonnteAlertRest,
      fonnteAlertConditional
    } = req.body;

    let existingConfig: any = {
      spreadsheetId: "15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI",
      webhookUrl: "",
      fonnteToken: "iNfrBRnqQj4izhPo4PKL",
      fonnteTarget: "120363042234367353@g.us",
      fonnteEnabled: true,
      fonnteAlertUnfit: true,
      fonnteAlertRest: true,
      fonnteAlertConditional: true
    };
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        existingConfig = { ...existingConfig, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) };
      } catch (e) {}
    }

    const config = { 
      ...existingConfig,
      spreadsheetId: (spreadsheetId !== undefined && String(spreadsheetId).trim()) ? String(spreadsheetId).trim() : existingConfig.spreadsheetId,
      webhookUrl: webhookUrl !== undefined ? String(webhookUrl).trim() : existingConfig.webhookUrl,
      fonnteToken: (fonnteToken !== undefined && String(fonnteToken).trim()) ? String(fonnteToken).trim() : (existingConfig.fonnteToken || "iNfrBRnqQj4izhPo4PKL"),
      fonnteTarget: (fonnteTarget !== undefined && String(fonnteTarget).trim()) ? String(fonnteTarget).trim() : (existingConfig.fonnteTarget || "120363042234367353@g.us"),
      fonnteEnabled: fonnteEnabled !== undefined ? Boolean(fonnteEnabled) : existingConfig.fonnteEnabled,
      fonnteAlertUnfit: fonnteAlertUnfit !== undefined ? Boolean(fonnteAlertUnfit) : existingConfig.fonnteAlertUnfit,
      fonnteAlertRest: fonnteAlertRest !== undefined ? Boolean(fonnteAlertRest) : existingConfig.fonnteAlertRest,
      fonnteAlertConditional: fonnteAlertConditional !== undefined ? Boolean(fonnteAlertConditional) : existingConfig.fonnteAlertConditional
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save configuration", details: error.message });
  }
});

// 7. Send WhatsApp message via Fonnte Gateway API
app.post("/api/send-wa-fonnte", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    let { token, target, message } = req.body;

    // Fallback to server config if not explicitly passed
    if ((!token || !target) && fs.existsSync(CONFIG_FILE)) {
      try {
        const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        token = token || configData.fonnteToken;
        target = target || configData.fonnteTarget;
      } catch (e) {}
    }

    token = token || "iNfrBRnqQj4izhPo4PKL";
    target = target || "120363042234367353@g.us";

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: "Pesan WhatsApp tidak boleh kosong." });
    }

    const cleanToken = String(token).trim();
    const cleanTarget = String(target).trim();

    // Prepare URLSearchParams for Fonnte endpoint
    const params = new URLSearchParams();
    params.append("target", cleanTarget);
    params.append("message", String(message).trim());
    params.append("countryCode", "62");

    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": cleanToken
      },
      body: params,
      signal: AbortSignal.timeout(15000)
    });

    const responseText = await fonnteRes.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log("[Fonnte WA Response]:", fonnteRes.status, responseData);

    // Fonnte returns { status: true, ... } on success, or { status: false, reason: "..." }
    if (!fonnteRes.ok || responseData.status === false) {
      return res.status(fonnteRes.status >= 400 ? fonnteRes.status : 400).json({
        success: false,
        error: responseData.reason || responseData.message || responseData.error || "Gagal mengirim pesan melalui Fonnte",
        details: responseData
      });
    }

    res.json({
      success: true,
      message: "Pesan WhatsApp berhasil dikirim ke " + cleanTarget,
      data: responseData
    });
  } catch (error: any) {
    console.error("[Fonnte WA Server Error]:", error);
    res.status(500).json({ 
      success: false, 
      error: "Terjadi kesalahan server saat menghubungi Fonnte: " + error.message,
      details: error.message 
    });
  }
});

// 8. Manual on-demand WhatsApp alert dispatch for specific assessment record
app.post("/api/send-wa-record", async (req, res) => {
  try {
    const { record, recordId } = req.body;
    let targetRecord = record;

    if (!targetRecord && recordId) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const history = JSON.parse(data);
      targetRecord = history.find((r: any) => r.id === recordId);
    }

    if (!targetRecord) {
      return res.status(404).json({ success: false, error: "Data laporan tidak ditemukan." });
    }

    let token = "iNfrBRnqQj4izhPo4PKL";
    let target = "120363042234367353@g.us";

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        if (cfg.fonnteToken && String(cfg.fonnteToken).trim()) token = String(cfg.fonnteToken).trim();
        if (cfg.fonnteTarget && String(cfg.fonnteTarget).trim()) target = String(cfg.fonnteTarget).trim();
      } catch (e) {}
    }

    let statusLabel = "FIT";
    let statusIcon = "✅";
    let tindakan = "Karyawan diizinkan bekerja normal sesuai standar keselamatan.";

    if (targetRecord.finalDecision === "UNFIT") {
      statusLabel = "UNFIT / TIDAK FIT BEKERJA";
      statusIcon = "⛔";
      tindakan = "Karyawan TIDAK DIIZINKAN bekerja/mengoperasikan unit. Pengawas/Supervisor wajib segera mengarahkan karyawan ke klinik/ruang istirahat dan menyiapkan operator pengganti.";
    } else if (targetRecord.finalDecision === "REST_BEFORE_WORK") {
      statusLabel = "BUTUH ISTIRAHAT SEBELUM BEKERJA";
      statusIcon = "⚠️";
      tindakan = "Karyawan WAJIB istirahat tambahan sebelum bekerja. Lakukan evaluasi ulang kondisi fisik sebelum diizinkan mengoperasikan unit/alat berat.";
    } else if (targetRecord.finalDecision === "FIT_CONDITIONAL" || targetRecord.consumesObat || targetRecord.hasPersonalProblem) {
      statusLabel = "BUTUH PENGAWASAN KHUSUS (FIT DENGAN CATATAN)";
      statusIcon = "⚠️";
      tindakan = "Karyawan diizinkan bekerja HANYA dengan PENGAWASAN KETAT oleh Pengawas/Supervisor shift berjalan terkait konsumsi obat/kondisi fisik.";
    }

    const message = `🚨 *NOTIFIKASI FIT TO WORK (WBS)* 🚨\n━━━━━━━━━━━━━━━━━━━━━\n${statusIcon} *STATUS: ${statusLabel}*\n\n👤 *Data Karyawan:*\n• *Nama:* ${targetRecord.nama || "-"}\n• *NIK:* ${targetRecord.nik || "-"}\n• *Departemen:* ${targetRecord.dept || "-"}\n• *Jabatan:* ${targetRecord.jabatan || "-"}\n• *Waktu Lapor:* ${targetRecord.tanggalPengisian || "-"} pukul ${targetRecord.jamPengisian || "-"}\n\n💤 *Parameter Tidur & Kelelahan:*\n• *Total Tidur 12 Jam:* ${targetRecord.totalSleep12 ?? "-"} Jam\n• *Total Tidur 36 Jam:* ${targetRecord.totalSleep36 ?? "-"} Jam\n• *Fatigue Score:* ${targetRecord.totalFatigueScore ?? "-"} (${targetRecord.fatigueCategory || "-"})\n• *Readiness Score:* ${targetRecord.readinessScore ?? "-"}%\n\n📋 *Catatan Khusus:*\n• *Konsumsi Obat:* ${targetRecord.consumesObat ? "⚠️ YA (Perlu Perhatian)" : "Tidak"}\n• *Masalah Pribadi:* ${targetRecord.hasPersonalProblem ? "⚠️ YA (Berpotensi Distraksi)" : "Tidak"}\n\n📢 *Rekomendasi Tindakan Pengawas:*\n${tindakan}\n━━━━━━━━━━━━━━━━━━━━━\n_Sistem Fit to Work Online PT. Wahana Bara Sentosa_`;

    const params = new URLSearchParams();
    params.append("target", target.trim());
    params.append("message", message.trim());
    params.append("countryCode", "62");

    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": token.trim() },
      body: params,
      signal: AbortSignal.timeout(15000)
    });

    const responseText = await fonnteRes.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (fonnteRes.ok && responseData.status === true) {
      res.json({
        success: true,
        message: `Alert untuk ${targetRecord.nama} berhasil dikirim ke ${target}`,
        data: responseData
      });
    } else {
      res.status(400).json({
        success: false,
        error: responseData.reason || responseData.message || "Gagal mengirim ke Fonnte",
        details: responseData
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoints for Cloud Run and load balancers
app.get(["/health", "/healthz", "/_health", "/ping"], (req, res) => {
  res.status(200).send("OK");
});

// Setup Vite Dev Server / Static Assets serving
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || (process.env.NODE_ENV !== "development" && fs.existsSync(path.join(distPath, "index.html")));

  if (!isProduction) {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexHtmlPath = path.join(process.cwd(), "index.html");
        if (fs.existsSync(indexHtmlPath)) {
          let template = fs.readFileSync(indexHtmlPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } else {
          next();
        }
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    console.log("Starting server in PRODUCTION mode...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send("<!doctype html><html><head><title>Fit to Work</title></head><body><div id='root'></div></body></html>");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operational on http://0.0.0.0:${PORT}`);
    
    // Non-blocking deferred auto-hydration so the HTTP server responds immediately to Cloud Run health probes
    console.log("[Startup] Scheduling auto-hydration from connected spreadsheet in 5 seconds...");
    setTimeout(() => {
      syncFromGoogleSheet().catch(e => {
        console.error("[Startup Sync Warning] Failed during launch auto-hydration:", e.message);
      });
    }, 5000);

    // Set background periodic sync interval every 5 minutes (300,000 milliseconds)
    setInterval(() => {
      console.log("[Periodic Sync] Refreshing employees and assessments from Google Sheets...");
      syncFromGoogleSheet().catch(e => {
        console.error("[Periodic Sync Error] Sheet pull failed:", e.message);
      });
    }, 300000);
  });
}

startServer();
