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
  Flame,
  MessageSquare,
  Send,
  Bell,
  ExternalLink,
  TrendingUp,
  BarChart3,
  Layers,
  Eye,
  Settings,
  Sliders
} from 'lucide-react';
import { calculateHoursFromTimeStrings, validateNik, checkAssessmentAnomalies } from './utils';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import AdminTrendsAnalysis from './AdminTrendsAnalysis';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  app as firebaseApp,
  auth as firebaseAuth,
  db as firestoreDb,
  googleProvider,
  syncAssessmentToFirestore,
  deleteAssessmentFromFirestore,
  fetchAssessmentsFromFirestore,
  fetchAssessmentsSinceFromFirestore,
  fetchAssessmentsRangeFromFirestore,
  isFirestoreQuotaError,
  syncEmployeeToFirestore,
  syncEmployeesBatchToFirestore,
  deleteEmployeeFromFirestore,
  fetchEmployeesFromFirestore,
  saveRosterToFirestore,
  fetchRosterFromFirestore,
  pruneOldAssessmentsFromFirestore,
  purgeDummyEmployeesFromFirestore,
  fetchSingleEmployeeFromFirestore
} from './firebase';

// List of Google AI Studio dummy/demo employee NIKs that must be completely removed from production
export const DUMMY_NIKS_PURGE_SET = new Set([
  "88204911", // Aris Setiawan
  "A0483",    // Andi Saputra
  "A5021",    // Rina Wijaya
  "A8274",    // Budi Pratama
  "A0912",    // Siti Rahma
  "A3821",    // Dani Setiawan
  "88112233", // Guntur Wibowo
  "88556677"  // Sandi Wijaya
]);

const DEFAULT_EMPLOYEE_DB: Record<string, { nama: string; jabatan: string; dept: string }> = {};
const DEFAULT_FONNTE_TOKEN = (import.meta as any).env?.VITE_FONNTE_TOKEN || 'iNfrBRnqQj4izhPo4PKL';
const DEFAULT_WA_GROUP_ID = (import.meta as any).env?.VITE_WA_GROUP_ID || '120363042234367353@g.us';
const DEFAULT_ADMIN_PASSWORD = (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'wbsadmin123';

// In-memory fallback map if iframe sandbox blocks access to localStorage / sessionStorage
const memoryStorage = new Map<string, string>();

const safeStorage = {
  get: (key: string, fallback: string = ''): string => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {}
    return memoryStorage.get(key) ?? fallback;
  },
  set: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {}
    memoryStorage.set(key, value);
  },
  remove: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}
    memoryStorage.delete(key);
  },
  getSession: (key: string, fallback: string = ''): string => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {}
    return memoryStorage.get(`sess_${key}`) ?? fallback;
  },
  setSession: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch (e) {}
    memoryStorage.set(`sess_${key}`, value);
  },
  removeSession: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (e) {}
    memoryStorage.delete(`sess_${key}`);
  }
};

interface CustomAssessment {
  id: string;
  originalId?: string;
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
  onViewHistory?: () => void;
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
  onViewHistory,
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
      <tr className="bg-danger-50/50">
        <td className="px-4 py-2 tabular-nums font-black text-danger-950 align-middle">
          {nik}
        </td>
        <td className="px-4 py-2 align-middle">
          <input 
            type="text" 
            value={namaVal}
            onChange={(e) => setNamaVal(e.target.value)}
            className="w-full bg-white border border-ink-300 rounded px-2 py-1 text-xs font-bold text-ink-900"
          />
        </td>
        <td className="px-4 py-2 align-middle">
          <input 
            type="text" 
            value={jabatanVal}
            onChange={(e) => setJabatanVal(e.target.value)}
            className="w-full bg-white border border-ink-300 rounded px-2 py-1 text-xs font-bold text-ink-900"
          />
        </td>
        <td className="px-4 py-2 align-middle">
          <input 
            type="text" 
            value={deptVal}
            onChange={(e) => setDeptVal(e.target.value)}
            className="w-full bg-white border border-ink-300 rounded px-2 py-1 text-xs font-bold text-ink-900"
          />
        </td>
        <td className="px-4 py-2 text-center align-middle whitespace-nowrap">
          <div className="flex justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onSaveEdit(namaVal, jabatanVal, deptVal)}
              className="bg-safe-600 hover:bg-safe-700 text-white text-xs font-black py-1 px-2.5 rounded cursor-pointer"
            >
              SIMPAN
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="bg-ink-200 hover:bg-ink-300 text-ink-700 text-xs font-black py-1 px-2.5 rounded cursor-pointer border border-ink-300"
            >
              BATAL
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-ink-50/70 transition">
      <td className="px-4 py-2.5 tabular-nums font-black text-ink-900 align-middle">
        {nik}
      </td>
      <td className="px-4 py-2.5 font-bold text-ink-800 align-middle">
        {item.nama}
      </td>
      <td className="px-4 py-2.5 text-ink-600 font-medium align-middle">
        {item.jabatan}
      </td>
      <td className="px-4 py-2.5 text-ink-500 font-semibold align-middle">
        {item.dept}
      </td>
      <td className="px-4 py-2.5 text-center align-middle whitespace-nowrap">
        <div className="flex justify-center gap-1.5 font-sans">
          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="bg-info-50 hover:bg-info-100 text-info-700 text-xs border border-info-200 font-bold py-1 px-2.5 rounded transition cursor-pointer flex items-center gap-1"
              title="Lihat riwayat FTW & ID tiket karyawan ini di Dashboard"
            >
               FTW
            </button>
          )}
          <button
            type="button"
            onClick={onStartEdit}
            className="bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs border border-ink-300 font-bold py-1 px-2.5 rounded transition cursor-pointer"
          >
             Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="bg-danger-50 hover:bg-danger-100 text-danger-600 text-xs border border-danger-200 font-bold py-1 px-2.5 rounded transition cursor-pointer"
          >
             Hapus
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

// Helper for date normalization
export const normalizeDateStr = (d?: string): string => {
  if (!d) return '';
  const clean = d.trim().split(' ')[0].replace(/\//g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`; // taste-skill-ignore
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // taste-skill-ignore
    }
  }
  return clean;
};

