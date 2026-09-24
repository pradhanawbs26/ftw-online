import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ArrowLeft, 
  ArrowRight, 
  ClipboardCheck, 
  Brain, 
  Pill, 
  Info, 
  PhoneCall, 
  Database, 
  Calendar, 
  Activity, 
  RefreshCw,
  TrendingDown,
  ChevronRight,
  Sparkles,
  History,
  Trash2,
  Printer,
  Share2,
  Download,
  LogIn,
  LogOut,
  Check,
  Flame
} from 'lucide-react';
import { calculateHoursFromTimeStrings } from './utils';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  app as firebaseApp,
  auth as firebaseAuth,
  db as firestoreDb,
  googleProvider,
  syncAssessmentToFirestore,
  deleteAssessmentFromFirestore,
  fetchAssessmentsFromFirestore,
  syncEmployeeToFirestore,
  syncEmployeesBatchToFirestore,
  deleteEmployeeFromFirestore,
  fetchEmployeesFromFirestore,
  saveRosterToFirestore,
  fetchRosterFromFirestore,
  pruneOldAssessmentsFromFirestore
} from './firebase';

// PT. Wahana Bara Sentosa Base Employee Database (Fallback if Google Sheets is not synced)
const DEFAULT_EMPLOYEE_DB: Record<string, { nama: string; jabatan: string; dept: string }> = {
  "88204911": { nama: "Aris Setiawan", jabatan: "Operator Excavator", dept: "Produksi" },
  "A0483": { nama: "Andi Saputra", jabatan: "Driver Dump Truck", dept: "Logistik & Transport" },
  "A5021": { nama: "Rina Wijaya", jabatan: "Safety Officer", dept: "HSE" },
  "A8274": { nama: "Budi Pratama", jabatan: "Mechanic Supervisor", dept: "Engineering" },
  "A0912": { nama: "Siti Rahma", jabatan: "Admin Finance", dept: "Finance & Admin" },
  "A3821": { nama: "Dani Setiawan", jabatan: "Mine Surveyor", dept: "Survey" },
  "88112233": { nama: "Guntur Wibowo", jabatan: "Operator Bulldozer", dept: "Produksi" },
  "88556677": { nama: "Sandi Wijaya", jabatan: "Drill Specialist", dept: "Exploration" }
};

interface CustomAssessment {
  id: string;
  timestamp: string;
  nik: string;
  nama: string;
  jabatan: string;
  dept: string;
  tanggalPengisian: string;
  jamPengisian: string;
  
  // Sleep data
  sleep12Session1Bed: string;
  sleep12Session1Wake: string;
  sleep12Session2Bed: string;
  sleep12Session2Wake: string;
  hasSleep12Session2: boolean;
  totalSleep12: number;

  sleep36Session1Bed: string;
  sleep36Session1Wake: string;
  sleep36Session2Bed: string;
  sleep36Session2Wake: string;
  hasSleep36Session2: boolean;
  totalSleep36: number;

  // Extra risk parameters
  consumesObat: boolean;
  hasPersonalProblem: boolean;

  // Calculations
  totalFatigueScore: number;
  readinessScore: number;
  fatigueCategory: 'NORMAL' | 'LAPOR' | 'REST' | 'REJECT';
  finalDecision: 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT';
}

interface InlineEditRowProps {
  nik: string;
  item: { nama: string; jabatan: string; dept: string };
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (namaVal: string, jabatanVal: string, deptVal: string) => void;
  onDelete: () => void;
  lang: 'ID' | 'EN';
}

const InlineEditRow: React.FC<InlineEditRowProps> = ({
  nik,
  item,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  lang
}) => {
  const [namaVal, setNamaVal] = useState<string>(item.nama);
  const [jabatanVal, setJabatanVal] = useState<string>(item.jabatan);
  const [deptVal, setDeptVal] = useState<string>(item.dept);

  useEffect(() => {
    setNamaVal(item.nama);
    setJabatanVal(item.jabatan);
    setDeptVal(item.dept);
  }, [item]);

  if (isEditing) {
    return (
      <tr className="bg-rose-50/50">
        <td className="px-4 py-2 font-mono font-black text-rose-950 align-middle">
          {nik}
        </td>
        <td className="px-4 py-2 align-middle">
          <input 
            type="text" 
            value={namaVal}
            onChange={(e) => setNamaVal(e.target.value)}
            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold text-neutral-900"
          />
        </td>
        <td className="px-4 py-2 align-middle">
          <input 
            type="text" 
            value={jabatanVal}
            onChange={(e) => setJabatanVal(e.target.value)}
            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold text-neutral-900"
          />
        </td>
        <td className="px-4 py-2 align-middle">
          <input 
            type="text" 
            value={deptVal}
            onChange={(e) => setDeptVal(e.target.value)}
            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold text-neutral-900"
          />
        </td>
        <td className="px-4 py-2 text-center align-middle whitespace-nowrap">
          <div className="flex justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onSaveEdit(namaVal, jabatanVal, deptVal)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black py-1 px-2.5 rounded cursor-pointer"
            >
              SIMPAN
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-black py-1 px-2.5 rounded cursor-pointer border border-neutral-300"
            >
              BATAL
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-neutral-50/70 transition">
      <td className="px-4 py-2.5 font-mono font-black text-neutral-900 align-middle">
        {nik}
      </td>
      <td className="px-4 py-2.5 font-bold text-neutral-800 align-middle">
        {item.nama}
      </td>
      <td className="px-4 py-2.5 text-neutral-600 font-medium align-middle">
        {item.jabatan}
      </td>
      <td className="px-4 py-2.5 text-neutral-500 font-semibold align-middle">
        {item.dept}
      </td>
      <td className="px-4 py-2.5 text-center align-middle whitespace-nowrap">
        <div className="flex justify-center gap-1.5 font-sans">
          <button
            type="button"
            onClick={onStartEdit}
            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10.5px] border border-neutral-300 font-bold py-1 px-2.5 rounded transition cursor-pointer"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10.5px] border border-rose-200 font-bold py-1 px-2.5 rounded transition cursor-pointer"
          >
            🗑️ Hapus
          </button>
        </div>
      </td>
    </tr>
  );
};

// Helper to determine shift based on input time
export const checkIsDayShift = (jamStr: string): boolean => {
  if (!jamStr) return true;
  const parts = jamStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  const totalMinutes = h * 60 + m;

  // 01:00 (60 mins) to 12:59 (779 mins) is Shift Siang (Day Shift)
  // This explicitly covers 01.00-07.00 pagi for Shift Siang.
  if (totalMinutes >= 60 && totalMinutes < 780) {
    return true;
  }
  // 13:00 (780 mins) to 00:59 (59 mins) is Shift Malam (Night Shift)
  // This explicitly covers 13.00-19.00 malam for Shift Malam.
  return false;
};

