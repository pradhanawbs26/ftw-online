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

const DEFAULT_EMPLOYEES = {
  "88204911": { nama: "Aris Setiawan", jabatan: "Operator Excavator", dept: "Produksi" },
  "A0483": { nama: "Andi Saputra", jabatan: "Driver Dump Truck", dept: "Logistik & Transport" },
  "A5021": { nama: "Rina Wijaya", jabatan: "Safety Officer", dept: "HSE" },
  "A8274": { nama: "Budi Pratama", jabatan: "Mechanic Supervisor", dept: "Engineering" },
  "A0912": { nama: "Siti Rahma", jabatan: "Admin Finance", dept: "Finance & Admin" },
  "A3821": { nama: "Dani Setiawan", jabatan: "Mine Surveyor", dept: "Survey" },
  "88112233": { nama: "Guntur Wibowo", jabatan: "Operator Bulldozer", dept: "Produksi" },
  "88556677": { nama: "Sandi Wijaya", jabatan: "Drill Specialist", dept: "Exploration" }
};

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ spreadsheetId: "15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI", webhookUrl: "" }, null, 2));
}

if (!fs.existsSync(EMPLOYEES_FILE)) {
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(DEFAULT_EMPLOYEES, null, 2));
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
            const history: any[] = [];
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const id = row[0] ? row[0].trim() : "";
              if (id && id !== "ID" && id !== "ID LAPORAN" && id !== "ID_LAPORAN") {
                const totalFatigueScore = parseInt(row[11]) || 0;
                const readinessScore = Math.max(0, 100 - (totalFatigueScore * 7.5));
                const consumesObat = row[9] === 'Ya / Yes' || row[9] === 'Ya' || row[9] === 'Yes' || row[9] === 'true';
                const hasPersonalProblem = row[10] === 'Ya / Yes' || row[10] === 'Ya' || row[10] === 'Yes' || row[10] === 'true';

                let fatigueCategory = "NORMAL";
                let finalDecision = "FIT";

                if (totalFatigueScore >= 12) {
                  fatigueCategory = "REJECT";
                  finalDecision = "UNFIT";
                } else if (totalFatigueScore >= 9) {
                  fatigueCategory = "REST";
                  finalDecision = "REST_BEFORE_WORK";
                } else if (totalFatigueScore >= 7) {
                  fatigueCategory = "LAPOR";
                  finalDecision = "FIT_CONDITIONAL";
                } else {
                  fatigueCategory = "NORMAL";
                  finalDecision = "FIT";
                }

                if (consumesObat || hasPersonalProblem) {
                  if (finalDecision === 'FIT') {
                    finalDecision = 'FIT_CONDITIONAL';
                    fatigueCategory = "LAPOR";
                  }
                }

                const record = {
                  id,
                  timestamp: row[1] ? `${row[1].trim()} ${row[2] ? row[2].trim() : ""}`.trim() : "",
                  nik: row[3] ? row[3].trim().toUpperCase() : "",
                  nama: row[4] ? row[4].trim() : "",
                  jabatan: row[5] ? row[5].trim() : "",
                  dept: row[6] ? row[6].trim() : "",
                  tanggalPengisian: row[1] ? row[1].trim() : "",
                  jamPengisian: row[2] ? row[2].trim() : "",
                  totalSleep12: parseFloat(row[7] ? row[7].replace(",", ".") : "0") || 0,
                  totalSleep36: parseFloat(row[8] ? row[8].replace(",", ".") : "0") || 0,
                  consumesObat,
                  hasPersonalProblem,
                  totalFatigueScore,
                  readinessScore,
                  fatigueCategory,
                  finalDecision: row[12] ? row[12].trim() : ""
                };
                history.push(record);
              }
            }
            if (history.length > 0) {
              // Convert to newest-first order
              const reversedHistory = history.reverse();
              await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(reversedHistory));
              console.log(`[Sync] Successfully loaded & cached ${history.length} assessment entries from Sheet 'Laporan_Fit'`);
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
    res.json(JSON.parse(data));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read history logs", details: error.message });
  }
});

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
    
    // Check if duplicate ID exists, if so prevent adding duplicate
    const index = history.findIndex((r: any) => r.id === newRecord.id);
    if (index === -1) {
      history.unshift(newRecord); // Add to the top
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
    
    res.json({ success: true, record: newRecord });
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
      const data = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.json(DEFAULT_EMPLOYEES);
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read employees list", details: error.message });
  }
});

// Firebase client config endpoint
app.get("/firebase-applet-config.json", (req, res) => {
  res.json({
    apiKey: "AIzaSyBMw_xLTuTK66i2TFn6Iotg43AFvFBtxZ8",
    authDomain: "ftw-wbs.firebaseapp.com",
    projectId: "ftw-wbs",
    storageBucket: "ftw-wbs.firebasestorage.app",
    messagingSenderId: "558288446517",
    appId: "1:558288446517:web:f7dde6f01f4accb1163d7c"
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
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read configuration", details: error.message });
  }
});

// 6. Save configuration (Spreadsheet ID & Webhook)
app.post("/api/config", (req, res) => {
  try {
    const { spreadsheetId, webhookUrl } = req.body;
    const config = { 
      spreadsheetId: spreadsheetId || "",
      webhookUrl: webhookUrl || ""
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save configuration", details: error.message });
  }
});

// Health check endpoints for Cloud Run and load balancers
app.get(["/health", "/healthz", "/_health", "/ping"], (req, res) => {
  res.status(200).send("OK");
});

// Setup Vite Dev Server / Static Assets serving
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "index.html"));

  if (!isProduction) {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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