// Helper to ensure records are strictly unique without dropping records with colliding generated IDs
export const deduplicateAssessments = (records: CustomAssessment[]): CustomAssessment[] => {
  const map = new Map<string, CustomAssessment>();
  for (const r of records) {
    if (!r) continue;
    // Normalize NIK to avoid double-counting when leading zeros vary (e.g. 0266900063 vs 266900063)
    const cleanNik = (r.nik || '').trim().replace(/^0+/, '') || (r.nik || '').trim();
    const dateStr = r.tanggalPengisian || (r.timestamp ? r.timestamp.slice(0, 10) : '');
    const timeStr = r.jamPengisian || (r.timestamp && r.timestamp.includes(' ') ? r.timestamp.split(' ')[1] : '');
    
    // An assessment is unique per employee per date per submission time
    const compositeKey = cleanNik && dateStr && timeStr
      ? `${cleanNik}__${dateStr}__${timeStr}`
      : (r.id || `${cleanNik}__${r.timestamp || Math.random()}`);

    if (!map.has(compositeKey)) {
      map.set(compositeKey, r);
    }
  }
  return Array.from(map.values());
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
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; // taste-skill-ignore
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
  const [history, setHistory] = useState<CustomAssessment[]>(() => {
    try {
      const saved = safeStorage.get('wbs_ftw_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateAssessments(parsed);
      }
    } catch (e) {}
    return [];
  });
  const [showHistoryOverlay, setShowHistoryOverlay] = useState<boolean>(false);
  const [historyNikFilter, setHistoryNikFilter] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState<boolean>(false);
  const [hasJustSubmitted, setHasJustSubmitted] = useState<boolean>(false);
  const [uiBanner, setUiBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const notifyUser = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setUiBanner({ type, text });
  };

  // Admin Dedicated Page & Navigation States
  const [isAdminPage, setIsAdminPage] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.hash === '#admin';
  });
  const [adminActiveTab, setAdminActiveTab] = useState<'dashboard' | 'employees' | 'trends' | 'integrations'>('dashboard');
  const [integrationSubTab, setIntegrationSubTab] = useState<'all' | 'fonnte_wa' | 'sheets_sync' | 'firebase_backup'>('all');

  // Trend & Frequency Analysis States
  const [trendPeriodPreset, setTrendPeriodPreset] = useState<'this_month' | 'last_month' | 'last_30_days' | 'custom'>('this_month');
  const [trendStartDate, setTrendStartDate] = useState<string>('2026-10-01');
  const [trendEndDate, setTrendEndDate] = useState<string>('2026-10-31');
  const [trendStatusFilter, setTrendStatusFilter] = useState<'ALL_ISSUES' | 'UNFIT_ONLY' | 'CONDITIONAL_ONLY' | 'REST_ONLY' | 'ALL_EMPLOYEES'>('ALL_ISSUES');
  const [trendSearchQuery, setTrendSearchQuery] = useState<string>('');
  const [trendSortBy, setTrendSortBy] = useState<'total_desc' | 'unfit_desc' | 'conditional_desc' | 'rest_desc' | 'name_asc'>('total_desc');
  const [selectedTrendEmployee, setSelectedTrendEmployee] = useState<any | null>(null);

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

  // Fonnte WhatsApp Gateway Integration States
  const [fonnteToken, setFonnteToken] = useState<string>(() => {
    return safeStorage.get('wbs_fonnte_token', DEFAULT_FONNTE_TOKEN);
  });
  const [fonnteTarget, setFonnteTarget] = useState<string>(() => {
    return safeStorage.get('wbs_fonnte_target', DEFAULT_WA_GROUP_ID);
  });
  const [fonnteEnabled, setFonnteEnabled] = useState<boolean>(() => {
    return safeStorage.get('wbs_fonnte_enabled', 'true') === 'true';
  });
  const [fonnteAlertUnfit, setFonnteAlertUnfit] = useState<boolean>(() => {
    return safeStorage.get('wbs_fonnte_alert_unfit', 'true') === 'true';
  });
  const [fonnteAlertRest, setFonnteAlertRest] = useState<boolean>(() => {
    return safeStorage.get('wbs_fonnte_alert_rest', 'true') === 'true';
  });
  const [fonnteAlertConditional, setFonnteAlertConditional] = useState<boolean>(() => {
    return safeStorage.get('wbs_fonnte_alert_conditional', 'true') === 'true';
  });
  const [fonnteTestStatus, setFonnteTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });
  const [waNotificationSent, setWaNotificationSent] = useState<boolean>(false);
  const [waNotificationStatus, setWaNotificationStatus] = useState<string>('');
  const [isSendingModalWa, setIsSendingModalWa] = useState<boolean>(false);

  // Admin Authentication States
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return safeStorage.getSession('wbs_admin_auth') === 'true';
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState<string>('');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string>('');

  // Admin Fit to Work Fatigue Dashboard States (Default status filter ALL to show all incoming submissions)
  const [adminFilterStartDate, setAdminFilterStartDate] = useState<string>('');
  const [adminFilterEndDate, setAdminFilterEndDate] = useState<string>('');
  const [adminFilterShift, setAdminFilterShift] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [adminFilterStatus, setAdminFilterStatus] = useState<'ALL' | 'PROBLEMATIC' | 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT' | 'ANOMALY'>('ALL');
  const [selectedDashboardRecordId, setSelectedDashboardRecordId] = useState<string | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');

  // Google Sheets Management States
  const [showSheetsModal, setShowSheetsModal] = useState<boolean>(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return safeStorage.get('wbs_spreadsheet_id', '15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI');
  });
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return safeStorage.get('wbs_sheets_webhook_url', '');
  });
  const [sheetsConnectionStatus, setSheetsConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'SYNCING'>('DISCONNECTED');
  const [sheetsLogs, setSheetsLogs] = useState<string[]>([]);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [logoFailed, setLogoFailed] = useState<boolean>(false);

  // Dynamic Employee Database state which updates from Google Sheets / Server API
  const [employeeDb, setEmployeeDb] = useState<Record<string, { nama: string; jabatan: string; dept: string }>>(() => {
    try {
      const localDb = safeStorage.get('wbs_sheets_employee_db');
      if (localDb) {
        const parsed = JSON.parse(localDb);
        const cleaned: Record<string, { nama: string; jabatan: string; dept: string }> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!DUMMY_NIKS_PURGE_SET.has(k)) {
            cleaned[k] = v as any;
          }
        }
        return cleaned;
      }
    } catch (e) {}
    return {};
  });

  const badgeRef = useRef<HTMLDivElement>(null);

  // States & Guards for Single-Read Cloud Lookups and Quota Safety
  const [isSearchingNikCloud, setIsSearchingNikCloud] = useState<boolean>(false);
  const queriedNiksRef = useRef<Set<string>>(new Set());
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string>('');
  const lastSyncTimestampRef = useRef<number>(0);
  const backupRunningRef = useRef<boolean>(false);
  const fetchedRangesRef = useRef<Set<string>>(new Set());

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

          if (config.fonnteToken && String(config.fonnteToken).trim()) {
            setFonnteToken(config.fonnteToken.trim());
            safeStorage.set('wbs_fonnte_token', config.fonnteToken.trim());
          }
          if (config.fonnteTarget && String(config.fonnteTarget).trim()) {
            setFonnteTarget(config.fonnteTarget.trim());
            safeStorage.set('wbs_fonnte_target', config.fonnteTarget.trim());
          }
          if (config.fonnteEnabled !== undefined) {
            setFonnteEnabled(Boolean(config.fonnteEnabled));
            safeStorage.set('wbs_fonnte_enabled', String(config.fonnteEnabled));
          }
          if (config.fonnteAlertUnfit !== undefined) {
            setFonnteAlertUnfit(Boolean(config.fonnteAlertUnfit));
            safeStorage.set('wbs_fonnte_alert_unfit', String(config.fonnteAlertUnfit));
          }
          if (config.fonnteAlertRest !== undefined) {
            setFonnteAlertRest(Boolean(config.fonnteAlertRest));
            safeStorage.set('wbs_fonnte_alert_rest', String(config.fonnteAlertRest));
          }
          if (config.fonnteAlertConditional !== undefined) {
            setFonnteAlertConditional(Boolean(config.fonnteAlertConditional));
            safeStorage.set('wbs_fonnte_alert_conditional', String(config.fonnteAlertConditional));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch server credentials", e);
      }

      const localId = safeStorage.get('wbs_spreadsheet_id', '');
      const localWebhook = safeStorage.get('wbs_sheets_webhook_url', '');

      // Fallback to designated sheet if completely clean
      const resolvedId = serverSpreadsheetId || localId || '15xOHL87QqqYUkwZRyNe3tG1riYgea3-4B6jaXFnbEfI';
      const resolvedWebhook = serverWebhookUrl || localWebhook || '';

      setSpreadsheetId(resolvedId);
      setWebhookUrl(resolvedWebhook);

      if (resolvedId) {
        safeStorage.set('wbs_spreadsheet_id', resolvedId);
      }
      if (resolvedWebhook) {
        safeStorage.set('wbs_sheets_webhook_url', resolvedWebhook);
      }

      // Self-heal: If the server configuration has missing keys, restore them from our browser cache instantly
      if (resolvedId !== serverSpreadsheetId || resolvedWebhook !== serverWebhookUrl) {
        console.log("[Self-Heal] Reviving backend server configuration from local browser state...");
        try {
          await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              spreadsheetId: resolvedId, 
              webhookUrl: resolvedWebhook,
              fonnteToken: safeStorage.get('wbs_fonnte_token', DEFAULT_FONNTE_TOKEN),
              fonnteTarget: safeStorage.get('wbs_fonnte_target', DEFAULT_WA_GROUP_ID),
              fonnteEnabled: safeStorage.get('wbs_fonnte_enabled', 'true') === 'true'
            })
          });
          // Call force-sync so the server pulls the database from the sheet right away
          await fetch('/api/sync-force', { method: 'POST' });
        } catch (syncErr) {
          console.warn("Self-healing background post failed", syncErr);
        }
      }

      // 1. Load employees DB from server API
      let loadedEmpCount = 0;
      try {
        const empResp = await fetch('/api/employees');
        if (empResp.ok) {
          const empData = await empResp.json();
          if (empData && typeof empData === 'object' && Object.keys(empData).length > 0) {
            const cleanData: Record<string, any> = {};
            for (const [k, v] of Object.entries(empData)) {
              if (!DUMMY_NIKS_PURGE_SET.has(k)) {
                cleanData[k] = v;
              }
            }
            if (Object.keys(cleanData).length > 0) {
              setEmployeeDb(cleanData);
              safeStorage.set('wbs_sheets_employee_db', JSON.stringify(cleanData));
              loadedEmpCount = Object.keys(cleanData).length;
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load employees list on startup", e);
      }

      // 2. Read from local storage if server was offline/static
      if (loadedEmpCount === 0) {
        const localSaved = safeStorage.get('wbs_sheets_employee_db');
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            const cleanLocal: Record<string, any> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (!DUMMY_NIKS_PURGE_SET.has(k)) cleanLocal[k] = v;
            }
            if (Object.keys(cleanLocal).length > 0) {
              setEmployeeDb(cleanLocal);
              safeStorage.set('wbs_sheets_employee_db', JSON.stringify(cleanLocal));
              loadedEmpCount = Object.keys(cleanLocal).length;
            }
          } catch (e) {}
        }
      }

      // CRITICAL QUOTA SAVER:
      // Only consult Firestore IF BOTH server and localStorage had zero employees (Disaster recovery only)!
      // Normal employee form visits will consume ZERO Firestore reads!
      if (loadedEmpCount === 0) {
        try {
          const firestoreEmployees = await fetchRosterFromFirestore();
          if (firestoreEmployees && Object.keys(firestoreEmployees).length > 0) {
            const cleanFs: Record<string, any> = {};
            for (const [k, v] of Object.entries(firestoreEmployees)) {
              if (!DUMMY_NIKS_PURGE_SET.has(k)) cleanFs[k] = v;
            }
            if (Object.keys(cleanFs).length > 0) {
              setEmployeeDb(cleanFs);
              safeStorage.set('wbs_sheets_employee_db', JSON.stringify(cleanFs));
            }
          }
        } catch (fbErr) {
          console.warn("[Firebase Recovery] Employees fetch warning:", fbErr);
        }
      }

      // Silently purge default dummy employees from Firestore collection in background
      purgeDummyEmployeesFromFirestore().catch(() => {});

      // 3. Load history: 1) Try Server /api/history, 2) Fallback to LocalStorage
      // CRITICAL READ SAVER: Do not query Firestore assessments collection on general user page loads!
      let historyLoaded = false;
      try {
        // Only today's records are needed for the duplicate-submission check.
        // Full history is loaded on demand by the Admin dashboard (date range).
        const todayForQuery = new Date().toISOString().split('T')[0];
        const historyResp = await fetch(`/api/history?date=${todayForQuery}`);
        if (historyResp.ok) {
          const contentType = historyResp.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await historyResp.json();
            if (Array.isArray(data) && data.length > 0) {
              const filterGarbage = (item: any) => {
                if (!item || !item.timestamp || !item.id) return false;
                const hasDateIndicator = item.timestamp.includes("-") || item.timestamp.includes("/");
                const isPureText = /^[a-zA-Z\s]+$/.test(item.timestamp);
                return hasDateIndicator && !isPureText;
              };

              const cleanServerData = data.filter(filterGarbage);
              if (cleanServerData.length > 0) {
                const uniqueData = deduplicateAssessments(cleanServerData);
                setHistory(uniqueData);
                historyLoaded = true;
                safeStorage.set('wbs_ftw_history', JSON.stringify(uniqueData.slice(0, 100)));
              }
            }
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve server history logs", e);
      }

      // Final fallback to cached history if offline
      if (!historyLoaded) {
        const saved = safeStorage.get('wbs_ftw_history');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const uniqueData = deduplicateAssessments(parsed);
              setHistory(uniqueData);
              historyLoaded = true;
            }
          } catch (err) {
            console.error(err);
          }
        }
      }

      // If still not loaded (e.g. on Vercel static hosting or brand new device with no local history):
      if (!historyLoaded) {
        try {
          const fsRecords = await fetchAssessmentsFromFirestore(100);
          if (fsRecords && fsRecords.length > 0) {
            const uniqueFs = deduplicateAssessments(fsRecords);
            setHistory(uniqueFs);
            historyLoaded = true;
            safeStorage.set('wbs_ftw_history', JSON.stringify(uniqueFs.slice(0, 100)));
          }
        } catch (e) {
          console.warn("Firestore history fallback warning:", e);
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

  // Autofill lookup when NIK changes with safe single-read cloud fallback for new employees
  useEffect(() => {
    const cleanNik = nik.trim().toUpperCase();
    if (!cleanNik) {
      setIsManualOverride(false);
      return;
    }

    // 1. Known employee from local cache -> 0 Firestore Reads!
    if (employeeDb[cleanNik]) {
      setNama(employeeDb[cleanNik].nama);
      setJabatan(employeeDb[cleanNik].jabatan);
      setDept(employeeDb[cleanNik].dept);
      setIsManualOverride(false);
      return;
    }

    // 2. Check if already queried before or too short to prevent infinite loops / wasted reads
    if (queriedNiksRef.current.has(cleanNik) || cleanNik.length < 5) {
      setIsManualOverride(true);
      return;
    }

    // 3. Debounced targeted single-read to Firestore for new/un-cached employees
    const timer = setTimeout(async () => {
      queriedNiksRef.current.add(cleanNik);
      try {
        setIsSearchingNikCloud(true);
        const cloudEmp = await fetchSingleEmployeeFromFirestore(cleanNik);
        if (cloudEmp && cloudEmp.nama) {
          setNama(cloudEmp.nama);
          setJabatan(cloudEmp.jabatan);
          setDept(cloudEmp.dept);
          setIsManualOverride(false);
          // Cache in state & memory/storage so it is never fetched again (0 reads next time)
          setEmployeeDb(prev => {
            const updated = { ...prev, [cleanNik]: cloudEmp };
            safeStorage.set('wbs_sheets_employee_db', JSON.stringify(updated));
            return updated;
          });
        } else {
          setIsManualOverride(true);
        }
      } catch (err) {
        console.warn("[Cloud NIK Lookup] Error:", err);
        setIsManualOverride(true);
      } finally {
        setIsSearchingNikCloud(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [nik, employeeDb]);

  // Function to pull real latest assessments from Firestore with bounded limit (150 docs)
  const syncAssessmentsFromCloud = async (isManualClick: boolean = false) => {
    const now = Date.now();
    // Throttle automatic syncs to at least 3 minutes apart (saves Firestore reads)
    if (!isManualClick && now - lastSyncTimestampRef.current < 180000) {
      return;
    }
    lastSyncTimestampRef.current = now;

    try {
      setIsCloudSyncing(true);
      // Incremental: only read documents newer than the newest one already in memory.
      // First sync of a session with no ISO timestamps falls back to a small bounded read.
      let newestIso = '';
      for (const r of history) {
        const t = r && r.timestamp;
        if (t && /^\d{4}-\d{2}-\d{2}T/.test(t) && t > newestIso) newestIso = t;
      }
      const cloudRecords = newestIso
        ? await fetchAssessmentsSinceFromFirestore(newestIso, 500)
        : await fetchAssessmentsFromFirestore(100);
      if (cloudRecords && cloudRecords.length > 0) {
        setHistory(prev => {
          const map = new Map<string, CustomAssessment>();
          prev.forEach(r => { if (r && r.id) map.set(r.id, r); });
          cloudRecords.forEach(r => { if (r && r.id) map.set(r.id, r); });
          const merged = Array.from(map.values());
          merged.sort((a, b) => {
            const ta = a.timestamp || `${a.tanggalPengisian} ${a.jamPengisian}` || '';
            const tb = b.timestamp || `${b.tanggalPengisian} ${b.jamPengisian}` || '';
            return tb.localeCompare(ta);
          });
          safeStorage.set('wbs_ftw_history', JSON.stringify(merged.slice(0, 100)));
          return merged;
        });
      }
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour12: false });
      setLastCloudSyncTime(timeStr);
    } catch (err) {
      console.warn("[Cloud Assessment Sync] Error:", err);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Admin date-range filter: pull the selected period on demand so older months are readable
  useEffect(() => {
    if (!isAdminPage || !isAdminAuthenticated || adminActiveTab !== 'dashboard') return;
    if (!adminFilterStartDate && !adminFilterEndDate) return;

    const rangeKey = `${adminFilterStartDate}|${adminFilterEndDate}`;
    if (fetchedRangesRef.current.has(rangeKey)) return;

    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams();
        if (adminFilterStartDate) qs.set('startDate', adminFilterStartDate);
        if (adminFilterEndDate) qs.set('endDate', adminFilterEndDate);
        const resp = await fetch(`/api/history?${qs.toString()}`);
        if (!resp.ok) return;
        fetchedRangesRef.current.add(rangeKey);
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) return;
        setHistory(prev => {
          const map = new Map<string, CustomAssessment>();
          prev.forEach(r => { if (r && r.id) map.set(r.id, r); });
          data.forEach((r: any) => { if (r && r.id && r.timestamp) map.set(r.id, r); });
          return Array.from(map.values());
        });
      } catch (err) {
        console.warn('[Admin Range Fetch] Error:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [adminFilterStartDate, adminFilterEndDate, adminActiveTab, isAdminPage, isAdminAuthenticated]);

  // Sync URL hash for dedicated Admin Page navigation
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setIsAdminPage(true);
      } else if (!window.location.hash || window.location.hash === '#') {
        setIsAdminPage(false);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Automatic sync when Admin opens the dashboard or regains browser focus
  useEffect(() => {
    if (!isAdminPage || !isAdminAuthenticated || adminActiveTab !== 'dashboard') {
      return;
    }

    // 1. Run immediate sync when admin enters the dashboard
    syncAssessmentsFromCloud(false);

    // 2. Poll every 10 minutes while looking at the dashboard (incremental reads only)
    const interval = setInterval(() => {
      if (!document.hidden) {
        syncAssessmentsFromCloud(false);
      }
    }, 600000);

    // 3. Sync on window focus if tab was in background
    const handleFocus = () => {
      if (!document.hidden) {
        syncAssessmentsFromCloud(false);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAdminPage, isAdminAuthenticated, adminActiveTab]);

  const saveToHistory = async (newHistory: CustomAssessment[], newRecord?: CustomAssessment) => {
    const uniqueHistory = deduplicateAssessments(newHistory);
    setHistory(uniqueHistory);
    safeStorage.set('wbs_ftw_history', JSON.stringify(uniqueHistory));

    // Also dispatch to central online server database
    if (newRecord) {
      try {
        const histResp = await fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newRecord),
        });
        if (histResp.ok) {
          const histData = await histResp.json();
          if (histData.waAlert?.sent) {
            setWaNotificationSent(true);
            setWaNotificationStatus(`Notifikasi WhatsApp terkirim ke grup Pengawas/HSE (${fonnteTarget || 'WBS'})`);
            addLog(`[Fonnte Auto-Alert] Berhasil kirim WA untuk ${newRecord.nama} (${newRecord.finalDecision})`);
          }
        }
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
      notifyUser(lang === 'ID' 
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
    safeStorage.set('wbs_spreadsheet_id', cleaned);
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
    safeStorage.set('wbs_sheets_webhook_url', cleaned);
    addLog(`Webhook URL disimpan: ${cleaned ? cleaned.substring(0, 35) + "..." : "KOSONG"}`);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, webhookUrl: cleaned })
      });
      addLog("Webhook URL disinkronkan ke server pusat.");
    } catch (e: any) {
      console.error("Failed to sync webhook URL to server configuration", e);
    }
  };

  // Save Fonnte WhatsApp Gateway Configuration
  const handleSaveFonnteConfig = async (
    tokenVal: string, 
    targetVal: string, 
    enabledVal: boolean,
    unfitVal: boolean,
    restVal: boolean,
    condVal: boolean
  ) => {
    const cleanToken = tokenVal.trim();
    const cleanTarget = targetVal.trim();

    setFonnteToken(cleanToken);
    setFonnteTarget(cleanTarget);
    setFonnteEnabled(enabledVal);
    setFonnteAlertUnfit(unfitVal);
    setFonnteAlertRest(restVal);
    setFonnteAlertConditional(condVal);

    safeStorage.set('wbs_fonnte_token', cleanToken);
    safeStorage.set('wbs_fonnte_target', cleanTarget);
    safeStorage.set('wbs_fonnte_enabled', String(enabledVal));
    safeStorage.set('wbs_fonnte_alert_unfit', String(unfitVal));
    safeStorage.set('wbs_fonnte_alert_rest', String(restVal));
    safeStorage.set('wbs_fonnte_alert_conditional', String(condVal));

    addLog(`[Fonnte WA] Konfigurasi disimpan (Target: ${cleanTarget || 'KOSONG'}, Status: ${enabledVal ? 'AKTIF' : 'NONAKTIF'})`);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId,
          webhookUrl,
          fonnteToken: cleanToken,
          fonnteTarget: cleanTarget,
          fonnteEnabled: enabledVal,
          fonnteAlertUnfit: unfitVal,
          fonnteAlertRest: restVal,
          fonnteAlertConditional: condVal
        })
      });
      addLog("[Fonnte WA] Konfigurasi berhasil disinkronkan ke server pusat.");
      notifyUser(lang === 'ID' ? ' Konfigurasi WhatsApp (Fonnte) berhasil disimpan!' : ' WhatsApp (Fonnte) configuration saved successfully!');
    } catch (e: any) {
      console.error("Failed to sync Fonnte config to server", e);
      addLog("[Fonnte Error] Gagal simpan ke server: " + e.message);
    }
  };

  // Universal Dual-Path Fonnte WhatsApp Message Dispatcher (Server Proxy + Direct Client CORS Fallback)
  const dispatchFonnteWAMessage = async (messageText: string, targetParam?: string, tokenParam?: string): Promise<{ success: boolean; message: string }> => {
    const cleanToken = (tokenParam || fonnteToken || DEFAULT_FONNTE_TOKEN).trim();
    const cleanTarget = (targetParam || fonnteTarget || DEFAULT_WA_GROUP_ID).trim();

    if (!cleanToken) {
      return { success: false, message: 'Token API Fonnte belum diatur. Silakan atur di Tab Integrasi WA.' };
    }
    if (!cleanTarget) {
      return { success: false, message: 'Target nomor atau ID Grup WA belum diatur.' };
    }

    // 1. Try server proxy first (Supported on Cloud Run / Node hosting)
    try {
      const resp = await fetch('/api/send-wa-fonnte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          target: cleanTarget,
          message: messageText
        })
      });

      const contentType = resp.headers.get('content-type') || '';
      // Only attempt JSON parsing if the server responded with application/json
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.success) {
          const qId = data.data?.id?.[0] ? ` (ID Antrian: ${data.data.id[0]})` : '';
          return { success: true, message: `Pesan WhatsApp berhasil dikirim ke ${cleanTarget}!${qId}` };
        } else if (data.error) {
          console.warn("[Fonnte Server Proxy Response]:", data.error);
        }
      }
    } catch (proxyErr) {
      console.warn("[Fonnte Proxy Server unreachable, switching to direct client call]:", proxyErr);
    }

    // 2. Direct browser-to-Fonnte call via CORS (Guaranteed to work on Vercel, Netlify, and static deployments)
    try {
      const params = new URLSearchParams();
      params.append('target', cleanTarget);
      params.append('message', messageText.trim());
      params.append('countryCode', '62');

      const directRes = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': cleanToken
        },
        body: params
      });

      const responseText = await directRes.text();
      let directData: any = {};
      try {
        directData = JSON.parse(responseText);
      } catch {
        directData = { raw: responseText };
      }

      if (directRes.ok && directData.status === true) {
        const qId = directData.id?.[0] ? ` (ID Antrian: ${directData.id[0]})` : '';
        return { 
          success: true, 
          message: `Pesan WhatsApp berhasil dikirim ke ${cleanTarget}!${qId}` 
        };
      } else {
        const errorReason = directData.reason || directData.message || directData.error || responseText || 'Gagal mengirim pesan melalui Fonnte';
        return { 
          success: false, 
          message: errorReason 
        };
      }
    } catch (directErr: any) {
      return { 
        success: false, 
        message: directErr.message || 'Gagal menghubungi gateway WhatsApp Fonnte.' 
      };
    }
  };

  // Helper to construct formatted alert message and dispatch for any assessment record
  const handleDispatchRecordAlert = async (record: CustomAssessment): Promise<{ success: boolean; message: string }> => {
    let statusLabel = 'Fit to Work';
    let statusIcon = '';
    let tindakan = 'Karyawan diizinkan bekerja normal sesuai standar keselamatan.';

    if (record.finalDecision === 'UNFIT') {
      statusLabel = 'UNFIT / TIDAK FIT BEKERJA';
      statusIcon = '';
      tindakan = 'Karyawan TIDAK DIIZINKAN bekerja/mengoperasikan unit. Pengawas/Supervisor wajib segera mengarahkan karyawan ke klinik/ruang istirahat dan menyiapkan operator pengganti.';
    } else if (record.finalDecision === 'REST_BEFORE_WORK') {
      statusLabel = 'BUTUH ISTIRAHAT SEBELUM BEKERJA';
      statusIcon = '';
      tindakan = 'Karyawan WAJIB istirahat tambahan sebelum bekerja. Lakukan evaluasi ulang kondisi fisik sebelum diizinkan mengoperasikan unit/alat berat.';
    } else if (record.finalDecision === 'FIT_CONDITIONAL' || record.consumesObat || record.hasPersonalProblem) {
      statusLabel = 'BUTUH Pengawasan Khusus (FIT DENGAN CATATAN)';
      statusIcon = '';
      tindakan = 'Karyawan diizinkan bekerja HANYA dengan PENGAWASAN KETAT oleh Pengawas/Supervisor shift berjalan terkait konsumsi obat/kondisi fisik.';
    }

    const message = ` *NOTIFIKASI Fit to Work (WBS)* \n━━━━━━━━━━━━━━━━━━━━━\n${statusIcon} *STATUS: ${statusLabel}*\n\n *Data Karyawan:*\n• *Nama:* ${record.nama || '-'}\n• *NIK:* ${record.nik || '-'}\n• *Departemen:* ${record.dept || '-'}\n• *Jabatan:* ${record.jabatan || '-'}\n• *Waktu Lapor:* ${record.tanggalPengisian || '-'} pukul ${record.jamPengisian || '-'}\n\n *Parameter Tidur & Kelelahan:*\n• *Total Tidur 12 Jam:* ${record.totalSleep12 ?? '-'} Jam\n• *Total Tidur 36 Jam:* ${record.totalSleep36 ?? '-'} Jam\n• *Fatigue Score:* ${record.totalFatigueScore ?? '-'} (${record.fatigueCategory || '-'})\n• *Readiness Score:* ${record.readinessScore ?? '-'}%\n\n *Catatan Khusus:*\n• *Konsumsi Obat:* ${record.consumesObat ? ' YA (Perlu Perhatian)' : 'Tidak'}\n• *Masalah Pribadi:* ${record.hasPersonalProblem ? ' YA (Berpotensi Distraksi)' : 'Tidak'}\n\n *Rekomendasi Tindakan Pengawas:*\n${tindakan}\n━━━━━━━━━━━━━━━━━━━━━\n_Sistem Fit to Work Online PT. Wahana Bara Sentosa_`;

    return await dispatchFonnteWAMessage(message);
  };

  // Test Fonnte WhatsApp Message Dispatch
  const handleTestFonnteWA = async () => {
    const cleanToken = (fonnteToken || DEFAULT_FONNTE_TOKEN).trim();
    const cleanTarget = (fonnteTarget || DEFAULT_WA_GROUP_ID).trim();

    if (!cleanToken) {
      notifyUser(lang === 'ID' ? 'Harap masukkan Token API Fonnte terlebih dahulu!' : 'Please enter Fonnte API Token first!');
      return;
    }
    if (!cleanTarget) {
      notifyUser(lang === 'ID' ? 'Harap masukkan nomor WhatsApp atau ID Grup tujuan!' : 'Please enter target phone number or WhatsApp Group ID!');
      return;
    }

    setFonnteTestStatus({ loading: true, message: undefined });
    const sampleMsg = ` *TES KONEKSI WHATSAPP (FONNTE)* \n━━━━━━━━━━━━━━━━━━━━━\nSistem *Fit to Work PT. Wahana Bara Sentosa* berhasil terhubung dengan Gateway Fonnte!\n\n *Waktu Uji:* ${new Date().toLocaleString('id-ID')}\n *Target Tujuan:* ${cleanTarget}\n *Status Gateway:* TERHUBUNG & SIAP MENGIRIM ALERT OTOMATIS\n\nNotifikasi darurat akan otomatis dikirimkan ke grup ini saat ada karyawan yang melaporkan kondisi:\n1.  *UNFIT*\n2.  *BUTUH ISTIRAHAT*\n3.  *BUTUH Pengawasan Khusus*\n━━━━━━━━━━━━━━━━━━━━━\n_Pesan uji coba otomatis sistem FTW WBS_`;

    const result = await dispatchFonnteWAMessage(sampleMsg, cleanTarget, cleanToken);
    setFonnteTestStatus({ 
      loading: false, 
      success: result.success, 
      message: result.message 
    });
    if (result.success) {
      addLog(`[Fonnte Test] ${result.message}`);
    } else {
      addLog(`[Fonnte Test Error] ${result.message}`);
    }
  };

  // Automatic Fonnte WhatsApp Notification Dispatcher for Unfit / Rest / Supervision
  const handleSendFonnteNotification = async (record: CustomAssessment) => {
    try {
      const result = await handleDispatchRecordAlert(record);
      if (result.success) {
        setWaNotificationSent(true);
        setWaNotificationStatus(`Notifikasi WhatsApp terkirim ke ${fonnteTarget || 'Grup WA'}`);
        addLog(`[Fonnte WA] Berhasil mengirim alert untuk ${record.nama} (${record.nik})`);
      } else {
        setWaNotificationStatus(`Gagal kirim WA: ${result.message}`);
        addLog(`[Fonnte WA Error] ${result.message}`);
      }
    } catch (err: any) {
      setWaNotificationStatus(`Gagal kirim WA: ${err.message}`);
      addLog(`[Fonnte WA Exception] ${err.message}`);
    }
  };

  // Create new active corporate spreadsheet with default templates
  const handleCreateNewSpreadsheet = async () => {
    if (!sheetsToken) {
      addLog(lang === 'ID' ? "Harap hubungkan akun Google Admin Anda terlebih dahulu!" : "Please login to your Google Admin account first!");
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
      safeStorage.set('wbs_spreadsheet_id', newSpreadsheetId);
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
        ["REKAPITULASI DAN DASHBOARD ANALISA HARIAN - Fit to Work"],
        ["PT. Wahana Bara Sentosa - SAFETY DIVISION"],
        [],
        ["TANGGAL MONITORING", "=TODAY()", "Ter-update secara real-time"],
        [],
        ["METRIK KESELAMATAN (SAFETY METRICS)", "JUMLAH", "PERSENTASE (%)"],
        ["Total Assessment Hari Ini", "=COUNTIF('Laporan_Fit'!B2:B5000, TODAY())", "100%"],
        ["Pekerja Fit to Work (Hijau)", "=COUNTIFS('Laporan_Fit'!B2:B5000, TODAY(), 'Laporan_Fit'!M2:M5000, \"FIT\")", "=IF(B7>0, B8/B7, 0)"],
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
      notifyUser(lang === 'ID' ? "Harap tentukan Spreadsheet ID telebih dahulu!" : "Please provide Google Spreadsheet ID first!");
      return;
    }
    if (!sheetsToken) {
      notifyUser(lang === 'ID' ? "Harap login akun Google/izin terlebih dahulu!" : "Please authorize Google Sign-In first!");
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
      notifyUser(lang === 'ID' 
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
        notifyUser(lang === 'ID' 
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
      notifyUser(lang === 'ID'
        ? `Gagal Sinkronisasi: ${e.message}\n\nPastikan Apps Script Anda sudah di-deploy dengan akses 'Anyone (Siapa Saja)' dan kode doGet/doPost sudah sesuai.`
        : `Sync Failed: ${e.message}\n\nVerify that the Web App has been deployed with access of 'Anyone' and the doGet method is correctly configured.`
      );
      setSheetsConnectionStatus('CONNECTED');
    }
  };

  // Helper to persist the modified employee DB both to local storage, the server database, and Firebase Firestore backup
  const saveEmployeeDb = async (updatedDb: Record<string, { nama: string; jabatan: string; dept: string }>) => {
    try {
      // Purge any dummy records before saving
      const cleanDb: Record<string, { nama: string; jabatan: string; dept: string }> = {};
      for (const [k, v] of Object.entries(updatedDb)) {
        if (!DUMMY_NIKS_PURGE_SET.has(k)) {
          cleanDb[k] = v;
        }
      }

      setEmployeeDb(cleanDb);
      safeStorage.set('wbs_sheets_employee_db', JSON.stringify(cleanDb));
      
      // 1. Save to Express server local storage (data/employees.json)
      try {
        const resp = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanDb)
        });
        if (!resp.ok) {
          console.warn("Notice: Server local file response:", await resp.text());
        }
      } catch (srvErr) {
        console.warn("Server API sync warning:", srvErr);
      }

      // 2. BACKUP TO FIREBASE FIRESTORE
      try {
        await syncEmployeesBatchToFirestore(cleanDb);
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
      notifyUser(lang === 'ID' ? 'Tidak ada data karyawan yang valid untuk diimpor.' : 'No valid employee data to import.');
      return;
    }

    const confirmMsg = mode === 'OVERWRITE'
      ? (lang === 'ID' 
          ? `PERINGATAN! Anda akan MENGHAPUS SEMUA (${Object.keys(employeeDb).length}) data karyawan aktif saat ini dan mengisinya dengan data baru sebanyak ${bulkPreviewData.length} karyawan?`
          : `WARNING! You are about to DELETE ALL (${Object.keys(employeeDb).length}) current active employees and replace them with ${bulkPreviewData.length} new employees. Proceed?`)
      : (lang === 'ID'
          ? `Anda akan menggabungkan/menambahkan ${bulkPreviewData.length} data karyawan ke dalam daftar aktif. Lanjutkan?`
          : `You are about to merge/add ${bulkPreviewData.length} employees to the active list. Proceed?`);

    setConfirmDialog({
      title: lang === 'ID' ? 'Konfirmasi Impor Data Karyawan' : 'Confirm Employee Import',
      message: confirmMsg,
      onConfirm: async () => {
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
          notifyUser(
            lang === 'ID'
              ? `Berhasil mengimpor ${bulkPreviewData.length} karyawan menggunakan mode ${mode}.`
              : `Imported ${bulkPreviewData.length} employees using mode ${mode}.`,
            'success'
          );
          setBulkInputText('');
          setBulkPreviewData([]);
        } else {
          notifyUser(lang === 'ID' ? 'Gagal menyimpan database karyawan ke server.' : 'Failed saving employee database.', 'error');
        }
      }
    });
  };

  const handleAddEmployee = async () => {
    if (!newEmpNik.trim() || !newEmpNama.trim() || !newEmpJabatan.trim() || !newEmpDept.trim()) {
      notifyUser(lang === 'ID' ? 'Harap lengkapi semua kolom NIK, Nama, Jabatan, dan Departemen!' : 'Please fill in all fields (NIK, Name, Position, and Department)!');
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
      notifyUser(lang === 'ID' 
        ? `Sukses! Karyawan dengan NIK ${cleanNik} (${newEmpData.nama}) berhasil ditambahkan dan disimpan ke database & cloud backup Firebase.` 
        : `Success! Employee with NIK ${cleanNik} (${newEmpData.nama}) has been added and saved to database & Firebase backup.`
      );
      // Reset input fields
      setNewEmpNik('');
      setNewEmpNama('');
      setNewEmpJabatan('');
      setNewEmpDept('');
    } else {
      notifyUser(lang === 'ID' ? 'Gagal menyimpan perubahan ke server pusat.' : 'Failed to save changes to the central server.');
    }
  };

  const handleDeleteEmployee = (nikToDelete: string) => {
    setConfirmDialog({
      title: lang === 'ID' ? 'Hapus Data Karyawan' : 'Delete Employee Record',
      message: lang === 'ID'
        ? `Apakah Anda yakin ingin menghapus karyawan dengan NIK: ${nikToDelete}?`
        : `Are you sure you want to delete employee with NIK: ${nikToDelete}?`,
      onConfirm: async () => {
        const cleanNik = nikToDelete.trim().toUpperCase();
        const nextDb = { ...employeeDb };
        delete nextDb[cleanNik];
        try {
          await deleteEmployeeFromFirestore(cleanNik);
        } catch (e) {
          console.warn("Firestore delete employee warning:", e);
        }
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
          notifyUser(lang === 'ID' ? `Karyawan NIK ${cleanNik} telah dihapus.` : `Employee ${cleanNik} deleted.`, 'info');
        } else {
          notifyUser(lang === 'ID' ? 'Gagal menghapus karyawan dari database server.' : 'Failed to delete employee from database server.', 'error');
        }
      }
    });
  };

  const handleSaveInlineEdit = async (nikToUpdate: string, namaVal: string, jabatanVal: string, deptVal: string) => {
    if (!namaVal.trim() || !jabatanVal.trim() || !deptVal.trim()) {
      notifyUser(lang === 'ID' ? 'Kolom tidak boleh kosong!' : 'Fields cannot be empty!');
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
      notifyUser(lang === 'ID' ? 'Gagal menyimpan pembaruan ke server.' : 'Failed to save updates to the server.');
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
        ? ` Berhasil membackup ${empCount} data karyawan (1 Dokumen Roster Hemat) dan ${histCount} data assessment ringkas ke Firebase Firestore!`
        : ` Successfully backed up ${empCount} employees (1-Doc Consolidated Roster) and ${histCount} lightweight assessment records to Firebase Firestore!`;
      
      setFirebaseStatusMsg(msg);
      notifyUser(msg);
    } catch (err: any) {
      console.error("Firebase sync error:", err);
      const errMsg = ` Gagal backup ke Firebase: ${err.message || err}`;
      setFirebaseStatusMsg(errMsg);
      notifyUser(errMsg);
    } finally {
      setFirebaseSyncing(false);
    }
  };

  const handleRestoreFromFirebase = async (forcedDate?: string) => {
    try {
      setFirebaseSyncing(true);
      const queryDate = forcedDate || (adminFilterStartDate ? adminFilterStartDate : undefined);
      const statusText = queryDate 
        ? (lang === 'ID' ? `Mengambil data dari Firebase Firestore untuk tanggal ${queryDate}...` : `Pulling data from Firebase Firestore for date ${queryDate}...`)
        : (lang === 'ID' ? 'Mengambil data dari Firebase Firestore...' : 'Pulling data from Firebase Firestore...');
      setFirebaseStatusMsg(statusText);

      // 1. Restore employees via consolidated single-read roster (1 Read only!)
      const fsEmployees = await fetchRosterFromFirestore();
      let empCount = 0;
      if (fsEmployees && Object.keys(fsEmployees).length > 0) {
        const mergedEmp = { ...employeeDb, ...fsEmployees };
        empCount = Object.keys(fsEmployees).length;
        await saveEmployeeDb(mergedEmp);
      }

      // 2. Restore assessments: target specific filter date if set, or get up to 500 records
      const fsAssessments = await fetchAssessmentsFromFirestore(500, queryDate);
      let histCount = 0;
      if (fsAssessments && fsAssessments.length > 0) {
        histCount = fsAssessments.length;

        // Create updated history mapping
        const histMap = new Map<string, CustomAssessment>();
        // Add current history first
        for (const item of history) {
          if (item && item.nik) {
            const key = `${item.nik}__${item.tanggalPengisian || ''}__${item.jamPengisian || ''}`;
            histMap.set(key, item);
          }
        }
        // Overwrite or insert with authoritative Firebase records
        for (const item of fsAssessments) {
          if (item && item.nik) {
            const key = `${item.nik}__${item.tanggalPengisian || ''}__${item.jamPengisian || ''}`;
            histMap.set(key, item as CustomAssessment);
          }
        }

        const mergedHist = Array.from(histMap.values());
        // Sort strictly newest-first
        mergedHist.sort((a, b) => {
          const dateA = normalizeDateStr(a.tanggalPengisian || a.timestamp || '');
          const dateB = normalizeDateStr(b.tanggalPengisian || b.timestamp || '');
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          const timeA = (a.jamPengisian || '').padStart(5, '0');
          const timeB = (b.jamPengisian || '').padStart(5, '0');
          return timeB.localeCompare(timeA);
        });

        setHistory(mergedHist);
        safeStorage.set('wbs_ftw_history', JSON.stringify(mergedHist.slice(0, 500)));

        // Persist to Express server so reload keeps the updated records
        try {
          await fetch('/api/history-sync-firebase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: fsAssessments })
          });
        } catch (srvErr) {
          console.warn('Server sync error from Firebase restore:', srvErr);
        }
      }

      // Calculate shift breakdown if date was specified
      let shiftBreakdown = '';
      if (queryDate && fsAssessments.length > 0) {
        const s1 = fsAssessments.filter(r => checkIsDayShift(r.jamPengisian)).length;
        const s2 = fsAssessments.filter(r => !checkIsDayShift(r.jamPengisian)).length;
        shiftBreakdown = ` (Shift 1: ${s1}, Shift 2: ${s2})`;
      }

      const msg = lang === 'ID'
        ? ` Berhasil memulihkan ${empCount} data karyawan dan ${histCount} data assessment dari Firebase Firestore${shiftBreakdown}!`
        : ` Successfully restored ${empCount} employees and ${histCount} assessment records from Firebase Firestore${shiftBreakdown}!`;

      setFirebaseStatusMsg(msg);
      notifyUser(msg);
    } catch (err: any) {
      console.error("Firebase restore error:", err);
      const errMsg = ` Gagal restore dari Firebase: ${err.message || err}`;
      setFirebaseStatusMsg(errMsg);
      notifyUser(errMsg);
    } finally {
      setFirebaseSyncing(false);
    }
  };

  // Handler to prune old assessments to free up Firebase storage space
  const handlePruneOldAssessments = () => {
    setConfirmDialog({
      title: lang === 'ID' ? 'Pangkas Riwayat Lama' : 'Prune Old Assessments',
      message: lang === 'ID'
        ? `Apakah Anda yakin ingin memangkas dan menghapus data laporan di Firebase Firestore yang berumur lebih dari ${pruneDays} hari?`
        : `Are you sure you want to prune assessment records in Firebase Firestore older than ${pruneDays} days?`,
      onConfirm: async () => {
        try {
          setIsPruning(true);
          setFirebaseStatusMsg(lang === 'ID' ? `Sedang memangkas data lama (> ${pruneDays} hari)...` : `Pruning data older than ${pruneDays} days...`);
          const result = await pruneOldAssessmentsFromFirestore(pruneDays);
          setFirebaseStatusMsg(result.message);
          notifyUser(result.message, 'success');
        } catch (err: any) {
          console.error("Prune error:", err);
          notifyUser(`Gagal memangkas: ${err.message || err}`, 'error');
        } finally {
          setIsPruning(false);
        }
      }
    });
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
      notifyUser(lang === 'ID' ? "Harap login Google dan cantumkan Spreadsheet ID!" : "Please login and provide Spreadsheet ID!");
      return;
    }
    if (history.length === 0) {
      notifyUser(lang === 'ID' ? "Tidak ada data riwayat penilaian untuk disinkronkan." : "No assessment records to sync.");
      return;
    }
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog("Memeriksa data laporan yang sudah diunggah sebelumnya di Google Sheets...");

      let existingIds: string[] = [];
      try {
        const checkResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Laporan_Fit!A2:A200000`, {
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
        notifyUser(lang === 'ID' 
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
      notifyUser(lang === 'ID' 
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

  const sheetRowFromRecord = (record: any) => [
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

  // Backup: pull everything in Firestore newer than the last row in Google Sheets, then append the missing rows.
  // Safe to retry: if Firestore quota is still exhausted nothing is written and it reports clearly.
  const handleBackupFirestoreToSheets = async (silent: boolean = false) => {
    if (backupRunningRef.current) return;
    if (!sheetsToken || !spreadsheetId) {
      if (!silent) notifyUser(lang === 'ID' ? 'Harap login Google dan isi Spreadsheet ID terlebih dahulu.' : 'Please sign in to Google and set the Spreadsheet ID first.');
      return;
    }
    backupRunningRef.current = true;
    try {
      setSheetsConnectionStatus('SYNCING');
      addLog('Backup Firestore ke Sheets: membaca isi Laporan_Fit...');

      const sheetResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Laporan_Fit!A2:B200000`, {
        headers: { 'Authorization': `Bearer ${sheetsToken}` }
      });
      if (!sheetResp.ok) throw new Error(`Gagal membaca Google Sheets: ${await sheetResp.text()}`);
      const sheetData = await sheetResp.json();
      const sheetRows: any[][] = sheetData.values || [];
      const existingIds = new Set<string>();
      let lastDate = '';
      for (const row of sheetRows) {
        if (row[0]) existingIds.add(String(row[0]).trim());
        const d = row[1] ? String(row[1]).trim() : '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > lastDate) lastDate = d;
      }
      const startDate = lastDate || '2026-01-01';
      addLog(`Tanggal terakhir di Sheets: ${lastDate || '(kosong)'}. Mengambil data Firestore sejak ${startDate}...`);

      let fsRecords: any[] = [];
      try {
        fsRecords = await fetchAssessmentsRangeFromFirestore(startDate, undefined, 5000);
      } catch (fsErr) {
        if (isFirestoreQuotaError(fsErr)) {
          const msg = lang === 'ID'
            ? 'Kuota Firestore hari ini masih habis. Backup akan dicoba lagi otomatis setelah kuota pulih (sekitar pukul 14:00 WIB).'
            : 'Firestore daily quota is still exhausted. Backup will retry automatically after it resets (around 14:00 WIB).';
          addLog(msg);
          if (!silent) notifyUser(msg);
          setSheetsConnectionStatus('CONNECTED');
          return;
        }
        throw fsErr;
      }

      const missing = deduplicateAssessments(fsRecords)
        .filter((r: any) => r && r.id && !existingIds.has(String(r.id).trim()))
        .sort((a: any, b: any) => {
          const da = `${a.tanggalPengisian || ''} ${(a.jamPengisian || '').padStart(5, '0')}`;
          const db2 = `${b.tanggalPengisian || ''} ${(b.jamPengisian || '').padStart(5, '0')}`;
          return da.localeCompare(db2);
        });

      if (missing.length === 0) {
        addLog('Google Sheets sudah sama dengan Firestore. Tidak ada data yang perlu dicadangkan.');
        if (!silent) notifyUser(lang === 'ID' ? 'Google Sheets sudah lengkap dan sama dengan Firestore.' : 'Google Sheets is already up to date with Firestore.');
        setSheetsConnectionStatus('CONNECTED');
        return;
      }

      addLog(`Menemukan ${missing.length} laporan di Firestore yang belum ada di Sheets. Mengunggah...`);
      const CHUNK = 500;
      for (let i = 0; i < missing.length; i += CHUNK) {
        const part = missing.slice(i, i + CHUNK);
        const appendResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Laporan_Fit!A:M:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: part.map(sheetRowFromRecord) })
        });
        if (!appendResp.ok) throw new Error(await appendResp.text());
        addLog(`Terunggah ${Math.min(i + CHUNK, missing.length)} dari ${missing.length} laporan...`);
      }

      setHistory(prev => {
        const map = new Map<string, CustomAssessment>();
        prev.forEach(r => { if (r && r.id) map.set(r.id, r); });
        missing.forEach((r: any) => { if (r.timestamp) map.set(r.id, r as CustomAssessment); });
        return Array.from(map.values());
      });

      const okMsg = lang === 'ID'
        ? `Backup selesai: ${missing.length} laporan dari Firestore berhasil dicadangkan ke Google Sheets.`
        : `Backup complete: ${missing.length} Firestore records appended to Google Sheets.`;
      addLog(okMsg);
      if (!silent) notifyUser(okMsg, 'success');
      setSheetsConnectionStatus('CONNECTED');
    } catch (e: any) {
      console.error(e);
      addLog('Gagal backup Firestore ke Sheets: ' + (e.message || e));
      if (!silent) notifyUser('Gagal backup Firestore ke Sheets: ' + (e.message || e), 'error');
      setSheetsConnectionStatus('CONNECTED');
    } finally {
      backupRunningRef.current = false;
    }
  };

  // Automatic retry: while Admin has the portal open and Google is connected, try the backup at most every 30 minutes.
  useEffect(() => {
    if (!isAdminPage || !isAdminAuthenticated || !sheetsToken || !spreadsheetId) return;
    const KEY = 'wbs_last_sheets_backup_attempt';
    const attempt = () => {
      const last = Number(safeStorage.get(KEY) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      safeStorage.set(KEY, String(Date.now()));
      handleBackupFirestoreToSheets(true);
    };
    attempt();
    const interval = setInterval(attempt, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdminPage, isAdminAuthenticated, sheetsToken, spreadsheetId]);

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
    
    // Strict NIK Validation (must be 9 digits without leading zero)
    const nikCheck = validateNik(nik, lang);
    if (!nikCheck.isValid) {
      setFormError(nikCheck.message);
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

      notifyUser(
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
    
    // Collision-free unique record ID combining timestamp and entropy
    const recordId = `WBS-FTW-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
    safeStorage.set(`wbs_ftw_submitted_${nik.trim().toLowerCase()}_${tanggalPengisian}`, 'true');

    // If Google Sheets is connected, push automatically
    if (sheetsToken && spreadsheetId) {
      handlePushResultToSheets(newRecord);
    }

    // Reset notification state and dispatch Fonnte WhatsApp alert if conditions match
    setWaNotificationSent(false);
    setWaNotificationStatus('');

    const isUnfit = newRecord.finalDecision === 'UNFIT';
    const isRest = newRecord.finalDecision === 'REST_BEFORE_WORK';
    const isConditional = newRecord.finalDecision === 'FIT_CONDITIONAL' || newRecord.consumesObat || newRecord.hasPersonalProblem;

    const shouldNotify = (
      (isUnfit && fonnteAlertUnfit) ||
      (isRest && fonnteAlertRest) ||
      (isConditional && fonnteAlertConditional)
    );

    if (shouldNotify) {
      handleSendFonnteNotification(newRecord);
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

  const handleExportExcel = (records: CustomAssessment[]) => {
    if (records.length === 0) {
      notifyUser(lang === 'ID' ? 'Tidak ada data untuk diekspor.' : 'No data to export.');
      return;
    }

    const headers = [
      "No",
      "ID Laporan",
      "Timestamp",
      "NIK",
      "Nama Karyawan",
      "Jabatan",
      "Departemen",
      "Tanggal Pengisian",
      "Jam Pengisian",
      "Jam Mulai Tidur 12j",
      "Jam Bangun 12j",
      "Total Tidur 12j (Jam)",
      "Jam Mulai Tidur 36j",
      "Jam Bangun 36j",
      "Total Tidur 36j (Jam)",
      "Konsumsi Obat",
      "Masalah Pribadi",
      "Fatigue Score",
      "Readiness Ratio (%)",
      "Kategori Fatigue",
      "Keputusan Akhir",
      "Deteksi Data Aneh / Anomali"
    ];

    const rows = records.map((rec, idx) => {
      const anom = checkAssessmentAnomalies(rec);
      return [
        idx + 1,
        rec.id,
        rec.timestamp,
        rec.nik,
        rec.nama,
        rec.jabatan,
        rec.dept,
        rec.tanggalPengisian,
        rec.jamPengisian,
        rec.sleep12Session1Bed || '-',
        rec.sleep12Session1Wake || '-',
        rec.totalSleep12,
        rec.sleep36Session1Bed || '-',
        rec.sleep36Session1Wake || '-',
        rec.totalSleep36,
        rec.consumesObat ? (lang === 'ID' ? 'Ya' : 'Yes') : (lang === 'ID' ? 'Tidak' : 'No'),
        rec.hasPersonalProblem ? (lang === 'ID' ? 'Ya' : 'Yes') : (lang === 'ID' ? 'Tidak' : 'No'),
        rec.totalFatigueScore,
        `${rec.readinessScore}%`,
        rec.fatigueCategory,
        rec.finalDecision,
        anom.hasAnomaly ? ` ANOMALI: ${anom.reasons.join(' | ')}` : 'Normal'
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
      { wch: 25 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Laporan FTW");

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `FTW_Laporan_Rekap_${dateStr}.xlsx`);
  };

  const handleDeleteRecord = (id: string) => {
    setConfirmDialog({
      title: lang === 'ID' ? 'Hapus Catatan Penilaian' : 'Delete Assessment Record',
      message: lang === 'ID'
        ? 'Hapus catatan ini dari database online pusat dan backup Firebase?'
        : 'Delete this assessment record from the central database and Firebase backup?',
      onConfirm: async () => {
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
        notifyUser(lang === 'ID' ? 'Catatan penilaian telah dihapus.' : 'Assessment record deleted.', 'info');
      }
    });
  };

  // Features Added: Sharing Report to WhatsApp
  const handleShareWhatsApp = () => {
    const formatVerdict = () => {
      if (calculations.finalDecision === 'FIT') return " Karyawan diizinkan bekerja normal";
      if (calculations.finalDecision === 'FIT_CONDITIONAL') return " Karyawan diizinkan bekerja normal (Dengan Pengawasan)";
      if (calculations.finalDecision === 'REST_BEFORE_WORK') return " istirahat dahulu sebelum bekerja";
      return " tidak boleh bekerja";
    };

    const text = `*LAPORAN Fit to Work ASSESSMENT*
*PT. Wahana Bara Sentosa FTW Online*
---------------------------------------
 *Data Karyawan:*
• *Nama:* ${nama}
• *NIK:* ${nik}
• *Jabatan:* ${jabatan} [${dept}]
• *Waktu Pengisian:* ${tanggalPengisian} pukul ${jamPengisian}

 *Detail Jadwal Tidur & Jam Bangun:*
• *Sesi Utama (12 Jam):* Jam Tidur ${sleep12Session1Bed} s/d Jam Bangun ${sleep12Session1Wake} (Total: ${calculations.totalSleep12} Jam)
${hasSleep12Session2 ? `• *Sesi Tambahan (12 Jam):* Jam Tidur ${sleep12Session2Bed} s/d Jam Bangun ${sleep12Session2Wake}\n` : ''}• *Evaluasi 36 Jam:* Jam Tidur ${sleep36Session1Bed} s/d Jam Bangun ${sleep36Session1Wake} (Total: ${calculations.totalSleep36} Jam)

 *Hasil Analisa Kelayakan:*
• *Kondisi:* *${formatVerdict()}*
• *Readiness Score:* ${calculations.readinessScore}%
• *Fatigue Score:* ${calculations.totalFatigueScore} Penalti

 *Faktor Risiko Tambahan:*
• *Konsumsi Obat Sleepy:* ${consumesObat ? "Ya (Ada Risiko Mengantuk) " : "Tidak"}
• *Masalah Pribadi / Stres:* ${hasPersonalProblem ? "Ya (Fokus Terganggu) " : "Tidak"}

 *Rekomendasi Kerja:*
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
      notifyUser("Elemen sertifikat tidak ditemukan.");
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
      notifyUser("Gagal merender gambar. Coba sekali lagi.");
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
    <div className="min-h-dvh bg-white text-ink-800 flex flex-col font-sans transition-colors duration-300">
      
      {/* GLOBAL MASTER HEADER BAR Styled White Premium */}
      <div data-ui className="bg-white border-b border-ink-200 px-6 py-3.5 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div data-ui className="flex items-center gap-2.5 bg-white px-2.5 py-1 rounded-lg border border-ink-200 transition duration-150 shrink-0">
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
            <span className="text-xs font-black text-danger-600 leading-none">
              Fatigue Management
            </span>
            <span className="text-xs text-ink-900 font-extrabold leading-none mt-1.5">Fit to Work Online PT. WBS</span>
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
            className="text-xs sm:text-xs font-bold bg-ink-100 hover:bg-ink-200 border border-ink-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-ink-700 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{lang === 'ID' ? 'Riwayat' : 'Registry'}</span>
          </button>

          {/* Halaman Admin - Dedicated Administration Page */}
          <button 
            type="button"
            onClick={() => {
              setAdminNikFilter('');
              setIsAdminPage(true);
              window.location.hash = '#admin';
            }}
            className="text-xs sm:text-xs font-bold bg-danger-600 hover:bg-danger-700 text-white border border-danger-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
            <span className="hidden xs:inline">{lang === 'ID' ? 'Halaman Admin' : 'Admin Portal'}</span>
            <span className="xs:hidden">Admin</span>
          </button>

          {/* Language Toggle */}
          <button 
            type="button"
            onClick={() => setLang(lang === 'ID' ? 'EN' : 'ID')}
            className="text-xs font-bold bg-ink-100 hover:bg-ink-200 border border-ink-200 text-ink-700 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            
            <span className="tabular-nums">{lang}</span>
          </button>
        </div>
      </div>

      {/* INLINE NOTIFICATION BANNER */}
      {uiBanner && (
        <div data-ui className="max-w-xl w-full mx-auto mt-3 px-4">
          <div data-ui className={`p-3 rounded-xl border text-xs font-semibold flex items-start justify-between gap-3 ${
            uiBanner.type === 'error'
              ? 'bg-danger-50 border-danger-200 text-danger-800'
              : uiBanner.type === 'success'
                ? 'bg-safe-50 border-safe-200 text-safe-800'
                : 'bg-info-50 border-info-200 text-info-800'
          }`}>
            <span className="whitespace-pre-wrap leading-relaxed">{uiBanner.text}</span>
            <button
              type="button"
              onClick={() => setUiBanner(null)}
              className="text-xs font-bold px-2 py-0.5 rounded border border-current shrink-0 cursor-pointer"
            >
              {lang === 'ID' ? 'Tutup' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 bg-paper">
        <div data-ui className="w-full max-w-xl bg-elevated border border-rule rounded-2xl self-center text-ink-800 p-1 flex flex-col">
          <div className="w-full flex-1 flex flex-col p-5 sm:p-7">
            <div className="text-center mb-5 mt-2 flex flex-col items-center">
              <div data-ui className="mb-2.5 p-2 bg-elevated rounded-2xl border border-rule inline-flex items-center justify-center">
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
              <h1 className="text-xl font-black tracking-tight text-ink-900 mt-1">
                Fit To Work Online
              </h1>
              <p className="text-ink-500 text-xs font-semibold mt-0.5">
                PT. Wahana Bara Sentosa · Fatigue Management
              </p>
            </div>

            {/* STEP PROGRESS INDICATOR PIPES Light Mode Grid */}
            <div data-ui className="bg-ink-50 p-3 rounded-xl border border-rule flex items-center justify-around mb-6 text-center select-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black tabular-nums transition ${
                  step === 1 ? 'bg-danger-600 text-white ' : step > 1 ? 'bg-safe-600 text-white' : 'bg-ink-200 text-ink-500'
                }`}>
                  {step > 1 ? '' : '1'}
                </div>
                <span className="text-xs font-bold tracking-tight text-ink-600 shrink-0">
                  {lang === 'ID' ? 'Identitas Karyawan' : 'ID'}
                </span>
              </div>
              <div className={`h-0.5 flex-1 mx-2 ${step > 1 ? 'bg-safe-600' : 'bg-ink-200'}`}></div>

              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black tabular-nums transition ${
                  step === 2 ? 'bg-danger-600 text-white ' : step > 2 ? 'bg-safe-600 text-white' : 'bg-ink-200 text-ink-500'
                }`}>
                  {step > 2 ? '' : '2'}
                </div>
                <span className="text-xs font-bold tracking-tight text-ink-600 shrink-0">
                  {lang === 'ID' ? 'Jam Tidur' : 'Sleep'}
                </span>
              </div>
              <div className={`h-0.5 flex-1 mx-2 ${step > 2 ? 'bg-safe-600' : 'bg-ink-200'}`}></div>

              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black tabular-nums transition ${
                  step === 3 ? 'bg-danger-600 text-white ' : 'bg-ink-200 text-ink-500'
                }`}>
                  3
                </div>
                <span className="text-xs font-bold tracking-tight text-ink-600 shrink-0">
                  {lang === 'ID' ? 'Hasil FTW' : 'Result'}
                </span>
              </div>
            </div>

            {/* ERROR TICKER */}
            {formError && (
              <div data-ui className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* ---------------------------------------------------------------------------------- */}
            {/* HALAMAN 1: IDENTITAS KARYAWAN (Dengan Google sheet database integration) */}
            {/* ---------------------------------------------------------------------------------- */}
            {step === 1 && (
              <div className="flex-1 flex flex-col gap-4 text-ink-800">
                <div data-ui className="pb-2 border-b border-ink-200">
                  <h2 className="text-sm font-bold text-danger-600 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{t.h1Title}</span>
                  </h2>
                  <p className="text-xs text-ink-500">{t.h1Sub}</p>
                </div>

                {/* Spreadsheet status alert bar */}
                {spreadsheetId && sheetsToken && (
                  <div data-ui className="bg-safe-50 text-safe-800 border border-safe-200 p-2.5 rounded-lg text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      
                      <span>Connected to Google Sheets</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleSyncKaryawan()}
                      className="text-xs font-bold underline bg-white text-safe-700 px-1.5 py-0.5 rounded border border-safe-300 hover:bg-ink-50 cursor-pointer"
                    >
                      Sync Now
                    </button>
                  </div>
                )}

                {/* Input NIK with strict format guidelines & instant notification */}
                <div className="flex flex-col gap-1.5 font-sans">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-extrabold text-ink-500 block">
                      {lang === 'ID' ? 'Nomor Induk Karyawan (NIK)' : 'Employee ID Number (NIK)'}
                    </label>
                    <span className="text-xs tabular-nums font-bold text-ink-400">
                      Wajib 9 Digit (Tanpa 0)
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      type="text"
                      maxLength={12}
                      className={`w-full bg-ink-50 border rounded-lg py-2.5 px-3.5 pl-10 text-sm  tabular-nums  text-ink-900  transition-colors font-semibold  ${
                        nik.trim().startsWith('0') 
                          ? 'border-danger-500 bg-danger-50/30 focus:ring-2 focus:ring-danger-500' 
                          : nik.trim().length > 0 && nik.trim().length !== 9 
                            ? 'border-warn-400 bg-warn-50/20 focus:ring-2 focus:ring-warn-500' 
                            : nik.trim().length === 9 && !nik.trim().startsWith('0') && /^\d+$/.test(nik.trim())
                              ? 'border-safe-500 bg-safe-50/20 focus:ring-2 focus:ring-safe-500'
                              : 'border-ink-300 focus:ring-2 focus:ring-danger-500 focus:bg-white'
                      }`}
                      placeholder={lang === 'ID' ? "Contoh: 123456789 (9 digit)" : "e.g. 123456789 (9 digits)"}
                      value={nik}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s+/g, '');
                        setNik(val);
                      }}
                    />
                    <span className="absolute left-3.5 top-3.5 text-ink-400 tabular-nums text-xs">#</span>
                    {nik.trim().length > 0 && (
                      <span className="absolute right-3 top-3 text-xs tabular-nums font-bold text-ink-500">
                        {nik.trim().length}/9
                      </span>
                    )}
                  </div>

                  {/* Real-time NIK Validation Alerts */}
                  {(() => {
                    const trimmed = nik.trim();
                    if (!trimmed) return null;

                    // Condition 1: Starts with zero
                    if (trimmed.startsWith('0')) {
                      return (
                        <div data-ui className="bg-danger-50 border border-danger-300 text-danger-800 p-2.5 rounded-lg text-xs flex items-start gap-2 animate-fadeIn">
                          
                          <div>
                            <p className="font-black text-xs">
                              {lang === 'ID' ? 'Pemberitahuan: NIK Tidak Boleh Diawali Nol' : 'Warning: NIK Cannot Start With Zero'}
                            </p>
                            <p className="font-bold text-xs mt-0.5 leading-snug">
                              {lang === 'ID' 
                                ? 'NIK tidak boleh diawali dengan angka nol (0)! Harap masukkan NIK yang benar di input tanpa angka nol di depan.' 
                                : 'NIK cannot start with zero (0)! Please enter your correct NIK without leading zero.'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // Condition 2: Contains non-digits
                    if (!/^\d+$/.test(trimmed)) {
                      return (
                        <div data-ui className="bg-danger-50 border border-danger-300 text-danger-800 p-2.5 rounded-lg text-xs flex items-start gap-2 animate-fadeIn">
                          
                          <div>
                            <p className="font-black text-xs">
                              {lang === 'ID' ? 'Peringatan: Karakter Tidak Valid' : 'Warning: Invalid Characters'}
                            </p>
                            <p className="font-bold text-xs mt-0.5 leading-snug">
                              {lang === 'ID' 
                                ? 'NIK hanya boleh berupa angka! Tidak boleh mengandung huruf atau simbol.' 
                                : 'NIK must only consist of numbers! No letters or symbols allowed.'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // Condition 3: Abnormal length (not 9 digits)
                    if (trimmed.length !== 9) {
                      return (
                        <div data-ui className="bg-warn-50 border border-warn-300 text-warn-900 p-2.5 rounded-lg text-xs flex items-start gap-2 animate-fadeIn">
                          
                          <div>
                            <p className="font-black text-xs">
                              {lang === 'ID' ? 'Peringatan: Jumlah Digit NIK Abnormal' : 'Warning: Abnormal NIK Length'}
                            </p>
                            <p className="font-bold text-xs mt-0.5 leading-snug">
                              {lang === 'ID' 
                                ? `Jumlah digit NIK abnormal (${trimmed.length} digit). Format NIK wajib tepat 9 digit angka tanpa angka nol di depan. Anda tidak boleh mengisi FTW sebelum mengisi NIK dengan benar.` 
                                : `Abnormal NIK length (${trimmed.length} digits). Format must be exactly 9 digits without leading zero. You cannot proceed to fill FTW until NIK is entered correctly.`}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // Condition 4: Perfectly Valid 9-digit NIK
                    return (
                      <div data-ui className="bg-safe-50 border border-safe-300 text-safe-800 py-1.5 px-3 rounded-lg text-xs flex items-center justify-between font-bold animate-fadeIn">
                        <span className="flex items-center gap-1.5">
                          
                          <span>{lang === 'ID' ? 'Format NIK valid (9 digit angka tanpa angka nol di depan)' : 'Valid NIK format (9 digits, no leading zero)'}</span>
                        </span>
                        <span className="tabular-nums text-safe-700 font-black">9 / 9 Digit Valid</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Database Search Ticker popup info block */}
                {(() => {
                  const cleanNik = nik.trim().toUpperCase();
                  const isVerified = !!employeeDb[cleanNik];
                  return (
                    <div data-ui className="bg-ink-50 px-3.5 py-2.5 rounded-lg border border-ink-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        
                        <span className="text-xs font-bold text-ink-700">
                          {isSearchingNikCloud 
                            ? (lang === 'ID' ? 'Memeriksa NIK ke Cloud...' : 'Checking Cloud Database...') 
                            : (isVerified 
                                ? (lang === 'ID' ? 'Karyawan Terverifikasi' : 'VERIFIED EMPLOYEE') 
                                : (lang === 'ID' ? 'Input Manual / Karyawan Baru' : 'MANUAL DATA INPUT / NEW')
                              )
                          }
                        </span>
                      </div>
                      {isVerified && (
                        <span className="text-xs font-extrabold text-safe-700 tabular-nums bg-safe-100 px-2.5 py-0.5 rounded-md">
                          Autofill OK
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Autocompleted Fields Card */}
                {(() => {
                  const cleanNik = nik.trim().toUpperCase();
                  const isVerified = !isManualOverride && !!employeeDb[cleanNik];
                  return (
                    <div data-ui className="bg-ink-50 p-4 rounded-xl border border-ink-200/80 flex flex-col gap-3.5">
                      {/* Nama Field */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-extrabold text-ink-500">{lang === 'ID' ? 'Nama Lengkap Karyawan' : 'Full Name'}</span>
                        <input 
                          type="text" 
                          value={nama}
                          disabled={isVerified}
                          onChange={(e) => setNama(e.target.value)}
                          className={`w-full bg-white border ${
                            isVerified ? 'border-ink-200 text-ink-400 font-semibold' : 'border-ink-300 text-ink-900 focus:ring-1 focus:ring-danger-500 font-bold'
                          } text-xs py-2 px-3 rounded-lg `}
                          placeholder="Masukkan nama lengkap"
                        />
                      </div>

                      {/* Jabatan & Dept Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-extrabold text-ink-500">{lang === 'ID' ? 'Jabatan' : 'Job Title'}</span>
                          <input 
                            type="text" 
                            value={jabatan}
                            disabled={isVerified}
                            onChange={(e) => setJabatan(e.target.value)}
                            className={`w-full bg-white border ${
                              isVerified ? 'border-ink-200 text-ink-400 font-semibold' : 'border-ink-300 text-ink-900 focus:ring-1 focus:ring-danger-500'
                            } text-xs py-2 px-3 rounded-lg  font-medium`}
                            placeholder="Operator, Driver, dll"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-extrabold text-ink-500">{lang === 'ID' ? 'Departemen' : 'Department'}</span>
                          <input 
                            type="text" 
                            value={dept}
                            disabled={isVerified}
                            onChange={(e) => setDept(e.target.value)}
                            className={`w-full bg-white border ${
                              isVerified ? 'border-ink-200 text-ink-400 font-semibold' : 'border-ink-300 text-ink-900 focus:ring-1 focus:ring-danger-500'
                            } text-xs py-2 px-3 rounded-lg  font-medium`}
                            placeholder="Produksi, HSE, dll"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tanggal & Jam Pengisian */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-extrabold text-ink-500">{lang === 'ID' ? 'Tanggal Assessment' : 'Assessment Date'}</span>
                    <input 
                      type="date"
                      value={tanggalPengisian}
                      onChange={(e) => setTanggalPengisian(e.target.value)}
                      className="w-full bg-ink-50 border border-ink-300 rounded-lg text-ink-900 text-xs py-2 px-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-extrabold text-ink-500">{lang === 'ID' ? 'Waktu Pengisian' : 'Assessment Time'}</span>
                    <input 
                      type="time" 
                      value={jamPengisian}
                      onChange={(e) => setJamPengisian(e.target.value)}
                      className="w-full bg-ink-50 border border-ink-300 rounded-lg text-ink-900 text-xs py-2 px-3"
                    />
                  </div>
                </div>

                {/* MENU RIWAYAT KARYAWAN */}
                <div data-ui className="bg-ink-50 border border-ink-200 p-4 rounded-xl flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    
                    <div>
                      <h4 className="text-xs font-extrabold text-ink-800 leading-tight">
                        {lang === 'ID' ? 'Riwayat Pengisian Karyawan' : 'Employee Submission History'}
                      </h4>
                      <p className="text-xs text-ink-500 leading-none mt-0.5">
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
                      className="w-full bg-white hover:bg-ink-50 text-ink-700 font-bold py-2 px-3 rounded-lg text-xs border border-ink-300 hover:border-danger-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      
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
                      className="w-full bg-white hover:bg-ink-50 text-ink-600 font-bold py-2 px-3 rounded-lg text-xs border border-ink-300 hover:border-danger-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      
                      <span>{lang === 'ID' ? 'Tampilkan Semua' : 'View All'}</span>
                    </button>
                  </div>
                </div>

                {/* Navigation Button Block step 1 */}
                <div className="mt-auto pt-5 flex flex-col gap-2">
                  {(() => {
                    const nikVal = validateNik(nik, lang);
                    const isNikInvalid = nik.trim().length > 0 && !nikVal.isValid;
                    return (
                      <>
                        <button 
                          type="button"
                          onClick={goToStep2}
                          className={`w-full text-white font-black py-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer  text-xs  ${
                            isNikInvalid 
                              ? 'bg-ink-500 hover:bg-ink-600 shadow-neutral-200' 
                              : 'bg-danger-600 hover:bg-danger-500  shadow-rose-200'
                          }`}
                        >
                          <span>{lang === 'ID' ? 'PILIH JAM TIDUR' : 'ENTER SLEEP TIMES'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        {isNikInvalid && (
                          <p className="text-xs text-danger-600 font-bold text-center leading-tight mt-1">
                             {nikVal.message}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------------------------- */}
            {/* HALAMAN 2: JAM TIDUR & BANGUN */}
            {/* ---------------------------------------------------------------------------------- */}
            {step === 2 && (
              <div className="flex-1 flex flex-col gap-4 text-ink-800">
                <div data-ui className="pb-2 border-b border-ink-200">
                  <h2 className="text-sm font-bold text-danger-600 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-danger-600" />
                    <span>{t.h2Title}</span>
                  </h2>
                  <p className="text-xs text-ink-500">{t.h2Sub}</p>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[460px] pr-1.5 flex flex-col gap-5">
                  
                  {/* --- AREA 1: 12 JAM TERAKHIR (Sleep block 1) --- */}
                  <div data-ui className="bg-ink-50 p-4 rounded-xl border border-ink-200 flex flex-col gap-3">
                    <div data-ui className="flex justify-between items-center border-b border-ink-200 pb-2">
                      <h3 className="text-xs font-extrabold text-danger-600 flex items-center gap-2">
                        
                        {lang === 'ID' ? 'Sesi Tidur Utama (12 Jam Terakhir)' : 'Primary Sleep Session (Last 12 Hours)'}
                      </h3>
                    </div>

                    {/* Sesi 1 Times */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Mulai Tidur' : 'Bedtime (Session 1)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep12Session1Bed}
                          onChange={(e) => setSleep12Session1Bed(e.target.value)}
                          className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center focus:border-danger-500 focus:ring-1 focus:ring-danger-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Bangun Tidur' : 'Wake-up (Session 1)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep12Session1Wake}
                          onChange={(e) => setSleep12Session1Wake(e.target.value)}
                          className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center focus:border-danger-500 focus:ring-1 focus:ring-danger-500"
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
                          className="w-3.5 h-3.5 rounded text-danger-600 focus:ring-danger-500 bg-white border-ink-300 transition"
                        />
                        <span className="text-xs font-bold text-danger-600">
                          {lang === 'ID' ? ' Sesi Tidur Tambahan (Bila Terbangun)' : ' Additional Sleep Session (If Interrupted/Woken Up)'}
                        </span>
                      </label>

                      {hasSleep12Session2 && (
                        <div data-ui className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-ink-200">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Tidur Sesi 2' : 'Bedtime (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep12Session2Bed}
                              onChange={(e) => setSleep12Session2Bed(e.target.value)}
                              className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Bangun Sesi 2' : 'Wake-up (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep12Session2Wake}
                              onChange={(e) => setSleep12Session2Wake(e.target.value)}
                              className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* --- AREA 2: 36 JAM TERAKHIR --- */}
                  <div data-ui className="bg-ink-50 p-4 rounded-xl border border-ink-200 flex flex-col gap-3">
                    <div data-ui className="flex justify-between items-center border-b border-ink-200 pb-2">
                      <h3 className="text-xs font-extrabold text-ink-700 flex items-center gap-2">
                        
                        {lang === 'ID' ? 'Sesi Tidur Siklus Sebelumnya (36 Jam Terakhir)' : 'Previous Cycle Sleep Session (Last 36 Hours)'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Mulai Tidur' : 'Bedtime (Cycle 2)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep36Session1Bed}
                          onChange={(e) => setSleep36Session1Bed(e.target.value)}
                          className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center focus:border-danger-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Bangun Tidur' : 'Wake-up (Cycle 2)'}</span>
                        <input 
                          type="time" 
                          required
                          value={sleep36Session1Wake}
                          onChange={(e) => setSleep36Session1Wake(e.target.value)}
                          className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center focus:border-danger-500"
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
                          className="w-3.5 h-3.5 rounded text-danger-600 focus:ring-danger-500 bg-white border-ink-300 transition"
                        />
                        <span className="text-xs font-bold text-ink-600">
                          {lang === 'ID' ? ' Sesi Tidur Tambahan (Bila Terbangun)' : ' Additional Sleep Session (If Interrupted/Woken Up)'}
                        </span>
                      </label>

                      {hasSleep36Session2 && (
                        <div data-ui className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-ink-200">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Tidur Sesi 2' : 'Bedtime (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep36Session2Bed}
                              onChange={(e) => setSleep36Session2Bed(e.target.value)}
                              className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-ink-500">{lang === 'ID' ? 'Jam Bangun Sesi 2' : 'Wake-up (Session 2)'}</span>
                            <input 
                              type="time" 
                              value={sleep36Session2Wake}
                              onChange={(e) => setSleep36Session2Wake(e.target.value)}
                              className="w-full bg-white border border-ink-300 rounded-lg text-ink-900 tabular-nums text-xs py-2 px-3 text-center"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EXTRA RISK ASSESSMENTS */}
                  <div data-ui className="bg-ink-50 p-4 rounded-xl border border-ink-200 flex flex-col gap-3.5">
                    <h3 className="text-xs font-extrabold text-caution-700 border-b border-ink-200 pb-2 flex items-center gap-2">
                      
                      {lang === 'ID' ? 'Tambahan Informasi' : 'Additional Information'}
                    </h3>

                    {/* Consumes medication */}
                    <div className="flex flex-col gap-2 text-ink-800">
                      <span className="text-xs font-extrabold text-ink-600 leading-tight block">
                         {lang === 'ID' ? 'Mengkonsumsi obat yang menyebabkan mengantuk beberapa jam lalu?' : 'Have you consumed drowsiness-inducing medicine?'}
                      </span>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-ink-700">
                          <input 
                            type="radio" 
                            name="obat" 
                            checked={!consumesObat} 
                            onChange={() => setConsumesObat(false)}
                            className="w-4 h-4 text-danger-600 focus:ring-danger-500" 
                          />
                          {lang === 'ID' ? 'Tidak' : 'No'}
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-ink-700">
                          <input 
                            type="radio" 
                            name="obat" 
                            checked={consumesObat} 
                            onChange={() => setConsumesObat(true)} 
                            className="w-4 h-4 text-danger-600 focus:ring-danger-500"
                          />
                          {lang === 'ID' ? 'Ya' : 'Yes'}
                        </label>
                      </div>
                    </div>

                    {/* Personal issue */}
                    <div data-ui className="flex flex-col gap-2 pt-3 border-t border-ink-200">
                      <span className="text-xs font-extrabold text-ink-600 leading-tight block">
                         {lang === 'ID' ? 'Sedang dalam Masalah Pribadi / Perasaan Tertekan (Stres)?' : 'SOP Alert: Under heavy emotional distress / stress?'}
                      </span>
                      <div className="flex gap-6 font-semibold">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-ink-700">
                          <input 
                            type="radio" 
                            name="stress" 
                            checked={!hasPersonalProblem} 
                            onChange={() => setHasPersonalProblem(false)}
                            className="w-4 h-4 text-danger-600 focus:ring-danger-500" 
                          />
                          {lang === 'ID' ? 'Tidak' : 'No'}
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-ink-700">
                          <input 
                            type="radio" 
                            name="stress" 
                            checked={hasPersonalProblem} 
                            onChange={() => setHasPersonalProblem(true)} 
                            className="w-4 h-4 text-danger-600 focus:ring-danger-500"
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
                    className="col-span-4 bg-white border border-ink-300 hover:bg-ink-100 text-ink-700 py-3.5 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'ID' ? 'KEMBALI' : 'BACK'}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={processCalculationsAndShowResult}
                    className="col-span-8 bg-danger-600 hover:bg-danger-500 text-white font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-rose-200 text-xs"
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
              <div className="flex-1 flex flex-col gap-4 text-ink-800">
                <div data-ui className="pb-2 border-b border-ink-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold text-danger-600 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-danger-600" />
                      <span>{t.h3Title}</span>
                    </h2>
                    <p className="text-xs text-ink-500">{t.h3Sub}</p>
                  </div>
                  <span data-ui className="text-xs bg-ink-100 border border-rule text-ink-600 px-2.5 py-1 rounded tabular-nums font-black">
                    ID Laporan: …{tanggalPengisian.substring(8, 10)}{jamPengisian.replace(':', '')}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[440px] pr-1.5 flex flex-col gap-4">
                  
                  {/* WhatsApp Alert Status Banner if dispatched */}
                  {waNotificationSent && (
                    <div data-ui className="bg-safe-50 border border-safe-300 text-safe-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2.5">
                      
                      <div>
                        <p className="font-bold leading-tight">
                          {lang === 'ID' ? 'Notifikasi WhatsApp Otomatis Terkirim' : 'WhatsApp Notification Dispatched'}
                        </p>
                        <p className="text-xs text-safe-700 leading-snug">
                          {lang === 'ID' 
                            ? `Laporan kondisi telah otomatis diteruskan ke grup WA Pengawas (${fonnteTarget || 'Tujuan'}) via Fonnte.` 
                            : `Safety condition alert has been automatically sent to supervisor WA group via Fonnte.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HIDDEN / CAPTURABLE HIGH RES REGISTER BADGE CARD (Pure Custom Styling for Capture) */}
                  <div data-ui className="p-0.5 border border-dashed border-ink-300 rounded-2xl bg-white">
                    <div data-ui 
                      ref={badgeRef}
                      id="ftw-card-to-capture" 
                      className="bg-white p-6 rounded-2xl border-4 border-danger-600 flex flex-col gap-4 font-sans select-text relative overflow-hidden"
                      style={{ minWidth: '320px' }}
                    >
                      <div className="absolute -right-12 -top-12 w-28 h-28 bg-danger-100 rounded-full opacity-50"></div>
                      <div className="absolute -left-12 -bottom-12 w-28 h-28 bg-ink-100 rounded-full opacity-50"></div>

                      {/* Card Header inside Image */}
                      <div data-ui className="flex items-center justify-between border-b pb-3 border-ink-200">
                        <div className="flex items-center gap-2">
                          <div data-ui className="bg-danger-50 border border-danger-200 p-1 rounded">
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
                            <span className="text-xs font-black text-ink-900 block leading-none">PT. Wahana Bara Sentosa FTW Online</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs tabular-nums text-ink-500 block font-bold">Date Assessed</span>
                          <span className="text-xs tabular-nums font-bold text-ink-700">{tanggalPengisian} {jamPengisian}</span>
                        </div>
                      </div>

                      {/* Employee Information in Image Card */}
                      <div data-ui className="grid grid-cols-2 gap-y-2 border-b pb-3 border-rule text-xs">
                        <div>
                          <span className="text-ink-400 text-xs block font-bold">{lang === 'ID' ? 'NAMA PEKERJA' : 'NAME'}</span>
                          <span className="font-extrabold text-ink-900 text-xs">{nama}</span>
                        </div>
                        <div>
                          <span className="text-ink-400 text-xs block font-bold">NIK / Posisi</span>
                          <span className="font-bold text-ink-700 text-xs tabular-nums">{nik} / {jabatan}</span>
                        </div>
                      </div>

                      {/* Jam Mulai Tidur & Jam Bangun (Capture Card) */}
                      <div data-ui className="bg-ink-50 border border-ink-200/90 rounded-lg p-2.5 text-xs">
                        <div className="flex justify-between items-center text-ink-500 font-bold mb-1">
                          <span className="text-xs">Jadwal Tidur (12 Jam Terakhir)</span>
                          <span className="tabular-nums font-black text-ink-800">{calculations.totalSleep12} Jam</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 tabular-nums">
                          <div>
                            <span className="text-xs text-ink-400 block font-bold">Jam Mulai Tidur:</span>
                            <span className="font-black text-ink-800 text-xs">{sleep12Session1Bed}</span>
                          </div>
                          <div>
                            <span className="text-xs text-ink-400 block font-bold">Jam Bangun Tidur:</span>
                            <span className="font-black text-ink-800 text-xs">{sleep12Session1Wake}</span>
                          </div>
                        </div>
                        {hasSleep12Session2 && (
                          <div data-ui className="mt-1 pt-1 border-t border-dashed border-ink-200 grid grid-cols-2 gap-2 tabular-nums text-xs">
                            <div>
                              <span className="text-xs text-ink-400 block font-semibold">Sesi 2 Mulai:</span>
                              <span className="font-bold text-ink-700">{sleep12Session2Bed}</span>
                            </div>
                            <div>
                              <span className="text-xs text-ink-400 block font-semibold">Sesi 2 Bangun:</span>
                              <span className="font-bold text-ink-700">{sleep12Session2Wake}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SCORE GAUGE AREA IN CAPTURED IMAGE */}
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-4 flex flex-col items-center justify-center">
                          {/* Beautiful simplified visual count radial badge */}
                          <div className="relative w-20 h-20 flex flex-col items-center justify-center">
                            <svg className="w-18 h-18 transform -rotate-90" aria-hidden="true">
                              <circle cx="36" cy="36" r="32" fill="none" stroke="var(--color-rule)" strokeWidth="5"/>
                              <circle 
                                cx="36" cy="36" r="32" fill="none" 
                                stroke={
                                  calculations.finalDecision === 'FIT' ? 'var(--color-safe-500)' :
                                  calculations.finalDecision === 'FIT_CONDITIONAL' ? 'var(--color-warn-500)' :
                                  calculations.finalDecision === 'REST_BEFORE_WORK' ? 'var(--color-caution-500)' : 'var(--color-danger-500)'
                                } 
                                strokeWidth="5"
                                strokeDasharray="201"
                                strokeDashoffset={201 - (201 * calculations.readinessScore) / 100}
                              />
                            </svg>
                            <span className="absolute text-center leading-none">
                              <span className="text-base font-black tabular-nums text-ink-900">{calculations.readinessScore}%</span>
                              <span className="text-xs block font-extrabold text-ink-400 leading-none mt-0.5">Ready</span>
                            </span>
                          </div>
                        </div>

                        <div className="col-span-8 flex flex-col justify-center">
                          <span className="text-xs tabular-nums text-ink-500 block font-bold">Aspek Analisis Keputusan</span>
                          <span className="text-xs text-ink-700 tabular-nums mt-0.5">Skor Fatigue: <b>{calculations.totalFatigueScore}</b> / 31</span>
                          
                          {/* Highlight big tag */}
                          <div data-ui className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-black  inline-block text-center  max-w-fit ${
                            calculations.finalDecision === 'FIT' ? 'bg-safe-100 text-safe-800 border border-safe-200' :
                            calculations.finalDecision === 'FIT_CONDITIONAL' ? 'bg-warn-100 text-warn-800 border border-warn-200' :
                            calculations.finalDecision === 'REST_BEFORE_WORK' ? 'bg-caution-100 text-caution-800 border border-caution-200' : 
                            'bg-danger-100 text-danger-800 border border-danger-200'
                          }`}>
                            {calculations.finalDecision === 'FIT' && ' Fit to Work'}
                            {calculations.finalDecision === 'FIT_CONDITIONAL' && ' BEKERJA DALAM Pengawasan Khusus'}
                            {calculations.finalDecision === 'REST_BEFORE_WORK' && ' Wajib Istirahat Sebelum Bekerja'}
                            {calculations.finalDecision === 'UNFIT' && ' Tidak Boleh Bekerja'}
                          </div>
                        </div>
                      </div>

                      {/* Verification Badge Code footer */}
                      <div data-ui className="pt-2.5 border-t border-rule flex items-center justify-between text-xs tabular-nums text-ink-500">
                        <span>FTW-ONLINE-SHE-WBS-{tanggalPengisian.replace(/-/g,'')}</span>
                        <span className="font-extrabold text-ink-700">Online Register Synced</span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK ACTION ROW: WHATSAPP SHARE & UNDUH GAMBAR */}
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    
                    {/* Share directly on Whatsapp */}
                    <button 
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="bg-safe-600 hover:bg-safe-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer shadow-emerald-200"
                    >
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ID' ? 'Kirim ke WhatsApp' : 'Share to WhatsApp'}</span>
                    </button>

                    {/* Download Image Card for worker badge */}
                    <button 
                      type="button"
                      onClick={handleDownloadImage}
                      className="bg-danger-600 hover:bg-danger-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer shadow-rose-200"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ID' ? 'Unduh Gambar FTW' : 'Download Pass-Card'}</span>
                    </button>
                  </div>

                  {/* ACTION RECOMMENDATIONS LIST */}
                  <div data-ui className="bg-ink-50 p-4 rounded-xl border border-ink-200 flex flex-col gap-2">
                    <h4 className="text-xs font-extrabold text-ink-800">
                      Protokol & Rekomendasi Kerja:
                    </h4>

                    {calculations.isSleepDeficit && (
                      <div data-ui className="bg-danger-50/50 border border-danger-200 p-3 rounded-lg flex gap-2.5 text-xs leading-relaxed mb-1 items-start">
                        
                        <div>
                          <p className="font-extrabold text-danger-800 text-xs leading-tight">
                            {lang === 'ID' ? 'REKOMENDASI DURASI ISTIRAHAT MANDATORI' : 'MANDATORY REST TIME REQUIRED'}
                          </p>
                          <p className="text-xs text-ink-800 mt-1 font-bold leading-normal">
                            Karyawan kurang tidur sebanyak <b>{calculations.requiredRecoveryRest} jam</b>. 
                            Wajib melakukan <b>Tidur / Istirahat pemulihan mandatori selama minimal {calculations.requiredRecoveryRest} jam</b> sebelum diizinkan mengoperasikan unit critical. Hubungi pengawas untuk penjadwalan istirahat!
                          </p>
                        </div>
                      </div>
                    )}

                    <ul className="text-xs text-ink-700 flex flex-col gap-2 pl-1 select-text">
                      <li className="flex gap-2.5 items-start">
                        <span className="text-danger-600 shrink-0 font-extrabold">•</span>
                        <span>
                          {calculations.finalDecision === 'FIT' && 'Karyawan memenuhi syarat untuk Fit to Work.'}
                          {calculations.finalDecision === 'FIT_CONDITIONAL' && 'Karyawan masuk dalam kategori BEKERJA DALAM Pengawasan Khusus.'}
                          {calculations.finalDecision === 'REST_BEFORE_WORK' && 'Karyawan Wajib Istirahat Sebelum Bekerja.'}
                          {calculations.finalDecision === 'UNFIT' && 'Karyawan Tidak Boleh Bekerja.'}
                        </span>
                      </li>

                      {consumesObat && (
                        <li data-ui className="flex gap-2.5 items-start bg-warn-50 p-2.5 rounded-lg border border-warn-200 text-warn-800 flex-col md:flex-row">
                          
                          <div>
                            <span className="font-bold text-xs block text-danger-700">Rekomendasi Medikasi:</span>
                            <span className="block mt-0.5 text-xs text-ink-800">
                              {lang === 'ID' 
                                ? 'Mengkonsumsi Obat: Efek kantuk obat berisiko tinggi. Dilarang keras mengoperasikan unit critical / alat berat selama 4 jam ke depan. Wajib lapor kepada tim SHE atau Paramedis untuk memperoleh rekomendasi kelayakan selanjutnya!' 
                                : 'Consuming Medication: Medical drowsiness safety risk. Do not operate critical machinery or heavy equipment for the next 4 hours. You are required to report to the SHE department or Paramedic to receive further fitness check recommendations.'}
                            </span>
                          </div>
                        </li>
                      )}

                      {hasPersonalProblem && (
                        <li data-ui className="flex gap-2.5 items-start bg-danger-50 p-2.5 rounded-lg border border-danger-200 text-danger-800 flex-col md:flex-row">
                          
                          <div>
                            <span className="font-bold text-xs block text-danger-700">Rekomendasi Konsentrasi:</span>
                            <span className="block mt-0.5 text-xs text-ink-800">
                              {lang === 'ID' 
                                ? 'Ada Masalah / Gangguan Fokus (Stres): Wajib dilakukan koordinasi dan pengawasan ketat oleh foreman. Karyawan wajib melakukan konseling dengan pengawas sebelum memulai pekerjaan!' 
                                : 'Personal/Stress Issues: Close supervision by field foreman is required. Employee must undergo counseling with the supervisor before executing any tasks.'}
                            </span>
                          </div>
                        </li>
                      )}

                      <li data-ui className="flex gap-2.5 items-start text-xs pt-2 border-t border-ink-200">
                        <span className="text-ink-500 tabular-nums font-bold shrink-0">Ref SOP</span>
                        <span className="text-xs italic text-ink-500 tabular-nums">
                          ID Laporan: {tanggalPengisian.replace(/-/g,'')}/{jamPengisian.replace(':','')} - PT. Wahana Bara Sentosa FTW Online.
                        </span>
                      </li>
                    </ul>
                  </div>

                </div>

                {/* STEP 3 ACTIONS with local database and google spreadsheet upload */}
                <div className="mt-auto pt-5 flex flex-col gap-3">
                  <div data-ui className="bg-safe-50 border border-safe-200 rounded-xl p-3.5 flex gap-3 items-start">
                    
                    <div className="flex flex-col">
                      <span className="text-safe-800 text-xs font-black leading-none">
                        {lang === 'ID' ? 'Penilaian Terkirim Aman' : 'Submission Saved'}
                      </span>
                      <span className="text-xs text-safe-600 font-semibold leading-normal mt-1.5 font-sans">
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
          <div data-ui className="bg-ink-100 border-t border-ink-200 px-5 py-3.5 flex justify-between items-center text-xs text-ink-500 select-none rounded-b-2xl">
            <span className="tabular-nums text-ink-600">
              SOP-SA-001 · Fatigue Management
            </span>
            <span className="flex items-center gap-1.5 font-black text-danger-600">
              
              WBS Cloud-Ready
            </span>
          </div>

        </div>

      </div>

      {/* ---------------------------------------------------------------------------------- */}
      {/* CONFIRM SUBMISSION WITH INTEGRITY & COMPANY REGULATIONS DECLARATION MODAL */}
      {/* ---------------------------------------------------------------------------------- */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 bg-ink-900/60 flex items-center justify-center p-4 z-[60] select-none animate-fadeIn">
          <div data-ui className="bg-white rounded-2xl border-2 border-danger-600 w-full max-w-md flex flex-col overflow-hidden text-ink-800">
            <div data-ui className="bg-danger-50 border-b border-danger-100 px-5 py-4 flex gap-3 items-center">
              
              <div>
                <h3 className="text-xs font-black text-danger-800">
                  {lang === 'ID' ? 'PERNYATAAN INTEGRITAS & DISIPLIN' : 'INTEGRITY & DISCIPLINE DECLARATION'}
                </h3>
                <p className="text-xs text-danger-600 font-bold mt-0.5 leading-none">
                  {lang === 'ID' ? 'DATA TIDAK DAPAT DIUBAH SETELAH DIKIRIM' : 'DATA CANNOT BE MODIFIED AFTER SENT'}
                </p>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-ink-700 leading-relaxed">
                {lang === 'ID' 
                  ? 'Sebelum melihat hasil analisis kelayakan kerja (Fit to Work), harap baca dan setujui peraturan integritas keselamatan berikut ini:' 
                  : 'Before viewing your safety assessment result, please read and confirm the following regulations:'}
              </p>

              <div data-ui className="bg-ink-50 border border-rule flex flex-col gap-3 p-4 rounded-xl text-xs leading-relaxed text-ink-800 select-text">
                <div className="flex gap-2.5 items-start">
                  <span className="text-danger-600 font-extrabold shrink-0">•</span>
                  <span>
                    <b>{lang === 'ID' ? 'Pernyataan Sebenarnya:' : 'Declaration of Truth:'}</b>{' '}
                    {lang === 'ID' 
                      ? 'Saya menyatakan dengan sebenar-benarnya bahwa seluruh data jam tidur, konsumsi obat, dan kesiapan fokus yang diisi adalah data yang jujur sesuai kondisi nyata yang saya alami.'
                      : 'I solemnly declare and testify that all sleeping hours, medications, and mental focus levels entered are true and represent my actual condition.'}
                  </span>
                </div>

                <div className="flex gap-2.5 items-start">
                  <span className="text-danger-600 font-extrabold shrink-0">•</span>
                  <span>
                    <b>{lang === 'ID' ? 'Sanksi Peraturan Perusahaan:' : 'Company Regulation Actions:'}</b>{' '}
                    <span className="text-danger-700 font-bold">
                      {lang === 'ID' 
                        ? 'Apabila saya memberikan data yang tidak benar atau memanipulasi informasi, maka saya bersedia diberikan sanksi kedisiplinan sesuai Peraturan Perusahaan PT. Wahana Bara Sentosa.'
                        : 'Any false representation of safety and sleep data will subject me to strict disciplinary actions in accordance with the Company Regulations of PT. Wahana Bara Sentosa.'}
                    </span>
                  </span>
                </div>

                <div data-ui className="flex gap-2.5 items-start pt-2 border-t border-dashed border-ink-300">
                  
                  <span className="text-xs text-ink-500 italic">
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
                  className="w-full bg-danger-600 hover:bg-danger-500 text-white font-black py-4 px-4 rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  {lang === 'ID' ? ' SAYA SETUJU & KIRIM' : ' I AGREE & SUBMIT'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmSubmitModal(false)}
                  className="w-full bg-white hover:bg-ink-50 border border-ink-300 text-ink-700 font-extrabold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer text-center"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-6 z-50 select-none animate-fadeIn">
          <div data-ui className="bg-white rounded-2xl border border-ink-200 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden text-ink-800">
            
            {/* Drawer Header */}
            <div data-ui className="bg-ink-50 px-6 py-4 border-b border-ink-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-ink-950 flex items-center gap-2">
                  <Database className="w-4 h-4 text-safe-600" />
                  <span>{lang === 'ID' ? 'Arsip Database Penilaian' : 'Shift Fatigue Registry logs'}</span>
                </h3>
                <p className="text-xs text-ink-500">PT. Wahana Bara Sentosa</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowHistoryOverlay(false)}
                className="bg-ink-100 hover:bg-ink-200 text-ink-600 py-1.5 px-3 border border-ink-300 rounded-lg font-black cursor-pointer text-xs transition"
              >
                
              </button>
            </div>

            {/* Filter Search Field */}
            <div data-ui className="px-5 py-3.5 bg-white border-b border-rule flex flex-col sm:flex-row gap-2.5 items-center">
              <label className="text-xs font-extrabold text-ink-500 shrink-0">
                {lang === 'ID' ? 'Cari NIK Karyawan:' : 'Search Employee NIK:'}
              </label>
              <div className="relative w-full">
                <input 
                  type="text"
                  className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-3 pl-8 text-xs tabular-nums text-ink-900 focus:ring-1 focus:ring-danger-500 font-bold"
                  placeholder={lang === 'ID' ? 'Masukkan NIK untuk filter...' : 'Enter NIK to filter...'}
                  value={historyNikFilter}
                  onChange={(e) => setHistoryNikFilter(e.target.value)}
                />
                
              </div>
              {historyNikFilter && (
                <button 
                  type="button" 
                  onClick={() => setHistoryNikFilter('')}
                  className="text-xs text-danger-600 hover:underline shrink-0 font-extrabold tracking-tight"
                >
                  {lang === 'ID' ? 'Reset' : 'Clear'}
                </button>
              )}
            </div>

            {/* List entries */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3.5 bg-ink-50">
              {filteredHistory.length === 0 ? (
                <div data-ui className="py-12 text-center text-ink-500 border border-dashed border-ink-300 rounded-xl bg-white">
                  <p className="text-3xl mb-2"></p>
                  <p className="text-xs font-extrabold text-ink-600">
                    {lang === 'ID' ? 'Arsip Tidak Ditemukan' : 'Records Not Found'}
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    {historyNikFilter 
                      ? (lang === 'ID' ? `Tidak ada pengisian untuk NIK: "${historyNikFilter.toUpperCase()}"` : `No records match NIK: "${historyNikFilter.toUpperCase()}"`) 
                      : (lang === 'ID' ? 'Lakukan penilaian dan klik simpan.' : 'Run assessment and click save.')
                    }
                  </p>
                </div>
              ) : (
                filteredHistory.map((record, index) => (
                  <div data-ui key={record.id ? `${record.id}-${index}` : index} className="bg-white border border-ink-200 p-4 rounded-xl flex flex-col gap-2.5 relative">
                    
                    {/* Top Row ID */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs tabular-nums text-ink-500 block font-bold">
                          {record.tanggalPengisian} • {record.jamPengisian} • ID: {record.id}
                        </span>
                        <span className="text-sm font-black text-ink-900 block mt-0.5">{record.nama}</span>
                        <span className="text-xs tabular-nums text-ink-500 block font-bold mt-0.5">{record.nik} • {record.jabatan}</span>
                      </div>
                      
                      {/* Decision pill */}
                      <span data-ui className={`px-2.5 py-1 rounded text-xs font-black  text-center ${
                        record.finalDecision === 'FIT' ? 'bg-safe-50 text-safe-700 border border-safe-200' :
                        record.finalDecision === 'FIT_CONDITIONAL' ? 'bg-warn-50 text-warn-700 border border-warn-200 font-bold' :
                        record.finalDecision === 'REST_BEFORE_WORK' ? 'bg-caution-50 text-caution-700 border border-caution-200' :
                        'bg-danger-50 text-danger-700 border border-danger-200 '
                      }`}>
                        {record.finalDecision === 'FIT' && (lang === 'ID' ? 'Bekerja Normal' : 'FIT')}
                        {record.finalDecision === 'FIT_CONDITIONAL' && (lang === 'ID' ? 'Normal (Dengan Pengawasan)' : 'FIT CONDITIONAL')}
                        {record.finalDecision === 'REST_BEFORE_WORK' && (lang === 'ID' ? 'Istirahat Dahulu' : 'REST MANDATORY')}
                        {record.finalDecision === 'UNFIT' && (lang === 'ID' ? 'Tidak Boleh Bekerja' : 'UNFIT')}
                      </span>
                    </div>

                    {/* Sleep analytics breakdown with Jam Tidur & Jam Bangun */}
                    <div data-ui className="grid grid-cols-3 gap-2 py-2 border-t border-b border-ink-100 text-xs tabular-nums">
                      <div>
                        <span className="text-ink-400 block text-xs font-bold">{lang === 'ID' ? 'Total Tidur 12J' : 'TOTAL SLEEP'}</span>
                        <span className="font-extrabold text-ink-700 mt-0.5 block">{record.totalSleep12} Jam</span>
                      </div>
                      <div>
                        <span className="text-ink-400 block text-xs font-bold">{lang === 'ID' ? 'Tidur 36J' : 'SLEEP 36h'}</span>
                        <span className="font-extrabold text-ink-700 mt-0.5 block">{record.totalSleep36} Jam</span>
                      </div>
                      <div>
                        <span className="text-ink-400 block text-xs font-bold">{lang === 'ID' ? 'Fatigue Skor' : 'FATIGUE SCORE'}</span>
                        <span className="font-bold text-danger-600 mt-0.5 block">{record.totalFatigueScore}</span>
                      </div>
                    </div>

                    {/* Detail Jam Tidur & Bangun */}
                    <div data-ui className="bg-ink-50 p-2 rounded-lg border border-ink-200/70 text-xs tabular-nums flex flex-col gap-1">
                      <div className="flex items-center justify-between text-ink-700">
                        <span className="text-ink-400 font-bold text-xs"> Tidur 12 Jam:</span>
                        <span className="font-bold">
                          Tidur: <b>{record.sleep12Session1Bed || '-'}</b>  Bangun: <b>{record.sleep12Session1Wake || '-'}</b>
                        </span>
                      </div>
                      {record.hasSleep12Session2 && (
                        <div className="flex items-center justify-between text-ink-500 text-xs">
                          <span className="text-ink-400 font-bold text-xs"> Sesi 2:</span>
                          <span>Tidur: {record.sleep12Session2Bed || '-'}  Bangun: {record.sleep12Session2Wake || '-'}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-ink-600 text-xs">
                        <span className="text-ink-400 font-bold text-xs"> Tidur 36 Jam:</span>
                        <span className="font-semibold">
                          Tidur: <b>{record.sleep36Session1Bed || '-'}</b>  Bangun: <b>{record.sleep36Session1Wake || '-'}</b>
                        </span>
                      </div>
                    </div>

                    {/* Extras and actions */}
                    <div className="flex justify-between items-center pt-1.5">
                      <div className="flex gap-2">
                        {record.consumesObat && (
                          <span data-ui className="bg-warn-50 text-warn-700 px-1.5 py-0.5 rounded text-xs font-bold border border-warn-200"> {lang === 'ID' ? 'Obat' : 'Meds'}</span>
                        )}
                        {record.hasPersonalProblem && (
                          <span data-ui className="bg-danger-50 text-danger-700 px-1.5 py-0.5 rounded text-xs font-bold border border-danger-200"> {lang === 'ID' ? 'Stres' : 'Stress'}</span>
                        )}
                        {record.totalSleep12 < 6.0 && (
                          <span data-ui className="bg-ink-100 text-ink-600 px-1.5 py-0.5 rounded text-xs font-bold border border-ink-200"> {lang === 'ID' ? 'Low' : 'Low'}</span>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {/* Sync individually to Google sheets */}
                        {sheetsToken && spreadsheetId && (
                          <button 
                            type="button"
                            onClick={() => handlePushResultToSheets(record)}
                            className="text-xs font-black text-danger-600 hover:text-danger-500 transition cursor-pointer"
                          >
                             Backup
                          </button>
                        )}

                        {/* Print/Download individual report */}
                        <button 
                          type="button"
                          onClick={() => {
                            const details = `--- LAPORAN INDIVIDU Fit to Work WBS ---
ID: ${record.id}
Tanggal: ${record.tanggalPengisian} pukul ${record.jamPengisian}
Nama: ${record.nama} (${record.nik})
Jabatan: ${record.jabatan}
Dept: ${record.dept}

[JADWAL JAM TIDUR & BANGUN]
• Jam Mulai Tidur (12 Jam): ${record.sleep12Session1Bed || '-'}
• Jam Bangun Tidur (12 Jam): ${record.sleep12Session1Wake || '-'}
• Durasi Tidur 12 Jam: ${record.totalSleep12} Jam
${record.hasSleep12Session2 ? `• Sesi 2: Mulai ${record.sleep12Session2Bed || '-'} s/d Bangun ${record.sleep12Session2Wake || '-'}\n` : ''}• Jam Mulai Tidur (36 Jam): ${record.sleep36Session1Bed || '-'}
• Jam Bangun Tidur (36 Jam): ${record.sleep36Session1Wake || '-'}
• Total Jam Tidur 36 Jam: ${record.totalSleep36} Jam

[HASIL PENILAIAN]
• Skor Fatigue: ${record.totalFatigueScore}
• Kesiapan Kerja: ${record.readinessScore}%
• Keputusan: ${record.finalDecision === 'FIT' ? 'Fit to Work' : record.finalDecision === 'FIT_CONDITIONAL' ? 'BEKERJA DALAM Pengawasan Khusus' : record.finalDecision === 'REST_BEFORE_WORK' ? 'Wajib Istirahat Sebelum Bekerja' : 'Tidak Boleh Bekerja'}

PT. Wahana Bara Sentosa`;
                            notifyUser(details);
                          }}
                          className="text-xs font-bold text-ink-600 hover:text-ink-900 border border-ink-200 rounded px-1.5 py-0.5 hover:bg-ink-50 transition cursor-pointer"
                        >
                          {lang === 'ID' ? 'Cetak' : 'Detail'}
                        </button>

                        {/* Delete entry */}
                        <button 
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="text-xs font-bold text-danger-600 hover:text-danger-700 transition cursor-pointer"
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
            <div data-ui className="bg-ink-100 p-3 flex justify-between items-center text-center border-t border-ink-200 gap-2">
              {sheetsToken && spreadsheetId && history.length > 0 && (
                <button 
                  type="button"
                  onClick={handleBulkUploadHistory}
                  className="text-xs font-black bg-safe-600 hover:bg-safe-500 text-white rounded px-3 py-1.5 cursor-pointer text-left transition"
                >
                   Backup Semua ke Sheets
                </button>
              )}
              {history.length > 0 && (
                <button 
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      title: lang === 'ID' ? 'Hapus Seluruh Riwayat' : 'Purge All Records',
                      message: lang === 'ID'
                        ? 'Hapus seluruh log riwayat penilaian di cloud dan penyimpanan lokal?'
                        : 'Purge all cloud and local assessment records permanently?',
                      onConfirm: async () => {
                        try {
                          await fetch('/api/history/clear', { method: 'POST' });
                        } catch (e) {
                          console.error("Failed to clear history on server", e);
                        }
                        saveToHistory([]);
                        notifyUser(lang === 'ID' ? 'Seluruh riwayat penilaian telah dibersihkan.' : 'All records cleared.', 'info');
                      }
                    });
                  }}
                  className="text-xs tabular-nums font-bold text-danger-600 hover:text-danger-700 ml-auto py-1 px-3 cursor-pointer"
                >
                   Purge Semua
                </button>
              )}
            </div>

            {/* Top Close Footer */}
            <div data-ui className="p-4 bg-white text-center border-t border-ink-200">
              <button 
                type="button"
                onClick={() => setShowHistoryOverlay(false)}
                className="w-full bg-ink-800 hover:bg-ink-950 font-bold py-2 px-6 rounded-lg text-xs cursor-pointer text-white transition"
              >
                {lang === 'ID' ? 'Kembali Ke Menu Utama' : 'Close Registry Logs'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------------------- */}
      {/* HALAMAN ADMIN TERSENDIRI (DEDICATED FULL-SCREEN ADMIN PAGE) */}
      {/* ---------------------------------------------------------------------------------- */}
      {isAdminPage && (
        <div className="fixed inset-0 z-50 bg-ink-100 overflow-y-auto flex flex-col font-sans">
          
          {/* Header Navigasi Halaman Admin */}
          <header data-ui className="bg-ink-900 text-white border-b border-ink-800 sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAdminPage(false);
                    window.location.hash = '';
                    setEditingEmpNik(null);
                    setSelectedDashboardRecordId(null);
                  }}
                  className="bg-ink-800 hover:bg-ink-700 text-ink-100 hover:text-white px-3.5 py-1.5 rounded-lg border border-ink-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-danger-400" />
                  <span>{lang === 'ID' ? '← Kembali ke Formulir Asesmen' : '← Back to Assessment Form'}</span>
                </button>

                <div className="h-6 w-px bg-ink-700 hidden sm:block"></div>

                <div className="flex items-center gap-2.5">
                  <div className="bg-white p-1 rounded-md shrink-0">
                    <img 
                      src="https://res.cloudinary.com/dgjnlxf69/image/upload/v1790130590/Logo_FTW_ul1dz4.png" 
                      alt="Logo FTW" 
                      className="h-7 w-auto object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/logo-ftw.png';
                      }}
                    />
                  </div>
                  <div>
                    <h1 className="text-sm font-black text-white leading-none">
                      {lang === 'ID' ? 'Halaman Admin Pusat' : 'Central Admin Portal'}
                    </h1>
                    <p className="text-xs text-ink-400 font-medium leading-none mt-1">
                      PT. Wahana Bara Sentosa • Fatigue Management System
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setLang(lang === 'ID' ? 'EN' : 'ID')}
                  className="text-xs font-bold bg-ink-800 hover:bg-ink-700 border border-ink-700 text-ink-200 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <span> {lang}</span>
                </button>

                {isAdminAuthenticated ? (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdminAuthenticated(false);
                      safeStorage.removeSession('wbs_admin_auth');
                      setAdminUsernameInput('');
                      setAdminPasswordInput('');
                    }}
                    className="bg-danger-900 hover:bg-danger-800 text-danger-100 hover:text-white border border-danger-700 rounded-lg py-1.5 px-3 font-bold text-xs cursor-pointer transition flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdminPage(false);
                      window.location.hash = '';
                    }}
                    className="bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-700 rounded-lg py-1.5 px-3 font-bold text-xs cursor-pointer transition"
                  >
                     Tutup
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Kontainer Utama Halaman Admin */}
          <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col">
            {uiBanner && (
              <div data-ui className={`mb-4 p-3.5 rounded-xl border text-xs font-semibold flex items-start justify-between gap-3 ${
                uiBanner.type === 'error'
                  ? 'bg-danger-50 border-danger-200 text-danger-800'
                  : uiBanner.type === 'success'
                    ? 'bg-safe-50 border-safe-200 text-safe-800'
                    : 'bg-info-50 border-info-200 text-info-800'
              }`}>
                <span className="whitespace-pre-wrap leading-relaxed">{uiBanner.text}</span>
                <button
                  type="button"
                  onClick={() => setUiBanner(null)}
                  className="text-xs font-bold px-2.5 py-1 rounded border border-current shrink-0 cursor-pointer"
                >
                  {lang === 'ID' ? 'Tutup' : 'Close'}
                </button>
              </div>
            )}
            <div data-ui className="bg-white rounded-2xl border border-ink-200 flex flex-col flex-1 overflow-hidden">

            {!isAdminAuthenticated ? (
              /* SECURE LOGIN SCREEN */
              <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-ink-50 flex items-center justify-center">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (adminUsernameInput.trim() === 'admin' && adminPasswordInput === DEFAULT_ADMIN_PASSWORD) {
                      setIsAdminAuthenticated(true);
                      safeStorage.setSession('wbs_admin_auth', 'true');
                      setAdminLoginError('');
                    } else {
                      setAdminLoginError(lang === 'ID' ? 'Username atau password salah!' : 'Invalid username or password!');
                    }
                  }}
                  className="bg-white rounded-2xl border border-ink-200 p-6 sm:p-8 max-w-md w-full"
                >
                  <div className="text-center mb-6">
                    <div data-ui className="bg-danger-50 border border-danger-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                      <ShieldAlert className="w-7 h-7 text-danger-700" />
                    </div>
                    <h4 className="text-base font-black text-ink-900">
                      {lang === 'ID' ? 'Verifikasi Keamanan' : 'Security Clearance Check'}
                    </h4>
                    <p className="text-xs text-ink-500 mt-1">
                      {lang === 'ID' ? 'Bagian ini dilindungi sandi untuk hak akses Administrator WBS.' : 'This panel is secure and requires authorization to manage records.'}
                    </p>
                  </div>

                  {adminLoginError && (
                    <div data-ui className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg p-3 text-xs font-bold mb-4 text-center">
                       {adminLoginError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-ink-600 mb-1">
                        {lang === 'ID' ? 'Username Pengguna:' : 'Admin Username:'}
                      </label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-ink-50 border border-rule rounded-lg py-2 px-3 text-xs font-bold text-ink-900 focus:ring-1 focus:ring-danger-500"
                        placeholder="Masukkan username..."
                        value={adminUsernameInput}
                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-ink-600 mb-1">
                        Password:
                      </label>
                      <input 
                        type="password"
                        required
                        className="w-full bg-ink-50 border border-rule rounded-lg py-2 px-3 text-xs tabular-nums font-bold text-ink-900 focus:ring-1 focus:ring-danger-500"
                        placeholder="••••••••"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                      />
                    </div>



                    <button
                      type="submit"
                      className="w-full bg-danger-700 hover:bg-danger-800 text-white font-black py-2.5 px-4 rounded-lg text-xs cursor-pointer text-center transition"
                    >
                       {lang === 'ID' ? 'Masuk Panel Admin' : 'Verify & Sign In'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* AUTHENTICATED ADMIN DASHBOARD & SYSTEM CONTROLS */
              <>
                {/* Tab segment buttons */}
                <div data-ui className="bg-ink-50 px-6 py-2 border-b border-ink-200 flex items-center gap-1.5 shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('dashboard')}
                    className={`py-2 px-3 rounded-lg font-black text-xs   cursor-pointer transition shrink-0 ${
                      adminActiveTab === 'dashboard' 
                        ? 'bg-danger-600 text-white ' 
                        : 'bg-ink-100 hover:bg-ink-200 text-ink-700 border border-rule'
                    }`}
                  >
                     Fit to Work Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('employees')}
                    className={`py-2 px-3 rounded-lg font-black text-xs   cursor-pointer transition shrink-0 ${
                      adminActiveTab === 'employees' 
                        ? 'bg-danger-600 text-white ' 
                        : 'bg-ink-100 hover:bg-ink-200 text-ink-700 border border-rule'
                    }`}
                  >
                     {lang === 'ID' ? 'Karyawan Aktif' : 'Employee Database'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('trends')}
                    className={`py-2 px-3 rounded-lg font-black text-xs   cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                      adminActiveTab === 'trends' 
                        ? 'bg-danger-600 text-white ' 
                        : 'bg-ink-100 hover:bg-ink-200 text-ink-700 border border-rule'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-danger-500" />
                    <span> {lang === 'ID' ? 'Analisis Trend & Frekuensi' : 'Trend & Frequency Analysis'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('integrations')}
                    className={`py-2 px-3 rounded-lg font-black text-xs   cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                      adminActiveTab === 'integrations' 
                        ? 'bg-danger-600 text-white ' 
                        : 'bg-ink-100 hover:bg-ink-200 text-ink-700 border border-rule'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 text-ink-600" />
                    <span> {lang === 'ID' ? 'Integrasi & Cloud Backup' : 'Integrations & Cloud'}</span>
                  </button>
                </div>

                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-ink-50">
                  
                  {/* TAB 1: INTERACTIVE FATIGUE & Fit to Work DASHBOARD */}
                  {adminActiveTab === 'dashboard' && (() => {
                    // Helper to normalize date strings to YYYY-MM-DD
                    const normalizeDateStr = (d?: string) => {
                      if (!d) return '';
                      const clean = d.trim().split(' ')[0].replace(/\//g, '-');
                      const parts = clean.split('-');
                      if (parts.length === 3) {
                        if (parts[0].length === 4) {
                          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`; // taste-skill-ignore
                        } else if (parts[2].length === 4) {
                          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // taste-skill-ignore
                        }
                      }
                      return clean;
                    };

                    const searchQueryClean = adminSearchQuery.trim().toLowerCase();
                    const isSearching = searchQueryClean.length > 0;

                    // 1. Gather records in the selected Period (Date range & Shift) for overall KPI Summary
                    // Note: When actively searching for a specific employee, NIK, or Ticket ID, do not let shift dropdown hide the result!
                    const periodRecords = deduplicateAssessments(history).filter(record => {
                      const recDate = normalizeDateStr(record.tanggalPengisian || record.timestamp);
                      if (adminFilterStartDate && recDate && recDate < adminFilterStartDate) {
                        return false;
                      }
                      if (adminFilterEndDate && recDate && recDate > adminFilterEndDate) {
                        return false;
                      }
                      
                      // Shift filters: only enforce if user is NOT actively typing a search query
                      if (!isSearching && adminFilterShift !== 'ALL') {
                        const isDayShift = checkIsDayShift(record.jamPengisian || (record.timestamp ? record.timestamp.split(' ')[1] : ''));
                        if (adminFilterShift === 'DAY' && !isDayShift) return false;
                        if (adminFilterShift === 'NIGHT' && isDayShift) return false;
                      }

                      return true;
                    });

                    // Stats breakdown for the selected period
                    const periodTotalCount = periodRecords.length;
                    const fitCount = periodRecords.filter(r => r.finalDecision === 'FIT').length;
                    const fitCondCount = periodRecords.filter(r => r.finalDecision === 'FIT_CONDITIONAL').length;
                    const restCount = periodRecords.filter(r => r.finalDecision === 'REST_BEFORE_WORK').length;
                    const unfitCount = periodRecords.filter(r => r.finalDecision === 'UNFIT').length;
                    const problematicCount = periodTotalCount - fitCount;
                    const anomalyRecords = periodRecords.filter(r => checkAssessmentAnomalies(r).hasAnomaly);
                    const anomalyCount = anomalyRecords.length;

                    // 2. Gather records filtered for table view (applying Status & Name/NIK/ID Search filter)
                    let filteredRecords = deduplicateAssessments(periodRecords.filter(record => {
                      if (adminFilterStatus === 'ANOMALY') {
                        return checkAssessmentAnomalies(record).hasAnomaly;
                      } else if (adminFilterStatus === 'PROBLEMATIC') {
                        return record.finalDecision !== 'FIT';
                      } else if (adminFilterStatus !== 'ALL') {
                        return record.finalDecision === adminFilterStatus;
                      }
                      return true;
                    }));

                    if (isSearching) {
                      filteredRecords = filteredRecords.filter(record => 
                        (record.nama && record.nama.toLowerCase().includes(searchQueryClean)) ||
                        (record.nik && record.nik.toLowerCase().includes(searchQueryClean)) ||
                        (record.dept && record.dept.toLowerCase().includes(searchQueryClean)) ||
                        (record.jabatan && record.jabatan.toLowerCase().includes(searchQueryClean)) ||
                        (record.id && record.id.toLowerCase().includes(searchQueryClean)) ||
                        (record.originalId && record.originalId.toLowerCase().includes(searchQueryClean))
                      );
                    }

                    // Strict chronological newest-first sort so recent shift entries always appear on top
                    filteredRecords.sort((a, b) => {
                      const dateA = normalizeDateStr(a.tanggalPengisian || a.timestamp || '');
                      const dateB = normalizeDateStr(b.tanggalPengisian || b.timestamp || '');
                      if (dateA !== dateB) return dateB.localeCompare(dateA);
                      const timeA = (a.jamPengisian || '').padStart(5, '0');
                      const timeB = (b.jamPengisian || '').padStart(5, '0');
                      return timeB.localeCompare(timeA);
                    });

                    return (
                      <div className="flex flex-col gap-6">
                        {/* Interactive Toolbar Filter */}
                        <div data-ui className="bg-white rounded-xl border border-ink-200 p-4">
                          <h4 className="text-xs font-black text-danger-800 mb-3 flex items-center gap-1.5">
                            
                            <span>{lang === 'ID' ? 'Penyaringan Periode, Status, Shift & Karyawan' : 'Filter Period, Status, Shift & Employee'}</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                            <div>
                              <label className="block text-xs font-black text-ink-600 mb-1">
                                {lang === 'ID' ? 'Tanggal Mulai:' : 'Start Date:'}
                              </label>
                              <input 
                                type="date"
                                className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2.5 text-xs font-bold text-ink-900"
                                value={adminFilterStartDate}
                                onChange={(e) => setAdminFilterStartDate(e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-black text-ink-600 mb-1">
                                {lang === 'ID' ? 'Tanggal Selesai:' : 'End Date:'}
                              </label>
                              <input 
                                type="date"
                                className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2.5 text-xs font-bold text-ink-900"
                                value={adminFilterEndDate}
                                onChange={(e) => setAdminFilterEndDate(e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-black text-ink-600 mb-1">
                                {lang === 'ID' ? 'Pilih Shift:' : 'Filter Shift:'}
                              </label>
                              <select 
                                className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2 text-xs font-bold text-ink-900 cursor-pointer focus:ring-1 focus:ring-danger-500"
                                value={adminFilterShift}
                                onChange={(e) => setAdminFilterShift(e.target.value as any)}
                              >
                                <option value="ALL">{lang === 'ID' ? ' Semua Shift' : 'All Shifts'}</option>
                                <option value="DAY">{lang === 'ID' ? ' Shift Siang (Input 01:00 - 07:00)' : 'Day Shift (Input 01:00 - 07:00)'}</option>
                                <option value="NIGHT">{lang === 'ID' ? ' Shift Malam (Input 13:00 - 19:00)' : 'Night Shift (Input 13:00 - 19:00)'}</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-black text-ink-600 mb-1">
                                {lang === 'ID' ? 'Status Kelayakan:' : 'Fitness Status:'}
                              </label>
                              <select 
                                className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2 text-xs font-bold text-ink-950 cursor-pointer focus:ring-1 focus:ring-danger-500 font-extrabold"
                                value={adminFilterStatus}
                                onChange={(e) => setAdminFilterStatus(e.target.value as any)}
                              >
                                <option value="ALL"> {lang === 'ID' ? 'Semua Status (Seluruh Laporan)' : 'All Status (Show All)'}</option>
                                <option value="ANOMALY"> {lang === 'ID' ? 'Hanya Data Aneh / Manipulasi Jam (Rahasia Pengawas)' : 'Suspicious / Anomaly Data Only'}</option>
                                <option value="PROBLEMATIC"> {lang === 'ID' ? 'Hanya Bermasalah (Kurang/Tidak Fit)' : 'Problematic / Kurang Fit Only'}</option>
                                <option value="FIT"> Fit to Work</option>
                                <option value="FIT_CONDITIONAL"> BEKERJA DALAM Pengawasan Khusus</option>
                                <option value="REST_BEFORE_WORK"> Wajib Istirahat Sebelum Bekerja</option>
                                <option value="UNFIT"> Tidak Boleh Bekerja</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-black text-ink-600 mb-1">
                                {lang === 'ID' ? 'Cari Nama / NIK:' : 'Search Name / NIK:'}
                              </label>
                              <div className="relative">
                                <input 
                                  type="text"
                                  placeholder={lang === 'ID' ? 'Ketik nama / NIK...' : 'Search name / NIK...'}
                                  className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 pl-6 pr-2 text-xs font-bold text-ink-900 placeholder:text-ink-400 placeholder:font-normal"
                                  value={adminSearchQuery}
                                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                                />
                                
                              </div>
                            </div>
                          </div>

                          <div data-ui className="mt-3.5 flex flex-wrap justify-between items-center bg-ink-50 border border-ink-200/60 p-2 rounded-lg gap-2">
                            <span className="text-xs text-ink-500 font-semibold">
                              * {lang === 'ID' ? 'Kriteria Shift dinilai berdasarkan jam pengisian sertifikat laporan secara tepat.' : 'Shift determined based on the exact submission timestamp hour.'}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const niks = Array.from(new Set(periodRecords.map(r => r.nik))).filter(Boolean);
                                  if (niks.length === 0) {
                                    notifyUser(lang === 'ID' ? 'Tidak ada data NIK pada filter ini' : 'No NIKs in this filter');
                                    return;
                                  }
                                  navigator.clipboard.writeText(niks.join('\n'));
                                  notifyUser(lang === 'ID' ? ` Berhasil menyalin ${niks.length} NIK karyawan/operator untuk shift & tanggal ini ke clipboard!` : ` Copied ${niks.length} operator NIKs to clipboard!`);
                                }}
                                className="bg-safe-600 hover:bg-safe-700 text-white text-xs font-black py-1 px-2.5 rounded cursor-pointer transition flex items-center gap-1"
                                title="Salin daftar NIK ke clipboard untuk setting operator"
                              >
                                 Salin Daftar NIK ({Array.from(new Set(periodRecords.map(r => r.nik))).filter(Boolean).length})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminFilterStartDate('');
                                  setAdminFilterEndDate('');
                                  setAdminFilterShift('ALL');
                                  setAdminFilterStatus('ALL');
                                  setAdminSearchQuery('');
                                }}
                                className="bg-ink-200 hover:bg-ink-300 text-ink-700 text-xs font-black py-1 px-3 border border-ink-300 rounded cursor-pointer transition"
                              >
                                 Clear Filters
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Summary Widget Badge Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setAdminFilterStatus('ALL')}
                            className={`border rounded-xl p-3 text-center whitespace-nowrap cursor-pointer transition-colors ${adminFilterStatus === 'ALL' ? 'bg-ink-900 text-ink-50 border-ink-950 ring-2 ring-ink-400' : 'bg-elevated hover:bg-surface border-rule'}`}
                          >
                            <span className={`block text-xs font-bold ${adminFilterStatus === 'ALL' ? 'text-ink-200' : 'text-ink-500'}`}>{lang === 'ID' ? 'Total Penilaian' : 'Total Period'}</span>
                            <span className={`block text-xl tabular-nums font-black mt-1 ${adminFilterStatus === 'ALL' ? 'text-ink-50' : 'text-ink-900'}`}>{periodTotalCount}</span>
                            <span className={`text-xs font-semibold block mt-0.5 ${adminFilterStatus === 'ALL' ? 'text-ink-200' : 'text-ink-500'}`}>Laporan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminFilterStatus('PROBLEMATIC')}
                            className={`border rounded-xl p-3 text-center whitespace-nowrap cursor-pointer transition-colors ${adminFilterStatus === 'PROBLEMATIC' ? 'bg-danger-700 text-ink-50 border-danger-800 ring-2 ring-danger-400' : 'bg-danger-50 hover:bg-danger-100 border-danger-200'}`}
                          >
                            <span className={`block text-xs font-bold ${adminFilterStatus === 'PROBLEMATIC' ? 'text-ink-50' : 'text-danger-700'}`}>{lang === 'ID' ? 'Bermasalah' : 'Curbed Issues'}</span>
                            <span className={`block text-xl tabular-nums font-black mt-1 ${adminFilterStatus === 'PROBLEMATIC' ? 'text-ink-50' : 'text-danger-800'}`}>{problematicCount}</span>
                            <span className={`text-xs font-semibold block mt-0.5 ${adminFilterStatus === 'PROBLEMATIC' ? 'text-danger-100' : 'text-danger-600'}`}>({periodTotalCount > 0 ? Math.round((problematicCount/periodTotalCount)*100) : 0}%) Kurang Fit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminFilterStatus(adminFilterStatus === 'ANOMALY' ? 'ALL' : 'ANOMALY')}
                            className={`border rounded-xl p-3 text-center whitespace-nowrap cursor-pointer transition-colors ${
                              adminFilterStatus === 'ANOMALY'
                                ? 'bg-danger-600 text-ink-50 border-danger-700 ring-2 ring-danger-400' 
                                : anomalyCount > 0 
                                  ? 'bg-danger-50 hover:bg-danger-100 border-danger-300' 
                                  : 'bg-surface border-rule'
                            }`}
                            title="Filter karyawan yang mengisi data aneh / manipulasi jam (rahasia pengawas)"
                          >
                            <span className={`block text-xs font-bold ${adminFilterStatus === 'ANOMALY' ? 'text-ink-50' : 'text-danger-700'}`}>
                              {lang === 'ID' ? 'Data Anomali' : 'Anomalies'}
                            </span>
                            <span className={`block text-xl tabular-nums font-black mt-1 ${adminFilterStatus === 'ANOMALY' ? 'text-ink-50' : 'text-danger-800'}`}>
                              {anomalyCount}
                            </span>
                            <span className={`text-xs font-semibold block mt-0.5 ${adminFilterStatus === 'ANOMALY' ? 'text-danger-100' : 'text-danger-600'}`}>
                              {lang === 'ID' ? 'Rahasia Pengawas' : 'Supervisor Only'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminFilterStatus('FIT_CONDITIONAL')}
                            className={`border rounded-xl p-3 text-center whitespace-nowrap cursor-pointer transition-colors ${adminFilterStatus === 'FIT_CONDITIONAL' ? 'bg-warn-600 text-ink-50 border-warn-700 ring-2 ring-warn-400' : 'bg-warn-50 hover:bg-warn-100 border-warn-200'}`}
                          >
                            <span className={`block text-xs font-bold ${adminFilterStatus === 'FIT_CONDITIONAL' ? 'text-ink-50' : 'text-warn-700'}`}>Pengawasan</span>
                            <span className={`block text-xl tabular-nums font-black mt-1 ${adminFilterStatus === 'FIT_CONDITIONAL' ? 'text-ink-50' : 'text-warn-800'}`}>{fitCondCount}</span>
                            <span className={`text-xs font-semibold block mt-0.5 ${adminFilterStatus === 'FIT_CONDITIONAL' ? 'text-warn-100' : 'text-warn-600'}`}>Pantau</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminFilterStatus('REST_BEFORE_WORK')}
                            className={`border rounded-xl p-3 text-center whitespace-nowrap cursor-pointer transition-colors ${adminFilterStatus === 'REST_BEFORE_WORK' ? 'bg-caution-600 text-ink-50 border-caution-700 ring-2 ring-caution-400' : 'bg-caution-50 hover:bg-caution-100 border-caution-200'}`}
                          >
                            <span className={`block text-xs font-bold ${adminFilterStatus === 'REST_BEFORE_WORK' ? 'text-ink-50' : 'text-caution-700'}`}>Istirahat</span>
                            <span className={`block text-xl tabular-nums font-black mt-1 ${adminFilterStatus === 'REST_BEFORE_WORK' ? 'text-ink-50' : 'text-caution-800'}`}>{restCount}</span>
                            <span className={`text-xs font-semibold block mt-0.5 ${adminFilterStatus === 'REST_BEFORE_WORK' ? 'text-caution-100' : 'text-caution-600'}`}>Wajib Tidur</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAdminFilterStatus('UNFIT')}
                            className={`border rounded-xl p-3 text-center whitespace-nowrap cursor-pointer transition-colors ${adminFilterStatus === 'UNFIT' ? 'bg-danger-700 text-ink-50 border-danger-800 ring-2 ring-danger-400' : 'bg-danger-100 hover:bg-danger-200 border-danger-200'}`}
                          >
                            <span className={`block text-xs font-bold ${adminFilterStatus === 'UNFIT' ? 'text-ink-50' : 'text-danger-800'}`}>Tidak Fit</span>
                            <span className={`block text-xl tabular-nums font-black mt-1 ${adminFilterStatus === 'UNFIT' ? 'text-ink-50' : 'text-danger-900'}`}>{unfitCount}</span>
                            <span className={`text-xs font-semibold block mt-0.5 ${adminFilterStatus === 'UNFIT' ? 'text-danger-100' : 'text-danger-600'}`}>Dilarang</span>
                          </button>
                        </div>

                        {/* Table list */}
                        <div data-ui className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                          <div data-ui className="bg-danger-950/5 border-b border-ink-200 px-4 py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
                            <span className="text-xs font-black text-ink-900 flex items-center gap-1.5">
                              
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
                                onClick={() => syncAssessmentsFromCloud(true)}
                                disabled={isCloudSyncing}
                                className="bg-white hover:bg-ink-100 text-ink-700 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-ink-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title={lastCloudSyncTime ? `Terakhir sinkron: ${lastCloudSyncTime}` : 'Segarkan data'}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin text-safe-600' : 'text-ink-600'}`} />
                                <span className="hidden sm:inline">{isCloudSyncing ? (lang === 'ID' ? 'Memuat...' : 'Syncing...') : (lang === 'ID' ? 'Segarkan' : 'Refresh')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportExcel(filteredRecords)}
                                className="bg-safe-600 hover:bg-safe-700 font-bold text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Unduh data tabel ke format Excel (.xlsx)"
                              >
                                
                                <span>{lang === 'ID' ? 'Unduh Rekap (Excel)' : 'Download Excel (.xlsx)'}</span>
                              </button>
                              <span className="bg-ink-800 text-white text-xs px-2 py-1 tabular-nums font-bold rounded-full h-fit shrink-0">
                                {filteredRecords.length} Logs Match
                              </span>
                            </div>
                          </div>

                          {/* Active Search Result Banner */}
                          {isSearching && (
                            <div data-ui className="bg-info-50 border border-info-200 text-info-900 px-3.5 py-2.5 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                
                                <span>
                                  {lang === 'ID' ? 'Hasil pencarian untuk:' : 'Search results for:'} <span className="bg-info-200/80 px-1.5 py-0.5 rounded tabular-nums text-info-950 font-black">"{adminSearchQuery}"</span>
                                  <span className="ml-2 font-normal text-info-700">({filteredRecords.length} {lang === 'ID' ? 'laporan ditemukan di seluruh shift' : 'records matched across all shifts'})</span>
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => setAdminSearchQuery('')} 
                                className="text-danger-600 hover:text-danger-800 text-xs font-black underline cursor-pointer"
                              >
                                 {lang === 'ID' ? 'Hapus Pencarian' : 'Clear Search'}
                              </button>
                            </div>
                          )}

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-sans">
                              <thead>
                                <tr className="bg-ink-50 border-b border-ink-200 text-ink-500 font-black text-xs">
                                  <th className="px-4 py-3 text-center">{lang === 'ID' ? 'WAKTU LAPOR & ID TIKET' : 'DATE, TIME & TICKET ID'}</th>
                                  <th className="px-4 py-3">{lang === 'ID' ? 'IDENTITAS KARYAWAN' : 'EMPLOYEE IDENTITY'}</th>
                                  <th className="px-3 py-3 text-center">Shift</th>
                                  <th className="px-4 py-3 text-right">{lang === 'ID' ? 'Detail Jam Tidur' : 'Sleep Duration'}</th>
                                  <th className="px-4 py-3">{lang === 'ID' ? 'ASPEK RISIKO' : 'RISKY METRIC'}</th>
                                  <th className="px-4 py-3 text-center">{lang === 'ID' ? 'REKOMENDASI FIT' : 'FIT DECISION'}</th>
                                  <th className="px-4 py-3 text-center">AKSI</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-rule">
                                {filteredRecords.map((rec, index) => {
                                  // Parse shift
                                  const isDay = checkIsDayShift(rec.jamPengisian);
                                  
                                  // Sleep violation flags
                                  const sleepheroLow = rec.totalSleep12 < 6;
                                  
                                  // Anomaly detection check (Confidential supervisor detection)
                                  const anom = checkAssessmentAnomalies(rec);

                                  return (
                                    <tr key={rec.id ? `${rec.id}-${index}` : index} className={`hover:bg-ink-50/70 transition-colors ${
                                      rec.finalDecision === 'UNFIT' ? 'bg-danger-50/20' : 
                                      anom.hasAnomaly ? 'bg-danger-50/30' : 
                                      rec.finalDecision === 'REST_BEFORE_WORK' ? 'bg-caution-50/10' : ''
                                    }`}>
                                      <td className="px-4 py-3 text-center whitespace-nowrap align-middle">
                                        <div className="font-bold text-ink-900 tabular-nums text-xs">
                                          {rec.tanggalPengisian}
                                        </div>
                                        <div className="text-xs text-ink-400 font-semibold mt-0.5">
                                           {rec.jamPengisian}
                                        </div>
                                        <div data-ui className="text-xs tabular-nums text-ink-600 font-black bg-ink-100 border border-rule px-1.5 py-0.5 rounded mt-1 inline-block tracking-tight" title={`ID Tiket: ${rec.id}`}>
                                          ID: {rec.id}
                                        </div>
                                        {anom.hasAnomaly && (
                                          <div className="mt-1">
                                            <span data-ui 
                                              className="text-xs font-black text-danger-700 bg-danger-100 border border-danger-300 px-1.5 py-0.5 rounded tracking-tight inline-block"
                                              title={anom.reasons.join('\n')}
                                            >
                                               Data Anomali
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                      
                                      <td className="px-4 py-3 align-middle">
                                        <div className="font-black text-ink-900 text-xs flex items-center gap-1">
                                          <span>{rec.nama}</span>
                                          <span className="tabular-nums text-xs font-black text-ink-400">({rec.nik})</span>
                                        </div>
                                        <div className="text-xs text-ink-500 font-bold mt-0.5 tracking-tight">
                                          {rec.jabatan} • <span className="text-ink-400 font-medium">{rec.dept}</span>
                                        </div>
                                      </td>

                                      <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                                        {isDay ? (
                                          <span data-ui className="inline-flex items-center gap-0.5 bg-warn-50 border border-warn-200 text-warn-800 text-xs font-black px-1.5 py-0.5 rounded">
                                             Siang
                                          </span>
                                        ) : (
                                          <span data-ui className="inline-flex items-center gap-0.5 bg-info-50 border border-info-200 text-info-800 text-xs font-black px-1.5 py-0.5 rounded">
                                             Malam
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-right align-middle whitespace-nowrap tabular-nums">
                                        <div className="text-xs">
                                          <span className="font-bold text-ink-500 text-xs">12 Jam:</span>{' '}
                                          <span className={`tabular-nums font-black ${sleepheroLow ? 'text-danger-600' : 'text-ink-800'}`}>
                                            {rec.totalSleep12} Jam
                                          </span>
                                        </div>
                                        <div data-ui className="text-xs mt-1 pt-1 border-t border-rule">
                                          <span className="font-bold text-ink-400 text-xs">36 Jam:</span>{' '}
                                          <span className="tabular-nums font-bold text-ink-700">
                                            {rec.totalSleep36} Jam
                                          </span>
                                        </div>
                                      </td>

                                      <td className="px-4 py-3 align-middle">
                                        <div className="flex flex-col gap-1 max-w-[160px]">
                                          {anom.hasAnomaly && (
                                            <span data-ui 
                                              className="text-xs font-black text-danger-800 bg-danger-100 border border-danger-300 rounded px-1.5 py-0.5 w-fit leading-tight" 
                                              title={anom.reasons.join('\n')}
                                            >
                                               {anom.reasons[0].length > 40 ? anom.reasons[0].substring(0, 40) + '...' : anom.reasons[0]}
                                            </span>
                                          )}
                                          {rec.consumesObat && (
                                            <span data-ui className="text-xs font-bold text-warn-700 bg-warn-50 border border-warn-200 rounded px-1.5 py-0.5 w-fit">
                                               Obat / Meds
                                            </span>
                                          )}
                                          {rec.hasPersonalProblem && (
                                            <span data-ui className="text-xs font-bold text-danger-700 bg-danger-50 border border-danger-200 rounded px-1.5 py-0.5 w-fit">
                                               Masalah Keluarga
                                            </span>
                                          )}
                                          {rec.totalFatigueScore >= 6 ? (
                                            <span data-ui className="text-xs font-bold text-caution-700 bg-caution-50 border border-caution-200 rounded px-1.5 py-0.5 w-fit">
                                               Fatigue Score: {rec.totalFatigueScore}
                                            </span>
                                          ) : !anom.hasAnomaly && !rec.consumesObat && !rec.hasPersonalProblem ? (
                                            <span className="text-xs font-medium text-ink-400"> No risk drugs</span>
                                          ) : null}
                                        </div>
                                      </td>

                                      <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                        {rec.finalDecision === 'FIT' ? (
                                          <span data-ui className="inline-block px-2.5 py-1 bg-safe-100 text-safe-800 border border-safe-200 font-black text-xs rounded-lg">
                                             Fit to Work
                                          </span>
                                        ) : rec.finalDecision === 'FIT_CONDITIONAL' ? (
                                          <span data-ui className="inline-block px-2.5 py-1 bg-warn-100 text-warn-800 border border-warn-200 font-black text-xs rounded-lg">
                                             Pengawasan Khusus
                                          </span>
                                        ) : rec.finalDecision === 'REST_BEFORE_WORK' ? (
                                          <span data-ui className="inline-block px-2.5 py-1 bg-caution-100 text-caution-800 border border-caution-200 font-black text-xs rounded-lg">
                                             Wajib Istirahat
                                          </span>
                                        ) : (
                                          <span data-ui className="inline-block px-2.5 py-1 bg-danger-100 text-danger-800 border border-danger-200 font-black text-xs rounded-lg">
                                             Tidak Boleh Bekerja
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedDashboardRecordId(rec.id)}
                                          className="bg-ink-800 hover:bg-ink-900 font-bold text-white text-xs px-2.5 py-1 rounded transition-colors cursor-pointer tracking-tight"
                                        >
                                           Detail
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {filteredRecords.length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="py-16 text-center text-ink-400 font-bold bg-ink-50/40">
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

                        {/* DetailED DRILLDOWN MODAL OVERLAY */}
                        {selectedDashboardRecordId && (() => {
                          const det = history.find(r => r.id === selectedDashboardRecordId);
                          if (!det) return null;
                          return (
                            <div className="fixed inset-0 bg-ink-950/70 flex items-center justify-center p-4 z-[60] animate-fadeIn">
                              <div data-ui className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-ink-200 p-5 sm:p-6 text-ink-800 flex flex-col">
                                
                                {/* Header */}
                                <div data-ui className="border-b border-ink-200 pb-3 mb-4 flex justify-between items-start">
                                  <div>
                                    <span className="text-xs bg-ink-100 text-ink-600 font-black px-2 py-0.5 rounded">
                                      ID Rekap: {det.id}
                                    </span>
                                    <h4 className="text-base font-black text-danger-900 mt-1 tracking-tight">
                                       Diagnostik Kelelahan Fatigue
                                    </h4>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDashboardRecordId(null)}
                                    className="bg-ink-100 hover:bg-ink-200 border border-ink-300 text-ink-700 w-8 h-8 rounded-full flex items-center justify-center font-black cursor-pointer text-sm transition"
                                  >
                                    
                                  </button>
                                </div>

                                <div className="space-y-4 text-xs font-sans">
                                  {/* Confidential Anomaly Detection Alert Box for Supervisors */}
                                  {(() => {
                                    const anom = checkAssessmentAnomalies(det);
                                    if (!anom.hasAnomaly) return null;
                                    return (
                                      <div data-ui className="bg-danger-50 border-2 border-danger-500 rounded-xl p-4 animate-fadeIn">
                                        <div className="flex items-center gap-2 text-danger-800 font-black text-xs">
                                          
                                          <span>Temuan Anomali Pengisian (Rahasia Pengawas)</span>
                                        </div>
                                        <p className="text-xs text-danger-700 font-semibold mt-1 leading-snug">
                                          Sistem mendeteksi indikasi ketidakwajaran / manipulasi waktu tidur. Catatan ini hanya terlihat oleh pengawas/admin di fitur admin dan dirahasiakan sepenuhnya dari karyawan.
                                        </p>
                                        <div className="mt-2.5 space-y-1.5">
                                          {anom.reasons.map((r, i) => (
                                            <div data-ui key={i} className="text-xs font-bold text-danger-950 bg-white border border-danger-300 p-2.5 rounded-lg flex items-start gap-2">
                                              <span className="text-danger-600 tabular-nums text-sm leading-none shrink-0">•</span>
                                              <span className="leading-snug">{r}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Identity Card */}
                                  <div data-ui className="bg-ink-50 border border-ink-200 p-3.5 rounded-xl">
                                    <span className="block text-xs font-black text-ink-500 mb-1.5">Karyawan Terkait:</span>
                                    <div className="text-sm font-black text-ink-900">{det.nama}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-ink-600 font-semibold">
                                      <div>NIK: <span className="tabular-nums font-bold text-ink-800">{det.nik}</span></div>
                                      <div>DEPT: <span className="font-bold text-ink-800">{det.dept}</span></div>
                                      <div className="col-span-2">JABATAN: <span className="font-bold text-ink-800">{det.jabatan}</span></div>
                                    </div>
                                  </div>

                                  {/* Sleep Metrics breakdown with explicit Bedtime and Wake-up time */}
                                  <div data-ui className="border border-ink-200 rounded-xl p-3.5">
                                    <span className="block text-xs font-black text-ink-500 mb-2">Detail Analisis Rekap Tidur & Waktu:</span>
                                    
                                    <div className="space-y-2 mt-1">
                                      <div data-ui className="flex justify-between items-center text-xs border-b border-ink-100 pb-1.5">
                                        <span className="font-bold text-ink-600">Total Jam Tidur (12 Jam):</span>
                                        <span className={`tabular-nums font-black ${det.totalSleep12 < 6 ? 'text-danger-600' : 'text-safe-700'}`}>
                                          {det.totalSleep12} Jam {det.totalSleep12 < 6 ? '( KURANG)' : ' (Kategori Baik)'}
                                        </span>
                                      </div>

                                      <div data-ui className="flex justify-between items-center text-xs border-b border-ink-100 pb-1.5">
                                        <span className="font-bold text-ink-600">Total Jam Tidur 36 Jam Terakhir:</span>
                                        <span className="tabular-nums font-black text-ink-700">
                                          {det.totalSleep36} Jam
                                        </span>
                                      </div>

                                      <div data-ui className="flex justify-between items-center text-xs border-b border-ink-100 pb-1.5">
                                        <span className="font-bold text-ink-600">Fatigue Score (Skor Kelelahan):</span>
                                        <span className={`tabular-nums font-black ${det.totalFatigueScore >= 6 ? 'text-danger-600' : 'text-ink-700'}`}>
                                          {det.totalFatigueScore} / 12 {det.totalFatigueScore >= 6 ? '( TINGGI)' : ''}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-ink-600">Kesiapan Kerja (Readiness Score):</span>
                                        <span className="tabular-nums font-black text-safe-700 font-extrabold text-xs">
                                          {det.readinessScore}% Kesiapan
                                        </span>
                                      </div>
                                    </div>

                                    {/* Jam Mulai Tidur & Jam Bangun Section */}
                                    <div data-ui className="mt-3 pt-3 border-t border-ink-200">
                                      <span className="block text-xs font-black text-ink-500 mb-2">
                                         Detail Jadwal Jam Tidur & Jam Bangun:
                                      </span>
                                      <div data-ui className="bg-ink-50 p-3 rounded-lg border border-ink-200 space-y-2 text-xs tabular-nums">
                                        <div>
                                          <div className="text-xs font-sans font-bold text-ink-500">Sesi Utama (12 Jam Terakhir):</div>
                                          <div className="flex justify-between items-center mt-1">
                                            <span>Mulai Tidur: <b className="text-ink-900">{det.sleep12Session1Bed || '-'}</b></span>
                                            <span>Bangun: <b className="text-ink-900">{det.sleep12Session1Wake || '-'}</b></span>
                                          </div>
                                        </div>

                                        {det.hasSleep12Session2 && (
                                          <div data-ui className="pt-1.5 border-t border-dashed border-ink-200">
                                            <div className="text-xs font-sans font-bold text-ink-500">Sesi Tambahan 2 (12 Jam):</div>
                                            <div className="flex justify-between items-center mt-1">
                                              <span>Mulai: <b className="text-ink-900">{det.sleep12Session2Bed || '-'}</b></span>
                                              <span>Bangun: <b className="text-ink-900">{det.sleep12Session2Wake || '-'}</b></span>
                                            </div>
                                          </div>
                                        )}

                                        <div data-ui className="pt-1.5 border-t border-ink-200">
                                          <div className="text-xs font-sans font-bold text-ink-500">Evaluasi Tidur 36 Jam:</div>
                                          <div className="flex justify-between items-center mt-1">
                                            <span>Mulai Tidur: <b className="text-ink-900">{det.sleep36Session1Bed || '-'}</b></span>
                                            <span>Bangun: <b className="text-ink-900">{det.sleep36Session1Wake || '-'}</b></span>
                                          </div>
                                        </div>

                                        <div data-ui className="pt-1.5 border-t border-ink-200 text-ink-600 text-xs flex justify-between">
                                          <span className="font-sans font-semibold">Waktu Pengisian Aktual:</span>
                                          <span>{det.tanggalPengisian} pukul <b>{det.jamPengisian}</b></span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Medical & Personal Problem risk section */}
                                  <div data-ui className="border border-ink-200 rounded-xl p-3.5">
                                    <span className="block text-xs font-black text-ink-400 mb-1.5">Konteks Tambahan Risiko:</span>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div data-ui className="bg-ink-50/50 p-2 rounded border border-rule">
                                        <span className="block text-xs text-ink-500 font-bold">Konsumsi Obat Dokter:</span>
                                        <span className={`font-extrabold block mt-0.5 ${det.consumesObat ? 'text-danger-600' : 'text-safe-600'}`}>
                                          {det.consumesObat ? ' YA (RECON)' : ' TIDAK'}
                                        </span>
                                      </div>
                                      
                                      <div data-ui className="bg-ink-50/50 p-2 rounded border border-rule">
                                        <span className="block text-xs text-ink-500 font-bold">Masalah Pribadi Keluarga:</span>
                                        <span className={`font-extrabold block mt-0.5 ${det.hasPersonalProblem ? 'text-danger-600' : 'text-safe-600'}`}>
                                          {det.hasPersonalProblem ? ' YA (CURBED)' : ' TIDAK'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Rekomendasi Follow Up */}
                                  <div data-ui className="bg-danger-50 border border-danger-100 rounded-xl p-4">
                                    <span className="block text-xs tabular-nums font-black text-danger-900 mb-1.5">
                                       Rekomendasi Tindak Lanjut (PT. WBS):
                                    </span>
                                    <div className="font-bold text-ink-800 text-xs leading-relaxed space-y-2">
                                      {(() => {
                                        const totalSleep12 = det.totalSleep12 || 0;
                                        if (totalSleep12 < 6.0) {
                                          const deficit = parseFloat((6.0 - totalSleep12).toFixed(1));
                                          return (
                                            <p className="text-danger-800">
                                               Karyawan kurang tidur sebanyak <b>{deficit} jam</b> dari standar minimal 6 jam. Rekomendasi follow up adalah <b>tidur {deficit} jam sebelum mulai bekerja</b>.
                                            </p>
                                          );
                                        } else {
                                          return (
                                            <p className="text-safe-800">
                                               Karyawan telah memenuhi standar jam tidur minimal yaitu 6 jam harian (Total tidur: {totalSleep12} jam). Tidak diperlukan tambahan istirahat wajib.
                                            </p>
                                          );
                                        }
                                      })()}
                                      
                                      <p data-ui className="mt-1.5 text-ink-600 border-t border-danger-100 pt-1.5 text-xs">
                                        <b>Klasifikasi Status ({det.finalDecision}):</b>{' '}
                                        {det.finalDecision === 'FIT' && 'Fit to Work - Karyawan layak melaksanakan tugas.'}
                                        {det.finalDecision === 'FIT_CONDITIONAL' && 'BEKERJA DALAM Pengawasan Khusus - Pengawasan ketat di lapangan oleh Foreman.'}
                                        {det.finalDecision === 'REST_BEFORE_WORK' && 'Wajib Istirahat Sebelum Bekerja - Mandat wajib beristirahat tidur siang / tidur pulas.'}
                                        {det.finalDecision === 'UNFIT' && 'Tidak Boleh Bekerja - Dilarang keras mengoperasikan unit atau turun ke lapangan.'}
                                      </p>
                                    </div>
                                    {(det.consumesObat || det.hasPersonalProblem) && (
                                      <div data-ui className="mt-2.5 pt-2 border-t border-danger-200 text-xs text-ink-800 flex flex-col gap-1.5 leading-relaxed">
                                        {det.consumesObat && (
                                          <p> <b>Rekomendasi Medikasi:</b> Mengonsumsi obat efek kantuk. Dilarang mengoperasikan unit critical / alat berat selama 4 jam ke depan. Karyawan WAJIB lapor SHE atau Paramedis.</p>
                                        )}
                                        {det.hasPersonalProblem && (
                                          <p> <b>Rekomendasi Konsentrasi:</b> Masalah stres / konsentrasi terganggu. Wajib pengawasan foreman & karyawan WAJIB konseling dengan pengawas.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                </div>

                                {/* Actions */}
                                <div data-ui className="mt-5 pt-3 border-t border-ink-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    disabled={isSendingModalWa}
                                    onClick={async () => {
                                      setIsSendingModalWa(true);
                                      try {
                                        const result = await handleDispatchRecordAlert(det);
                                        if (result.success) {
                                          notifyUser(` ${result.message}`);
                                        } else {
                                          notifyUser(` Gagal: ${result.message}`);
                                        }
                                      } catch (err: any) {
                                        notifyUser(` Galat: ${err.message || 'Gagal mengirim alert'}`);
                                      } finally {
                                        setIsSendingModalWa(false);
                                      }
                                    }}
                                    className="bg-safe-600 hover:bg-safe-700 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Send className={`w-3.5 h-3.5 ${isSendingModalWa ? '' : ''}`} />
                                    <span>{isSendingModalWa ? (lang === 'ID' ? 'Mengirim...' : 'Sending...') : (lang === 'ID' ? 'Kirim Alert ke Grup WA' : 'Send Alert to WA Group')}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedDashboardRecordId(null)}
                                    className="bg-ink-950 hover:bg-black font-black text-white text-xs py-1.5 px-3 rounded cursor-pointer"
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
                        <div data-ui className="lg:col-span-3 bg-white rounded-xl border border-ink-200 p-4 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-black text-danger-800 mb-3 flex items-center gap-2">
                              
                              <span>{lang === 'ID' ? 'Tambah Data Karyawan Baru' : 'Add New Employee Record'}</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-black text-ink-600 mb-1">NIK:</label>
                                <input 
                                  type="text"
                                  className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2.5 text-xs tabular-nums font-black placeholder-ink-400 focus:ring-1 focus:ring-danger-500 text-ink-900"
                                  placeholder="9 digit NIK (tanpa angka 0 di depan)"
                                  value={newEmpNik}
                                  onChange={(e) => setNewEmpNik(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-black text-ink-600 mb-1">{lang === 'ID' ? 'Nama:' : 'Name:'}</label>
                                <input 
                                  type="text"
                                  className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2.5 text-xs font-bold placeholder-ink-400 focus:ring-1 focus:ring-danger-500 text-ink-900"
                                  placeholder="Nama Lengkap Karyawan"
                                  value={newEmpNama}
                                  onChange={(e) => setNewEmpNama(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-black text-ink-600 mb-1">{lang === 'ID' ? 'Jabatan:' : 'Position:'}</label>
                                <input 
                                  type="text" 
                                  className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2.5 text-xs font-bold placeholder-ink-400 focus:ring-1 focus:ring-danger-500 text-ink-900"
                                  placeholder="Operator / Driver / Staff"
                                  value={newEmpJabatan}
                                  onChange={(e) => setNewEmpJabatan(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-black text-ink-600 mb-1">Departemen:</label>
                                <input 
                                  type="text" 
                                  className="w-full bg-ink-50 border border-rule rounded-lg py-1.5 px-2.5 text-xs font-bold placeholder-ink-400 focus:ring-1 focus:ring-danger-500 text-ink-900"
                                  placeholder="Produksi / HSE / Logistik"
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
                              className="bg-safe-600 hover:bg-safe-700 text-white text-xs font-black px-4 py-2 rounded-lg transition cursor-pointer"
                            >
                               {lang === 'ID' ? 'Simpan Karyawan' : 'Save Employee'}
                            </button>
                          </div>
                        </div>

                        {/* UPLOAD DATABASE KARYAWAN (Excel / CSV / Paste) */}
                        <div data-ui className="lg:col-span-2 bg-white rounded-xl border border-ink-200 p-4 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-black text-safe-800 mb-2 flex items-center gap-2">
                              
                              <span>{lang === 'ID' ? 'Upload Data Karyawan' : 'Upload Employee Data'}</span>
                            </h4>
                            
                            <p className="text-xs text-ink-500 mb-3 leading-relaxed">
                              {lang === 'ID' 
                                ? 'Cara paling praktis: Pilih file Excel (.xlsx/.xls) atau file CSV Anda, atau copy baris/kolom dari lembar kerja Anda lalu tempel (paste) langsung ke kotak teks di bawah.' 
                                : 'Most convenient: Select an Excel file (.xlsx/.xls) or a CSV file, or copy rows/columns from your worksheet and paste directly in the textbox below.'}
                            </p>

                            <div className="space-y-3">
                              {/* Option 1: Copy-Paste Text Area */}
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-black text-ink-600">
                                    {lang === 'ID' ? 'Paste Data Spreadsheet (NIK, Nama, Jabatan, Dept):' : 'Paste Spreadsheet Data:'}
                                  </span>
                                  {bulkPreviewData.length > 0 && (
                                    <span className="bg-safe-100 text-safe-800 text-xs px-1.5 py-0.5 rounded font-black tabular-nums">
                                      {bulkPreviewData.length} Karyawan Terdeteksi
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  className="w-full bg-ink-50 border border-rule rounded-lg p-2 text-xs tabular-nums font-medium focus:ring-1 focus:ring-danger-500 text-ink-800"
                                  rows={4}
                                  placeholder={lang === 'ID' 
                                    ? "Format: NIK [Tab] Nama Lengkap [Tab] Jabatan [Tab] Departemen"
                                    : "Format: NIK [Tab] Full Name [Tab] Position [Tab] Department"
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
                                <label className="block text-xs font-black text-ink-600 mb-1">
                                  {lang === 'ID' ? 'Pilih File Database Karyawan (Excel/.xlsx/.xls atau .csv):' : 'Choose Employee Database File (Excel/.xlsx/.xls or .csv):'}
                                </label>
                                <input
                                  type="file"
                                  accept=".xlsx,.xls,.csv,.txt"
                                  className="w-full text-xs text-ink-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200 cursor-pointer"
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
                                              notifyUser(lang === 'ID' ? 'File Excel kosong!' : 'Excel file is empty!');
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
                                            notifyUser(lang === 'ID' ? 'Gagal membaca file Excel ini.' : 'Failed to read this Excel file.');
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
                              <div data-ui className="mt-3 bg-ink-50 border border-ink-200 rounded-lg p-2 text-xs leading-relaxed max-h-24 overflow-y-auto">
                                <p className="font-bold text-ink-600 mb-1"> {lang === 'ID' ? 'Pratinjau Hasil Ekstraksi:' : 'Parsed Preview:'}</p>
                                <ul data-ui className="divide-y divide-rule tabular-nums text-xs">
                                  {bulkPreviewData.slice(0, 3).map((item, idx) => (
                                    <li key={idx} className="py-0.5 text-ink-700">
                                      [{item.nik}] {item.nama} - {item.jabatan} ({item.dept})
                                    </li>
                                  ))}
                                  {bulkPreviewData.length > 3 && (
                                    <li className="py-0.5 text-danger-700 font-bold">
                                      …dan {bulkPreviewData.length - 3} karyawan lainnya.
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
                                  className="bg-safe-600 hover:bg-safe-700 text-white text-xs font-black px-3 py-2 rounded-lg transition cursor-pointer"
                                >
                                   {lang === 'ID' ? 'Gabungkan Data' : 'Merge Data'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkImportSave('OVERWRITE')}
                                  className="bg-danger-600 hover:bg-danger-700 text-white text-xs font-black px-3 py-2 rounded-lg transition cursor-pointer"
                                >
                                   {lang === 'ID' ? 'Ganti Semua' : 'Overwrite All'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkInputText('');
                                    setBulkPreviewData([]);
                                  }}
                                  className="bg-ink-100 hover:bg-ink-200 text-ink-600 text-xs font-black px-3 py-2 rounded-lg transition cursor-pointer"
                                >
                                  {lang === 'ID' ? 'Batal' : 'Cancel'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* ACTIVE EMPLOYEE REGISTRY TABLE */}
                      <div data-ui className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                        <div data-ui className="bg-ink-100 border-b border-ink-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-2">
                          <h4 className="text-xs font-black text-ink-950">
                             {lang === 'ID' ? 'Database Karyawan Terdaftar' : 'Registered Employee Database'}
                          </h4>
                          
                          {/* Search Filter input */}
                          <div className="relative w-full sm:w-64">
                            <input 
                              type="text"
                              className="w-full bg-white border border-rule rounded-lg py-1 px-2.5 pl-7 text-xs font-bold text-ink-900"
                              placeholder={lang === 'ID' ? 'Cari NIK / NAMA...' : 'Filter by NIK / Name...'}
                              value={adminNikFilter}
                              onChange={(e) => setAdminNikFilter(e.target.value)}
                            />
                            
                          </div>
                        </div>

                        <div className="overflow-x-auto font-sans">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-ink-50 text-ink-500 border-b border-ink-200 font-black tracking-tight text-xs">
                                <th className="px-4 py-2.5 w-24">NIK</th>
                                <th className="px-4 py-2.5">{lang === 'ID' ? 'NAMA LENGKAP' : 'FULL NAME'}</th>
                                <th className="px-4 py-2.5">{lang === 'ID' ? 'JABATAN (ROLES)' : 'POSITION'}</th>
                                <th className="px-4 py-2.5">DEPT</th>
                                <th className="px-4 py-2.5 text-center w-28">Tindakan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-rule">
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
                                      onViewHistory={() => {
                                        setAdminActiveTab('dashboard');
                                        setAdminSearchQuery(keyNik);
                                      }}
                                      lang={lang}
                                    />
                                  );
                                })}
                              {Object.keys(employeeDb).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-12 text-center text-ink-400 font-bold bg-ink-50">
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

                  {/* TAB 3: TREND & FREQUENCY ANALYSIS (UNFIT & Pengawasan Khusus) */}
                  {adminActiveTab === 'trends' && (
                    <AdminTrendsAnalysis
                      history={history as any}
                      employeeDb={employeeDb}
                      lang={lang}
                      normalizeDateStr={normalizeDateStr}
                      deduplicateAssessments={deduplicateAssessments}
                    />
                  )}

                  {/* TAB 4: UNIFIED INTEGRATIONS & CLOUD BACKUP (FIREBASE, GOOGLE SHEETS, WHATSAPP) */}
                  {adminActiveTab === 'integrations' && (
                    <div className="flex flex-col gap-6 animate-fadeIn text-ink-800 max-w-6xl mx-auto">
                      
                      {/* Sub-Navigation Tabs Bar */}
                      <div data-ui className="bg-white border border-ink-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                          <button
                            type="button"
                            onClick={() => setIntegrationSubTab('firebase_backup')}
                            className={`py-1.5 px-3 rounded-lg font-black text-xs   cursor-pointer transition flex items-center gap-1.5 ${
                              integrationSubTab === 'firebase_backup'
                                ? 'bg-warn-600 text-white '
                                : 'bg-warn-50 hover:bg-warn-100 text-warn-900 border border-warn-200'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5 text-warn-500" />
                            <span> {lang === 'ID' ? 'Firebase Cloud Backup' : 'Firebase Cloud Backup'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIntegrationSubTab('sheets_sync')}
                            className={`py-1.5 px-3 rounded-lg font-black text-xs   cursor-pointer transition flex items-center gap-1.5 ${
                              integrationSubTab === 'sheets_sync'
                                ? 'bg-safe-700 text-white '
                                : 'bg-safe-50 hover:bg-safe-100 text-safe-900 border border-safe-200'
                            }`}
                          >
                            <Database className="w-3.5 h-3.5 text-safe-600" />
                            <span> {lang === 'ID' ? 'Google Sheet Integration' : 'Google Sheets'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIntegrationSubTab('fonnte_wa')}
                            className={`py-1.5 px-3 rounded-lg font-black text-xs   cursor-pointer transition flex items-center gap-1.5 ${
                              integrationSubTab === 'fonnte_wa'
                                ? 'bg-safe-700 text-white '
                                : 'bg-safe-50 hover:bg-safe-100 text-safe-900 border border-safe-200'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-safe-600" />
                            <span> {lang === 'ID' ? 'WhatsApp Alert (Fonnte)' : 'WhatsApp Alerts'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIntegrationSubTab('all')}
                            className={`py-1.5 px-3 rounded-lg font-black text-xs   cursor-pointer transition ${
                              integrationSubTab === 'all'
                                ? 'bg-ink-900 text-white '
                                : 'bg-ink-100 hover:bg-ink-200 text-ink-700'
                            }`}
                          >
                             {lang === 'ID' ? 'Tampilkan Semua (1 Halaman)' : 'Show All (1 Page)'}
                          </button>
                        </div>

                        <span className="text-xs text-ink-500 font-bold px-2 hidden sm:inline">
                           {lang === 'ID' ? 'Pusat Cloud Backup, Spreadsheet, & Gateway' : 'Central Integration Hub'}
                        </span>
                      </div>

                      {/* SECTION: WHATSAPP ALERT (FONNTE API) INTEGRATION */}
                      {(integrationSubTab === 'all' || integrationSubTab === 'fonnte_wa') && (
                        <div className="flex flex-col gap-6 animate-fadeIn text-ink-800">
                      
                      {/* Top Header Card */}
                      <div data-ui className="bg-safe-800 text-white rounded-xl p-5 border border-safe-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3.5 font-sans">
                          <div data-ui className="bg-safe-700/80 p-2.5 rounded-lg border border-safe-600 shrink-0 flex items-center justify-center">
                            <MessageSquare className="w-6 h-6 text-safe-100" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black leading-none">
                                {lang === 'ID' ? 'Integrasi WhatsApp Gateway (Fonnte API)' : 'WhatsApp Gateway Integration (Fonnte API)'}
                              </h4>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full   ${
                                fonnteEnabled && fonnteToken && fonnteTarget 
                                  ? 'bg-safe-300 text-safe-950 font-black' 
                                  : 'bg-ink-700 text-ink-200'
                              }`}>
                                {fonnteEnabled && fonnteToken && fonnteTarget ? '● AKTIF' : '○ NONAKTIF'}
                              </span>
                            </div>
                            <p className="text-xs text-safe-100 mt-1.5 leading-relaxed font-sans">
                              {lang === 'ID'
                                ? 'Kirim notifikasi otomatis langsung ke Grup WhatsApp Pengawas & HSE saat ada karyawan melaporkan kondisi Unfit, Butuh Istirahat, atau Pengawasan Khusus.'
                                : 'Automatically dispatch urgent WhatsApp alerts directly to Supervisor/HSE WhatsApp group when an employee reports Unfit, Needs Rest, or Special Supervision.'}
                            </p>
                          </div>
                        </div>

                        {/* Master Toggle */}
                        <label data-ui className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl border border-white/20 cursor-pointer transition shrink-0 select-none">
                          <input 
                            type="checkbox"
                            checked={fonnteEnabled}
                            onChange={(e) => {
                              const nextVal = e.target.checked;
                              setFonnteEnabled(nextVal);
                              handleSaveFonnteConfig(fonnteToken, fonnteTarget, nextVal, fonnteAlertUnfit, fonnteAlertRest, fonnteAlertConditional);
                            }}
                            className="w-4 h-4 accent-safe-400 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-white">
                            {lang === 'ID' ? 'Aktifkan Alert WA' : 'Enable WA Alerts'}
                          </span>
                        </label>
                      </div>

                      {/* Credentials & Target Card */}
                      <div data-ui className="bg-white rounded-xl border border-ink-200 p-6 flex flex-col gap-5">
                        <h4 className="text-xs font-black text-ink-800 flex items-center gap-2 border-b border-ink-100 pb-3">
                          
                          <span>{lang === 'ID' ? 'Konfigurasi Token Fonnte & Target WhatsApp' : 'Fonnte Token & Target Configuration'}</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-ink-700 mb-1.5">
                              {lang === 'ID' ? 'Token API Fonnte:' : 'Fonnte API Token:'}
                            </label>
                            <input 
                              type="text"
                              value={fonnteToken}
                              onChange={(e) => setFonnteToken(e.target.value)}
                              placeholder="Contoh: a1b2c3d4e5f6g7h8..."
                              className="w-full bg-ink-50 border border-ink-300 rounded-xl px-3.5 py-2.5 text-xs tabular-nums font-medium text-ink-900 focus:bg-white focus:border-safe-500 focus:ring-1 focus:ring-safe-500 transition"
                            />
                            <p className="text-xs text-ink-500 mt-1">
                              {lang === 'ID' ? (
                                <>Didapatkan dari dashboard akun <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-safe-700 underline font-semibold">fonnte.com</a> di menu <b>Device</b>.</>
                              ) : (
                                <>Available in your <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-safe-700 underline font-semibold">fonnte.com</a> dashboard under <b>Device</b>.</>
                              )}
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-ink-700 mb-1.5">
                              {lang === 'ID' ? 'Target WhatsApp (ID Grup / Nomor):' : 'WhatsApp Target (Group ID / Phone):'}
                            </label>
                            <input 
                              type="text"
                              value={fonnteTarget}
                              onChange={(e) => setFonnteTarget(e.target.value)}
                              placeholder="Contoh: 120363028123456789@g.us atau 08123456789"
                              className="w-full bg-ink-50 border border-ink-300 rounded-xl px-3.5 py-2.5 text-xs tabular-nums font-medium text-ink-900 focus:bg-white focus:border-safe-500 focus:ring-1 focus:ring-safe-500 transition"
                            />
                            <p className="text-xs text-ink-500 mt-1">
                              {lang === 'ID' ? (
                                <>Untuk grup gunakan <b>ID Grup</b> (format: <code>...@g.us</code>). Untuk nomor pribadi gunakan format <code>08...</code> atau <code>628...</code>. Bisa dipisah koma jika banyak.</>
                              ) : (
                                <>For groups use <b>Group ID</b> (e.g. <code>...@g.us</code>). For phone numbers use <code>08...</code> or <code>628...</code>.</>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Triggers selection */}
                        <div data-ui className="bg-ink-50 rounded-xl p-4 border border-ink-200 flex flex-col gap-3">
                          <label className="text-xs font-black text-ink-700">
                            {lang === 'ID' 
                              ? 'Kondisi Karyawan Yang Memicu Notifikasi WA Otomatis:' 
                              : 'Employee Conditions Triggering Automated WhatsApp Alerts:'}
                          </label>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label data-ui className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-ink-200 cursor-pointer hover:border-danger-400 transition">
                              <input 
                                type="checkbox"
                                checked={fonnteAlertUnfit}
                                onChange={(e) => setFonnteAlertUnfit(e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-danger-600 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-danger-700 block"> Status UNFIT</span>
                                <span className="text-xs text-ink-500 leading-tight block mt-0.5">
                                  {lang === 'ID' ? 'Kelelahan tinggi (Score ≥ 12) / Dilarang bekerja.' : 'Severe fatigue (Score ≥ 12) / Work rejected.'}
                                </span>
                              </div>
                            </label>

                            <label data-ui className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-ink-200 cursor-pointer hover:border-warn-400 transition">
                              <input 
                                type="checkbox"
                                checked={fonnteAlertRest}
                                onChange={(e) => setFonnteAlertRest(e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-warn-500 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-warn-700 block"> Butuh Istirahat</span>
                                <span className="text-xs text-ink-500 leading-tight block mt-0.5">
                                  {lang === 'ID' ? 'Kelelahan sedang (Score 9-11) / Wajib istirahat.' : 'Moderate fatigue (Score 9-11) / Rest required.'}
                                </span>
                              </div>
                            </label>

                            <label data-ui className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-ink-200 cursor-pointer hover:border-info-400 transition">
                              <input 
                                type="checkbox"
                                checked={fonnteAlertConditional}
                                onChange={(e) => setFonnteAlertConditional(e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-info-600 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-info-700 block"> Pengawasan Khusus</span>
                                <span className="text-xs text-ink-500 leading-tight block mt-0.5">
                                  {lang === 'ID' ? 'Konsumsi obat, masalah pribadi, atau Score 7-8.' : 'Medication, personal stress, or Score 7-8.'}
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div data-ui className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-ink-100">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveFonnteConfig(
                                fonnteToken, 
                                fonnteTarget, 
                                fonnteEnabled,
                                fonnteAlertUnfit,
                                fonnteAlertRest,
                                fonnteAlertConditional
                              )}
                              className="bg-safe-600 hover:bg-safe-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>{lang === 'ID' ? 'Simpan Konfigurasi WA' : 'Save WA Settings'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={fonnteTestStatus.loading}
                              onClick={handleTestFonnteWA}
                              className="bg-ink-800 hover:bg-ink-900 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 text-safe-400" />
                              <span>{fonnteTestStatus.loading ? (lang === 'ID' ? 'Mengirim...' : 'Sending...') : (lang === 'ID' ? 'Tes Kirim Pesan WA' : 'Test WA Alert')}</span>
                            </button>
                          </div>

                          {fonnteTestStatus.message && (
                            <div data-ui className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                              fonnteTestStatus.success 
                                ? 'bg-safe-50 text-safe-800 border-safe-300' 
                                : 'bg-danger-50 text-danger-800 border-danger-300'
                            }`}>
                              <span>{fonnteTestStatus.success ? '' : ''}</span>
                              <span>{fonnteTestStatus.message}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Guide & Instructions Card */}
                      <div data-ui className="bg-ink-50 rounded-xl border border-ink-200 p-6 flex flex-col gap-4">
                        <h4 className="text-xs font-black text-ink-800 flex items-center gap-2">
                          
                          <span>{lang === 'ID' ? 'Panduan Menghubungkan WhatsApp Grup dengan Fonnte' : 'Fonnte WhatsApp Group Connection Guide'}</span>
                        </h4>
                        
                        <ol className="list-decimal list-inside text-xs text-ink-600 space-y-2 leading-relaxed">
                          <li>
                            <b>Buat Akun & Sambungkan Perangkat:</b> Buka <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-safe-700 font-bold underline hover:text-safe-800">fonnte.com</a>, daftar akun, lalu pada menu <b>Device</b>, klik <b>Connect</b> dan scan QR code menggunakan nomor WhatsApp yang dijadikan pengirim alert.
                          </li>
                          <li>
                            <b>Salin API Token:</b> Salin token perangkat dari dashboard Fonnte ke kolom <b>Token API Fonnte</b> di atas.
                          </li>
                          <li>
                            <b>Masukkan Akun ke Grup WhatsApp:</b> Tambahkan nomor WhatsApp Fonnte Anda ke dalam Grup WhatsApp Pengawas/HSE PT. Wahana Bara Sentosa.
                          </li>
                          <li>
                            <b>Dapatkan ID Grup WhatsApp:</b> Pada menu Fonnte atau via list groups, salin ID Grup (format: <code>120363028123456789@g.us</code>) dan tempel ke kolom <b>Target WhatsApp</b>.
                          </li>
                          <li>
                            <b>Uji Coba:</b> Klik tombol <b>Tes Kirim Pesan WA</b> untuk memastikan pesan uji coba masuk ke grup WhatsApp Anda.
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* SECTION: GOOGLE SHEETS INTEGRATION & SYNCHRONIZATION SUMMARY */}
                  {(integrationSubTab === 'all' || integrationSubTab === 'sheets_sync') && (
                    <div className="flex flex-col gap-6 animate-fadeIn text-ink-800">
                      
                      {/* Top Header Card */}
                      <div data-ui className="bg-safe-800 text-white rounded-xl p-5 border border-safe-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3.5 font-sans">
                          <div data-ui className="bg-safe-700/80 p-2.5 rounded-lg border border-safe-600 shrink-0 flex items-center justify-center">
                            <Database className="w-6 h-6 text-safe-100" />
                          </div>
                          <div>
                            <h4 className="text-base font-black leading-none">
                              {lang === 'ID' ? 'Integrasi Google Sheets & Webhook' : 'Google Sheets & Webhook Sync'}
                            </h4>
                            <p className="text-xs text-safe-200 mt-1.5 leading-relaxed font-sans">
                              {lang === 'ID' 
                                ? 'Sinkronisasikan daftar karyawan aktif dan rekap seluruh riwayat laporan penilaian Fit to Work secara instan ke cloud spreadsheet pihak ketiga.' 
                                : 'Instantly synchronize active employee registers and export assessment reports to your cloud Google Spreadsheet database.'}
                            </p>
                          </div>
                        </div>

                        {/* Direct Link to Sheet */}
                        <a data-ui 
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-white hover:bg-ink-50 text-safe-800 font-extrabold py-2 px-4 rounded-lg text-xs self-start sm:self-center transition flex items-center gap-1.5 shrink-0 border border-safe-200"
                        >
                          <span> {lang === 'ID' ? 'Buka Google Sheet' : 'Open Sheet Link'}</span>
                          <span className="text-xs bg-safe-100 text-safe-800 rounded px-1.5 py-0.5">Edit ↗</span>
                        </a>
                      </div>

                      {/* Main Settings Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* LEFT FORM CONFIGS */}
                        <div className="lg:col-span-7 flex flex-col gap-6">
                          
                          {/* 1. Google API Session Authentication Panel */}
                          <div data-ui className="bg-white rounded-xl border border-ink-200 p-4 font-sans">
                            <h4 className="text-xs font-black text-danger-800 mb-4 flex items-center gap-2">
                              
                              <span>{lang === 'ID' ? 'Otorisasi Keamanan Google Sheets API' : 'Google Authentication Control'}</span>
                            </h4>

                            <div data-ui className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-ink-50 border border-ink-200 p-4 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                                  sheetsToken ? 'bg-safe-500 ' : 'bg-ink-300'
                                }`} />
                                <div className="flex flex-col">
                                  <span className="text-xs font-extrabold leading-none text-ink-600 block mb-1">
                                    {lang === 'ID' ? 'Status Koneksi Google' : 'Google Connection Status'}
                                  </span>
                                  <span className="text-xs font-black text-ink-800 leading-normal">
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
                                    className="bg-safe-600 hover:bg-safe-500 text-white font-black text-xs py-2 px-4 rounded-lg cursor-pointer transition flex items-center gap-1.5"
                                  >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>{lang === 'ID' ? 'Hubungkan Akun' : 'Sign In Google'}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleSheetsLogout}
                                    className="bg-ink-200 hover:bg-ink-300 text-ink-800 font-extrabold text-xs py-2 px-4 rounded-lg cursor-pointer transition flex items-center gap-1.5"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>{lang === 'ID' ? 'Putuskan' : 'Disconnect'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. Spreadsheet Configuration Parameters */}
                          <div data-ui className="bg-white rounded-xl border border-ink-200 p-4 flex flex-col gap-4 font-sans">
                            <h4 className="text-xs font-black text-danger-800 flex items-center gap-2">
                              
                              <span>{lang === 'ID' ? 'Parameter Target Google Sheets' : 'Spreadsheet ID & Endpoint Config'}</span>
                            </h4>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-black text-ink-600">
                                Active Spreadsheet ID:
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-ink-50 text-ink-900 border border-rule rounded-lg py-2 px-2.5 text-xs tabular-nums font-bold"
                                  placeholder="Contoh: 15xOHL87QqqYUkwZRyNe..."
                                  value={spreadsheetId}
                                  onChange={(e) => setSpreadsheetId(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveSpreadsheetId(spreadsheetId)}
                                  className="bg-ink-800 hover:bg-ink-950 text-white font-extrabold text-xs py-2 px-3.5 rounded-lg cursor-pointer transition"
                                >
                                  {lang === 'ID' ? 'Simpan' : 'Save'}
                                </button>
                              </div>
                              <span className="text-xs text-ink-400 font-semibold italic mt-0.5 leading-relaxed font-sans block">
                                {lang === 'ID' 
                                  ? 'ID ini digunakan untuk mengambil data karyawan dan menyimpan log rekap assessment.' 
                                  : 'This key tells the API which spreadsheet folder to access for synchronization.'}
                              </span>
                            </div>

                            {/* Auto-Template Creator Section */}
                            <div data-ui className="pt-2.5 border-t border-dashed border-ink-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-ink-600">
                              <div>
                                <span className="font-bold text-ink-800 block text-xs mb-0.5">
                                  {lang === 'ID' ? 'Inisialisasi Template Otomatis' : 'Automatic Schema Builder'}
                                </span>
                                {lang === 'ID' 
                                  ? 'Membuat file spreadsheet baru yang lengkap dengan pola template tabel PT. WBS.' 
                                  : 'Generates a fresh formatted spreadsheet with SHE default template folders.'}
                              </div>
                              <button
                                type="button"
                                onClick={handleCreateNewSpreadsheet}
                                className="bg-danger-50 hover:bg-danger-100 border border-danger-200 text-danger-700 font-black text-xs py-2 px-3.5 rounded-lg cursor-pointer shrink-0 transition"
                              >
                                 {lang === 'ID' ? 'Buat Baru & Template' : 'Generate Schema'}
                              </button>
                            </div>
                          </div>

                          {/* 3. Operational Sync Triggers */}
                          <div data-ui className="bg-white rounded-xl border border-ink-200 p-4 flex flex-col gap-4 font-sans">
                            <h4 className="text-xs font-black text-danger-800 flex items-center gap-2">
                              
                              <span>{lang === 'ID' ? 'Aksi Sinkronisasi Mandatori' : 'Operational Sync Controls'}</span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Tarik karyawan */}
                              <div data-ui className="border border-rule rounded-xl p-3 bg-ink-50/50 flex flex-col justify-between">
                                <div className="mb-3">
                                  <span className="font-extrabold text-xs text-ink-800 block">
                                    {lang === 'ID' ? '1. Impor Database Karyawan' : '1. Sync Active Employees'}
                                  </span>
                                  <span className="text-xs text-ink-500 font-medium leading-relaxed mt-1 block font-sans">
                                    {lang === 'ID' 
                                      ? "Mengambil kolom data pendaftaran karyawan dari worksheet 'Karyawan' ke memori sistem." 
                                      : "Pull, parsed, and verifies names & depts from 'Karyawan' sheet tab."}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSyncKaryawan()}
                                  className="w-full bg-safe-600 hover:bg-safe-500 text-white font-black text-xs py-2 rounded-lg cursor-pointer text-center transition"
                                >
                                   Pull Karyawan API
                                </button>
                              </div>

                              {/* Backup Assessment */}
                              <div data-ui className="border border-rule rounded-xl p-3 bg-ink-50/50 flex flex-col justify-between">
                                <div className="mb-3">
                                  <span className="font-extrabold text-xs text-ink-800 block">
                                    {lang === 'ID' ? '2. Ekspor Rekap Hasil Assessment' : '2. Backup Assessment History'}
                                  </span>
                                  <span className="text-xs text-ink-500 font-medium leading-relaxed mt-1 block font-sans">
                                    {lang === 'ID' 
                                      ? "Mengunggah seluruh daftar pengisian penilaian safety yang direkap oleh sistem ke Google Sheet 'Hasil Assessment'." 
                                      : "Appends recent recorded employee fatigue passes and status rows on cloud."}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleBulkUploadHistory}
                                  className="w-full bg-danger-600 hover:bg-danger-500 text-white font-black text-xs py-2 rounded-lg cursor-pointer text-center transition"
                                >
                                   Push Hasil Assessment
                                </button>
                              </div>
                            </div>

                            {/* Firestore -> Sheets backup */}
                            <div data-ui className="border border-rule rounded-xl p-3 bg-ink-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <span className="font-extrabold text-xs text-ink-800 block">
                                  {lang === 'ID' ? '3. Cadangkan Firestore ke Google Sheets' : '3. Back up Firestore to Google Sheets'}
                                </span>
                                <span className="text-xs text-ink-500 font-medium leading-relaxed mt-1 block font-sans">
                                  {lang === 'ID'
                                    ? "Menarik laporan Firestore sejak tanggal terakhir di tab 'Laporan_Fit' lalu menambahkan yang belum ada. Dicoba otomatis tiap 30 menit selama panel admin terbuka dan Google terhubung."
                                    : "Pulls Firestore reports since the last date in 'Laporan_Fit' and appends missing rows. Retries automatically every 30 minutes while the admin panel is open and Google is connected."}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleBackupFirestoreToSheets(false)}
                                className="bg-safe-700 hover:bg-safe-600 text-white font-black text-xs py-2 px-4 rounded-lg cursor-pointer shrink-0 transition"
                              >
                                {lang === 'ID' ? 'Cadangkan Sekarang' : 'Back up now'}
                              </button>
                            </div>

                            {/* Sync Webhook alternative */}
                            <div data-ui className="pt-3 border-t border-dashed border-ink-200 flex flex-col gap-2.5">
                              <span className="font-extrabold text-xs text-ink-700 block">
                                Webhook Google Apps Script Deployment URL:
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 bg-ink-50 text-ink-950 border border-rule rounded-lg py-1.5 px-2 text-xs tabular-nums focus:ring-1 focus:ring-danger-500 font-semibold"
                                  placeholder="https://script.google.com/macros/s/.../exec"
                                  value={webhookUrl}
                                  onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveWebhookUrl(webhookUrl)}
                                  className="bg-ink-800 hover:bg-ink-950 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg cursor-pointer transition"
                                >
                                  {lang === 'ID' ? 'Simpan' : 'Save'}
                                </button>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mt-1">
                                <span className="text-xs text-ink-400 font-medium leading-normal italic font-sans block">
                                  {lang === 'ID' 
                                    ? 'Gunakan webhook untuk melakukan sync karyawan secara aman tanpa perlu login akun Google di perambah.' 
                                    : 'Enables quick secure sync without individual browser login or Google popup.'}
                                </span>
                                <button
                                  type="button"
                                  onClick={handleSyncKaryawanViaWebhook}
                                  className="bg-white hover:bg-ink-50 border border-rule text-ink-700 font-bold text-xs py-1.5 px-3 rounded-lg cursor-pointer transition shrink-0"
                                >
                                   Pull via Webhook
                                </button>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* RIGHT LIVE DIAGNOSTICS & SYSTEM TERMINAL FEED */}
                        <div className="lg:col-span-5 flex flex-col gap-4">
                          
                          {/* Instructions Card info */}
                          <div data-ui className="bg-ink-50 rounded-xl border border-ink-200 p-4 text-xs leading-relaxed font-sans">
                            <h4 className="text-xs font-black text-ink-800 mb-2 font-sans">
                               {lang === 'ID' ? 'Panduan Struktur Sheet' : 'Sheet Folder Guidelines'}
                            </h4>
                            <p className="text-ink-600 text-xs leading-relaxed font-sans">
                              {lang === 'ID' 
                                ? 'Spreadsheet wajib memiliki dua nama worksheet (tab) utama untuk dapat dibaca dengan benar oleh sistem Fit to Work:' 
                                : 'For this synchronization system to operate flawlessly, make sure your Spreadsheet contains these two worksheets:'}
                            </p>
                            <ul className="text-ink-700 flex flex-col gap-2.5 pl-1.5 mt-3 select-text font-sans">
                              <li className="flex gap-2 items-start text-xs">
                                <span className="text-danger-600 font-extrabold shrink-0">•</span>
                                <div className="font-sans leading-normal">
                                  <b>Tab 'Karyawan':</b> {lang === 'ID' ? 'Memuat kolom NIK (A), Nama (B), Jabatan (C), dan Departemen (D).' : 'Holds columns NIK (A), Name (B), Position (C), and Dept (D).'}
                                </div>
                              </li>
                              <li className="flex gap-2 items-start text-xs">
                                <span className="text-danger-600 font-extrabold shrink-0">•</span>
                                <div className="font-sans leading-normal">
                                  <b>Tab 'Hasil Assessment':</b> {lang === 'ID' ? 'Tempat sistem mengunggah detail jam tidur dan status kelayakan kerja.' : 'Real-time database table for fatigue index scores and safety passes.'}
                                </div>
                              </li>
                            </ul>
                          </div>

                          {/* Structured Sync Log Panel */}
                          <div data-ui className="bg-elevated border border-rule rounded-xl min-h-[250px] flex-1 flex flex-col overflow-hidden text-ink-800 text-xs">
                            <div data-ui className="bg-surface px-4 py-2.5 border-b border-rule flex items-center justify-between shrink-0">
                              <div className="flex items-center gap-2">
                                
                                <span className="text-xs font-bold text-ink-700">
                                  {lang === 'ID' ? 'Log Sinkronisasi Sistem' : 'System Sync Logs'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSheetsLogs([])}
                                className="text-xs bg-elevated hover:bg-surface border border-rule font-bold px-2.5 py-1 rounded text-ink-700 cursor-pointer"
                              >
                                {lang === 'ID' ? 'Bersihkan' : 'Clear'}
                              </button>
                            </div>

                            <div className="p-3.5 flex-1 overflow-y-auto flex flex-col-reverse gap-1.5 select-text leading-relaxed">
                              {sheetsLogs.length > 0 ? (
                                sheetsLogs.map((log, index) => (
                                  <div key={index} data-ui className="border-b border-rule pb-1 flex gap-2 items-start">
                                    <span className="text-safe-600 shrink-0 select-none">•</span>
                                    <code className="whitespace-pre-wrap text-xs text-ink-800">{log}</code>
                                  </div>
                                ))
                              ) : (
                                <div className="text-ink-500 italic py-12 text-center select-none">
                                  {lang === 'ID' ? 'Belum ada aktivitas sinkronisasi.' : 'No sync activity recorded yet.'}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                      </div>

                    </div>
                  )}

                  {/* SECTION: FIREBASE CLOUD BACKUP & RESTORE */}
                  {(integrationSubTab === 'all' || integrationSubTab === 'firebase_backup') && (
                    <div className="max-w-5xl mx-auto space-y-5 w-full">
                      {/* Banner / Notification */}
                      {firebaseStatusMsg && (
                        <div data-ui className="bg-warn-50 border border-warn-200 text-warn-900 rounded-xl p-4 text-xs font-bold flex items-center justify-between">
                          <span>{firebaseStatusMsg}</span>
                          <button
                            type="button"
                            onClick={() => setFirebaseStatusMsg('')}
                            className="text-warn-700 hover:text-warn-900 font-extrabold text-xs ml-3 cursor-pointer"
                          >
                            
                          </button>
                        </div>
                      )}

                      {/* Header Card */}
                      <div className="bg-danger-700 rounded-2xl p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 bg-white/20 rounded-xl">
                              <Flame className="w-6 h-6 text-warn-200" />
                            </span>
                            <div>
                              <h3 className="text-lg font-black tracking-tight">
                                Firebase Cloud Storage & Quota Optimization
                              </h3>
                              <p className="text-xs text-warn-100 font-medium">
                                Mode Hemat Kuota & Penyimpanan Ringan Aktif untuk PT. Wahana Bara Sentosa
                              </p>
                            </div>
                          </div>
                          
                          <div data-ui className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20 text-xs">
                            <div className="bg-black/15 rounded-xl p-3">
                              <span className="text-xs text-warn-200 font-black block">Firebase Project</span>
                              <span className="tabular-nums font-bold text-white text-sm">ftw-wbs</span>
                            </div>
                            <div className="bg-black/15 rounded-xl p-3">
                              <span className="text-xs text-warn-200 font-black block">Mode Arsitektur</span>
                              <span className="font-bold text-safe-300 text-xs flex items-center gap-1.5 mt-0.5">
                                
                                 Hemat Kuota & Storage
                              </span>
                            </div>
                            <div className="bg-black/15 rounded-xl p-3">
                              <span className="text-xs text-warn-200 font-black block">Target Collections</span>
                              <span className="tabular-nums font-bold text-white text-xs">directory, assessments</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quota & Storage Optimization Highlights */}
                      <div data-ui className="bg-safe-50 border border-safe-200 rounded-2xl p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          
                          <div className="space-y-2 text-xs">
                            <h4 className="font-black text-safe-950 text-xs">
                              Strategi Optimasi Kuota & Penyimpanan Firebase Aktif:
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-safe-900">
                              <div data-ui className="bg-white/80 rounded-xl p-3 border border-safe-200">
                                <div className="font-bold text-safe-950 flex items-center gap-1.5 mb-1">
                                  <span> 1-Doc Consolidated Roster</span>
                                </div>
                                <p className="text-xs text-safe-800 leading-relaxed">
                                  Ratusan data karyawan dibundle ke 1 dokumen <code className="bg-safe-100 px-1 py-0.5 rounded tabular-nums text-xs">/directory/roster</code>. Menghemat <b>99% kuota Read & Write</b> dibanding 1 dokumen per karyawan!
                                </p>
                              </div>
                              <div data-ui className="bg-white/80 rounded-xl p-3 border border-safe-200">
                                <div className="font-bold text-safe-950 flex items-center gap-1.5 mb-1">
                                  <span> IndexedDB Persistent Cache</span>
                                </div>
                                <p className="text-xs text-safe-800 leading-relaxed">
                                  Cache multi-tab browser aktif di memori lokal. Pengambilan data berulang disajikan dari browser lokal tanpa memakan kuota Read Firebase.
                                </p>
                              </div>
                              <div data-ui className="bg-white/80 rounded-xl p-3 border border-safe-200">
                                <div className="font-bold text-safe-950 flex items-center gap-1.5 mb-1">
                                  <span> Payload Sanitized & Ringan</span>
                                </div>
                                <p className="text-xs text-safe-800 leading-relaxed">
                                  Field kosong & metadata UI dibersihkan sebelum disimpan ke Firestore, memotong ukuran penyimpanan dokumen hingga <b>70% lebih kecil</b>.
                                </p>
                              </div>
                              <div data-ui className="bg-white/80 rounded-xl p-3 border border-safe-200">
                                <div className="font-bold text-safe-950 flex items-center gap-1.5 mb-1">
                                  <span> Pencegah Lonjakan Read (1.9M)</span>
                                </div>
                                <p className="text-xs text-safe-800 leading-relaxed">
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
                        <div data-ui className="bg-white rounded-xl border border-ink-200 p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              
                              <h4 className="font-black text-sm text-ink-900">
                                {lang === 'ID' ? 'Backup Seluruh Data (Format Hemat)' : 'Backup All Data (Quota Saver)'}
                              </h4>
                            </div>
                            <p className="text-xs text-ink-600 leading-relaxed mb-4">
                              {lang === 'ID'
                                ? 'Mengunggah seluruh daftar karyawan ke 1 dokumen roster hemat kuota dan riwayat assessment ringkas ke database Firestore (ftw-wbs).'
                                : 'Upload and safely backup all current active employees (1-Doc roster) and compact assessment history to Firebase Firestore.'}
                            </p>
                            
                            <div data-ui className="bg-ink-50 rounded-xl p-3 border border-rule mb-4 space-y-1.5 text-xs">
                              <div className="flex justify-between text-ink-600">
                                <span>Karyawan di memori:</span>
                                <span className="font-bold tabular-nums text-ink-900">{Object.keys(employeeDb).length} orang</span>
                              </div>
                              <div className="flex justify-between text-ink-600">
                                <span>Laporan riwayat di memori:</span>
                                <span className="font-bold tabular-nums text-ink-900">{history.length} laporan</span>
                              </div>
                              <div data-ui className="flex justify-between text-safe-700 font-semibold pt-1 border-t border-ink-200">
                                <span>Estimasi Kuota Tulis (Writes):</span>
                                <span className="tabular-nums">1 Write (Roster) + {history.length} Writes</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={firebaseSyncing}
                            onClick={handleSyncAllToFirebase}
                            className={`w-full py-3 px-4 rounded-xl font-black text-xs   text-white  flex items-center justify-center gap-2 cursor-pointer transition ${
                              firebaseSyncing
                                ? 'bg-ink-400 cursor-not-allowed'
                                : 'bg-danger-600 hover:bg-danger-700 active:scale-[0.99]'
                            }`}
                          >
                            <Flame className="w-4 h-4 text-warn-300" />
                            <span>
                              {firebaseSyncing
                                ? (lang === 'ID' ? 'Memproses Backup...' : 'Backing up...')
                                : (lang === 'ID' ? ' Backup ke Firebase Sekarang' : ' Backup to Firebase Now')}
                            </span>
                          </button>
                        </div>

                        {/* 2. Pull / Restore Data */}
                        <div data-ui className="bg-white rounded-xl border border-ink-200 p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              
                              <h4 className="font-black text-sm text-ink-900">
                                {lang === 'ID' ? 'Tarik Data (1-Read Roster Mode)' : 'Restore Data (1-Read Mode)'}
                              </h4>
                            </div>
                            <p className="text-xs text-ink-600 leading-relaxed mb-4">
                              {lang === 'ID'
                                ? 'Mengambil seluruh karyawan hanya dengan 1 kali Read dari dokumen roster terpadu, plus riwayat laporan assessment esensial.'
                                : 'Fetch all employees with a single Firestore Read operation from the unified roster document, plus essential assessment history.'}
                            </p>

                            <div data-ui className="bg-ink-50 rounded-xl p-3 border border-rule mb-4 text-xs text-ink-600 space-y-1">
                              <div className="font-bold text-ink-800"> Efisiensi Kuota Baca (Read):</div>
                              <p className="text-xs text-ink-500 leading-relaxed">
                                Mode sebelumnya menghabiskan ratusan Read setiap kali ditarik. Mode baru mengelompokkan data karyawan dalam 1 dokumen roster sehingga hanya mengonsumsi <b>1 Read</b>!
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={firebaseSyncing}
                            onClick={() => handleRestoreFromFirebase()}
                            className={`w-full py-3 px-4 rounded-xl font-black text-xs   text-white  flex items-center justify-center gap-2 cursor-pointer transition ${
                              firebaseSyncing
                                ? 'bg-ink-400 cursor-not-allowed'
                                : 'bg-safe-600 hover:bg-safe-700 active:scale-[0.99]'
                            }`}
                          >
                            <RefreshCw className={`w-4 h-4 ${firebaseSyncing ? 'animate-spin' : ''}`} />
                            <span>
                              {firebaseSyncing
                                ? (lang === 'ID' ? 'Memproses Data...' : 'Processing...')
                                : (lang === 'ID' ? ' Tarik Data dari Firebase' : ' Pull from Firebase')}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Storage Pruning & Cleanup Card (Hemat Kapasitas Penyimpanan) */}
                      <div data-ui className="bg-white rounded-xl border border-warn-200 p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              
                              <h4 className="font-black text-sm text-ink-900">
                                {lang === 'ID' ? 'Pangkas & Bersihkan Storage Riwayat Lama' : 'Prune Old History Storage'}
                              </h4>
                            </div>
                            <p className="text-xs text-ink-600 max-w-2xl leading-relaxed">
                              {lang === 'ID'
                                ? 'Hapus laporan assessment lama dari Firebase Firestore yang sudah tidak aktif untuk mengosongkan kuota penyimpanan (Storage) agar tetap berada dalam free-tier dan database tetap ringan.'
                                : 'Delete old assessment records from Firebase Firestore to free up storage space and keep your database lightweight.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={pruneDays}
                              onChange={(e) => setPruneDays(Number(e.target.value))}
                              className="bg-ink-50 border border-ink-300 rounded-xl px-3 py-2 text-xs font-bold text-ink-800"
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
                              className={`py-2 px-4 rounded-xl font-bold text-xs text-white  cursor-pointer transition flex items-center gap-1.5 ${
                                isPruning
                                  ? 'bg-ink-400 cursor-not-allowed'
                                  : 'bg-warn-600 hover:bg-warn-700 active:scale-95'
                              }`}
                            >
                              <Trash2 className={`w-3.5 h-3.5 ${isPruning ? 'animate-spin' : ''}`} />
                              <span>{isPruning ? (lang === 'ID' ? 'Memangkas...' : 'Pruning...') : (lang === 'ID' ? 'Pangkas Sekarang' : 'Prune Now')}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Technical Info & Config Card */}
                      <div data-ui className="bg-white rounded-xl border border-ink-200 p-5">
                        <h4 className="text-xs font-black text-ink-800 mb-3 flex items-center gap-2">
                          <Database className="w-4 h-4 text-ink-500" />
                          <span>Informasi Konfigurasi Firebase Firestore Backend</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
                          <div data-ui className="bg-ink-50 p-3 rounded-lg border border-ink-200">
                            <span className="text-xs text-ink-500 font-bold block">Auth Domain</span>
                            <span className="font-semibold text-ink-800 break-all">ftw-wbs.firebaseapp.com</span>
                          </div>
                          <div data-ui className="bg-ink-50 p-3 rounded-lg border border-ink-200">
                            <span className="text-xs text-ink-500 font-bold block">Storage Bucket</span>
                            <span className="font-semibold text-ink-800 break-all">ftw-wbs.firebasestorage.app</span>
                          </div>
                          <div data-ui className="bg-ink-50 p-3 rounded-lg border border-ink-200">
                            <span className="text-xs text-ink-500 font-bold block">Messaging Sender ID</span>
                            <span className="font-semibold text-ink-800">558288446517</span>
                          </div>
                          <div data-ui className="bg-ink-50 p-3 rounded-lg border border-ink-200">
                            <span className="text-xs text-ink-500 font-bold block">App ID</span>
                            <span className="font-semibold text-ink-800 break-all text-xs">1:558288446517:web:f7dde6f01f4accb1163d7c</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

                </div>

                {/* Admin Page Footer */}
                <div data-ui className="p-4 bg-white border-t border-ink-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
                  <span className="text-xs text-ink-500 font-medium">
                    Fit to Work PT. Wahana Bara Sentosa • Central Admin Portal
                  </span>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdminPage(false);
                      window.location.hash = '';
                      setEditingEmpNik(null);
                      setSelectedDashboardRecordId(null);
                    }}
                    className="bg-ink-900 hover:bg-black font-bold py-2.5 px-6 rounded-lg text-xs cursor-pointer text-white transition text-xs"
                  >
                    {lang === 'ID' ? '← Kembali Ke Formulir Asesmen' : '← Return to Assessment Form'}
                  </button>
                </div>
              </>
            )}

            </div>
          </main>
        </div>
      )}

      {/* INLINE CONFIRMATION DIALOG MODAL */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-ink-950/60 flex items-center justify-center p-4 z-[70]">
          <div data-ui className="bg-elevated rounded-2xl border border-rule max-w-md w-full p-6 text-ink-800 flex flex-col gap-4">
            <h3 className="text-base font-bold text-ink-900">{confirmDialog.title}</h3>
            <p className="text-xs text-ink-600 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="bg-surface hover:bg-rule text-ink-700 border border-rule font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
              >
                {lang === 'ID' ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  fn();
                }}
                className="bg-danger-600 hover:bg-danger-700 text-ink-50 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
              >
                {lang === 'ID' ? 'Ya, Lanjutkan' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