export default function App() {
  // Config & Firebase Hooks
  const [firebaseLoaded, setFirebaseLoaded] = useState<boolean>(false);
  const [connectedUser, setConnectedUser] = useState<FirebaseUser | null>(null);
  const [sheetsToken, setSheetsToken] = useState<string | null>(null);

  // App States
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'responsive'>('responsive');
  const [step, setStep] = useState<number>(1);
  const [lang, setLang] = useState<'ID' | 'EN'>('ID');

  // Input states
  const [nik, setNik] = useState<string>('');
  const [nama, setNama] = useState<string>('');
  const [jabatan, setJabatan] = useState<string>('');
  const [dept, setDept] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  // Current Client Date & Time defaults
  const [tanggalPengisian, setTanggalPengisian] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [jamPengisian, setJamPengisian] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // Bedtimes & Wakeups
  const [sleep12Session1Bed, setSleep12Session1Bed] = useState<string>('23:00');
  const [sleep12Session1Wake, setSleep12Session1Wake] = useState<string>('06:00');
  const [hasSleep12Session2, setHasSleep12Session2] = useState<boolean>(false);
  const [sleep12Session2Bed, setSleep12Session2Bed] = useState<string>('');
  const [sleep12Session2Wake, setSleep12Session2Wake] = useState<string>('');

  const [sleep36Session1Bed, setSleep36Session1Bed] = useState<string>('22:30');
  const [sleep36Session1Wake, setSleep36Session1Wake] = useState<string>('05:00');
  const [hasSleep36Session2, setHasSleep36Session2] = useState<boolean>(false);
  const [sleep36Session2Bed, setSleep36Session2Bed] = useState<string>('');
  const [sleep36Session2Wake, setSleep36Session2Wake] = useState<string>('');

  const [consumesObat, setConsumesObat] = useState<boolean>(false);
  const [hasPersonalProblem, setHasPersonalProblem] = useState<boolean>(false);

  // Registry / History lists
  const [history, setHistory] = useState<CustomAssessment[]>([]);
  const [showHistoryOverlay, setShowHistoryOverlay] = useState<boolean>(false);
  const [historyNikFilter, setHistoryNikFilter] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState<boolean>(false);
  const [hasJustSubmitted, setHasJustSubmitted] = useState<boolean>(false);

  // Admin Panel States
  const [showAdminOverlay, setShowAdminOverlay] = useState<boolean>(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'dashboard' | 'employees' | 'sheets_sync' | 'firebase_backup'>('dashboard');
  const [firebaseSyncing, setFirebaseSyncing] = useState<boolean>(false);
  const [firebaseStatusMsg, setFirebaseStatusMsg] = useState<string>('');
  const [pruneDays, setPruneDays] = useState<number>(30);
  const [isPruning, setIsPruning] = useState<boolean>(false);
  const [adminNikFilter, setAdminNikFilter] = useState<string>('');
  const [newEmpNik, setNewEmpNik] = useState<string>('');
  const [newEmpNama, setNewEmpNama] = useState<string>('');
  const [newEmpJabatan, setNewEmpJabatan] = useState<string>('');
  const [newEmpDept, setNewEmpDept] = useState<string>('');
  const [editingEmpNik, setEditingEmpNik] = useState<string | null>(null);
  const [bulkInputText, setBulkInputText] = useState<string>('');
  const [bulkPreviewData, setBulkPreviewData] = useState<{ nik: string; nama: string; jabatan: string; dept: string }[]>([]);

  // Admin Authentication States
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('wbs_admin_auth') === 'true';
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState<string>('');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string>('');

  // Admin Fit to Work Fatigue Dashboard States
  const [adminFilterStartDate, setAdminFilterStartDate] = useState<string>('');
  const [adminFilterEndDate, setAdminFilterEndDate] = useState<string>('');
  const [adminFilterShift, setAdminFilterShift] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [adminFilterStatus, setAdminFilterStatus] = useState<'ALL' | 'PROBLEMATIC' | 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT'>('PROBLEMATIC');
  const [selectedDashboardRecordId, setSelectedDashboardRecordId] = useState<string | null>(null);

  // Google Sheets Management States
  const [showSheetsModal, setShowSheetsModal] = useState<boolean>(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('wbs_spreadsheet_id') || '15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI';
  });
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('wbs_sheets_webhook_url') || '';
  });
  const [sheetsConnectionStatus, setSheetsConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'SYNCING'>('DISCONNECTED');
  const [sheetsLogs, setSheetsLogs] = useState<string[]>([]);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [logoFailed, setLogoFailed] = useState<boolean>(false);

  // Dynamic Employee Database state which updates from Google Sheets
  const [employeeDb, setEmployeeDb] = useState<Record<string, { nama: string; jabatan: string; dept: string }>>(() => {
    const localDb = localStorage.getItem('wbs_sheets_employee_db');
    if (localDb) {
      try {
        return JSON.parse(localDb);
      } catch (e) {
        return DEFAULT_EMPLOYEE_DB;
      }
    }
    return DEFAULT_EMPLOYEE_DB;
  });

  const badgeRef = useRef<HTMLDivElement>(null);

  // Load config, employees list and assessment history on startup with self-healing credentials
  useEffect(() => {
    const loadConfigAndHistory = async () => {
      let serverSpreadsheetId = '';
      let serverWebhookUrl = '';

      try {
        const configResp = await fetch('/api/config');
        if (configResp.ok) {
          const config = await configResp.json();
          serverSpreadsheetId = config.spreadsheetId || '';
          serverWebhookUrl = config.webhookUrl || '';
        }
      } catch (e) {
        console.warn("Failed to fetch server credentials", e);
      }

      const localId = localStorage.getItem('wbs_spreadsheet_id') || '';
      const localWebhook = localStorage.getItem('wbs_sheets_webhook_url') || '';

      // Fallback to designated sheet if completely clean
      const resolvedId = serverSpreadsheetId || localId || '15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI';
      const resolvedWebhook = serverWebhookUrl || localWebhook || '';

      setSpreadsheetId(resolvedId);
      setWebhookUrl(resolvedWebhook);

      if (resolvedId) {
        localStorage.setItem('wbs_spreadsheet_id', resolvedId);
      }
      if (resolvedWebhook) {
        localStorage.setItem('wbs_sheets_webhook_url', resolvedWebhook);
      }

      // Self-heal: If the server configuration has missing keys, restore them from our browser cache instantly
      if (resolvedId !== serverSpreadsheetId || resolvedWebhook !== serverWebhookUrl) {
        console.log("[Self-Heal] Reviving backend server configuration from local browser state...");
        try {
          await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId: resolvedId, webhookUrl: resolvedWebhook })
          });
          // Call force-sync so the server pulls the database from the sheet right away
          await fetch('/api/sync-force', { method: 'POST' });
        } catch (syncErr) {
          console.warn("Self-healing background post failed", syncErr);
        }
      }

      // Load employees DB from server with self-healing to prevent resetting to 8 people
      try {
        const empResp = await fetch('/api/employees');
        if (empResp.ok) {
          const empData = await empResp.json();
          if (empData && typeof empData === 'object' && Object.keys(empData).length > 0) {
            const localSaved = localStorage.getItem('wbs_sheets_employee_db');
            let localParsed: any = null;
            if (localSaved) {
              try { localParsed = JSON.parse(localSaved); } catch (e) { }
            }

            const isServerDefault = Object.keys(empData).length === 8 && Object.keys(empData).every(k => k in DEFAULT_EMPLOYEE_DB);
            const hasLocalCustomData = localParsed && typeof localParsed === 'object' && Object.keys(localParsed).length > 8;

            if (isServerDefault && hasLocalCustomData) {
              console.log("[Self-Heal] Server returned default 8-employee template, but client has richer database. Restoring server's database...");
              setEmployeeDb(localParsed);
              await saveEmployeeDb(localParsed);
            } else {
              setEmployeeDb(empData);
              localStorage.setItem('wbs_sheets_employee_db', JSON.stringify(empData));
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load employees list on startup", e);
      }

      // Consult Firestore single-read roster to ensure any cloud-registered employees are fully merged
      try {
        // Use consolidated single-document roster (1 Read only!)
        const firestoreEmployees = await fetchRosterFromFirestore();
        if (firestoreEmployees && Object.keys(firestoreEmployees).length > 0) {
          setEmployeeDb(prev => {
            const merged = { ...firestoreEmployees, ...prev };
            localStorage.setItem('wbs_sheets_employee_db', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (fbErr) {
        console.warn("[Firebase Recovery] Employees fetch warning:", fbErr);
      }

      // Load history with filtering to ignore and cleanse any legacy invalid imports
      try {
        const historyResp = await fetch('/api/history');
        if (historyResp.ok) {
          const data = await historyResp.json();
          if (Array.isArray(data)) {
            // Filter both loaded server dataset and cached local dataset to block garbage data rows
            const filterGarbage = (item: any) => {
              if (!item || !item.timestamp || !item.id) return false;
              // Real timestamps contain characters like '-' and digits (e.g. "2026-05-22")
              // Garbage imported rows have names like "Wahyudi Asrianto" as timestamp
              const hasDateIndicator = item.timestamp.includes("-") || item.timestamp.includes("/");
              const isPureText = /^[a-zA-Z\s]+$/.test(item.timestamp);
              return hasDateIndicator && !isPureText;
            };

            const cleanServerData = data.filter(filterGarbage);

            const localSaved = localStorage.getItem('wbs_ftw_history');
            let localParsed: any[] = [];
            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (Array.isArray(parsed)) {
                  localParsed = parsed.filter(filterGarbage);
                }
              } catch (e) {}
            }

            if (cleanServerData.length === 0 && localParsed.length > 0) {
              console.log("[Self-Heal] Server history was blank/reset, republishing clean cached assessments to server database...");
              setHistory(localParsed);
              localStorage.setItem('wbs_ftw_history', JSON.stringify(localParsed));
              
              // Restore history records on server
              for (const record of localParsed) {
                try {
                  await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(record)
                  });
                } catch (postErr) {
                  console.error("Self-heal backup upload failed for record", record.id, postErr);
                }
              }
            } else {
              setHistory(cleanServerData);
              localStorage.setItem('wbs_ftw_history', JSON.stringify(cleanServerData));
            }
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve cloud history logs, falling back to local files", e);
        const saved = localStorage.getItem('wbs_ftw_history');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const filterGarbage = (item: any) => {
                if (!item || !item.timestamp || !item.id) return false;
                const hasDateIndicator = item.timestamp.includes("-") || item.timestamp.includes("/");
                const isPureText = /^[a-zA-Z\s]+$/.test(item.timestamp);
                return hasDateIndicator && !isPureText;
              };
              const cleanLocalData = parsed.filter(filterGarbage);
              setHistory(cleanLocalData);
              localStorage.setItem('wbs_ftw_history', JSON.stringify(cleanLocalData));
            }
          } catch (err) {
            console.error(err);
          }
        } else {
          // Default initial fallback logs
          const initLogs: CustomAssessment[] = [
            {
              id: "WBS-FTW-90214",
              timestamp: "2026-05-22T08:14:02Z",
              nik: "88204911",
              nama: "Aris Setiawan",
              jabatan: "Operator Excavator",
              dept: "Produksi",
              tanggalPengisian: "2026-05-22",
              jamPengisian: "08:10",
              sleep12Session1Bed: "23:00",
              sleep12Session1Wake: "06:00",
              sleep12Session2Bed: "",
              sleep12Session2Wake: "",
              hasSleep12Session2: false,
              totalSleep12: 7.0,
              sleep36Session1Bed: "22:30",
              sleep36Session1Wake: "05:00",
              sleep36Session2Bed: "",
              sleep36Session2Wake: "",
              hasSleep36Session2: false,
              totalSleep36: 13.5,
              consumesObat: false,
              hasPersonalProblem: false,
              totalFatigueScore: 1,
              readinessScore: 92,
              fatigueCategory: "NORMAL",
              finalDecision: "FIT"
            },
            {
              id: "WBS-FTW-71402",
              timestamp: "2026-05-21T18:45:00Z",
              nik: "A5021",
              nama: "Rina Wijaya",
              jabatan: "Safety Officer",
              dept: "HSE",
              tanggalPengisian: "2026-05-21",
              jamPengisian: "18:30",
              sleep12Session1Bed: "23:30",
              sleep12Session1Wake: "04:30",
              sleep12Session2Bed: "",
              sleep12Session2Wake: "",
              hasSleep12Session2: false,
              totalSleep12: 5.0,
              sleep36Session1Bed: "23:00",
              sleep36Session1Wake: "04:00",
              sleep36Session2Bed: "",
              sleep36Session2Wake: "",
              hasSleep36Session2: false,
              totalSleep36: 10.0,
              consumesObat: true,
              hasPersonalProblem: false,
              totalFatigueScore: 13,
              readinessScore: 35,
              fatigueCategory: "REJECT",
              finalDecision: "UNFIT"
            }
          ];
          setHistory(initLogs);
          localStorage.setItem('wbs_ftw_history', JSON.stringify(initLogs));
        }
      }

      // Quota Saver: Only fetch from Firestore if local history is completely blank
      const localHistRaw = localStorage.getItem('wbs_ftw_history');
      const isHistoryEmpty = !localHistRaw || localHistRaw === '[]';
      if (isHistoryEmpty) {
        try {
          // Bounded query (limit 50) to protect Firestore read quota
          const firestoreRecords = await fetchAssessmentsFromFirestore(50);
          if (firestoreRecords && firestoreRecords.length > 0) {
            console.log(`[Firebase Recovery] Restored ${firestoreRecords.length} assessments from Firestore (Limit 50)`);
            setHistory(firestoreRecords);
            localStorage.setItem('wbs_ftw_history', JSON.stringify(firestoreRecords));
          }
        } catch (fbHistErr) {
          console.warn("[Firebase Recovery] History fetch warning:", fbHistErr);
        }
      }
    };

    loadConfigAndHistory();
  }, []);

  // Load Firebase Auth on startup
  useEffect(() => {
    setFirebaseLoaded(true);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setConnectedUser(user);
        setSheetsConnectionStatus('CONNECTED');
      } else {
        setConnectedUser(null);
        setSheetsToken(null);
        setSheetsConnectionStatus('DISCONNECTED');
      }
    });
    return () => unsubscribe();
  }, []);

  // Autofill lookup when NIK changes
  useEffect(() => {
    if (employeeDb[nik]) {
      setNama(employeeDb[nik].nama);
      setJabatan(employeeDb[nik].jabatan);
      setDept(employeeDb[nik].dept);
      setIsManualOverride(false);
    } else {
      if (nik.trim() !== '') {
        setIsManualOverride(true);
      }
    }
  }, [nik, employeeDb]);

  const saveToHistory = async (newHistory: CustomAssessment[], newRecord?: CustomAssessment) => {
    setHistory(newHistory);
    localStorage.setItem('wbs_ftw_history', JSON.stringify(newHistory));

    // Also dispatch to central online server database
    if (newRecord) {
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newRecord),
        });
      } catch (e) {
        console.error("Failed to sync record with cloud database server", e);
      }

      // Sync to Firebase Firestore Backup
      try {
        await syncAssessmentToFirestore(newRecord);
        console.log("[Firebase Backup] Assessment successfully backed up to Firestore (ftw-wbs):", newRecord.id);
      } catch (fbErr) {
        console.warn("[Firebase Backup] Warning syncing assessment to Firestore:", fbErr);
      }
    }
  };

  // Log outputs inside spreadsheet popup helper
  const addLog = (msg: string) => {
    setSheetsLogs(prev => [msg, ...prev]);
  };

  // Google Sheets integration API Calls
  const handleSheetsLogin = async () => {
    if (!firebaseAuth || !googleProvider) {
      alert(lang === 'ID' 
        ? 'Silakan tunggu, modul sinkronisasi Google sedang dipersiapkan. Mohon klik card persetujuan di bawah jika masih diminta.'
        : 'Google API client modules are initializing. Ensure you have authorized the API in the card control section.');
      return;
    }
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog("Menghubungkan ke layanan Google Auth...");
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setSheetsToken(credential.accessToken);
        setConnectedUser(result.user);
        setSheetsConnectionStatus('CONNECTED');
        addLog(lang === 'ID' ? "Berhasil menghubungkan akun Google!" : "Successfully authenticated with Google Workspace!");
      } else {
        throw new Error("Gagal memperoleh token akses Google.");
      }
    } catch (e: any) {
      console.error(e);
      addLog("Gagal login Google Sheets: " + e.message);
      setSheetsConnectionStatus('DISCONNECTED');
    }
  };

  const handleSheetsLogout = async () => {
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }
    setSheetsToken(null);
    setConnectedUser(null);
    setSheetsConnectionStatus('DISCONNECTED');
    addLog(lang === 'ID' ? "Terputus dari Google Spreadsheet." : "Disconnected from Google Sheets.");
  };

  // Save Spreadsheet ID on manual input
  const handleSaveSpreadsheetId = async (id: string) => {
    const cleaned = id.trim();
    setSpreadsheetId(cleaned);
    localStorage.setItem('wbs_spreadsheet_id', cleaned);
    addLog(`Spreadsheet ID disimpan: ${cleaned}`);

    // Update config on server
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: cleaned, webhookUrl })
      });
      addLog("Spreadsheet ID disinkronkan ke server pusat.");
    } catch (e: any) {
      console.error("Failed to sync spreadsheet ID to server configuration", e);
    }
  };

  // Save Google Sheets Webhook URL for server-side central automation
  const handleSaveWebhookUrl = async (url: string) => {
    const cleaned = url.trim();
    setWebhookUrl(cleaned);
    localStorage.setItem('wbs_sheets_webhook_url', cleaned);
    addLog(`Webhook URL disimpan: ${cleaned ? cleaned.substring(0, 35) + "..." : "KOSONG"}`);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, webhookUrl: cleaned })
      });
      addLog("Webhook URL disinkronkan ke server pusat.");
      alert(lang === 'ID' 
        ? "Webhook otomatisasi Google Sheets berhasil disimpan di server pusat!" 
        : "Google Sheets automation webhook successfully saved on the central server!"
      );
    } catch (e: any) {
      console.error("Failed to sync webhook URL to server configuration", e);
    }
  };

  // Create new active corporate spreadsheet with default templates
  const handleCreateNewSpreadsheet = async () => {
    if (!sheetsToken) {
      alert(lang === 'ID' ? "Harap hubungkan akun Google Admin Anda terlebih dahulu!" : "Please login to your Google Admin account first!");
      return;
    }
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog("Memproses pembuatan Spreadsheet baru di Google Drive Anda...");

      const resp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: "PT. Wahana Bara Sentosa - Fit to Work Portal"
          },
          sheets: [
            { properties: { title: "Dashboard Harian" } },
            { properties: { title: "Karyawan" } },
            { properties: { title: "Laporan_Fit" } }
          ]
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText);
      }

      const data = await resp.json();
      const newSpreadsheetId = data.spreadsheetId;
      setSpreadsheetId(newSpreadsheetId);
      localStorage.setItem('wbs_spreadsheet_id', newSpreadsheetId);
      addLog(`Spreadsheet terbuat! ID: ${newSpreadsheetId}`);

      // Push to backend server
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spreadsheetId: newSpreadsheetId, webhookUrl })
        });
        addLog("Spreadsheet ID tersimpan di server pusat!");
      } catch (e) {
        console.error("Failed to save generated sheet ID to server configuration", e);
      }

      addLog("Menulin skema database karyawan dan formula dashboard otomatis...");
      const headersKaryawan = ["NIK", "Nama", "Jabatan", "Departemen"];
      const rowsKaryawan = Object.entries(DEFAULT_EMPLOYEE_DB).map(([itemNik, item]) => [
        itemNik, item.nama, item.jabatan, item.dept
      ]);

      const headersHasil = [
        "ID Laporan", "Tanggal", "Jam", "NIK", "Nama", "Jabatan", "Departemen",
        "Skor Tidur 12j", "Skor Tidur 36j", "Minum Obat?", "Masalah Pribadi?", "Total Fatigue Score", "Keputusan Akhir"
      ];

      const dashboardTemplate = [
        ["REKAPITULASI DAN DASHBOARD ANALISA HARIAN - FIT TO WORK"],
        ["PT. WAHANA BARA SENTOSA - SAFETY DIVISION"],
        [],
        ["TANGGAL MONITORING", "=TODAY()", "Ter-update secara real-time"],
        [],
        ["METRIK KESELAMATAN (SAFETY METRICS)", "JUMLAH", "PERSENTASE (%)"],
        ["Total Assessment Hari Ini", "=COUNTIF('Laporan_Fit'!B2:B5000, TODAY())", "100%"],
        ["Pekerja FIT TO WORK (Hijau)", "=COUNTIFS('Laporan_Fit'!B2:B5000, TODAY(), 'Laporan_Fit'!M2:M5000, \"FIT\")", "=IF(B7>0, B8/B7, 0)"],
        ["Pekerja FIT CONDITIONAL (Kuning)", "=COUNTIFS('Laporan_Fit'!B2:B5000, TODAY(), 'Laporan_Fit'!M2:M5000, \"FIT_CONDITIONAL\")", "=IF(B7>0, B9/B7, 0)"],
        ["Pekerja POWER NAP / REST (Oranye)", "=COUNTIFS('Laporan_Fit'!B2:B5000, TODAY(), 'Laporan_Fit'!M2:M5000, \"REST_BEFORE_WORK\")", "=IF(B7>0, B10/B7, 0)"],
        ["Pekerja UNFIT WORKERS (Merah)", "=COUNTIFS('Laporan_Fit'!B2:B5000, TODAY(), 'Laporan_Fit'!M2:M5000, \"UNFIT\")", "=IF(B7>0, B11/B7, 0)"],
        [],
        ["Rata-Rata Fatigue Score Harian", "=AVERAGEIF('Laporan_Fit'!B2:B5000, TODAY(), 'Laporan_Fit'!L2:L5000)", "Skala penalti fatique umum"],
        [],
        ["PROSEDUR ADMIN UNTUK REKAP & KESIMPULAN:"],
        ["1. Karyawan yang 'UNFIT' dilarang keras mengoperasikan alat berat."],
        ["2. Laporan historis terisi otomatis dari pengisian HP masing-masing pekerja."],
        ["3. Anda dapat membagikan diagram bawaan Google Sheets ini kepada direksi harian."]
      ];

      // Populate templates cleanly using Sheets REST APIs batchUpdate
      const populateResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            { range: "Karyawan!A1:D1", values: [headersKaryawan] },
            { range: `Karyawan!A2:D${rowsKaryawan.length + 1}`, values: rowsKaryawan },
            { range: "Laporan_Fit!A1:M1", values: [headersHasil] },
            { range: "Dashboard Harian!A1:C18", values: dashboardTemplate }
          ]
        })
      });

      if (!populateResp.ok) throw new Error(await populateResp.text());
      addLog("Sukses membuat dan menyusun template spreadsheet portabel!");
      setSheetsConnectionStatus('CONNECTED');
      
      // Load newly created employee lists to initialize in local state
      await handleSyncKaryawan(newSpreadsheetId);
    } catch (e: any) {
      console.error(e);
      addLog("Gagal generate Spreadsheet: " + e.message);
      setSheetsConnectionStatus('CONNECTED');
    }
  };

  // Sync / Fetch Karyawan employees registry from sheet
  const handleSyncKaryawan = async (customId?: string) => {
    const targetId = customId || spreadsheetId;
    if (!targetId) {
      alert(lang === 'ID' ? "Harap tentukan Spreadsheet ID telebih dahulu!" : "Please provide Google Spreadsheet ID first!");
      return;
    }
    if (!sheetsToken) {
      alert(lang === 'ID' ? "Harap login akun Google/izin terlebih dahulu!" : "Please authorize Google Sign-In first!");
      return;
    }
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog("Mengambil data karyawan aktif dari Spreadsheet...");

      const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/Karyawan!A2:D500`, {
        headers: { 'Authorization': `Bearer ${sheetsToken}` }
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();

      if (data.values && data.values.length > 0) {
        const nextDb: Record<string, { nama: string; jabatan: string; dept: string }> = {};
        data.values.forEach((row: string[]) => {
          if (row[0]) {
            nextDb[row[0].trim()] = {
              nama: row[1] || '',
              jabatan: row[2] || '',
              dept: row[3] || ''
            };
          }
        });
        await saveEmployeeDb(nextDb);
        addLog(`Sinkronisasi sukses! ${Object.keys(nextDb).length} Karyawan diimpor.`);
      } else {
        addLog("Tabel 'Karyawan' terdeteksi kosong.");
      }
      setSheetsConnectionStatus('CONNECTED');
    } catch (e: any) {
      console.error(e);
      addLog("Gagal Sinkronisasi Karyawan: " + e.message);
      setSheetsConnectionStatus('CONNECTED');
    }
  };

  // Sync / Fetch Karyawan employees registry from sheet via Webhook (no Google login required)
  const handleSyncKaryawanViaWebhook = async () => {
    if (!webhookUrl) {
      alert(lang === 'ID' 
        ? "Harap masukkan Deployment URL Web App (Webhook) terlebih dahulu di Langkah 2!" 
        : "Please configure the Web App Deployment URL in Step 2 first!"
      );
      return;
    }
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog("Mengambil data karyawan aktif dari Webhook...");
      
      const response = await fetch("/api/sync-karyawan-webhook", {
        method: "POST"
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.details || "Unknown proxy error");
      }
      
      const result = await response.json();
      if (result.success && result.employees) {
        await saveEmployeeDb(result.employees);
        const numCount = Object.keys(result.employees).length;
        addLog(`Sinkronisasi Webhook sukses! ${numCount} Karyawan berhasil diimpor.`);
        alert(lang === 'ID' 
          ? `Sukses! Berhasil mengunduh & sinkronisasi ${numCount} data karyawan dari Google Sheets utama.`
          : `Success! Successfully pulled & synchronized ${numCount} employees from your central Google Sheet.`
        );
      } else {
        throw new Error("Data karyawan kosong atau format salah.");
      }
      setSheetsConnectionStatus('CONNECTED');
    } catch (e: any) {
      console.error(e);
      addLog("Gagal Sinkronisasi Webhook: " + e.message);
      alert(lang === 'ID'
        ? `Gagal Sinkronisasi: ${e.message}\n\nPastikan Apps Script Anda sudah di-deploy dengan akses 'Anyone (Siapa Saja)' dan kode doGet/doPost sudah sesuai.`
        : `Sync Failed: ${e.message}\n\nVerify that the Web App has been deployed with access of 'Anyone' and the doGet method is correctly configured.`
      );
      setSheetsConnectionStatus('CONNECTED');
    }
  };

  // Helper to persist the modified employee DB both to local storage, the server database, and Firebase Firestore backup
  const saveEmployeeDb = async (updatedDb: Record<string, { nama: string; jabatan: string; dept: string }>) => {
    try {
      setEmployeeDb(updatedDb);
      localStorage.setItem('wbs_sheets_employee_db', JSON.stringify(updatedDb));
      
      // 1. Save to Express server local storage (data/employees.json)
      try {
        const resp = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedDb)
        });
        if (!resp.ok) {
          console.warn("Notice: Server local file response:", await resp.text());
        }
      } catch (srvErr) {
        console.warn("Server API sync warning:", srvErr);
      }

      // 2. BACKUP TO FIREBASE FIRESTORE
      try {
        await syncEmployeesBatchToFirestore(updatedDb);
        console.log("[Firebase Backup] Employees successfully synced to Firestore (ftw-wbs)");
      } catch (fbErr) {
        console.warn("[Firebase Backup] Warning syncing to Firestore:", fbErr);
      }

      return true;
    } catch (err: any) {
      console.error("Gagal menyimpan database karyawan:", err);
      return false;
    }
  };

  const handleBulkParseText = (textStringToParse: string) => {
    if (!textStringToParse.trim()) {
      setBulkPreviewData([]);
      return;
    }
    const lines = textStringToParse.split(/\r?\n/);
    const parsed: { nik: string; nama: string; jabatan: string; dept: string }[] = [];
    let headerIndexMap = { nik: -1, nama: -1, jabatan: -1, dept: -1 };

    const firstRow = lines[0] || '';
    const isTab = firstRow.includes('\t');
    const separator = isTab ? '\t' : (firstRow.includes(';') ? ';' : ',');

    const splitRow = (rowText: string) => {
      const cells: string[] = [];
      let insideQuote = false;
      let currentCell = '';
      for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === separator && !insideQuote) {
          cells.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim());
      return cells;
    };

    const firstRowCells = splitRow(firstRow).map(c => c.toLowerCase());
    
    firstRowCells.forEach((cell, idx) => {
      if (cell.includes('nik') || cell.includes('id') || cell.includes('nomor') || cell.includes('n.i.k')) {
        headerIndexMap.nik = idx;
      } else if (cell.includes('nama') || cell.includes('name')) {
        headerIndexMap.nama = idx;
      } else if (cell.includes('jabatan') || cell.includes('position') || cell.includes('role') || cell.includes('pekerjaan')) {
        headerIndexMap.jabatan = idx;
      } else if (cell.includes('dept') || cell.includes('divisi') || cell.includes('departemen') || cell.includes('section')) {
        headerIndexMap.dept = idx;
      }
    });

    const hasHeader = headerIndexMap.nik !== -1 || headerIndexMap.nama !== -1;
    const startIdx = hasHeader ? 1 : 0;

    if (headerIndexMap.nik === -1) headerIndexMap.nik = 0;
    if (headerIndexMap.nama === -1) headerIndexMap.nama = 1;
    if (headerIndexMap.jabatan === -1) headerIndexMap.jabatan = 2;
    if (headerIndexMap.dept === -1) headerIndexMap.dept = 3;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = splitRow(line);
      const rawNik = (cells[headerIndexMap.nik] || '').trim();
      if (!rawNik) continue;
      
      const cleanNik = rawNik.replace(/["']/g, '').toUpperCase();
      const nama = (cells[headerIndexMap.nama] || '').trim().replace(/["']/g, '');
      const jabatan = (cells[headerIndexMap.jabatan] || 'Staff').trim().replace(/["']/g, '');
      const dept = (cells[headerIndexMap.dept] || 'Umum').trim().replace(/["']/g, '');

      if (cleanNik && nama) {
        parsed.push({ nik: cleanNik, nama, jabatan, dept });
      }
    }
    setBulkPreviewData(parsed);
  };

  const handleBulkImportSave = async (mode: 'MERGE' | 'OVERWRITE') => {
    if (bulkPreviewData.length === 0) {
      alert(lang === 'ID' ? 'Tidak ada data karyawan yang valid untuk diimpor.' : 'No valid employee data to import.');
      return;
    }

    const confirmMsg = mode === 'OVERWRITE'
      ? (lang === 'ID' 
          ? `PERINGATAN! Anda akan MENGHAPUS SEMUA (${Object.keys(employeeDb).length}) data karyawan aktif saat ini dan mengisinya dengan data baru sebanyak ${bulkPreviewData.length} karyawan?`
          : `WARNING! You are about to DELETE ALL (${Object.keys(employeeDb).length}) current active employees and replace them with ${bulkPreviewData.length} new employees. Proceed?`)
      : (lang === 'ID'
          ? `Anda akan menggabungkan/menambahkan ${bulkPreviewData.length} data karyawan ke dalam daftar aktif. Lanjutkan?`
          : `You are about to merge/add ${bulkPreviewData.length} employees to the active list. Proceed?`);

    if (!confirm(confirmMsg)) return;

    let targetDb: Record<string, { nama: string; jabatan: string; dept: string }> = {};
    if (mode === 'MERGE') {
      targetDb = { ...employeeDb };
    }

    bulkPreviewData.forEach(item => {
      targetDb[item.nik] = {
        nama: item.nama,
        jabatan: item.jabatan,
        dept: item.dept
      };
    });

    const success = await saveEmployeeDb(targetDb);
    if (success) {
      alert(lang === 'ID' 
        ? `Sukses! Berhasil mengimpor ${bulkPreviewData.length} karyawan menggunakan mode ${mode}.` 
        : `Success! Imported ${bulkPreviewData.length} employees using mode ${mode}.`
      );
      setBulkInputText('');
      setBulkPreviewData([]);
    } else {
      alert(lang === 'ID' ? 'Gagal menyimpan database karyawan ke server.' : 'Failed saving employee database.');
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmpNik.trim() || !newEmpNama.trim() || !newEmpJabatan.trim() || !newEmpDept.trim()) {
      alert(lang === 'ID' ? 'Harap lengkapi semua kolom NIK, Nama, Jabatan, dan Departemen!' : 'Please fill in all fields (NIK, Name, Position, and Department)!');
      return;
    }
    const cleanNik = newEmpNik.trim().toUpperCase();
    const newEmpData = {
      nama: newEmpNama.trim(),
      jabatan: newEmpJabatan.trim(),
      dept: newEmpDept.trim()
    };
    const nextDb = {
      ...employeeDb,
      [cleanNik]: newEmpData
    };

    // Save to local storage, server, and Firebase Firestore batch
    const success = await saveEmployeeDb(nextDb);

    // Also specifically sync this individual employee directly to Firestore
    try {
      await syncEmployeeToFirestore(cleanNik, newEmpData);
    } catch (e) {
      console.warn("Direct Firestore employee sync warning:", e);
    }

    // Also if Google Sheets is connected with token, append to Karyawan tab in Google Sheets
    if (sheetsToken && spreadsheetId) {
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Karyawan!A:D:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sheetsToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [[cleanNik, newEmpData.nama, newEmpData.jabatan, newEmpData.dept]]
          })
        });
        addLog(`Karyawan baru (${cleanNik}) disinkronkan ke Google Sheet.`);
      } catch (sheetErr) {
        console.warn("Sheet append warning:", sheetErr);
      }
    }

    if (success) {
      alert(lang === 'ID' 
        ? `Sukses! Karyawan dengan NIK ${cleanNik} (${newEmpData.nama}) berhasil ditambahkan dan disimpan ke database & cloud backup Firebase.` 
        : `Success! Employee with NIK ${cleanNik} (${newEmpData.nama}) has been added and saved to database & Firebase backup.`
      );
      // Reset input fields
      setNewEmpNik('');
      setNewEmpNama('');
      setNewEmpJabatan('');
      setNewEmpDept('');
    } else {
      alert(lang === 'ID' ? 'Gagal menyimpan perubahan ke server pusat.' : 'Failed to save changes to the central server.');
    }
  };

  const handleDeleteEmployee = async (nikToDelete: string) => {
    const isConfirmed = confirm(lang === 'ID' 
      ? `Apakah Anda yakin ingin menghapus karyawan dengan NIK: ${nikToDelete}?` 
      : `Are you sure you want to delete employee with NIK: ${nikToDelete}?`
    );
    if (!isConfirmed) return;

    const cleanNik = nikToDelete.trim().toUpperCase();
    const nextDb = { ...employeeDb };
    delete nextDb[cleanNik];
    
    // Delete from Firestore
    try {
      await deleteEmployeeFromFirestore(cleanNik);
    } catch (e) {
      console.warn("Firestore delete employee warning:", e);
    }

    // Delete from server
    try {
      await fetch(`/api/employees/${cleanNik}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Server delete employee warning:", e);
    }

    const success = await saveEmployeeDb(nextDb);
    if (success) {
      if (editingEmpNik === cleanNik) {
        setEditingEmpNik(null);
      }
    } else {
      alert(lang === 'ID' ? 'Gagal menghapus karyawan dari database server.' : 'Failed to delete employee from database server.');
    }
  };

  const handleSaveInlineEdit = async (nikToUpdate: string, namaVal: string, jabatanVal: string, deptVal: string) => {
    if (!namaVal.trim() || !jabatanVal.trim() || !deptVal.trim()) {
      alert(lang === 'ID' ? 'Kolom tidak boleh kosong!' : 'Fields cannot be empty!');
      return;
    }
    const cleanNik = nikToUpdate.trim().toUpperCase();
    const updatedData = {
      nama: namaVal.trim(),
      jabatan: jabatanVal.trim(),
      dept: deptVal.trim()
    };
    const nextDb = {
      ...employeeDb,
      [cleanNik]: updatedData
    };

    // Sync to Firestore
    try {
      await syncEmployeeToFirestore(cleanNik, updatedData);
    } catch (e) {
      console.warn("Firestore update warning:", e);
    }

    const success = await saveEmployeeDb(nextDb);
    if (success) {
      setEditingEmpNik(null);
    } else {
      alert(lang === 'ID' ? 'Gagal menyimpan pembaruan ke server.' : 'Failed to save updates to the server.');
    }
  };

  // Full Firebase Cloud Backup & Restore Handlers (Optimized Quota Saver)
  const handleSyncAllToFirebase = async () => {
    try {
      setFirebaseSyncing(true);
      setFirebaseStatusMsg(lang === 'ID' ? 'Sedang membackup ke Firebase Firestore (Mode Hemat Kuota & Ringan)...' : 'Backing up to Firebase Firestore (Quota Saver Mode)...');

      // 1. Single-write consolidated roster backup (1 Write instead of hundreds!)
      const empCount = Object.keys(employeeDb).length;
      await syncEmployeesBatchToFirestore(employeeDb);

      // 2. Backup assessments history using lightweight sanitized payload
      let histCount = 0;
      for (const rec of history) {
        await syncAssessmentToFirestore(rec);
        histCount++;
      }

      const msg = lang === 'ID'
        ? `✅ Berhasil membackup ${empCount} data karyawan (1 Dokumen Roster Hemat) dan ${histCount} data assessment ringkas ke Firebase Firestore!`
        : `✅ Successfully backed up ${empCount} employees (1-Doc Consolidated Roster) and ${histCount} lightweight assessment records to Firebase Firestore!`;
      
      setFirebaseStatusMsg(msg);
      alert(msg);
    } catch (err: any) {
      console.error("Firebase sync error:", err);
      const errMsg = `❌ Gagal backup ke Firebase: ${err.message || err}`;
      setFirebaseStatusMsg(errMsg);
      alert(errMsg);
    } finally {
      setFirebaseSyncing(false);
    }
  };

  const handleRestoreFromFirebase = async () => {
    try {
      setFirebaseSyncing(true);
      setFirebaseStatusMsg(lang === 'ID' ? 'Mengambil data dari Firebase Firestore (Mode Hemat 1-Read)...' : 'Pulling data from Firebase Firestore (1-Read Saver Mode)...');

      // 1. Restore employees via consolidated single-read roster (1 Read only!)
      const fsEmployees = await fetchRosterFromFirestore();
      let empCount = 0;
      if (fsEmployees && Object.keys(fsEmployees).length > 0) {
        const mergedEmp = { ...employeeDb, ...fsEmployees };
        empCount = Object.keys(fsEmployees).length;
        await saveEmployeeDb(mergedEmp);
      }

      // 2. Restore assessments with bounded query (Limit 100 to protect read quota)
      const fsAssessments = await fetchAssessmentsFromFirestore(100);
      let histCount = 0;
      if (fsAssessments && fsAssessments.length > 0) {
        const existingIds = new Set(history.map(r => r.id));
        const toAdd = fsAssessments.filter(r => r.id && !existingIds.has(r.id));
        histCount = fsAssessments.length;
        if (toAdd.length > 0) {
          const mergedHist = [...toAdd, ...history];
          setHistory(mergedHist);
          localStorage.setItem('wbs_ftw_history', JSON.stringify(mergedHist));
          for (const item of toAdd) {
            try {
              await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
              });
            } catch (e) {}
          }
        }
      }

      const msg = lang === 'ID'
        ? `✅ Berhasil memulihkan ${empCount} data karyawan (1 Read) dan ${histCount} data assessment dari Firebase Firestore!`
        : `✅ Successfully restored ${empCount} employees (1 Read) and ${histCount} assessment records from Firebase Firestore!`;

      setFirebaseStatusMsg(msg);
      alert(msg);
    } catch (err: any) {
      console.error("Firebase restore error:", err);
      const errMsg = `❌ Gagal restore dari Firebase: ${err.message || err}`;
      setFirebaseStatusMsg(errMsg);
      alert(errMsg);
    } finally {
      setFirebaseSyncing(false);
    }
  };

  // Handler to prune old assessments to free up Firebase storage space
  const handlePruneOldAssessments = async () => {
    const confirmPrune = window.confirm(
      lang === 'ID'
        ? `Apakah Anda yakin ingin memangkas & menghapus data laporan di Firebase Firestore yang berumur lebih dari ${pruneDays} hari? Tindakan ini akan mengosongkan kapasitas storage Firebase dan menjaga performa tetap cepat.`
        : `Are you sure you want to prune assessment records in Firebase Firestore older than ${pruneDays} days? This will free up storage space.`
    );
    if (!confirmPrune) return;

    try {
      setIsPruning(true);
      setFirebaseStatusMsg(lang === 'ID' ? `Sedang memangkas data lama (> ${pruneDays} hari)...` : `Pruning data older than ${pruneDays} days...`);
      const result = await pruneOldAssessmentsFromFirestore(pruneDays);
      setFirebaseStatusMsg(result.message);
      alert(result.message);
    } catch (err: any) {
      console.error("Prune error:", err);
      alert(`Gagal memangkas: ${err.message || err}`);
    } finally {
      setIsPruning(false);
    }
  };

  // Push individual assessment online sync backup
  const handlePushResultToSheets = async (record: CustomAssessment) => {
    if (!sheetsToken || !spreadsheetId) return;
    try {
      const row = [
        record.id,
        record.tanggalPengisian,
        record.jamPengisian,
        record.nik,
        record.nama,
        record.jabatan,
        record.dept,
        record.totalSleep12,
        record.totalSleep36,
        record.consumesObat ? 'Ya' : 'Tidak',
        record.hasPersonalProblem ? 'Ya' : 'Tidak',
        record.totalFatigueScore,
        record.finalDecision
      ];

      const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Laporan_Fit!A:M:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [row]
        })
      });

      if (resp.ok) {
        addLog(`Backup Online sukses untuk ID: ${record.id}`);
      } else {
        addLog(`Gagal backup online: ${resp.statusText}`);
      }
    } catch (e: any) {
      console.error(e);
      addLog(`Kesalahan saat push hasil: ${e.message}`);
    }
  };

  // Bulk push any accumulated offline/cloud results to Google sheets without duplicating
  const handleBulkUploadHistory = async () => {
    if (!sheetsToken || !spreadsheetId) {
      alert(lang === 'ID' ? "Harap login Google dan cantumkan Spreadsheet ID!" : "Please login and provide Spreadsheet ID!");
      return;
    }
    if (history.length === 0) {
      alert(lang === 'ID' ? "Tidak ada data riwayat penilaian untuk disinkronkan." : "No assessment records to sync.");
      return;
    }
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog("Memeriksa data laporan yang sudah diunggah sebelumnya di Google Sheets...");

      let existingIds: string[] = [];
      try {
        const checkResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Laporan_Fit!A2:A5000`, {
          headers: { 'Authorization': `Bearer ${sheetsToken}` }
        });
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          if (checkData.values) {
            existingIds = checkData.values.map((v: any) => v[0] ? v[0].trim() : "");
          }
        }
      } catch (checkErr) {
        console.warn("Could not retrieve pre-existing IDs. Appending all instead.", checkErr);
      }

      // Filter local database assessments to find records not yet uploaded
      const unsyncedHistory = history.filter(record => !existingIds.includes(record.id));

      if (unsyncedHistory.length === 0) {
        addLog("Semua data laporan sudah terekap sempurna di Google Sheets!");
        alert(lang === 'ID' 
          ? "Seluruh data laporan di server sudah tersinkronisasi sempurna di Google Sheets Anda!" 
          : "All records are already fully synchronized with Google Sheets!"
        );
        setSheetsConnectionStatus('CONNECTED');
        return;
      }

      addLog(`Menemukan ${unsyncedHistory.length} data baru belum tersinkronisasi. Memproses upload...`);

      const rows = unsyncedHistory.map(record => [
        record.id,
        record.tanggalPengisian,
        record.jamPengisian,
        record.nik,
        record.nama,
        record.jabatan,
        record.dept,
        record.totalSleep12,
        record.totalSleep36,
        record.consumesObat ? 'Ya' : 'Tidak',
        record.hasPersonalProblem ? 'Ya' : 'Tidak',
        record.totalFatigueScore,
        record.finalDecision
      ]);

      const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Laporan_Fit!A:M:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      });

      if (!resp.ok) throw new Error(await resp.text());
      addLog(`Sukses menyinkronkan ${unsyncedHistory.length} data baru!`);
      alert(lang === 'ID' 
        ? `Sukses! ${unsyncedHistory.length} laporan baru berhasil disinkronkan ke Google Sheets.` 
        : `Success! ${unsyncedHistory.length} new reports successfully synchronized to Google Sheets.`
      );
      setSheetsConnectionStatus('CONNECTED');
    } catch (e: any) {
      console.error(e);
      addLog("Gagal Sinkronisasi Massal: " + e.message);
      setSheetsConnectionStatus('CONNECTED');
    }
  };

  // Calculations logic
  const calculations = useMemo(() => {
    const sleep12_s1 = calculateHoursFromTimeStrings(sleep12Session1Bed, sleep12Session1Wake);
    const sleep12_s2 = hasSleep12Session2 ? calculateHoursFromTimeStrings(sleep12Session2Bed, sleep12Session2Wake) : 0;
    const totalSleep12 = parseFloat((sleep12_s1 + sleep12_s2).toFixed(1));

    const sleep36_s1 = calculateHoursFromTimeStrings(sleep36Session1Bed, sleep36Session1Wake);
    const sleep36_s2 = hasSleep36Session2 ? calculateHoursFromTimeStrings(sleep36Session2Bed, sleep36Session2Wake) : 0;
    const totalSleep36Combined = parseFloat((sleep36_s1 + sleep36_s2).toFixed(1));

    const totalSleep36 = parseFloat((totalSleep12 + totalSleep36Combined).toFixed(1));
    const awakeLast12h = parseFloat(Math.max(0, 12 - totalSleep12).toFixed(1));
    const awakeMinusSleep = parseFloat(Math.max(0, awakeLast12h - totalSleep12).toFixed(1));

    let scoreA = 0;
    if (totalSleep12 <= 1.5) scoreA = 20;
    else if (totalSleep12 <= 2.5) scoreA = 16;
    else if (totalSleep12 <= 3.5) scoreA = 12;
    else if (totalSleep12 <= 4.5) scoreA = 8;
    else if (totalSleep12 <= 5.5) scoreA = 6;
    else if (totalSleep12 <= 6.5) scoreA = 3;

    let scoreB = 1;
    if (totalSleep36 < 7.5) scoreB = 8;
    else if (totalSleep36 < 8.5) scoreB = 7;
    else if (totalSleep36 < 9.5) scoreB = 6;
    else if (totalSleep36 < 10.5) scoreB = 5;
    else if (totalSleep36 < 11.5) scoreB = 4;
    else if (totalSleep36 < 12.5) scoreB = 3;
    else if (totalSleep36 < 13.5) scoreB = 2;

    let scoreC = 0;
    if (awakeMinusSleep >= 2.5) scoreC = 3;
    else if (awakeMinusSleep >= 1.5) scoreC = 2;
    else if (awakeMinusSleep >= 0.5) scoreC = 1;

    const totalFatigueScore = scoreA + scoreB + scoreC;

    let fatigueCategory: 'NORMAL' | 'LAPOR' | 'REST' | 'REJECT' = 'NORMAL';
    if (totalFatigueScore >= 12) fatigueCategory = 'REJECT';
    else if (totalFatigueScore >= 9) fatigueCategory = 'REST';
    else if (totalFatigueScore >= 7) fatigueCategory = 'LAPOR';
    else fatigueCategory = 'NORMAL';

    let finalDecision: 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT' = 'FIT';
    if (fatigueCategory === 'REJECT') finalDecision = 'UNFIT';
    else if (fatigueCategory === 'REST') finalDecision = 'REST_BEFORE_WORK';
    else if (fatigueCategory === 'LAPOR') finalDecision = 'FIT_CONDITIONAL';
    else finalDecision = 'FIT';

    if (consumesObat || hasPersonalProblem) {
      if (finalDecision === 'FIT') {
        finalDecision = 'FIT_CONDITIONAL';
        fatigueCategory = 'LAPOR';
      }
    }

    const readinessScore = Math.max(0, 100 - (totalFatigueScore * 7.5));
    const sleepStandard = 6.0;
    const isSleepDeficit = totalSleep12 < sleepStandard;
    const requiredRecoveryRest = isSleepDeficit ? parseFloat((sleepStandard - totalSleep12).toFixed(1)) : 0;

    return {
      sleep12_s1,
      sleep12_s2,
      totalSleep12,
      sleep36_s1,
      sleep36_s2,
      totalSleep36,
      awakeLast12h,
      awakeMinusSleep,
      scoreA,
      scoreB,
      scoreC,
      totalFatigueScore,
      readinessScore,
      fatigueCategory,
      finalDecision,
      isSleepDeficit,
      requiredRecoveryRest
    };
  }, [
    sleep12Session1Bed, sleep12Session1Wake, hasSleep12Session2, sleep12Session2Bed, sleep12Session2Wake,
    sleep36Session1Bed, sleep36Session1Wake, hasSleep36Session2, sleep36Session2Bed, sleep36Session2Wake,
    consumesObat, hasPersonalProblem
  ]);

  const goToStep2 = () => {
    setFormError('');
    if (!nik.trim()) {
      setFormError(lang === 'ID' ? 'NIK Karyawan wajib diisi!' : 'Employee ID is required!');
      return;
    }
    if (!nama.trim()) {
      setFormError(lang === 'ID' ? 'Nama Karyawan wajib diisi!' : 'Employee name is required!');
      return;
    }
    if (!jabatan.trim()) {
      setFormError(lang === 'ID' ? 'Jabatan wajib diisi!' : 'Position is required!');
      return;
    }
    if (!dept.trim()) {
      setFormError(lang === 'ID' ? 'Departemen wajib diisi!' : 'Department is required!');
      return;
    }

    const cleanNik = nik.trim().toLowerCase();
    
    // Check if there is an existing submission for this NIK today
    const existingRecord = history.find(rec => 
      rec.nik.trim().toLowerCase() === cleanNik && 
      rec.tanggalPengisian === tanggalPengisian
    );

    if (existingRecord) {
      // Load the previous submission states so they see their locked card
      setSleep12Session1Bed(existingRecord.sleep12Session1Bed || '23:00');
      setSleep12Session1Wake(existingRecord.sleep12Session1Wake || '06:00');
      setHasSleep12Session2(existingRecord.hasSleep12Session2 || false);
      setSleep12Session2Bed(existingRecord.sleep12Session2Bed || '');
      setSleep12Session2Wake(existingRecord.sleep12Session2Wake || '');

      setSleep36Session1Bed(existingRecord.sleep36Session1Bed || '22:30');
      setSleep36Session1Wake(existingRecord.sleep36Session1Wake || '05:00');
      setHasSleep36Session2(existingRecord.hasSleep36Session2 || false);
      setSleep36Session2Bed(existingRecord.sleep36Session2Bed || '');
      setSleep36Session2Wake(existingRecord.sleep36Session2Wake || '');

      setConsumesObat(existingRecord.consumesObat || false);
      setHasPersonalProblem(existingRecord.hasPersonalProblem || false);

      setHasJustSubmitted(true);
      setStep(3);

      alert(
        lang === 'ID'
          ? `Sistem mendeteksi NIK ${nik} sudah mengisi penilaian Fit to Work hari ini pada jam ${existingRecord.jamPengisian}. Menampilkan langsung hasil pengembalian hasil penilaian Anda (Terkunci).`
          : `System detected that NIK ${nik} has already completed the Fit to Work assessment today at ${existingRecord.jamPengisian}. Redirecting to your current locked results card.`
      );
      return;
    }

    setStep(2);
  };

  const processCalculationsAndShowResult = () => {
    setFormError('');

    if (!sleep12Session1Bed || !sleep12Session1Wake) {
      setFormError(lang === 'ID' ? 'Jam Tidur & Bangun Sesi Utama 12 Jam wajib diisi!' : 'Primary 12 Hours Sleep details required!');
      return;
    }
    if (hasSleep12Session2 && (!sleep12Session2Bed || !sleep12Session2Wake)) {
      setFormError(lang === 'ID' ? 'Isi jam Sesi 2 (12 Jam) lengkap atau hilangkan tanda centang!' : 'Complete optional Sesi 2 (12 Hours) or uncheck it!');
      return;
    }
    if (!sleep36Session1Bed || !sleep36Session1Wake) {
      setFormError(lang === 'ID' ? 'Jam Tidur Sesi Utama 36 Jam wajib diisi!' : 'Primary 36 Hours Sleep details required!');
      return;
    }
    if (hasSleep36Session2 && (!sleep36Session2Bed || !sleep36Session2Wake)) {
      setFormError(lang === 'ID' ? 'Isi jam Sesi 2 (36 Jam) lengkap atau hilangkan tanda centang!' : 'Complete optional Sesi 2 (36 Hours) or uncheck it!');
      return;
    }

    // Open confirmation warning modal instead of going to step 3 directly
    setShowConfirmSubmitModal(true);
  };

  // Safe confirm-and-submit function
  const handleConfirmAndSubmitAssessment = () => {
    setShowConfirmSubmitModal(false);
    
    const recordId = `WBS-FTW-${Math.floor(10000 + Math.random() * 90000)}`;
    const newRecord: CustomAssessment = {
      id: recordId,
      timestamp: new Date().toISOString(),
      nik,
      nama,
      jabatan,
      dept,
      tanggalPengisian,
      jamPengisian,
      sleep12Session1Bed,
      sleep12Session1Wake,
      sleep12Session2Bed,
      sleep12Session2Wake,
      hasSleep12Session2,
      totalSleep12: calculations.totalSleep12,
      sleep36Session1Bed,
      sleep36Session1Wake,
      sleep36Session2Bed,
      sleep36Session2Wake,
      hasSleep36Session2,
      totalSleep36: calculations.totalSleep36,
      consumesObat,
      hasPersonalProblem,
      totalFatigueScore: calculations.totalFatigueScore,
      readinessScore: calculations.readinessScore,
      fatigueCategory: calculations.fatigueCategory,
      finalDecision: calculations.finalDecision
    };

    saveToHistory([newRecord, ...history], newRecord);

    // Save submission date to local storage specifically to check again
    localStorage.setItem(`wbs_ftw_submitted_${nik.trim().toLowerCase()}_${tanggalPengisian}`, 'true');

    // If Google Sheets is connected, push automatically
    if (sheetsToken && spreadsheetId) {
      handlePushResultToSheets(newRecord);
      alert(
        lang === 'ID' 
          ? `Sukses Online! Data berhasil dikirim dan tersimpan di database online pusat PT. Wahana Bara Sentosa & di-backup otomatis ke Google Spreadsheet admin. (Laporan ID: ${recordId})`
          : `Success Online! Data saved to PT. Wahana Bara Sentosa central online database and securely backed up to admin's Google Spreadsheet. (Report ID: ${recordId})`
      );
    } else {
      alert(
        lang === 'ID' 
          ? `Sukses Online! Penilaian dikirim dan disimpan ke database online pusat PT. Wahana Bara Sentosa. (Laporan ID: ${recordId}).`
          : `Success Online! Assessment saved to PT. Wahana Bara Sentosa central cloud database. (Report ID: ${recordId}).`
      );
    }

    setHasJustSubmitted(true);
    setStep(3);
  };

  const handleResetApp = () => {
    setStep(1);
    setNik('');
    setNama('');
    setJabatan('');
    setDept('');
    setIsManualOverride(false);
    setSleep12Session1Bed('23:00');
    setSleep12Session1Wake('06:00');
    setHasSleep12Session2(false);
    setSleep12Session2Bed('');
    setSleep12Session2Wake('');
    setSleep36Session1Bed('22:30');
    setSleep36Session1Wake('05:00');
    setHasSleep36Session2(false);
    setSleep36Session2Bed('');
    setSleep36Session2Wake('');
    setConsumesObat(false);
    setHasPersonalProblem(false);
    setFormError('');
  };

  const handleExportCSV = (records: CustomAssessment[]) => {
    if (records.length === 0) {
      alert(lang === 'ID' ? 'Tidak ada data untuk diekspor.' : 'No data to export.');
      return;
    }

    const headers = [
      "ID Laporan",
      "Timestamp",
      "NIK",
      "Nama",
      "Jabatan",
      "Departemen",
      "Tanggal Pengisian",
      "Jam Pengisian",
      "Total Tidur (Jam)",
      "Total Tidur 36 Jam (Jam)",
      "Konsumsi Obat",
      "Masalah Pribadi",
      "Fatigue Score",
      "Readiness Ratio (%)",
      "Kategori Fatigue",
      "Keputusan Akhir"
    ];

    const rows = records.map(rec => [
      `"${rec.id}"`,
      `"${rec.timestamp}"`,
      `"${rec.nik}"`,
      `"${rec.nama.replace(/"/g, '""')}"`,
      `"${rec.jabatan.replace(/"/g, '""')}"`,
      `"${rec.dept.replace(/"/g, '""')}"`,
      `"${rec.tanggalPengisian}"`,
      `"${rec.jamPengisian}"`,
      rec.totalSleep12,
      rec.totalSleep36,
      rec.consumesObat ? (lang === 'ID' ? 'Ya' : 'Yes') : (lang === 'ID' ? 'Tidak' : 'No'),
      rec.hasPersonalProblem ? (lang === 'ID' ? 'Ya' : 'Yes') : (lang === 'ID' ? 'Tidak' : 'No'),
      rec.totalFatigueScore,
      `"${rec.readinessScore}%"`,
      `"${rec.fatigueCategory}"`,
      `"${rec.finalDecision}"`
    ]);

    // UTF-8 BOM representation for correct Excel character loading
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FTW_Dashboard_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteRecord = async (id: string) => {
    if (confirm(lang === 'ID' ? 'Hapus catatan ini dari database online pusat & backup Firebase?' : 'Delete this assessment record from the central database & Firebase backup?')) {
      try {
        await fetch(`/api/history/${id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.error("Failed to delete record from central server:", e);
      }
      try {
        await deleteAssessmentFromFirestore(id);
      } catch (fbErr) {
        console.warn("Firestore delete assessment warning:", fbErr);
      }
      const updated = history.filter(item => item.id !== id);
      saveToHistory(updated);
    }
  };

  // Features Added: Sharing Report to WhatsApp
  const handleShareWhatsApp = () => {
    const formatVerdict = () => {
      if (calculations.finalDecision === 'FIT') return "🟢 Karyawan diizinkan bekerja normal";
      if (calculations.finalDecision === 'FIT_CONDITIONAL') return "🟡 Karyawan diizinkan bekerja normal (Dengan Pengawasan)";
      if (calculations.finalDecision === 'REST_BEFORE_WORK') return "🟠 istirahat dahulu sebelum bekerja";
      return "🔴 tidak boleh bekerja";
    };

    const text = `*LAPORAN FIT TO WORK ASSESSMENT*
*PT. WAHANA BARA SENTOSA FTW Online*
---------------------------------------
📋 *Data Karyawan:*
• *Nama:* ${nama}
• *NIK:* ${nik}
• *Jabatan:* ${jabatan} [${dept}]
• *Waktu Pengisian:* ${tanggalPengisian} pukul ${jamPengisian}

🛡️ *Hasil Analisa Kelayakan:*
• *Kondisi:* *${formatVerdict()}*
• *Readiness Score:* ${calculations.readinessScore}%
• *Fatigue Score:* ${calculations.totalFatigueScore} Penalti

⚠️ *Faktor Risiko Tambahan:*
• *Konsumsi Obat Sleepy:* ${consumesObat ? "Ya (Ada Risiko Mengantuk) 💊" : "Tidak"}
• *Masalah Pribadi / Stres:* ${hasPersonalProblem ? "Ya (Fokus Terganggu) 🧠" : "Tidak"}

💡 *Rekomendasi Kerja:*
• ${
      calculations.finalDecision === 'FIT' ? "Karyawan diizinkan bekerja normal." :
      calculations.finalDecision === 'FIT_CONDITIONAL' ? "Karyawan diizinkan bekerja normal (Wajib lapor supervisor)." :
      calculations.finalDecision === 'REST_BEFORE_WORK' ? "Karyawan wajib istirahat dahulu sebelum bekerja." :
      "Karyawan tidak boleh bekerja."
    }

_Laporan sah secara sistem PT. Wahana Bara Sentosa FTW Online_`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Features Added: Save Assessment Result Card as JPG/PNG
  const handleDownloadImage = () => {
    const element = badgeRef.current;
    if (!element) {
      alert("Elemen sertifikat tidak ditemukan.");
      return;
    }
    
    addLog("Sedang melakukan render gambar sertifikat...");
    html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 3, // Premium quality scaling
      useCORS: true,
      logging: false
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `FTW_PASS_${nik}_${tanggalPengisian.replace(/-/g, '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      addLog("Gambar sertifikat diunduh.");
    }).catch(e => {
      console.error(e);
      alert("Gagal merender gambar. Coba sekali lagi.");
    });
  };

  // Filter history based on search state (NIK filter)
  const filteredHistory = history.filter((record) => {
    if (!historyNikFilter) return true;
    return record.nik.toLowerCase().trim().includes(historyNikFilter.toLowerCase().trim());
  });

  // UI Translates
  const t = {
    h1Title: lang === 'ID' ? 'IDENTITAS KARYAWAN' : 'EMPLOYEE IDENTITY',
    h1Sub: lang === 'ID' ? 'Halaman 1 dari 3 - Data Registrasi Karyawan' : 'Page 1 of 3 - Employee Details',
    h2Title: lang === 'ID' ? 'Jam Tidur & Bangun' : 'Sleep-Wake Timing',
    h2Sub: lang === 'ID' ? 'Halaman 2 dari 3 - Rest Log' : 'Page 2 of 3 - Rest Log',
    h3Title: lang === 'ID' ? 'Hasil Analisis & Skor' : 'Outcomes & Fatigue Score',
    h3Sub: lang === 'ID' ? 'Halaman 3 dari 3 - Status Kelayakan' : 'Page 3 of 3 - Fatigue Verdict',
  };

  return (
    <div className="min-h-screen bg-white text-neutral-800 flex flex-col font-sans transition-all duration-300">
      
      {/* GLOBAL MASTER HEADER BAR Styled White Premium */}
      <div className="bg-white border-b border-neutral-200 shadow-sm px-6 py-3.5 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-white px-2.5 py-1 rounded-lg border border-neutral-200 hover:scale-[1.02] transition duration-150 shadow-xs shrink-0">
            <img 
              src="https://res.cloudinary.com/dgjnlxf69/image/upload/v1790130590/Logo_FTW_ul1dz4.png" 
              alt="Logo Fit to Work PT. WBS" 
              className="h-9 w-auto object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo-ftw.png';
              }}
            />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-[10.5px] font-black tracking-widest text-[#e11d48] leading-none uppercase flex items-center gap-1.5">
              Fatigue Management 
              <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-250 font-sans text-[7.5px] tracking-normal font-black animate-pulse uppercase">● Cloud Sync</span>
            </span>
            <span className="text-[10px] tracking-wide text-neutral-900 font-extrabold leading-none mt-1.5 uppercase">FIT TO WORK ONLINE PT. WBS</span>
          </div>
        </div>

        {/* TOP STATUS CONTROLS - WHATSAPP TRIGGER */}
        <div className="flex items-center gap-2">
          
          {/* Access history log overlay drawer */}
          <button 
            type="button"
            onClick={() => {
              setHistoryNikFilter('');
              setShowHistoryOverlay(true);
            }}
            className="text-[10px] sm:text-xs font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-neutral-700 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{lang === 'ID' ? 'Riwayat' : 'Registry'}</span>
          </button>

          {/* Menu Admin - Custom Employee & Integration Panel */}
          <button 
            type="button"
            onClick={() => {
              setAdminNikFilter('');
              setShowAdminOverlay(true);
            }}
            className="text-[10px] sm:text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="hidden xs:inline">{lang === 'ID' ? 'Menu Admin' : 'Admin Panel'}</span>
            <span className="xs:hidden">ADMIN</span>
          </button>

          {/* Language Toggle */}
          <button 
            type="button"
            onClick={() => setLang(lang === 'ID' ? 'EN' : 'ID')}
            className="text-xs font-bold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <span>🌎</span>
            <span className="font-mono">{lang}</span>
          </button>
        </div>
      </div>

      {/* TOP DESKTOP MODE NOTIFICATION BANNER */}
      {deviceMode === 'mobile' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-1 text-[10.5px] font-medium hidden md:block select-none">
          💡 Mode <b>MOBILE VIEW</b> aktif. Tampilan disesuaikan dengan dimensi layar smartphone HP (390px × 844px).
        </div>
      )}

      {/* CHASSIS CONTAINER FOR REDESIGNED WHITE THEME */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 bg-white">

        {/* DEVICE WRAPPER - WHITE THEMED */}
        <div className={`transition-all duration-300 w-full flex flex-col ${
          deviceMode === 'mobile' 
            ? 'max-w-[400px] h-[860px] border-[12px] border-neutral-900 rounded-[3rem] shadow-2xl bg-white overflow-hidden justify-between relative text-neutral-800' 
            : 'max-w-xl bg-white border border-neutral-200 shadow-xl rounded-2xl self-center text-neutral-800 p-1'
        }`}>
          
          {/* SPEAKER / CAMERA CAP IF PHONE FRAME */}
          {deviceMode === 'mobile' && (
            <div className="w-full flex justify-center py-3.5 absolute top-0 left-0 bg-neutral-100/85 z-20 border-b border-neutral-200/50">
              <div className="w-24 h-4 bg-neutral-200 rounded-full flex items-center justify-around px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-300"></span>
              </div>
            </div>
          )}

          {/* MAIN PAGE CARD CONTENT */}
          <div className={`w-full flex-1 flex flex-col p-5 sm:p-7 ${
            deviceMode === 'mobile' ? 'mt-9 overflow-y-auto' : ''
          }`}>
            
            {/* COMPONENT LOGO TITLE AREA */}
            <div className="text-center mb-5 mt-2 flex flex-col items-center">
              <div className="mb-2.5 p-2 bg-white rounded-2xl border border-neutral-200 inline-flex items-center justify-center shadow-xs">
                <img 
                  src="https://res.cloudinary.com/dgjnlxf69/image/upload/v1790130590/Logo_FTW_ul1dz4.png" 
                  alt="Logo Fit to Work PT. WBS" 
                  className="h-14 sm:h-16 w-auto object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/logo-ftw.png';
                  }}
                />
              </div>
              <span className="text-[10px] font-bold tracking-[0.25em] text-rose-600 uppercase block">
                Fatigue Management
              </span>
              <h1 className="text-xl font-black tracking-tight text-neutral-900 mt-1 uppercase">
                Fit To Work Online
              </h1>
              <p className="text-neutral-500 text-[11px] font-semibold mt-0.5 uppercase tracking-wide">
                PT. Wahana Bara Sentosa
              </p>
            </div>

            {/* STEP PROGRESS INDICATOR PIPES Light Mode Grid */}
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-250 flex items-center justify-around mb-6 text-center select-none shadow-sm">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-mono transition ${
                  step === 1 ? 'bg-rose-600 text-white shadow-md' : step > 1 ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {step > 1 ? '✓' : '1'}
                </div>
                <span className="text-[9.5px] font-bold tracking-tight text-neutral-600 uppercase shrink-0">
                  {lang === 'ID' ? 'Identitas Karyawan' : 'ID'}
                </span>
              </div>
              <div className={`h-0.5 flex-1 mx-2 ${step > 1 ? 'bg-emerald-600' : 'bg-neutral-200'}`}></div>

              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-mono transition ${
                  step === 2 ? 'bg-rose-600 text-white shadow-md' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {step > 2 ? '✓' : '2'}
                </div>
                <span className="text-[9.5px] font-bold tracking-tight text-neutral-600 uppercase shrink-0">
                  {lang === 'ID' ? 'Jam Tidur' : 'Sleep'}
                </span>
              </div>
              <div className={`h-0.5 flex-1 mx-2 ${step > 2 ? 'bg-emerald-600' : 'bg-neutral-200'}`}></div>

              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-mono transition ${
                  step === 3 ? 'bg-rose-600 text-white shadow-md' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  3
                </div>
                <span className="text-[9.5px] font-bold tracking-tight text-neutral-600 uppercase shrink-0">
                  {lang === 'ID' ? 'Hasil FTW' : 'Result'}
                </span>
              </div>
            </div>

            {/* ERROR TICKER */}
            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-center gap-2 animate-bounce">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* ---------------------------------------------------------------------------------- */}
            {/* HALAMAN 1: IDENTITAS KARYAWAN (Dengan Google sheet database integration) */}
            {/* ---------------------------------------------------------------------------------- */}
            {step === 1 && (
              <div className="flex-1 flex flex-col gap-4 text-neutral-800">
                <div className="pb-2 border-b border-neutral-200">
                  <h2 className="text-sm font-bold tracking-wider text-rose-600 uppercase flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{t.h1Title}</span>
                  </h2>
                  <p className="text-[10px] text-neutral-500">{t.h1Sub}</p>
                </div>

                {/* Spreadsheet status alert bar */}
                {spreadsheetId && sheetsToken && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2.5 rounded-lg text-[10px] flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Connected to Google Sheets</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleSyncKaryawan()}
                      className="text-[9px] font-bold uppercase underline bg-white text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-300 hover:bg-neutral-50 cursor-pointer"
                    >
                      Sync Now
                    </button>
                  </div>
                )}

                {/* Input NIK */}
                <div className="flex flex-col gap-1.5 font-sans">
                  <label className="text-[9.5px] font-extrabold text-neutral-500 uppercase tracking-widest block">
                    {lang === 'ID' ? 'Nomor Induk Karyawan (NIK)' : 'Employee ID Number (NIK)'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-lg py-2.5 px-3.5 pl-10 text-sm tracking-wider font-mono uppercase text-neutral-900 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-semibold shadow-xs"
                      placeholder={lang === 'ID' ? "INPUT NOMOR NIK ANDA DISINI" : "INPUT YOUR NIK HERE"}
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                    />
                    <span className="absolute left-3.5 top-3.5 text-neutral-400 font-mono text-xs">#</span>
                  </div>
                </div>

                {/* Database Search Ticker popup info block */}
                <div className="bg-neutral-50 px-3.5 py-2.5 rounded-lg border border-neutral-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      employeeDb[nik] ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                    }`}></span>
                    <span className="text-[10px] font-bold text-neutral-700 uppercase">
                      {employeeDb[nik] 
                        ? (lang === 'ID' ? 'Karyawan Terverifikasi' : 'VERIFIED EMPLOYEE') 
                        : (lang === 'ID' ? 'Input Manual / Baru' : 'MANUAL DATA INPUT / NEW')
                      }
                    </span>
                  </div>
                  {employeeDb[nik] && (
                    <span className="text-[8.5px] font-extrabold uppercase text-emerald-700 font-mono bg-emerald-100 px-2.5 py-0.5 rounded-md">
                      Autofill OK
                    </span>
                  )}
                </div>

                {/* Autocompleted Fields Card */}
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/80 flex flex-col gap-3.5 shadow-xs">
                  
                  {/* Nama Field */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-extrabold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Nama Lengkap Karyawan' : 'Full Name'}</span>
                    <input 
                      type="text" 
                      value={nama}
                      disabled={!isManualOverride && !!employeeDb[nik]}
                      onChange={(e) => setNama(e.target.value)}
                      className={`w-full bg-white border ${
                        !isManualOverride && !!employeeDb[nik] ? 'border-neutral-200 text-neutral-400 font-semibold' : 'border-neutral-300 text-neutral-900 focus:ring-1 focus:ring-rose-500 font-bold'
                      } text-xs py-2 px-3 rounded-lg outline-none`}
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  {/* Jabatan & Dept Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9.5px] font-extrabold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jabatan' : 'Job Title'}</span>
                      <input 
                        type="text" 
                        value={jabatan}
                        disabled={!isManualOverride && !!employeeDb[nik]}
                        onChange={(e) => setJabatan(e.target.value)}
                        className={`w-full bg-white border ${
                          !isManualOverride && !!employeeDb[nik] ? 'border-neutral-200 text-neutral-400 font-semibold' : 'border-neutral-300 text-neutral-900 focus:ring-1 focus:ring-rose-500'
                        } text-xs py-2 px-3 rounded-lg outline-none font-medium`}
                        placeholder="Operator, Driver, dll"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9.5px] font-extrabold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Departemen' : 'Department'}</span>
                      <input 
                        type="text" 
                        value={dept}
                        disabled={!isManualOverride && !!employeeDb[nik]}
                        onChange={(e) => setDept(e.target.value)}
                        className={`w-full bg-white border ${
                          !isManualOverride && !!employeeDb[nik] ? 'border-neutral-200 text-neutral-400 font-semibold' : 'border-neutral-300 text-neutral-900 focus:ring-1 focus:ring-rose-500'
                        } text-xs py-2 px-3 rounded-lg outline-none font-medium`}
                        placeholder="Produksi, Logistik, dll"
                      />
                    </div>
                  </div>
                </div>

                {/* Tanggal & Jam Pengisian */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-extrabold text-neutral-550 uppercase tracking-wider">{lang === 'ID' ? 'Tanggal Assessment' : 'Assessment Date'}</span>
                    <input 
                      type="date"
                      value={tanggalPengisian}
                      onChange={(e) => setTanggalPengisian(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-lg text-neutral-900 text-xs py-2 px-3 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-extrabold text-neutral-550 uppercase tracking-wider">{lang === 'ID' ? 'Waktu Pengisian' : 'Assessment Time'}</span>
                    <input 
                      type="time" 
                      value={jamPengisian}
                      onChange={(e) => setJamPengisian(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-lg text-neutral-900 text-xs py-2 px-3 outline-none"
                    />
                  </div>
                </div>

                {/* MENU RIWAYAT KARYAWAN */}
                <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl flex flex-col gap-2.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base shrink-0">📋</span>
                    <div>
                      <h4 className="text-[10.5px] font-extrabold text-neutral-800 uppercase tracking-wider leading-tight">
                        {lang === 'ID' ? 'Riwayat Pengisian Karyawan' : 'Employee Submission History'}
                      </h4>
                      <p className="text-[9px] text-neutral-500 leading-none mt-0.5">
                        {lang === 'ID' ? 'Cek arsip pengisian penilaian sebelumnya' : 'Check previous self-assessment database records'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <button 
                      type="button"
                      onClick={() => {
                        setHistoryNikFilter(nik);
                        setShowHistoryOverlay(true);
                      }}
                      className="w-full bg-white hover:bg-neutral-50 text-neutral-700 font-bold py-2 px-3 rounded-lg text-[11px] border border-neutral-300 hover:border-rose-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>🔍</span>
                      <span className="truncate">
                        {lang === 'ID' 
                          ? `Riwayat NIK: ${nik || '(Belum Isi NIK)'}` 
                          : `History for NIK: ${nik || '(No NIK)'}`}
                      </span>
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        setHistoryNikFilter('');
                        setShowHistoryOverlay(true);
                      }}
                      className="w-full bg-white hover:bg-neutral-50 text-neutral-600 font-bold py-2 px-3 rounded-lg text-[11px] border border-neutral-300 hover:border-rose-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>📂</span>
                      <span>{lang === 'ID' ? 'Tampilkan Semua' : 'View All'}</span>
                    </button>
                  </div>
                </div>

                {/* Navigation Button Block step 1 */}
                <div className="mt-auto pt-5 flex flex-col gap-2">
                  <button 
                    type="button"
                    onClick={goToStep2}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-4 rounded-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-200 text-xs uppercase"
                  >
                    <span>{lang === 'ID' ? 'PILIH JAM TIDUR' : 'ENTER SLEEP TIMES'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------------------------- */}
            {/* HALAMAN 2: JAM TIDUR & BANGUN */}
            {/* ---------------------------------------------------------------------------------- */}
            {step === 2 && (
              <div className="flex-1 flex flex-col gap-4 text-neutral-800">
                <div className="pb-2 border-b border-neutral-200">
                  <h2 className="text-sm font-bold tracking-wider text-rose-600 uppercase flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" />
                    <span>{t.h2Title}</span>
                  </h2>
                  <p className="text-[10px] text-neutral-500">{t.h2Sub}</p>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[460px] pr-1.5 flex flex-col gap-5">
                  
                  {/* --- AREA 1: 12 JAM TERAKHIR (Sleep block 1) --- */}
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex flex-col gap-3 shadow-xs">
                    <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                      <h3 className="text-[11px] font-extrabold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                        <span className="bg-rose-600 w-1.5 h-3.5 rounded-sm"></span>
                        {lang === 'ID' ? 'Sesi Tidur Utama (12 Jam Terakhir)' : 'Primary Sleep Session (Last 12 Hours)'}
                      </h3>
                    </div>

                    {/* Sesi 1 Times */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Mulai Tidur' : 'Bedtime (Session 1)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep12Session1Bed}
                          onChange={(e) => setSleep12Session1Bed(e.target.value)}
                          className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Bangun Tidur' : 'Wake-up (Session 1)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep12Session1Wake}
                          onChange={(e) => setSleep12Session1Wake(e.target.value)}
                          className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    {/* Optional Session 2 Toggles for 12 hours */}
                    <div className="mt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={hasSleep12Session2}
                          onChange={(e) => setHasSleep12Session2(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-rose-650 focus:ring-rose-500 bg-white border-neutral-300 transition"
                        />
                        <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">
                          {lang === 'ID' ? '🌙 Sesi Tidur Tambahan (Bila Terbangun)' : '🌙 Additional Sleep Session (If Interrupted/Woken Up)'}
                        </span>
                      </label>

                      {hasSleep12Session2 && (
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-neutral-200">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Tidur Sesi 2' : 'Bedtime (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep12Session2Bed}
                              onChange={(e) => setSleep12Session2Bed(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Bangun Sesi 2' : 'Wake-up (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep12Session2Wake}
                              onChange={(e) => setSleep12Session2Wake(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* --- AREA 2: 36 JAM TERAKHIR --- */}
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex flex-col gap-3 shadow-xs">
                    <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                      <h3 className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest flex items-center gap-2">
                        <span className="bg-neutral-800 w-1.5 h-3.5 rounded-sm"></span>
                        {lang === 'ID' ? 'Sesi Tidur Siklus Sebelumnya (36 Jam Terakhir)' : 'Previous Cycle Sleep Session (Last 36 Hours)'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Mulai Tidur' : 'Bedtime (Cycle 2)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep36Session1Bed}
                          onChange={(e) => setSleep36Session1Bed(e.target.value)}
                          className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none focus:border-rose-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Bangun Tidur' : 'Wake-up (Cycle 2)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep36Session1Wake}
                          onChange={(e) => setSleep36Session1Wake(e.target.value)}
                          className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {/* Optional Session 2 Toggles for 36 hours */}
                    <div className="mt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={hasSleep36Session2}
                          onChange={(e) => setHasSleep36Session2(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-rose-650 focus:ring-rose-500 bg-white border-neutral-300 transition"
                        />
                        <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-wider">
                          {lang === 'ID' ? '🌙 Sesi Tidur Tambahan (Bila Terbangun)' : '🌙 Additional Sleep Session (If Interrupted/Woken Up)'}
                        </span>
                      </label>

                      {hasSleep36Session2 && (
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-neutral-200">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Tidur Sesi 2' : 'Bedtime (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep36Session2Bed}
                              onChange={(e) => setSleep36Session2Bed(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'Jam Bangun Sesi 2' : 'Wake-up (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep36Session2Wake}
                              onChange={(e) => setSleep36Session2Wake(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono text-xs py-2 px-3 text-center outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EXTRA RISK ASSESSMENTS */}
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex flex-col gap-3.5 shadow-xs">
                    <h3 className="text-[11px] font-extrabold text-[#7c2d12] uppercase tracking-widest border-b border-neutral-200 pb-2 flex items-center gap-2">
                      <span className="bg-rose-700 w-1.5 h-3.5 rounded-sm"></span>
                      {lang === 'ID' ? 'Tambahan Informasi' : 'Additional Information'}
                    </h3>

                    {/* Consumes medication */}
                    <div className="flex flex-col gap-2 text-neutral-800">
                      <span className="text-[10px] font-extrabold text-neutral-600 uppercase tracking-wide leading-tight block">
                        💊 {lang === 'ID' ? 'Mengkonsumsi obat yang menyebabkan engantuk beberapa jam lalu?' : 'Have you consumed drowsiness-inducing medicine?'}
                      </span>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-neutral-700">
                          <input 
                            type="radio" 
                            name="obat" 
                            checked={!consumesObat} 
                            onChange={() => setConsumesObat(false)}
                            className="w-4 h-4 text-rose-600 focus:ring-rose-500" 
                          />
                          {lang === 'ID' ? 'Tidak' : 'No'}
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-neutral-700">
                          <input 
                            type="radio" 
                            name="obat" 
                            checked={consumesObat} 
                            onChange={() => setConsumesObat(true)} 
                            className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                          />
                          {lang === 'ID' ? 'Ya' : 'Yes'}
                        </label>
                      </div>
                    </div>

                    {/* Personal issue */}
                    <div className="flex flex-col gap-2 pt-3 border-t border-neutral-200">
                      <span className="text-[10px] font-extrabold text-neutral-600 uppercase tracking-wide leading-tight block">
                        🧠 {lang === 'ID' ? 'Sedang dalam Masalah Pribadi / Perasaan Tertekan (Stres)?' : 'SOP Alert: Under heavy emotional distress / stress?'}
                      </span>
                      <div className="flex gap-6 font-semibold">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-neutral-700">
                          <input 
                            type="radio" 
                            name="stress" 
                            checked={!hasPersonalProblem} 
                            onChange={() => setHasPersonalProblem(false)}
                            className="w-4 h-4 text-rose-650 focus:ring-rose-500" 
                          />
                          {lang === 'ID' ? 'Tidak' : 'No'}
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-neutral-700">
                          <input 
                            type="radio" 
                            name="stress" 
                            checked={hasPersonalProblem} 
                            onChange={() => setHasPersonalProblem(true)} 
                            className="w-4 h-4 text-rose-650 focus:ring-rose-500"
                          />
                          {lang === 'ID' ? 'Ya' : 'Yes'}
                        </label>
                      </div>
                    </div>
                  </div>

                </div>

                {/* STEP 2 ACTIONS */}
                <div className="mt-auto pt-5 grid grid-cols-12 gap-3">
                  <button 
                    type="button"
                    onClick={() => setStep(1)}
                    className="col-span-4 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 py-3.5 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase shadow-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'ID' ? 'KEMBALI' : 'BACK'}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={processCalculationsAndShowResult}
                    className="col-span-8 bg-rose-600 hover:bg-rose-500 text-white font-black py-3.5 rounded-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-200 text-xs uppercase tracking-wider"
                  >
                    <span>{lang === 'ID' ? 'LIHAT ANALISIS' : 'SOP DISPATCH'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------------------------- */}
            {/* HALAMAN 3: HASIL SCORE FATIGUE & REKOMENDASI (Dengan Share WhatsApp & Unduh Gambar) */}
            {/* ---------------------------------------------------------------------------------- */}
            {step === 3 && (
              <div className="flex-1 flex flex-col gap-4 text-neutral-800">
                <div className="pb-2 border-b border-neutral-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold tracking-wider text-rose-600 uppercase flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-650" />
                      <span>{t.h3Title}</span>
                    </h2>
                    <p className="text-[10px] text-neutral-500">{t.h3Sub}</p>
                  </div>
                  <span className="text-[9.5px] bg-neutral-100 border border-neutral-250 text-neutral-600 px-2.5 py-1 rounded font-mono font-black">
                    REPORT ID: ...{tanggalPengisian.substring(8, 10)}{jamPengisian.replace(':', '')}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[440px] pr-1.5 flex flex-col gap-4">
                  
                  {/* HIDDEN / CAPTURABLE HIGH RES REGISTER BADGE CARD (Pure Custom Styling for Capture) */}
                  <div className="p-0.5 border border-dashed border-neutral-300 rounded-2xl bg-white shadow-xs">
                    <div 
                      ref={badgeRef}
                      id="ftw-card-to-capture" 
                      className="bg-white p-6 rounded-2xl border-4 border-rose-600 flex flex-col gap-4 font-sans select-text relative overflow-hidden"
                      style={{ minWidth: '320px' }}
                    >
                      <div className="absolute -right-12 -top-12 w-28 h-28 bg-rose-100 rounded-full opacity-50"></div>
                      <div className="absolute -left-12 -bottom-12 w-28 h-28 bg-neutral-100 rounded-full opacity-50"></div>

                      {/* Card Header inside Image */}
                      <div className="flex items-center justify-between border-b pb-3 border-neutral-200">
                        <div className="flex items-center gap-2">
                          <div className="bg-rose-50 border border-rose-200 p-1 rounded">
                            <img 
                              src="https://res.cloudinary.com/dgjnlxf69/image/upload/v1790130590/Logo_FTW_ul1dz4.png" 
                              alt="Logo Fit to Work" 
                              className="h-6 w-auto object-contain"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/logo-ftw.png';
                              }}
                            />
                          </div>
                          <div>
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-900 block leading-none">PT. WAHANA BARA SENTOSA FTW Online</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-mono text-neutral-450 block uppercase font-bold">DATE ASSESSED</span>
                          <span className="text-[9.5px] font-mono font-bold text-neutral-700">{tanggalPengisian} {jamPengisian}</span>
                        </div>
                      </div>

                      {/* Employee Information in Image Card */}
                      <div className="grid grid-cols-2 gap-y-2 border-b pb-3 border-neutral-150 text-xs">
                        <div>
                          <span className="text-neutral-400 text-[8.5px] uppercase tracking-wider block font-bold">{lang === 'ID' ? 'NAMA PEKERJA' : 'NAME'}</span>
                          <span className="font-extrabold text-neutral-900 text-[12px] uppercase">{nama}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 text-[8.5px] uppercase tracking-wider block font-bold">NIK / POSITION</span>
                          <span className="font-bold text-neutral-700 text-[11px] font-mono">{nik} / {jabatan}</span>
                        </div>
                      </div>

                      {/* SCORE GAUGE AREA IN CAPTURED IMAGE */}
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-4 flex flex-col items-center justify-center">
                          {/* Beautiful simplified visual count radial badge */}
                          <div className="relative w-20 h-20 flex flex-col items-center justify-center">
                            <svg className="w-18 h-18 transform -rotate-90">
                              <circle cx="36" cy="36" r="32" fill="none" stroke="#f3f4f6" strokeWidth="5"/>
                              <circle 
                                cx="36" cy="36" r="32" fill="none" 
                                stroke={
                                  calculations.finalDecision === 'FIT' ? '#10b981' :
                                  calculations.finalDecision === 'FIT_CONDITIONAL' ? '#f59e0b' :
                                  calculations.finalDecision === 'REST_BEFORE_WORK' ? '#f97316' : '#ef4444'
                                } 
                                strokeWidth="5"
                                strokeDasharray="201"
                                strokeDashoffset={201 - (201 * calculations.readinessScore) / 100}
                              />
                            </svg>
                            <span className="absolute text-center leading-none">
                              <span className="text-base font-black font-mono text-neutral-900">{calculations.readinessScore}%</span>
                              <span className="text-[6.5px] block font-extrabold text-neutral-400 uppercase leading-none mt-0.5">Ready</span>
                            </span>
                          </div>
                        </div>

                        <div className="col-span-8 flex flex-col justify-center">
                          <span className="text-[8.5px] font-mono text-neutral-500 block font-bold uppercase">ASPEK ANALISA KEPUTUSAN</span>
                          <span className="text-[9px] text-neutral-700 font-mono mt-0.5">Skor Fatigue: <b>{calculations.totalFatigueScore}</b> / 31</span>
                          
                          {/* Highlight big tag */}
                          <div className={`mt-2 px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase inline-block text-center tracking-wider max-w-fit ${
                            calculations.finalDecision === 'FIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            calculations.finalDecision === 'FIT_CONDITIONAL' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            calculations.finalDecision === 'REST_BEFORE_WORK' ? 'bg-orange-100 text-orange-850 border border-orange-200' : 
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {calculations.finalDecision === 'FIT' && '✓ FIT TO WORK'}
                            {calculations.finalDecision === 'FIT_CONDITIONAL' && '⚠ BEKERJA DALAM PENGAWASAN KHUSUS'}
                            {calculations.finalDecision === 'REST_BEFORE_WORK' && '💤 WAJIB ISTIRAHAT SEBELUM BEKERJA'}
                            {calculations.finalDecision === 'UNFIT' && '✖ TIDAK BOLEH BEKERJA'}
                          </div>
                        </div>
                      </div>

                      {/* Verification Badge Code footer */}
                      <div className="pt-2.5 border-t border-neutral-150 flex items-center justify-between text-[7px] font-mono text-neutral-450 uppercase">
                        <span>FTW-ONLINE-SHE-WBS-{tanggalPengisian.replace(/-/g,'')}</span>
                        <span className="font-extrabold text-neutral-700">ONLINE REGISTER SYNCED</span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK ACTION ROW: WHATSAPP SHARE & UNDUH GAMBAR */}
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    
                    {/* Share directly on Whatsapp */}
                    <button 
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs hover:scale-[1.01] transition-all cursor-pointer shadow-md shadow-emerald-200"
                    >
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ID' ? 'Kirim ke WhatsApp' : 'Share to WhatsApp'}</span>
                    </button>

                    {/* Download Image Card for worker badge */}
                    <button 
                      type="button"
                      onClick={handleDownloadImage}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs hover:scale-[1.01] transition-all cursor-pointer shadow-md shadow-rose-200"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ID' ? 'Unduh Gambar FTW' : 'Download Pass-Card'}</span>
                    </button>
                  </div>

                  {/* ACTION RECOMMENDATIONS LIST */}
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex flex-col gap-2 shadow-xs">
                    <h4 className="text-[10.5px] font-extrabold text-neutral-800 uppercase tracking-wider">
                      Protokol & Rekomendasi Kerja:
                    </h4>

                    {calculations.isSleepDeficit && (
                      <div className="bg-rose-50/50 border border-rose-200 p-3 rounded-lg flex gap-2.5 text-xs leading-relaxed mb-1 items-start">
                        <span className="text-base select-none shrink-0 font-sans">💤</span>
                        <div>
                          <p className="font-extrabold text-rose-800 uppercase text-[9px] tracking-wider leading-tight">
                            {lang === 'ID' ? 'REKOMENDASI DURASI ISTIRAHAT MANDATORI' : 'MANDATORY REST TIME REQUIRED'}
                          </p>
                          <p className="text-[10.5px] text-neutral-800 mt-1 font-bold leading-normal">
                            Karyawan kurang tidur sebanyak <b>{calculations.requiredRecoveryRest} jam</b>. 
                            Wajib melakukan <b>Tidur / Istirahat pemulihan mandatori selama minimal {calculations.requiredRecoveryRest} jam</b> sebelum diizinkan mengoperasikan unit critical. Hubungi pengawas untuk penjadwalan istirahat!
                          </p>
                        </div>
                      </div>
                    )}

                    <ul className="text-xs text-neutral-700 flex flex-col gap-2 pl-1 select-text">
                      <li className="flex gap-2.5 items-start">
                        <span className="text-rose-600 shrink-0 font-extrabold">•</span>
                        <span>
                          {calculations.finalDecision === 'FIT' && 'Karyawan memenuhi syarat untuk FIT TO WORK.'}
                          {calculations.finalDecision === 'FIT_CONDITIONAL' && 'Karyawan masuk dalam kategori BEKERJA DALAM PENGAWASAN KHUSUS.'}
                          {calculations.finalDecision === 'REST_BEFORE_WORK' && 'Karyawan WAJIB ISTIRAHAT SEBELUM BEKERJA.'}
                          {calculations.finalDecision === 'UNFIT' && 'Karyawan TIDAK BOLEH BEKERJA.'}
                        </span>
                      </li>

                      {consumesObat && (
                        <li className="flex gap-2.5 items-start bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-800 flex-col md:flex-row">
                          <span className="shrink-0 text-base">💊</span>
                          <div>
                            <span className="font-bold uppercase text-[9.5px] block tracking-wide text-rose-700">Rekomendasi Medikasi:</span>
                            <span className="block mt-0.5 text-xs text-neutral-800">
                              {lang === 'ID' 
                                ? 'Mengkonsumsi Obat: Efek kantuk obat berisiko tinggi. Dilarang keras mengoperasikan unit critical / alat berat selama 4 jam ke depan. Wajib lapor kepada tim SHE atau Paramedis untuk memperoleh rekomendasi kelayakan selanjutnya!' 
                                : 'Consuming Medication: Medical drowsiness safety risk. Do not operate critical machinery or heavy equipment for the next 4 hours. You are required to report to the SHE department or Paramedic to receive further fitness check recommendations.'}
                            </span>
                          </div>
                        </li>
                      )}

                      {hasPersonalProblem && (
                        <li className="flex gap-2.5 items-start bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-rose-850 flex-col md:flex-row">
                          <span className="shrink-0 text-base">🧠</span>
                          <div>
                            <span className="font-bold uppercase text-[9.5px] block tracking-wide text-rose-700">Rekomendasi Konsentrasi:</span>
                            <span className="block mt-0.5 text-xs text-neutral-800">
                              {lang === 'ID' 
                                ? 'Ada Masalah / Gangguan Fokus (Stres): Wajib dilakukan koordinasi dan pengawasan ketat oleh foreman. Karyawan wajib melakukan konseling dengan pengawas sebelum memulai pekerjaan!' 
                                : 'Personal/Stress Issues: Close supervision by field foreman is required. Employee must undergo counseling with the supervisor before executing any tasks.'}
                            </span>
                          </div>
                        </li>
                      )}

                      <li className="flex gap-2.5 items-start text-xs pt-2 border-t border-neutral-200">
                        <span className="text-neutral-500 font-mono font-bold shrink-0">R-SOP</span>
                        <span className="text-[10px] italic text-neutral-500 font-mono">
                          ID LAPORAN: {tanggalPengisian.replace(/-/g,'')}/{jamPengisian.replace(':','')} - PT. Wahana Bara Sentosa FTW Online.
                        </span>
                      </li>
                    </ul>
                  </div>

                </div>

                {/* STEP 3 ACTIONS with local database and google spreadsheet upload */}
                <div className="mt-auto pt-5 flex flex-col gap-3">
                  <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-3.5 flex gap-3 items-start shadow-xs">
                    <span className="text-emerald-700 text-base select-none mt-0.5">🔒</span>
                    <div className="flex flex-col">
                      <span className="text-emerald-800 text-[10.5px] font-black uppercase tracking-wider leading-none">
                        {lang === 'ID' ? 'Penilaian Terkirim Aman' : 'Submission Saved'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold leading-normal mt-1.5 font-sans">
                        {lang === 'ID' 
                          ? 'Seluruh data Anda telah dikirim dan tercatat dalam server monitoring Fit to Work PT. WBS secara langsung. Anda dilarang melakukan pengisian ulang ganda / manipulasi jam tidur untuk menjunjung integritas keselamatan kerja.'
                          : 'Your assessment response has been submitted and recorded permanently. You are not allowed to submit multiple entries or manipulate sleeping hours for work safety integrity.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* SYSTEM STATS FOOTER BAR */}
          <div className="bg-neutral-100 border-t border-neutral-200 px-5 py-3.5 flex justify-between items-center text-[10px] text-neutral-500 select-none rounded-b-2xl">
            <span className="font-mono tracking-widest text-neutral-600">
              SOP-SA-001 // FATIGUE MANAGEMENT
            </span>
            <span className="flex items-center gap-1.5 tracking-wide uppercase font-black text-rose-600">
              <span className="h-2 w-2 rounded-full bg-rose-600"></span>
              WBS CLOUD-READY
            </span>
          </div>

        </div>

      </div>

      {/* ---------------------------------------------------------------------------------- */}
      {/* CONFIRM SUBMISSION WITH INTEGRITY & COMPANY REGULATIONS DECLARATION MODAL */}
      {/* ---------------------------------------------------------------------------------- */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] select-none animate-fadeIn">
          <div className="bg-white rounded-2xl border-2 border-rose-600 w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-neutral-800">
            <div className="bg-rose-50 border-b border-rose-100 px-5 py-4 flex gap-3 items-center">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <h3 className="text-xs font-black text-rose-800 uppercase tracking-wider">
                  {lang === 'ID' ? 'PERNYATAAN INTEGRITAS & DISIPLIN' : 'INTEGRITY & DISCIPLINE DECLARATION'}
                </h3>
                <p className="text-[9px] text-rose-600 font-bold uppercase tracking-wider mt-0.5 leading-none">
                  {lang === 'ID' ? 'DATA TIDAK DAPAT DIUBAH SETELAH DIKIRIM' : 'DATA CANNOT BE MODIFIED AFTER SENT'}
                </p>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-neutral-700 leading-relaxed">
                {lang === 'ID' 
                  ? 'Sebelum melihat hasil analisis kelayakan kerja (Fit to Work), harap baca dan setujui peraturan integritas keselamatan berikut ini:' 
                  : 'Before proceeding to unlock your active safety assessment pass, please read and confirm the following regulations:'}
              </p>

              <div className="bg-neutral-50 border border-neutral-200. flex flex-col gap-3 p-4 rounded-xl text-xs leading-relaxed text-neutral-800 select-text">
                <div className="flex gap-2.5 items-start">
                  <span className="text-rose-600 font-extrabold shrink-0">•</span>
                  <span>
                    <b>{lang === 'ID' ? 'Pernyataan Sebenarnya:' : 'Declaration of Truth:'}</b>{' '}
                    {lang === 'ID' 
                      ? 'Saya menyatakan dengan sebenar-benarnya bahwa seluruh data jam tidur, konsumsi obat, dan kesiapan fokus yang diisi adalah data yang jujur sesuai kondisi nyata yang saya alami.'
                      : 'I solemnly declare and testify that all sleeping hours, medications, and mental focus levels entered are true and represent my actual condition.'}
                  </span>
                </div>

                <div className="flex gap-2.5 items-start">
                  <span className="text-rose-600 font-extrabold shrink-0">•</span>
                  <span>
                    <b>{lang === 'ID' ? 'Sanksi Peraturan Perusahaan:' : 'Company Regulation Actions:'}</b>{' '}
                    <span className="text-rose-700 font-bold">
                      {lang === 'ID' 
                        ? 'Apabila saya memberikan data yang tidak benar atau memanipulasi informasi, maka saya bersedia diberikan sanksi kedisiplinan sesuai Peraturan Perusahaan PT. Wahana Bara Sentosa.'
                        : 'Any false representation of safety and sleep data will subject me to strict disciplinary actions in accordance with the Company Regulations of PT. Wahana Bara Sentosa.'}
                    </span>
                  </span>
                </div>

                <div className="flex gap-2.5 items-start pt-2 border-t border-dashed border-neutral-300">
                  <span className="text-neutral-500 font-extrabold shrink-0">🔒</span>
                  <span className="text-[10px] text-neutral-500 italic">
                    {lang === 'ID'
                      ? 'Data Anda akan disinkronisasikan ke sistem K3 dan lembar backup data admin, dan tidak dapat diedit ulang.'
                      : 'This record will be sealed in the safety database and admin Sheets backup; it cannot be edited or resubmitted today.'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleConfirmAndSubmitAssessment}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-4 px-4 rounded-xl text-xs uppercase tracking-wider shadow-md hover:scale-[1.01] transition-all cursor-pointer text-center"
                >
                  {lang === 'ID' ? '✓ SAYA SETUJU & KIRIM' : '✓ I AGREE & SUBMIT'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmSubmitModal(false)}
                  className="w-full bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  {lang === 'ID' ? 'Batal / Periksa Kembali' : 'Cancel / Verify Input'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------------------- */}
      {/* HISTORICAL REGISTRY OUTS OVERLAY PANEL */}
      {/* ---------------------------------------------------------------------------------- */}
      {showHistoryOverlay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 select-none animate-fadeIn">
          <div className="bg-white rounded-2xl border border-neutral-200 w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl overflow-hidden text-neutral-800">
            
            {/* Drawer Header */}
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-neutral-950 uppercase flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>{lang === 'ID' ? 'Arsip Database Penilaian' : 'Shift Fatigue Registry logs'}</span>
                </h3>
                <p className="text-[10px] text-neutral-500">PT. WAHANA BARA SENTOSA</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowHistoryOverlay(false)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 py-1.5 px-3 border border-neutral-300 rounded-lg font-black cursor-pointer text-xs transition"
              >
                ✖
              </button>
            </div>

            {/* Filter Search Field */}
            <div className="px-5 py-3.5 bg-white border-b border-neutral-150 flex flex-col sm:flex-row gap-2.5 items-center">
              <label className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider shrink-0">
                {lang === 'ID' ? 'Cari NIK Karyawan:' : 'Search Employee NIK:'}
              </label>
              <div className="relative w-full">
                <input 
                  type="text"
                  className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-3 pl-8 text-xs font-mono uppercase text-neutral-900 outline-none focus:ring-1 focus:ring-rose-500 font-bold"
                  placeholder={lang === 'ID' ? 'Masukkan NIK untuk filter...' : 'Enter NIK to filter...'}
                  value={historyNikFilter}
                  onChange={(e) => setHistoryNikFilter(e.target.value)}
                />
                <span className="absolute left-2.5 top-2.5 text-neutral-400 font-mono text-[10px]">🔍</span>
              </div>
              {historyNikFilter && (
                <button 
                  type="button" 
                  onClick={() => setHistoryNikFilter('')}
                  className="text-[10px] text-rose-600 hover:underline shrink-0 font-extrabold uppercase tracking-tight"
                >
                  {lang === 'ID' ? 'Reset' : 'Clear'}
                </button>
              )}
            </div>

            {/* List entries */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3.5 bg-neutral-50">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-300 rounded-xl bg-white shadow-xs">
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-xs uppercase font-extrabold text-neutral-600">
                    {lang === 'ID' ? 'Arsip Tidak Ditemukan' : 'Records Not Found'}
                  </p>
                  <p className="text-[10px] text-neutral-450 mt-1">
                    {historyNikFilter 
                      ? (lang === 'ID' ? `Tidak ada pengisian untuk NIK: "${historyNikFilter.toUpperCase()}"` : `No records match NIK: "${historyNikFilter.toUpperCase()}"`) 
                      : (lang === 'ID' ? 'Lakukan penilaian dan klik simpan.' : 'Run assessment and click save.')
                    }
                  </p>
                </div>
              ) : (
                filteredHistory.map((record) => (
                  <div key={record.id} className="bg-white border border-neutral-200 p-4 rounded-xl flex flex-col gap-2.5 relative shadow-xs">
                    
                    {/* Top Row ID */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9.5px] font-mono text-neutral-500 block uppercase font-bold">
                          {record.tanggalPengisian} • {record.jamPengisian} • ID: {record.id}
                        </span>
                        <span className="text-sm font-black text-neutral-900 block uppercase mt-0.5">{record.nama}</span>
                        <span className="text-[10px] font-mono text-neutral-550 block font-bold mt-0.5">{record.nik} • {record.jabatan}</span>
                      </div>
                      
                      {/* Decision pill */}
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase text-center ${
                        record.finalDecision === 'FIT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                        record.finalDecision === 'FIT_CONDITIONAL' ? 'bg-amber-50 text-amber-700 border border-amber-250 font-bold' :
                        record.finalDecision === 'REST_BEFORE_WORK' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
                      }`}>
                        {record.finalDecision === 'FIT' && (lang === 'ID' ? 'Bekerja Normal' : 'FIT')}
                        {record.finalDecision === 'FIT_CONDITIONAL' && (lang === 'ID' ? 'Normal (Dengan Pengawasan)' : 'FIT CONDITIONAL')}
                        {record.finalDecision === 'REST_BEFORE_WORK' && (lang === 'ID' ? 'Istirahat Dahulu' : 'REST MANDATORY')}
                        {record.finalDecision === 'UNFIT' && (lang === 'ID' ? 'Tidak Boleh Bekerja' : 'UNFIT')}
                      </span>
                    </div>

                    {/* Sleep analytics breakdown */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 border-t border-b border-neutral-100 text-[10px] font-mono">
                      <div>
                        <span className="text-neutral-400 block uppercase text-[8px] font-bold">{lang === 'ID' ? 'Total Tidur' : 'TOTAL SLEEP'}</span>
                        <span className="font-extrabold text-neutral-700 mt-0.5 block">{record.totalSleep12} Jam</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block uppercase text-[8px] font-bold">{lang === 'ID' ? 'Tidur 36J' : 'SLEEP 36h'}</span>
                        <span className="font-extrabold text-neutral-700 mt-0.5 block">{record.totalSleep36} Jam</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block uppercase text-[8px] font-bold">{lang === 'ID' ? 'Fatigue Skor' : 'FATIGUE SCORE'}</span>
                        <span className="font-bold text-rose-600 mt-0.5 block">{record.totalFatigueScore}</span>
                      </div>
                    </div>

                    {/* Extras and actions */}
                    <div className="flex justify-between items-center pt-1.5">
                      <div className="flex gap-2">
                        {record.consumesObat && (
                          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border border-amber-200">💊 {lang === 'ID' ? 'Obat' : 'Meds'}</span>
                        )}
                        {record.hasPersonalProblem && (
                          <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border border-rose-200">🧠 {lang === 'ID' ? 'Stres' : 'Stress'}</span>
                        )}
                        {record.totalSleep12 < 6.0 && (
                          <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase border border-neutral-200">💤 {lang === 'ID' ? 'Low' : 'Low'}</span>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {/* Sync individually to Google sheets */}
                        {sheetsToken && spreadsheetId && (
                          <button 
                            type="button"
                            onClick={() => handlePushResultToSheets(record)}
                            className="text-[10px] font-black text-rose-600 hover:text-rose-500 uppercase transition cursor-pointer"
                          >
                            ☁️ Backup
                          </button>
                        )}

                        {/* Print/Download individual report */}
                        <button 
                          type="button"
                          onClick={() => {
                            const details = `--- LAPORAN FIT TO WORK WBS ---\nID: ${record.id}\nTanggal: ${record.tanggalPengisian} ${record.jamPengisian}\nNama: ${record.nama} (${record.nik})\nDept: ${record.dept}\n\nTotal Tidur: ${record.totalSleep12} Jam\nTidur 36 Jam: ${record.totalSleep36} Jam\nFatigue Score: ${record.totalFatigueScore}\nReadiness Score: ${record.readinessScore}%\nStatus: ${record.finalDecision === 'FIT' ? 'FIT TO WORK' : 'REPORT / UNFIT'}\n\nPT. WAHANA BARA SENTOSA`;
                            alert(details);
                          }}
                          className="text-[10px] font-bold text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded px-1.5 py-0.5 hover:bg-neutral-50 transition cursor-pointer"
                        >
                          {lang === 'ID' ? 'Cetak' : 'Detail'}
                        </button>

                        {/* Delete entry */}
                        <button 
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="text-[10px] font-bold text-rose-650 hover:text-rose-700 uppercase transition cursor-pointer"
                        >
                          {lang === 'ID' ? 'Hapus' : 'Delete'}
                        </button>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

            {/* Clear All & Bulk Sheet upload */}
            <div className="bg-neutral-100 p-3 flex justify-between items-center text-center border-t border-neutral-200 gap-2">
              {sheetsToken && spreadsheetId && history.length > 0 && (
                <button 
                  type="button"
                  onClick={handleBulkUploadHistory}
                  className="text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 cursor-pointer uppercase text-left transition"
                >
                  ☁️ Backup Semua ke Sheets
                </button>
              )}
              {history.length > 0 && (
                <button 
                  type="button"
                  onClick={async () => {
                    if (confirm(lang === 'ID' ? 'HAPUS SELURUH LOG RIWAYAT PENILAIAN DI CLOUD DAN LOKAL?' : 'PURGE ALL CLOUD AND LOCAL RECORDS PERMANENTLY?')) {
                      try {
                        await fetch('/api/history/clear', { method: 'POST' });
                      } catch (e) {
                        console.error("Failed to clear history on server", e);
                      }
                      saveToHistory([]);
                    }
                  }}
                  className="text-[10px] font-mono font-bold text-rose-600 hover:text-rose-700 uppercase ml-auto py-1 px-3 cursor-pointer"
                >
                  🗑️ Purge Semua
                </button>
              )}
            </div>

            {/* Top Close Footer */}
            <div className="p-4 bg-white text-center border-t border-neutral-200">
              <button 
                type="button"
                onClick={() => setShowHistoryOverlay(false)}
                className="w-full bg-neutral-800 hover:bg-neutral-950 font-bold py-2 px-6 rounded-lg text-xs cursor-pointer text-white transition uppercase tracking-wider"
              >
                {lang === 'ID' ? 'Kembali Ke Menu Utama' : 'Close Registry Logs'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------------------- */}
      {/* ADMIN CONTROL PANEL OVERLAY */}
      {/* ---------------------------------------------------------------------------------- */}
      {showAdminOverlay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn text-neutral-800">
          <div className="bg-white rounded-2xl border border-neutral-200 w-full max-w-4xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-rose-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-rose-800 p-2 rounded-lg border border-rose-700">
                  <ShieldAlert className="w-5 h-5 text-rose-100 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider leading-none">
                    {lang === 'ID' ? 'Pusat Kendali Admin' : 'Admin Control Center'}
                  </h3>
                  <p className="text-[10px] text-rose-200 font-bold mt-1 uppercase tracking-tight">
                    PT. WAHANA BARA SENTOSA
                  </p>
                </div>
              </div>
              
              {isAdminAuthenticated ? (
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdminAuthenticated(false);
                      sessionStorage.removeItem('wbs_admin_auth');
                      setAdminUsernameInput('');
                      setAdminPasswordInput('');
                    }}
                    className="bg-rose-950 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-800 rounded-lg py-1 px-2.5 font-bold text-[10.5px] cursor-pointer transition shadow-sm uppercase tracking-wider"
                  >
                    🚪 Logout
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAdminOverlay(false);
                      setEditingEmpNik(null);
                      setSelectedDashboardRecordId(null);
                    }}
                    className="bg-rose-800 hover:bg-rose-750 text-white border border-rose-600 rounded-lg py-1 px-2.5 font-bold text-[10.5px] cursor-pointer transition shadow-sm uppercase tracking-wider"
                  >
                    ✕ Close
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => {
                    setShowAdminOverlay(false);
                    setEditingEmpNik(null);
                    setSelectedDashboardRecordId(null);
                  }}
                  className="bg-rose-800 hover:bg-rose-700 text-white border border-rose-600 rounded-lg py-1.5 px-3 font-semibold text-xs cursor-pointer transition shadow-sm"
                >
                  ✕ Close
                </button>
              )}
            </div>

            {!isAdminAuthenticated ? (
              /* SECURE LOGIN SCREEN */
              <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-neutral-50 flex items-center justify-center">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (adminUsernameInput.trim() === 'admin' && adminPasswordInput === 'wbsadmin123') {
                      setIsAdminAuthenticated(true);
                      sessionStorage.setItem('wbs_admin_auth', 'true');
                      setAdminLoginError('');
                    } else {
                      setAdminLoginError(lang === 'ID' ? 'Username atau password salah!' : 'Invalid username or password!');
                    }
                  }}
                  className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 max-w-md w-full shadow-lg"
                >
                  <div className="text-center mb-6">
                    <div className="bg-rose-50 border border-rose-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                      <ShieldAlert className="w-7 h-7 text-rose-700" />
                    </div>
                    <h4 className="text-base font-black text-neutral-900 uppercase tracking-widest">
                      {lang === 'ID' ? 'Verifikasi Keamanan' : 'Security Clearance Check'}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1">
                      {lang === 'ID' ? 'Bagian ini dilindungi sandi untuk hak akses Administrator WBS.' : 'This panel is secure and requires authorization to manage records.'}
                    </p>
                  </div>

                  {adminLoginError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-bold mb-4 text-center">
                      ⚠️ {adminLoginError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
                        {lang === 'ID' ? 'Username Pengguna:' : 'Admin Username:'}
                      </label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-2 px-3 text-xs font-bold text-neutral-900 focus:ring-1 focus:ring-rose-500 outline-none"
                        placeholder="Masukkan username..."
                        value={adminUsernameInput}
                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
                        Password:
                      </label>
                      <input 
                        type="password"
                        required
                        className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-2 px-3 text-xs font-mono font-bold text-neutral-900 focus:ring-1 focus:ring-rose-500 outline-none"
                        placeholder="••••••••"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                      />
                    </div>



                    <button
                      type="submit"
                      className="w-full bg-rose-700 hover:bg-rose-800 text-white font-black py-2.5 px-4 rounded-lg text-xs cursor-pointer text-center uppercase tracking-widest transition shadow-sm"
                    >
                      🔓 {lang === 'ID' ? 'Masuk Panel Admin' : 'Authorize & Unlock'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* AUTHENTICATED ADMIN DASHBOARD & SYSTEM CONTROLS */
              <>
                {/* Tab segment buttons */}
                <div className="bg-neutral-50 px-6 py-2 border-b border-neutral-200 flex items-center gap-1.5 shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('dashboard')}
                    className={`py-2 px-3 rounded-lg font-black text-[11px] uppercase tracking-wider cursor-pointer transition shrink-0 ${
                      adminActiveTab === 'dashboard' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-250'
                    }`}
                  >
                    📊 Fit to Work Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('employees')}
                    className={`py-2 px-3 rounded-lg font-black text-[11px] uppercase tracking-wider cursor-pointer transition shrink-0 ${
                      adminActiveTab === 'employees' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-250'
                    }`}
                  >
                    👥 {lang === 'ID' ? 'Karyawan Aktif' : 'Employee Database'} ({Object.keys(employeeDb).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('sheets_sync')}
                    className={`py-2 px-3 rounded-lg font-black text-[11px] uppercase tracking-wider cursor-pointer transition shrink-0 ${
                      adminActiveTab === 'sheets_sync' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-250'
                    }`}
                  >
                    🟢 Google Sheets Integration
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('firebase_backup')}
                    className={`py-2 px-3 rounded-lg font-black text-[11px] uppercase tracking-wider cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                      adminActiveTab === 'firebase_backup' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-250'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>🔥 Firebase Cloud Backup</span>
                  </button>
                </div>

                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-neutral-50">
                  
                  {/* TAB 1: INTERACTIVE FATIGUE & FIT TO WORK DASHBOARD */}
                  {adminActiveTab === 'dashboard' && (() => {
                    // Gather records matching filters
                    const filteredRecords = history.filter(record => {
                      // 1. Date filters
                      if (adminFilterStartDate && record.tanggalPengisian < adminFilterStartDate) {
                        return false;
                      }
                      if (adminFilterEndDate && record.tanggalPengisian > adminFilterEndDate) {
                        return false;
                      }
                      
                      // 2. Shift filters
                      if (adminFilterShift !== 'ALL') {
                        const isDayShift = checkIsDayShift(record.jamPengisian);
                        if (adminFilterShift === 'DAY' && !isDayShift) return false;
                        if (adminFilterShift === 'NIGHT' && isDayShift) return false;
                      }

                      // 3. Status filters
                      if (adminFilterStatus === 'PROBLEMATIC') {
                        return record.finalDecision !== 'FIT';
                      } else if (adminFilterStatus !== 'ALL') {
                        return record.finalDecision === adminFilterStatus;
                      }

                      return true;
                    });

                    // Stats breakdown
                    const totalCount = filteredRecords.length;
                    const fitCount = filteredRecords.filter(r => r.finalDecision === 'FIT').length;
                    const fitCondCount = filteredRecords.filter(r => r.finalDecision === 'FIT_CONDITIONAL').length;
                    const restCount = filteredRecords.filter(r => r.finalDecision === 'REST_BEFORE_WORK').length;
                    const unfitCount = filteredRecords.filter(r => r.finalDecision === 'UNFIT').length;
                    const problematicCount = totalCount - fitCount;

                    return (
                      <div className="flex flex-col gap-6">
                        
                        {/* Interactive Toolbar Filter */}
                        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
                          <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <span>🔍</span>
                            <span>{lang === 'ID' ? 'Penyaringan Periode, Status & Shift Karyawan' : 'Filter Period, Status & Employee Shift'}</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wide">
                                {lang === 'ID' ? 'Tanggal Mulai:' : 'Start Date:'}
                              </label>
                              <input 
                                type="date"
                                className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2.5 text-xs font-bold text-neutral-900"
                                value={adminFilterStartDate}
                                onChange={(e) => setAdminFilterStartDate(e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wide">
                                {lang === 'ID' ? 'Tanggal Selesai:' : 'End Date:'}
                              </label>
                              <input 
                                type="date"
                                className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2.5 text-xs font-bold text-neutral-900"
                                value={adminFilterEndDate}
                                onChange={(e) => setAdminFilterEndDate(e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wide">
                                {lang === 'ID' ? 'Pilih Shift:' : 'Filter Shift:'}
                              </label>
                              <select 
                                className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-bold text-neutral-900 outline-none cursor-pointer focus:ring-1 focus:ring-rose-500"
                                value={adminFilterShift}
                                onChange={(e) => setAdminFilterShift(e.target.value as any)}
                              >
                                <option value="ALL">{lang === 'ID' ? '🟢 Semua Shift' : 'All Shifts'}</option>
                                <option value="DAY">{lang === 'ID' ? '☀️ Shift Siang (Input 01:00 - 07:00)' : 'Day Shift (Input 01:00 - 07:00)'}</option>
                                <option value="NIGHT">{lang === 'ID' ? '🌙 Shift Malam (Input 13:00 - 19:00)' : 'Night Shift (Input 13:00 - 19:00)'}</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wide">
                                {lang === 'ID' ? 'Status Kelayakan:' : 'Fitness Status:'}
                              </label>
                              <select 
                                className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-bold text-neutral-950 outline-none cursor-pointer focus:ring-1 focus:ring-rose-500 font-extrabold"
                                value={adminFilterStatus}
                                onChange={(e) => setAdminFilterStatus(e.target.value as any)}
                              >
                                <option value="PROBLEMATIC">⚠️ {lang === 'ID' ? 'Hanya Bermasalah (Kurang/Tidak Fit)' : 'Problematic / Kurang Fit Only'}</option>
                                <option value="ALL">📋 {lang === 'ID' ? 'Semua Status (Seluruh Laporan)' : 'All Status (Show All)'}</option>
                                <option value="FIT">🟢 FIT TO WORK</option>
                                <option value="FIT_CONDITIONAL">🟡 BEKERJA DALAM PENGAWASAN KHUSUS</option>
                                <option value="REST_BEFORE_WORK">🟠 WAJIB ISTIRAHAT SEBELUM BEKERJA</option>
                                <option value="UNFIT">🔴 TIDAK BOLEH BEKERJA</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-3.5 flex justify-between items-center bg-neutral-50 border border-neutral-200/60 p-2 rounded-lg">
                            <span className="text-[10px] text-neutral-500 font-semibold">
                              * {lang === 'ID' ? 'Kriteria Shift dinilai berdasarkan jam pengisian sertifikat laporan secara tepat.' : 'Shift determined based on the exact submission timestamp hour.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdminFilterStartDate('');
                                setAdminFilterEndDate('');
                                setAdminFilterShift('ALL');
                                setAdminFilterStatus('PROBLEMATIC');
                              }}
                              className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-black uppercase py-1 px-3 border border-neutral-300 rounded cursor-pointer transition shadow-sm"
                            >
                              🔄 Clear Filters
                            </button>
                          </div>
                        </div>

                        {/* Summary Widget Badge Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="bg-white border border-neutral-200 rounded-xl p-3 text-center shadow-xs">
                            <span className="block text-[9px] font-black text-neutral-500 uppercase tracking-wider">{lang === 'ID' ? 'TOTAL PENILAIAN' : 'TOTAL FILTERED'}</span>
                            <span className="block text-xl font-mono font-black text-neutral-900 mt-1">{totalCount}</span>
                            <span className="text-[8.5px] text-neutral-400 font-bold block mt-0.5 uppercase">Laporan</span>
                          </div>

                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center shadow-xs">
                            <span className="block text-[9px] font-black text-rose-700 uppercase tracking-wider">⚠️ {lang === 'ID' ? 'BERMASALAH' : 'CURBED ISSUES'}</span>
                            <span className="block text-xl font-mono font-black text-rose-800 mt-1">{problematicCount}</span>
                            <span className="text-[8.5px] text-rose-500 font-bold block mt-0.5 uppercase">({totalCount > 0 ? Math.round((problematicCount/totalCount)*100) : 0}%) Kurang Fit</span>
                          </div>

                           <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center shadow-sm">
                             <span className="block text-[9px] font-black text-amber-700 uppercase tracking-wide">🟡 PENGAWASAN KHUSUS</span>
                             <span className="block text-base font-black text-amber-800 mt-1.5">{fitCondCount}</span>
                             <span className="text-[8px] text-amber-500 font-bold block mt-1 uppercase">Bekerja dalam Pengawasan Khusus</span>
                           </div>
 
                           <div className="bg-orange-50 border border-orange-200/80 rounded-xl p-3 text-center shadow-sm">
                             <span className="block text-[9px] font-black text-orange-700 uppercase tracking-wide">🟠 WAJIB ISTIRAHAT</span>
                             <span className="block text-base font-black text-orange-850 mt-1.5">{restCount}</span>
                             <span className="text-[8px] text-orange-500 font-bold block mt-1 uppercase">Wajib Istirahat Sebelum Bekerja</span>
                           </div>
 
                           <div className="bg-rose-100 border border-rose-200 rounded-xl p-3 text-center shadow-sm col-span-2 sm:col-span-1">
                             <span className="block text-[9px] font-black text-rose-800 uppercase tracking-wide">🔴 TIDAK BOLEH BEKERJA</span>
                             <span className="block text-base font-black text-rose-900 mt-1.5">{unfitCount}</span>
                             <span className="text-[8px] text-rose-600 font-bold block mt-1 uppercase">Dilarang Keras Bekerja harian</span>
                           </div>
                        </div>

                        {/* Table list */}
                        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
                          <div className="bg-rose-950/5 border-b border-neutral-200 px-4 py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
                            <span className="text-xs font-black text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                              <span>📊</span>
                              <span>
                                {adminFilterStatus === 'PROBLEMATIC'
                                  ? (lang === 'ID' ? 'Daftar Karyawan Kurang Fit Terdeteksi' : 'Problematic Fatigue Fit-to-Work logs')
                                  : (lang === 'ID' ? 'Semua Laporan Fatigue Terfilter' : 'All filtered fatigue records')
                                }
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleExportCSV(filteredRecords)}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-[10.5px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm tracking-wide"
                              >
                                <span>💚</span>
                                <span>{lang === 'ID' ? 'Unduh Spreadsheet (Excel/CSV)' : 'Download Spreadsheet'}</span>
                              </button>
                              <span className="bg-neutral-800 text-white text-[9px] px-2 py-1 font-mono font-bold rounded-full h-fit shrink-0">
                                {totalCount} Logs Match
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-sans">
                              <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-black uppercase text-[9.5px]">
                                  <th className="px-4 py-3 text-center">{lang === 'ID' ? 'WAKTU LAPOR' : 'DATE & TIME'}</th>
                                  <th className="px-4 py-3">{lang === 'ID' ? 'IDENTITAS KARYAWAN' : 'EMPLOYEE IDENTITY'}</th>
                                  <th className="px-3 py-3 text-center">SHIFT</th>
                                  <th className="px-4 py-3">{lang === 'ID' ? 'DETAIL JADWAL TIDUR' : '12H / 36H SLEEP'}</th>
                                  <th className="px-4 py-3">{lang === 'ID' ? 'ASPEK RISIKO' : 'RISKY METRIC'}</th>
                                  <th className="px-4 py-3 text-center">{lang === 'ID' ? 'REKOMENDASI FIT' : 'FIT DECISION'}</th>
                                  <th className="px-4 py-3 text-center">AKSI</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-150">
                                {filteredRecords.map((rec) => {
                                  // Parse shift
                                  const isDay = checkIsDayShift(rec.jamPengisian);
                                  
                                  // Sleep violation flags
                                  const sleepheroLow = rec.totalSleep12 < 6;

                                  return (
                                    <tr key={rec.id} className={`hover:bg-neutral-50/70 transition-colors ${rec.finalDecision === 'UNFIT' ? 'bg-rose-50/20' : rec.finalDecision === 'REST_BEFORE_WORK' ? 'bg-orange-50/10' : ''}`}>
                                      <td className="px-4 py-3 text-center whitespace-nowrap align-middle">
                                        <div className="font-bold text-neutral-900 font-mono text-[11px]">
                                          {rec.tanggalPengisian}
                                        </div>
                                        <div className="text-[9.5px] text-neutral-400 font-semibold mt-0.5">
                                          ⏱️ {rec.jamPengisian}
                                        </div>
                                      </td>
                                      
                                      <td className="px-4 py-3 align-middle">
                                        <div className="font-black text-neutral-900 text-xs flex items-center gap-1">
                                          <span>{rec.nama}</span>
                                          <span className="font-mono text-[9.5px] font-black text-neutral-400">({rec.nik})</span>
                                        </div>
                                        <div className="text-[10px] text-neutral-500 font-bold uppercase mt-0.5 tracking-tight">
                                          {rec.jabatan} • <span className="text-neutral-400 font-medium">{rec.dept}</span>
                                        </div>
                                      </td>

                                      <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                                        {isDay ? (
                                          <span className="inline-flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                            ☀️ SIANG
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                            🌙 MALAM
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 align-middle">
                                        <div className="text-[10.5px]">
                                          <span className="font-bold text-neutral-500">12 Jm:</span>{' '}
                                          <span className={`font-mono font-black ${sleepheroLow ? 'text-rose-600' : 'text-neutral-800'}`}>
                                            {rec.totalSleep12} Jam
                                          </span>
                                        </div>
                                        <div className="text-[10.5px] mt-0.5">
                                          <span className="font-bold text-neutral-400">36 Jm:</span>{' '}
                                          <span className="font-mono font-bold text-neutral-600">
                                            {rec.totalSleep36} Jam
                                          </span>
                                        </div>
                                      </td>

                                      <td className="px-4 py-3 align-middle">
                                        <div className="flex flex-col gap-1 max-w-[150px]">
                                          {rec.consumesObat && (
                                            <span className="text-[9.5px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.2 w-fit">
                                              💊 Obat / Meds
                                            </span>
                                          )}
                                          {rec.hasPersonalProblem && (
                                            <span className="text-[9.5px] font-bold text-red-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.2 w-fit">
                                              ⚠️ Masalah Keluarga
                                            </span>
                                          )}
                                          {rec.totalFatigueScore >= 6 ? (
                                            <span className="text-[9.5px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.2 w-fit">
                                              💤 Fatigue Score: {rec.totalFatigueScore}
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-medium text-neutral-400">✓ No risk drugs</span>
                                          )}
                                        </div>
                                      </td>

                                      <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                        {rec.finalDecision === 'FIT' ? (
                                          <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-250 font-black text-[9.5px] tracking-wide rounded-lg uppercase">
                                            🟢 FIT TO WORK
                                          </span>
                                        ) : rec.finalDecision === 'FIT_CONDITIONAL' ? (
                                          <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-255 font-black text-[9.5px] tracking-wide rounded-lg uppercase">
                                            🟡 PENGAWASAN KHUSUS
                                          </span>
                                        ) : rec.finalDecision === 'REST_BEFORE_WORK' ? (
                                          <span className="inline-block px-2.5 py-1 bg-orange-100 text-orange-850 border border-orange-200 font-black text-[9.5px] tracking-wide rounded-lg uppercase">
                                            🟠 WAJIB ISTIRAHAT
                                          </span>
                                        ) : (
                                          <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-250 font-black text-[9.5px] tracking-wide rounded-lg uppercase">
                                            🔴 TIDAK BOLEH BEKERJA
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedDashboardRecordId(rec.id)}
                                          className="bg-neutral-800 hover:bg-neutral-900 hover:scale-103 font-bold text-white text-[10px] px-2.5 py-1 rounded transition-all cursor-pointer shadow-xs uppercase tracking-tight"
                                        >
                                          🔍 DETAIL
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {filteredRecords.length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="py-16 text-center text-neutral-400 font-bold bg-neutral-50/40">
                                      {lang === 'ID' 
                                        ? 'Tidak ditemukan riwayat karyawan dengan kriteria yang Anda cari.' 
                                        : 'No employee fatigue report logs match selected date or shift parameters.'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* DETAILED DRILLDOWN MODAL OVERLAY */}
                        {selectedDashboardRecordId && (() => {
                          const det = history.find(r => r.id === selectedDashboardRecordId);
                          if (!det) return null;
                          return (
                            <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fadeIn">
                              <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-200 shadow-2xl p-5 sm:p-6 text-neutral-800 flex flex-col">
                                
                                {/* Header */}
                                <div className="border-b border-neutral-200 pb-3 mb-4 flex justify-between items-start">
                                  <div>
                                    <span className="text-[10px] bg-neutral-100 text-neutral-600 font-black px-2 py-0.5 rounded uppercase">
                                      ID REKAP: {det.id}
                                    </span>
                                    <h4 className="text-base font-black text-rose-900 uppercase mt-1 tracking-tight">
                                      🔍 DIAGNOSTIK KELELAHAN FATIGUE
                                    </h4>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDashboardRecordId(null)}
                                    className="bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-700 w-8 h-8 rounded-full flex items-center justify-center font-black cursor-pointer text-sm transition"
                                  >
                                    ✕
                                  </button>
                                </div>

                                <div className="space-y-4 text-xs font-sans">
                                  {/* Identity Card */}
                                  <div className="bg-neutral-50 border border-neutral-200 p-3.5 rounded-xl">
                                    <span className="block text-[8.5px] font-black text-neutral-500 uppercase tracking-wider mb-1.5">KARYAWAN TERKAIT:</span>
                                    <div className="text-sm font-black text-neutral-900">{det.nama}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-neutral-600 font-semibold uppercase">
                                      <div>NIK: <span className="font-mono font-bold text-neutral-800">{det.nik}</span></div>
                                      <div>DEPT: <span className="font-bold text-neutral-800">{det.dept}</span></div>
                                      <div className="col-span-2">JABATAN: <span className="font-bold text-neutral-800">{det.jabatan}</span></div>
                                    </div>
                                  </div>

                                  {/* Sleep Metrics breakdown */}
                                  <div className="border border-neutral-200 rounded-xl p-3.5">
                                    <span className="block text-[8.5px] font-black text-neutral-500 uppercase tracking-wider mb-2">DETAIL ANALISIS REKAP TIDUR:</span>
                                    
                                    <div className="space-y-2 mt-1">
                                      <div className="flex justify-between items-center text-[11px] border-b border-neutral-100 pb-1.5">
                                        <span className="font-bold text-neutral-600">Total Jam Tidur:</span>
                                        <span className={`font-mono font-black ${det.totalSleep12 < 6 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                          {det.totalSleep12} Jam {det.totalSleep12 < 6 ? '(🚨 KURANG)' : ' (Kategori Baik)'}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center text-[11px] border-b border-neutral-100 pb-1.5">
                                        <span className="font-bold text-neutral-600">Total Jam Tidur 36 Jam Terakhir:</span>
                                        <span className="font-mono font-black text-neutral-700">
                                          {det.totalSleep36} Jam
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center text-[11px] border-b border-neutral-100 pb-1.5">
                                        <span className="font-bold text-neutral-600">Fatigue Score (Skor Kelelahan):</span>
                                        <span className={`font-mono font-black ${det.totalFatigueScore >= 6 ? 'text-rose-600' : 'text-neutral-700'}`}>
                                          {det.totalFatigueScore} / 12 {det.totalFatigueScore >= 6 ? '(⚠️ TINGGI)' : ''}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-bold text-neutral-600">Kesiapan Kerja (Readiness Score):</span>
                                        <span className="font-mono font-black text-emerald-700 font-extrabold text-xs">
                                          {det.readinessScore}% Kesiapan
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Medical & Personal Problem risk section */}
                                  <div className="border border-neutral-200 rounded-xl p-3.5">
                                    <span className="block text-[8.5px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">KONTEKS TAMBAHAN RISIKO:</span>
                                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                                      <div className="bg-neutral-50/50 p-2 rounded border border-neutral-150">
                                        <span className="block text-[8px] text-neutral-500 font-bold uppercase">Konsumsi Obat Dokter:</span>
                                        <span className={`font-extrabold block mt-0.5 ${det.consumesObat ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          {det.consumesObat ? '💊 YA (RECON)' : '✓ TIDAK'}
                                        </span>
                                      </div>
                                      
                                      <div className="bg-neutral-50/50 p-2 rounded border border-neutral-150">
                                        <span className="block text-[8px] text-neutral-500 font-bold uppercase">Masalah Pribadi Keluarga:</span>
                                        <span className={`font-extrabold block mt-0.5 ${det.hasPersonalProblem ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          {det.hasPersonalProblem ? '⚠️ YA (CURBED)' : '✓ TIDAK'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Rekomendasi Follow Up */}
                                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                                    <span className="block text-[8.5px] font-mono font-black text-rose-900 uppercase tracking-wide mb-1.5">
                                      🛡️ REKOMENDASI FOLLOW UP (PT. WBS):
                                    </span>
                                    <div className="font-bold text-neutral-800 text-[11px] leading-relaxed space-y-2">
                                      {(() => {
                                        const totalSleep12 = det.totalSleep12 || 0;
                                        if (totalSleep12 < 6.0) {
                                          const deficit = parseFloat((6.0 - totalSleep12).toFixed(1));
                                          return (
                                            <p className="text-rose-800">
                                              💤 Karyawan kurang tidur sebanyak <b>{deficit} jam</b> dari standar minimal 6 jam. Rekomendasi follow up adalah <b>tidur {deficit} jam sebelum mulai bekerja</b>.
                                            </p>
                                          );
                                        } else {
                                          return (
                                            <p className="text-emerald-800">
                                              ✓ Karyawan telah memenuhi standar jam tidur minimal yaitu 6 jam harian (Total tidur: {totalSleep12} jam). Tidak diperlukan tambahan istirahat wajib.
                                            </p>
                                          );
                                        }
                                      })()}
                                      
                                      <p className="mt-1.5 text-neutral-600 border-t border-rose-100 pt-1.5 text-[10.5px]">
                                        <b>Klasifikasi Status ({det.finalDecision}):</b>{' '}
                                        {det.finalDecision === 'FIT' && 'FIT TO WORK - Karyawan layak melaksanakan tugas.'}
                                        {det.finalDecision === 'FIT_CONDITIONAL' && 'BEKERJA DALAM PENGAWASAN KHUSUS - Pengawasan ketat di lapangan oleh Foreman.'}
                                        {det.finalDecision === 'REST_BEFORE_WORK' && 'WAJIB ISTIRAHAT SEBELUM BEKERJA - Mandat wajib beristirahat tidur siang / tidur pulas.'}
                                        {det.finalDecision === 'UNFIT' && 'TIDAK BOLEH BEKERJA - Dilarang keras mengoperasikan unit atau turun ke lapangan.'}
                                      </p>
                                    </div>
                                    {(det.consumesObat || det.hasPersonalProblem) && (
                                      <div className="mt-2.5 pt-2 border-t border-rose-200 text-[10px] text-neutral-850 flex flex-col gap-1.5 leading-relaxed">
                                        {det.consumesObat && (
                                          <p>💊 <b>Rekomendasi Medikasi:</b> Mengonsumsi obat efek kantuk. Dilarang mengoperasikan unit critical / alat berat selama 4 jam ke depan. Karyawan WAJIB lapor SHE atau Paramedis.</p>
                                        )}
                                        {det.hasPersonalProblem && (
                                          <p>🧠 <b>Rekomendasi Konsentrasi:</b> Masalah stres / konsentrasi terganggu. Wajib pengawasan foreman & karyawan WAJIB konseling dengan pengawas.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                </div>

                                {/* Actions */}
                                <div className="mt-5 pt-3 border-t border-neutral-200 flex justify-end gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDashboardRecordId(null)}
                                    className="bg-neutral-950 hover:bg-black font-black text-white text-[10.5px] py-1.5 px-3 rounded uppercase tracking-wider cursor-pointer"
                                  >
                                    Kembali ke Dashboard
                                  </button>
                                </div>

                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    );
                  })()}

                  {/* TAB 2: CURRENT MANAGE KARYAWAN */}
                  {adminActiveTab === 'employees' && (
                    <div className="flex flex-col gap-6">
                      
                      {/* CONTAINER FORM & BULK IMPORT */}
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        
                        {/* TAMBAH KARYAWAN BARU FORM */}
                        <div className="lg:col-span-3 bg-white rounded-xl border border-neutral-200 p-4 shadow-sm flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>➕</span>
                              <span>{lang === 'ID' ? 'Tambah Data Karyawan Baru' : 'Add New Employee Record'}</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9.5px] font-black text-neutral-600 uppercase mb-1">NIK:</label>
                                <input 
                                  type="text"
                                  className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2.5 text-xs font-mono font-black placeholder-neutral-400 focus:ring-1 focus:ring-rose-500 text-neutral-900 uppercase"
                                  placeholder="88204911"
                                  value={newEmpNik}
                                  onChange={(e) => setNewEmpNik(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[9.5px] font-black text-neutral-600 uppercase mb-1">{lang === 'ID' ? 'Nama:' : 'Name:'}</label>
                                <input 
                                  type="text"
                                  className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2.5 text-xs font-bold placeholder-neutral-400 focus:ring-1 focus:ring-rose-500 text-neutral-900"
                                  placeholder="Aris Setiawan"
                                  value={newEmpNama}
                                  onChange={(e) => setNewEmpNama(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[9.5px] font-black text-neutral-600 uppercase mb-1">{lang === 'ID' ? 'Jabatan:' : 'Position:'}</label>
                                <input 
                                  type="text"
                                  className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2.5 text-xs font-bold placeholder-neutral-400 focus:ring-1 focus:ring-rose-500 text-neutral-900"
                                  placeholder="Operator Excavator"
                                  value={newEmpJabatan}
                                  onChange={(e) => setNewEmpJabatan(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[9.5px] font-black text-neutral-600 uppercase mb-1">Departemen:</label>
                                <input 
                                  type="text"
                                  className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2.5 text-xs font-bold placeholder-neutral-400 focus:ring-1 focus:ring-rose-500 text-neutral-900"
                                  placeholder="Produksi"
                                  value={newEmpDept}
                                  onChange={(e) => setNewEmpDept(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={handleAddEmployee}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-lg transition shadow-sm cursor-pointer uppercase tracking-wider"
                            >
                              ✔ {lang === 'ID' ? 'Simpan Karyawan' : 'Save Employee'}
                            </button>
                          </div>
                        </div>

                        {/* UPLOAD DATABASE KARYAWAN (Excel / CSV / Paste) */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-4 shadow-sm flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span>🚀</span>
                              <span>{lang === 'ID' ? 'Upload Data Karyawan' : 'Upload Employee Data'}</span>
                            </h4>
                            
                            <p className="text-[10px] text-neutral-500 mb-3 leading-relaxed">
                              {lang === 'ID' 
                                ? 'Cara paling praktis: Pilih file Excel (.xlsx/.xls) atau file CSV Anda, atau copy baris/kolom dari lembar kerja Anda lalu tempel (paste) langsung ke kotak teks di bawah.' 
                                : 'Most convenient: Select an Excel file (.xlsx/.xls) or a CSV file, or copy rows/columns from your worksheet and paste directly in the textbox below.'}
                            </p>

                            <div className="space-y-3">
                              {/* Option 1: Copy-Paste Text Area */}
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9.5px] font-black text-neutral-600 uppercase">
                                    {lang === 'ID' ? 'Paste Data Spreadsheet (NIK, Nama, Jabatan, Dept):' : 'Paste Spreadsheet Data:'}
                                  </span>
                                  {bulkPreviewData.length > 0 && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-black font-mono">
                                      {bulkPreviewData.length} Karyawan Terdeteksi
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  className="w-full bg-neutral-50 border border-neutral-250 rounded-lg p-2 text-[11px] font-mono font-medium focus:ring-1 focus:ring-rose-500 text-neutral-850"
                                  rows={4}
                                  placeholder={lang === 'ID' 
                                    ? "88204911\tAris Setiawan\tOperator\tProduksi\n88204912\tSiti Rahma\tAdmin\tFinance"
                                    : "88204911\tAris Setiawan\tOperator\tProduksi\n88204912\tSiti Rahma\tAdmin\tFinance"
                                  }
                                  value={bulkInputText}
                                  onChange={(e) => {
                                    setBulkInputText(e.target.value);
                                    handleBulkParseText(e.target.value);
                                  }}
                                />
                              </div>

                              {/* Option 2: File upload selector */}
                              <div>
                                <label className="block text-[9.5px] font-black text-neutral-600 uppercase mb-1">
                                  {lang === 'ID' ? 'Pilih File Database Karyawan (Excel/.xlsx/.xls atau .csv):' : 'Choose Employee Database File (Excel/.xlsx/.xls or .csv):'}
                                </label>
                                <input
                                  type="file"
                                  accept=".xlsx,.xls,.csv,.txt"
                                  className="w-full text-xs text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10.5px] file:font-black file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const fileName = file.name.toLowerCase();
                                      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                                        const fileReader = new FileReader();
                                        fileReader.onload = (event) => {
                                          try {
                                            const binaryData = event.target?.result;
                                            if (!binaryData) return;
                                            const workbook = XLSX.read(binaryData, { type: 'binary' });
                                            const sheetName = workbook.SheetNames[0];
                                            const sheet = workbook.Sheets[sheetName];
                                            const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                                            if (rows.length === 0) {
                                              alert(lang === 'ID' ? 'File Excel kosong!' : 'Excel file is empty!');
                                              return;
                                            }
                                            const parsed: { nik: string; nama: string; jabatan: string; dept: string }[] = [];
                                            let headerIndexMap = { nik: -1, nama: -1, jabatan: -1, dept: -1 };
                                            const firstRowCells = (rows[0] as any[] || []).map(c => String(c || '').toLowerCase().trim());
                                            firstRowCells.forEach((cell, idx) => {
                                              if (cell.includes('nik') || cell.includes('id') || cell.includes('nomor') || cell.includes('n.i.k') || cell === 'nik') headerIndexMap.nik = idx;
                                              else if (cell.includes('nama') || cell.includes('name')) headerIndexMap.nama = idx;
                                              else if (cell.includes('jabatan') || cell.includes('position') || cell.includes('role') || cell.includes('pekerjaan') || cell === 'jabatan') headerIndexMap.jabatan = idx;
                                              else if (cell.includes('dept') || cell.includes('divisi') || cell.includes('departemen') || cell.includes('section') || cell === 'dept') headerIndexMap.dept = idx;
                                            });
                                            const hasHeader = headerIndexMap.nik !== -1 || headerIndexMap.nama !== -1;
                                            const startIdx = hasHeader ? 1 : 0;
                                            if (headerIndexMap.nik === -1) headerIndexMap.nik = 0;
                                            if (headerIndexMap.nama === -1) headerIndexMap.nama = 1;
                                            if (headerIndexMap.jabatan === -1) headerIndexMap.jabatan = 2;
                                            if (headerIndexMap.dept === -1) headerIndexMap.dept = 3;
                                            for (let i = startIdx; i < rows.length; i++) {
                                              const cells = rows[i] as any[];
                                              if (!cells || cells.length === 0) continue;
                                              const rawNik = String(cells[headerIndexMap.nik] || '').trim();
                                              if (!rawNik) continue;
                                              const cleanNik = rawNik.replace(/["']/g, '').toUpperCase();
                                              const nama = String(cells[headerIndexMap.nama] || '').trim().replace(/["']/g, '');
                                              const jabatan = String(cells[headerIndexMap.jabatan] || 'Staff').trim().replace(/["']/g, '');
                                              const dept = String(cells[headerIndexMap.dept] || 'Umum').trim().replace(/["']/g, '');
                                              if (cleanNik && nama) {
                                                parsed.push({ nik: cleanNik, nama, jabatan, dept });
                                              }
                                            }
                                            setBulkPreviewData(parsed);
                                            setBulkInputText(`[Excel File: ${file.name}] - ${parsed.length} row(s) read.`);
                                          } catch (err) {
                                            console.error(err);
                                            alert(lang === 'ID' ? 'Gagal membaca file Excel ini.' : 'Failed to read this Excel file.');
                                          }
                                        };
                                        fileReader.readAsBinaryString(file);
                                      } else {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                          const text = event.target?.result as string;
                                          setBulkInputText(text);
                                          handleBulkParseText(text);
                                        };
                                        reader.readAsText(file);
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>

                            {/* Preview parsed results if any */}
                            {bulkPreviewData.length > 0 && (
                              <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-[10px] leading-relaxed max-h-24 overflow-y-auto">
                                <p className="font-bold text-neutral-600 mb-1">🔍 {lang === 'ID' ? 'Pratinjau Hasil Ekstraksi:' : 'Parsed Preview:'}</p>
                                <ul className="divide-y divide-neutral-150 font-mono text-[9px]">
                                  {bulkPreviewData.slice(0, 3).map((item, idx) => (
                                    <li key={idx} className="py-0.5 text-neutral-700">
                                      [{item.nik}] {item.nama} - {item.jabatan} ({item.dept})
                                    </li>
                                  ))}
                                  {bulkPreviewData.length > 3 && (
                                    <li className="py-0.5 text-rose-700 font-bold">
                                      ...dan {bulkPreviewData.length - 3} karyawan lainnya.
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-4 flex flex-wrap gap-2 justify-end">
                            {bulkPreviewData.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleBulkImportSave('MERGE')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-2 rounded-lg transition shadow-sm cursor-pointer uppercase tracking-wider"
                                >
                                  📥 {lang === 'ID' ? 'Gabungkan Data' : 'Merge Data'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkImportSave('OVERWRITE')}
                                  className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black px-3 py-2 rounded-lg transition shadow-sm cursor-pointer uppercase tracking-wider"
                                >
                                  💥 {lang === 'ID' ? 'Ganti Semua' : 'Overwrite All'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkInputText('');
                                    setBulkPreviewData([]);
                                  }}
                                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[11px] font-black px-3 py-2 rounded-lg transition cursor-pointer uppercase tracking-wider"
                                >
                                  {lang === 'ID' ? 'Batal' : 'Cancel'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* ACTIVE EMPLOYEE REGISTRY TABLE */}
                      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                        <div className="bg-neutral-100 border-b border-neutral-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-2">
                          <h4 className="text-xs font-black text-neutral-950 uppercase tracking-widest">
                            🗂️ {lang === 'ID' ? 'Database Karyawan Terdaftar' : 'Registered Employee Database'}
                          </h4>
                          
                          {/* Search Filter input */}
                          <div className="relative w-full sm:w-64">
                            <input 
                              type="text"
                              className="w-full bg-white border border-neutral-250 rounded-lg py-1 px-2.5 pl-7 text-[11px] font-bold text-neutral-900 uppercase"
                              placeholder={lang === 'ID' ? 'Cari NIK / NAMA...' : 'Filter by NIK / Name...'}
                              value={adminNikFilter}
                              onChange={(e) => setAdminNikFilter(e.target.value)}
                            />
                            <span className="absolute left-2 top-1.5 text-neutral-400 text-xs">🔍</span>
                          </div>
                        </div>

                        <div className="overflow-x-auto font-sans">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 uppercase font-black tracking-tight text-[10px]">
                                <th className="px-4 py-2.5 w-24">NIK</th>
                                <th className="px-4 py-2.5">{lang === 'ID' ? 'NAMA LENGKAP' : 'FULL NAME'}</th>
                                <th className="px-4 py-2.5">{lang === 'ID' ? 'JABATAN (ROLES)' : 'POSITION'}</th>
                                <th className="px-4 py-2.5">DEPT</th>
                                <th className="px-4 py-2.5 text-center w-28">TINDAKAN</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-150">
                              {Object.entries(employeeDb)
                                .filter(([nik, item]: [string, { nama: string; jabatan: string; dept: string }]) => {
                                  if (!adminNikFilter) return true;
                                  const term = adminNikFilter.toUpperCase().trim();
                                  return nik.toUpperCase().includes(term) || item.nama.toUpperCase().includes(term);
                                })
                                .map(([keyNik, item]: [string, { nama: string; jabatan: string; dept: string }]) => {
                                  const isEditing = editingEmpNik === keyNik;
                                  return (
                                    <InlineEditRow 
                                      key={keyNik}
                                      nik={keyNik}
                                      item={item}
                                      isEditing={isEditing}
                                      onStartEdit={() => setEditingEmpNik(keyNik)}
                                      onCancelEdit={() => setEditingEmpNik(null)}
                                      onSaveEdit={(namaVal, jabatanVal, deptVal) => handleSaveInlineEdit(keyNik, namaVal, jabatanVal, deptVal)}
                                      onDelete={() => handleDeleteEmployee(keyNik)}
                                      lang={lang}
                                    />
                                  );
                                })}
                              {Object.keys(employeeDb).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-12 text-center text-neutral-400 font-bold bg-neutral-50">
                                    No registered employees. Please use form above or sync with sheets.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 3: GOOGLE SHEETS INTEGRATION & SYNCHRONIZATION SUMMARY */}
                  {adminActiveTab === 'sheets_sync' && (
                    <div className="flex flex-col gap-6 animate-fadeIn text-neutral-800">
                      
                      {/* Top Header Card */}
                      <div className="bg-emerald-800 text-white rounded-xl p-5 shadow-sm border border-emerald-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3.5 font-sans">
                          <div className="bg-emerald-700/80 p-2.5 rounded-lg border border-emerald-600 shadow-xs shrink-0 flex items-center justify-center">
                            <Database className="w-6 h-6 text-emerald-100" />
                          </div>
                          <div>
                            <h4 className="text-base font-black uppercase tracking-wider leading-none">
                              {lang === 'ID' ? 'Integrasi Google Sheets & Webhook' : 'Google Sheets & Webhook Sync'}
                            </h4>
                            <p className="text-xs text-emerald-200 mt-1.5 leading-relaxed font-sans">
                              {lang === 'ID' 
                                ? 'Sinkronisasikan daftar karyawan aktif dan rekap seluruh riwayat laporan penilaian Fit to Work secara instan ke cloud spreadsheet pihak ketiga.' 
                                : 'Instantly synchronize active employee registers and export assessment reports to your cloud Google Spreadsheet database.'}
                            </p>
                          </div>
                        </div>

                        {/* Direct Link to Sheet */}
                        <a 
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-white hover:bg-neutral-50 text-emerald-800 font-extrabold py-2 px-4 rounded-lg text-xs uppercase tracking-wide self-start sm:self-center transition shadow-xs flex items-center gap-1.5 shrink-0 border border-emerald-200"
                        >
                          <span>📂 {lang === 'ID' ? 'Buka Google Sheet' : 'Open Sheet Link'}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5">Edit ↗</span>
                        </a>
                      </div>

                      {/* Main Settings Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* LEFT FORM CONFIGS */}
                        <div className="lg:col-span-7 flex flex-col gap-6">
                          
                          {/* 1. Google API Session Authentication Panel */}
                          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm font-sans">
                            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <span>🔑</span>
                              <span>{lang === 'ID' ? 'Otorisasi Keamanan Google Sheets API' : 'Google Authentication Control'}</span>
                            </h4>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-neutral-50 border border-neutral-200 p-4 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                                  sheetsToken ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'
                                }`} />
                                <div className="flex flex-col">
                                  <span className="text-[10.5px] font-extrabold uppercase leading-none text-neutral-600 block mb-1">
                                    {lang === 'ID' ? 'Status Koneksi Google' : 'Google Connection Status'}
                                  </span>
                                  <span className="text-xs font-black text-neutral-800 leading-normal">
                                    {sheetsToken 
                                      ? (lang === 'ID' ? `Terhubung sebagai: Authorized User` : `Connected: API Session Active`) 
                                      : (lang === 'ID' ? 'Hubungkan akun Google anda untuk menulis data secara aman.' : 'Disconnect / No Token Active')}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {!sheetsToken ? (
                                  <button
                                    type="button"
                                    onClick={handleSheetsLogin}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase py-2 px-4 rounded-lg tracking-wider cursor-pointer shadow-xs transition flex items-center gap-1.5"
                                  >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>{lang === 'ID' ? 'Hubungkan Akun' : 'Sign In Google'}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleSheetsLogout}
                                    className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-extrabold text-xs uppercase py-2 px-4 rounded-lg cursor-pointer transition flex items-center gap-1.5"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>{lang === 'ID' ? 'Putuskan' : 'Disconnect'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. Spreadsheet Configuration Parameters */}
                          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm flex flex-col gap-4 font-sans">
                            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-2">
                              <span>⚙️</span>
                              <span>{lang === 'ID' ? 'Parameter Target Google Sheets' : 'Spreadsheet ID & Endpoint Config'}</span>
                            </h4>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-neutral-600 uppercase tracking-wide">
                                Active Spreadsheet ID:
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-neutral-50 text-neutral-900 border border-neutral-250 rounded-lg py-2 px-2.5 text-xs font-mono font-bold"
                                  placeholder="Contoh: 15xOHL87QqqYUkwZRyNe..."
                                  value={spreadsheetId}
                                  onChange={(e) => setSpreadsheetId(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveSpreadsheetId(spreadsheetId)}
                                  className="bg-neutral-800 hover:bg-neutral-950 text-white font-extrabold text-xs uppercase py-2 px-3.5 rounded-lg cursor-pointer transition"
                                >
                                  {lang === 'ID' ? 'Simpan' : 'Save'}
                                </button>
                              </div>
                              <span className="text-[9px] text-neutral-400 font-semibold italic mt-0.5 leading-relaxed font-sans block">
                                {lang === 'ID' 
                                  ? 'ID ini digunakan untuk mengambil data karyawan dan menyimpan log rekap assessment.' 
                                  : 'This key tells the API which spreadsheet folder to access for synchronization.'}
                              </span>
                            </div>

                            {/* Auto-Template Creator Section */}
                            <div className="pt-2.5 border-t border-dashed border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-neutral-600">
                              <div>
                                <span className="font-bold text-neutral-800 block text-[11px] mb-0.5">
                                  {lang === 'ID' ? 'Inisialisasi Template Otomatis' : 'Automatic Schema Builder'}
                                </span>
                                {lang === 'ID' 
                                  ? 'Membuat file spreadsheet baru yang lengkap dengan pola template tabel PT. WBS.' 
                                  : 'Generates a fresh formatted spreadsheet with SHE default template folders.'}
                              </div>
                              <button
                                type="button"
                                onClick={handleCreateNewSpreadsheet}
                                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-[10.5px] uppercase py-2 px-3.5 rounded-lg cursor-pointer shrink-0 transition"
                              >
                                🎯 {lang === 'ID' ? 'Buat Baru & Template' : 'Generate Schema'}
                              </button>
                            </div>
                          </div>

                          {/* 3. Operational Sync Triggers */}
                          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm flex flex-col gap-4 font-sans">
                            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-2">
                              <span>🔄</span>
                              <span>{lang === 'ID' ? 'Aksi Sinkronisasi Mandatori' : 'Operational Sync Controls'}</span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Tarik karyawan */}
                              <div className="border border-neutral-150 rounded-xl p-3 bg-neutral-50/50 flex flex-col justify-between">
                                <div className="mb-3">
                                  <span className="font-extrabold text-xs text-neutral-800 block">
                                    {lang === 'ID' ? '1. Impor Database Karyawan' : '1. Sync Active Employees'}
                                  </span>
                                  <span className="text-[9.5px] text-neutral-500 font-medium leading-relaxed mt-1 block font-sans">
                                    {lang === 'ID' 
                                      ? "Mengambil kolom data pendaftaran karyawan dari worksheet 'Karyawan' ke memori sistem." 
                                      : "Pull, parsed, and verifies names & depts from 'Karyawan' sheet tab."}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSyncKaryawan()}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] uppercase py-2 rounded-lg cursor-pointer tracking-wider text-center transition shadow-xs"
                                >
                                  📥 Pull Karyawan API
                                </button>
                              </div>

                              {/* Backup Assessment */}
                              <div className="border border-neutral-150 rounded-xl p-3 bg-neutral-50/50 flex flex-col justify-between">
                                <div className="mb-3">
                                  <span className="font-extrabold text-xs text-neutral-800 block">
                                    {lang === 'ID' ? '2. Ekspor Rekap Hasil Assessment' : '2. Backup Assessment History'}
                                  </span>
                                  <span className="text-[9.5px] text-neutral-500 font-medium leading-relaxed mt-1 block font-sans">
                                    {lang === 'ID' 
                                      ? "Mengunggah seluruh daftar pengisian penilaian safety yang direkap oleh sistem ke Google Sheet 'Hasil Assessment'." 
                                      : "Appends recent recorded employee fatigue passes and status rows on cloud."}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleBulkUploadHistory}
                                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black text-[10.5px] uppercase py-2 rounded-lg cursor-pointer tracking-wider text-center transition shadow-xs"
                                >
                                  ☁️ Push Hasil Assessment
                                </button>
                              </div>
                            </div>

                            {/* Sync Webhook alternative */}
                            <div className="pt-3 border-t border-dashed border-neutral-200 flex flex-col gap-2.5">
                              <span className="font-extrabold text-[11px] text-neutral-700 block">
                                Webhook Google Apps Script Deployment URL:
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-neutral-50 text-neutral-950 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-mono focus:ring-1 focus:ring-rose-500 font-semibold"
                                  placeholder="https://script.google.com/macros/s/.../exec"
                                  value={webhookUrl}
                                  onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveWebhookUrl(webhookUrl)}
                                  className="bg-neutral-800 hover:bg-neutral-950 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg cursor-pointer transition uppercase"
                                >
                                  {lang === 'ID' ? 'Simpan' : 'Save'}
                                </button>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mt-1">
                                <span className="text-[9.5px] text-neutral-400 font-medium leading-normal italic font-sans block">
                                  {lang === 'ID' 
                                    ? 'Gunakan webhook untuk melakukan sync karyawan secara aman tanpa perlu login akun Google di perambah.' 
                                    : 'Enables quick secure sync without individual browser login or Google popup.'}
                                </span>
                                <button
                                  type="button"
                                  onClick={handleSyncKaryawanViaWebhook}
                                  className="bg-white hover:bg-neutral-50 border border-neutral-250 text-neutral-700 font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg cursor-pointer transition shrink-0 shadow-xs"
                                >
                                  ⚡ Pull via Webhook
                                </button>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* RIGHT LIVE DIAGNOSTICS & SYSTEM TERMINAL FEED */}
                        <div className="lg:col-span-5 flex flex-col gap-4">
                          
                          {/* Instructions Card info */}
                          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 shadow-sm text-xs leading-relaxed font-sans">
                            <h4 className="text-xs font-black text-neutral-800 uppercase tracking-widest mb-2 font-sans">
                              📋 {lang === 'ID' ? 'Panduan Struktur Sheet' : 'Sheet Folder Guidelines'}
                            </h4>
                            <p className="text-neutral-600 text-[11px] leading-relaxed font-sans">
                              {lang === 'ID' 
                                ? 'Spreadsheet wajib memiliki dua nama worksheet (tab) utama untuk dapat dibaca dengan benar oleh sistem Fit to Work:' 
                                : 'For this synchronization system to operate flawlessly, make sure your Spreadsheet contains these two worksheets:'}
                            </p>
                            <ul className="text-neutral-700 flex flex-col gap-2.5 pl-1.5 mt-3 select-text font-sans">
                              <li className="flex gap-2 items-start text-[11px]">
                                <span className="text-rose-600 font-extrabold shrink-0">•</span>
                                <div className="font-sans leading-normal">
                                  <b>Tab 'Karyawan':</b> {lang === 'ID' ? 'Memuat kolom NIK (A), Nama (B), Jabatan (C), dan Departemen (D).' : 'Holds columns NIK (A), Name (B), Position (C), and Dept (D).'}
                                </div>
                              </li>
                              <li className="flex gap-2 items-start text-[11px]">
                                <span className="text-rose-600 font-extrabold shrink-0">•</span>
                                <div className="font-sans leading-normal">
                                  <b>Tab 'Hasil Assessment':</b> {lang === 'ID' ? 'Tempat sistem mengunggah detail jam tidur dan status kelayakan kerja.' : 'Real-time database table for fatigue index scores and safety passes.'}
                                </div>
                              </li>
                            </ul>
                          </div>

                          {/* Rolling Logs Live Board Terminal */}
                          <div className="bg-neutral-900 border border-neutral-800 rounded-xl min-h-[250px] flex-1 flex flex-col overflow-hidden text-neutral-200 font-mono text-[10px] shadow-lg">
                            <div className="bg-neutral-950 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between shrink-0 font-sans">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                <span className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                                  SYSTEM SYNC LOGS TERMINAL
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSheetsLogs([])}
                                className="text-[8.5px] bg-neutral-800 hover:bg-neutral-700 font-bold px-2 py-0.5 rounded text-neutral-350 cursor-pointer uppercase font-mono"
                              >
                                {lang === 'ID' ? 'Bersihkan' : 'Clear'}
                              </button>
                            </div>

                            <div className="p-3.5 flex-1 overflow-y-auto flex flex-col-reverse gap-1.5 select-text leading-relaxed font-mono">
                              {sheetsLogs.length > 0 ? (
                                sheetsLogs.map((log, index) => (
                                  <div key={index} className="border-b border-neutral-800 pb-1 flex gap-2 items-start font-mono">
                                    <span className="text-emerald-500 shrink-0 select-none">▶</span>
                                    <span className="whitespace-pre-wrap font-mono">{log}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-neutral-500 italic py-12 text-center select-none font-mono">
                                  {lang === 'ID' ? '--- Konsol Diagnostik Kosong ---' : '--- Diagnostics console idle. No sync acts run. ---'}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                      </div>

                    </div>
                  )}

                  {/* TAB 4: FIREBASE CLOUD BACKUP & RESTORE */}
                  {adminActiveTab === 'firebase_backup' && (
                    <div className="max-w-5xl mx-auto space-y-5">
                      {/* Banner / Notification */}
                      {firebaseStatusMsg && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs font-bold flex items-center justify-between shadow-xs">
                          <span>{firebaseStatusMsg}</span>
                          <button
                            type="button"
                            onClick={() => setFirebaseStatusMsg('')}
                            className="text-amber-700 hover:text-amber-900 font-extrabold text-xs ml-3 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Header Card */}
                      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                              <Flame className="w-6 h-6 text-amber-200" />
                            </span>
                            <div>
                              <h3 className="text-lg font-black tracking-tight">
                                Firebase Cloud Storage & Quota Optimization
                              </h3>
                              <p className="text-xs text-amber-100 font-medium">
                                Mode Hemat Kuota & Penyimpanan Ringan Aktif untuk PT. Wahana Bara Sentosa
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20 text-xs">
                            <div className="bg-black/15 rounded-xl p-3">
                              <span className="text-[10px] text-amber-200 uppercase font-black tracking-wider block">Firebase Project</span>
                              <span className="font-mono font-bold text-white text-sm">ftw-wbs</span>
                            </div>
                            <div className="bg-black/15 rounded-xl p-3">
                              <span className="text-[10px] text-amber-200 uppercase font-black tracking-wider block">Mode Arsitektur</span>
                              <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5 mt-0.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                ⚡ HEMAT KUOTA & STORAGE
                              </span>
                            </div>
                            <div className="bg-black/15 rounded-xl p-3">
                              <span className="text-[10px] text-amber-200 uppercase font-black tracking-wider block">Target Collections</span>
                              <span className="font-mono font-bold text-white text-xs">directory, assessments</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quota & Storage Optimization Highlights */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">💡</span>
                          <div className="space-y-2 text-xs">
                            <h4 className="font-black text-emerald-950 uppercase tracking-wide text-xs">
                              Strategi Optimasi Kuota & Penyimpanan Firebase Aktif:
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-emerald-900">
                              <div className="bg-white/80 rounded-xl p-3 border border-emerald-150">
                                <div className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                                  <span>📦 1-Doc Consolidated Roster</span>
                                </div>
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                  Ratusan data karyawan dibundle ke 1 dokumen <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[10px]">/directory/roster</code>. Menghemat <b>99% kuota Read & Write</b> dibanding 1 dokumen per karyawan!
                                </p>
                              </div>
                              <div className="bg-white/80 rounded-xl p-3 border border-emerald-150">
                                <div className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                                  <span>⚡ IndexedDB Persistent Cache</span>
                                </div>
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                  Cache multi-tab browser aktif di memori lokal. Pengambilan data berulang disajikan dari browser lokal tanpa memakan kuota Read Firebase.
                                </p>
                              </div>
                              <div className="bg-white/80 rounded-xl p-3 border border-emerald-150">
                                <div className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                                  <span>📉 Payload Sanitized & Ringan</span>
                                </div>
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                  Field kosong & metadata UI dibersihkan sebelum disimpan ke Firestore, memotong ukuran penyimpanan dokumen hingga <b>70% lebih kecil</b>.
                                </p>
                              </div>
                              <div className="bg-white/80 rounded-xl p-3 border border-emerald-150">
                                <div className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                                  <span>🛑 Pencegah Lonjakan Read (1.9M)</span>
                                </div>
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                  Menghilangkan pembacaan koleksi tanpa batas di setiap refresh halaman. Query riwayat dibatasi (limit) hanya untuk data esensial terbaru.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Main Operational Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* 1. Backup / Push Data */}
                        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="p-2 bg-rose-50 text-rose-600 rounded-lg font-black text-sm">🚀</span>
                              <h4 className="font-black text-sm text-neutral-900">
                                {lang === 'ID' ? 'Backup Seluruh Data (Format Hemat)' : 'Backup All Data (Quota Saver)'}
                              </h4>
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                              {lang === 'ID'
                                ? 'Mengunggah seluruh daftar karyawan ke 1 dokumen roster hemat kuota dan riwayat assessment ringkas ke database Firestore (ftw-wbs).'
                                : 'Upload and safely backup all current active employees (1-Doc roster) and compact assessment history to Firebase Firestore.'}
                            </p>
                            
                            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-150 mb-4 space-y-1.5 text-xs">
                              <div className="flex justify-between text-neutral-600">
                                <span>Karyawan di memori:</span>
                                <span className="font-bold font-mono text-neutral-900">{Object.keys(employeeDb).length} orang</span>
                              </div>
                              <div className="flex justify-between text-neutral-600">
                                <span>Laporan riwayat di memori:</span>
                                <span className="font-bold font-mono text-neutral-900">{history.length} laporan</span>
                              </div>
                              <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-neutral-200">
                                <span>Estimasi Kuota Tulis (Writes):</span>
                                <span className="font-mono">1 Write (Roster) + {history.length} Writes</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={firebaseSyncing}
                            onClick={handleSyncAllToFirebase}
                            className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition ${
                              firebaseSyncing
                                ? 'bg-neutral-400 cursor-not-allowed'
                                : 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99]'
                            }`}
                          >
                            <Flame className="w-4 h-4 text-amber-300" />
                            <span>
                              {firebaseSyncing
                                ? (lang === 'ID' ? 'Memproses Backup...' : 'Backing up...')
                                : (lang === 'ID' ? '🚀 Backup ke Firebase Sekarang' : '🚀 Backup to Firebase Now')}
                            </span>
                          </button>
                        </div>

                        {/* 2. Pull / Restore Data */}
                        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg font-black text-sm">📥</span>
                              <h4 className="font-black text-sm text-neutral-900">
                                {lang === 'ID' ? 'Tarik Data (1-Read Roster Mode)' : 'Restore Data (1-Read Mode)'}
                              </h4>
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                              {lang === 'ID'
                                ? 'Mengambil seluruh karyawan hanya dengan 1 kali Read dari dokumen roster terpadu, plus riwayat laporan assessment esensial.'
                                : 'Fetch all employees with a single Firestore Read operation from the unified roster document, plus essential assessment history.'}
                            </p>

                            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-150 mb-4 text-xs text-neutral-600 space-y-1">
                              <div className="font-bold text-neutral-800">⚡ Efisiensi Kuota Baca (Read):</div>
                              <p className="text-[11px] text-neutral-500 leading-relaxed">
                                Mode sebelumnya menghabiskan ratusan Read setiap kali ditarik. Mode baru mengelompokkan data karyawan dalam 1 dokumen roster sehingga hanya mengonsumsi <b>1 Read</b>!
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={firebaseSyncing}
                            onClick={handleRestoreFromFirebase}
                            className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition ${
                              firebaseSyncing
                                ? 'bg-neutral-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                            }`}
                          >
                            <RefreshCw className={`w-4 h-4 ${firebaseSyncing ? 'animate-spin' : ''}`} />
                            <span>
                              {firebaseSyncing
                                ? (lang === 'ID' ? 'Memproses Data...' : 'Processing...')
                                : (lang === 'ID' ? '📥 Tarik Data dari Firebase' : '📥 Pull from Firebase')}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Storage Pruning & Cleanup Card (Hemat Kapasitas Penyimpanan) */}
                      <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg font-bold text-sm">🧹</span>
                              <h4 className="font-black text-sm text-neutral-900">
                                {lang === 'ID' ? 'Pangkas & Bersihkan Storage Riwayat Lama' : 'Prune Old History Storage'}
                              </h4>
                            </div>
                            <p className="text-xs text-neutral-600 max-w-2xl leading-relaxed">
                              {lang === 'ID'
                                ? 'Hapus laporan assessment lama dari Firebase Firestore yang sudah tidak aktif untuk mengosongkan kuota penyimpanan (Storage) agar tetap berada dalam free-tier dan database tetap ringan.'
                                : 'Delete old assessment records from Firebase Firestore to free up storage space and keep your database lightweight.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={pruneDays}
                              onChange={(e) => setPruneDays(Number(e.target.value))}
                              className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800"
                            >
                              <option value={14}>{lang === 'ID' ? '> 14 Hari Lalu' : '> 14 Days Old'}</option>
                              <option value={30}>{lang === 'ID' ? '> 30 Hari Lalu' : '> 30 Days Old'}</option>
                              <option value={60}>{lang === 'ID' ? '> 60 Hari Lalu' : '> 60 Days Old'}</option>
                              <option value={90}>{lang === 'ID' ? '> 90 Hari Lalu' : '> 90 Days Old'}</option>
                            </select>

                            <button
                              type="button"
                              disabled={isPruning}
                              onClick={handlePruneOldAssessments}
                              className={`py-2 px-4 rounded-xl font-bold text-xs text-white shadow-xs cursor-pointer transition flex items-center gap-1.5 ${
                                isPruning
                                  ? 'bg-neutral-400 cursor-not-allowed'
                                  : 'bg-amber-600 hover:bg-amber-700 active:scale-95'
                              }`}
                            >
                              <Trash2 className={`w-3.5 h-3.5 ${isPruning ? 'animate-spin' : ''}`} />
                              <span>{isPruning ? (lang === 'ID' ? 'Memangkas...' : 'Pruning...') : (lang === 'ID' ? 'Pangkas Sekarang' : 'Prune Now')}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Technical Info & Config Card */}
                      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
                        <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Database className="w-4 h-4 text-neutral-500" />
                          <span>Informasi Konfigurasi Firebase Firestore Backend</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                          <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">Auth Domain</span>
                            <span className="font-semibold text-neutral-800 break-all">ftw-wbs.firebaseapp.com</span>
                          </div>
                          <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">Storage Bucket</span>
                            <span className="font-semibold text-neutral-800 break-all">ftw-wbs.firebasestorage.app</span>
                          </div>
                          <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">Messaging Sender ID</span>
                            <span className="font-semibold text-neutral-800">558288446517</span>
                          </div>
                          <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">App ID</span>
                            <span className="font-semibold text-neutral-800 break-all text-[11px]">1:558288446517:web:f7dde6f01f4accb1163d7c</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-white text-center border-t border-neutral-200 shrink-0">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAdminOverlay(false);
                      setEditingEmpNik(null);
                      setSelectedDashboardRecordId(null);
                    }}
                    className="w-full bg-neutral-950 hover:bg-black font-bold py-2.5 px-6 rounded-lg text-xs cursor-pointer text-white transition uppercase tracking-widest text-[11px]"
                  >
                    {lang === 'ID' ? 'Kembali Ke Menu Utama' : 'Return to main panel'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
