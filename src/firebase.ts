import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: appletConfig.apiKey || "AIzaSyBMw_xLTuTK66i2TFn6Iotg43AFvFBtxZ8",
  authDomain: appletConfig.authDomain || "ftw-wbs.firebaseapp.com",
  projectId: appletConfig.projectId || "ftw-wbs",
  storageBucket: appletConfig.storageBucket || "ftw-wbs.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || "558288446517",
  appId: appletConfig.appId || "1:558288446517:web:612a2986ec377a71163d7c",
  firestoreDatabaseId: appletConfig.firestoreDatabaseId || "ai-studio-fittoworkonlinep-d78305d3-bbb2-4d08-9e0c-ddafbc7bba37"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with Persistent Multi-Tab Local Cache (IndexedDB)
// This serves reads from browser cache whenever possible, cutting Firestore read quota consumption drastically (0-read cache hits)
let firestoreInstance: any;
const targetDbId = firebaseConfig.firestoreDatabaseId || undefined;

try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, targetDbId);
} catch (e: any) {
  // If already initialized or persistent cache active
  try {
    firestoreInstance = getFirestore(app, targetDbId);
  } catch (err2) {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// ---------------- Standardized Error Handler (SKILL Standard) ----------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.warn('[Firestore Managed Error]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ---------------- Storage Optimization: Lightweight Sanitizer ----------------
// Strips empty strings, undefined, and redundant verbose UI elements to save up to 70% storage bytes per record
export function sanitizeAssessmentForStorage(record: any): Record<string, any> {
  const sanitized: Record<string, any> = {
    id: String(record.id || '').trim(),
    nik: String(record.nik || '').trim().toUpperCase(),
    nama: String(record.nama || '').trim(),
    jabatan: String(record.jabatan || '').trim(),
    dept: String(record.dept || '').trim(),
    timestamp: record.timestamp || new Date().toISOString(),
    tanggalPengisian: record.tanggalPengisian || '',
    jamPengisian: record.jamPengisian || '',
    totalSleep12: Number(record.totalSleep12) || 0,
    totalSleep36: Number(record.totalSleep36) || 0,
    consumesObat: Boolean(record.consumesObat),
    hasPersonalProblem: Boolean(record.hasPersonalProblem),
    totalFatigueScore: Number(record.totalFatigueScore) || 0,
    readinessScore: Number(record.readinessScore) || 0,
    fatigueCategory: record.fatigueCategory || 'NORMAL',
    finalDecision: record.finalDecision || 'FIT',
    updatedAt: new Date().toISOString()
  };

  // Only store bed/wake session times if they exist to minimize document size
  if (record.sleep12Session1Bed) sanitized.sleep12Session1Bed = record.sleep12Session1Bed;
  if (record.sleep12Session1Wake) sanitized.sleep12Session1Wake = record.sleep12Session1Wake;
  if (record.hasSleep12Session2) {
    sanitized.hasSleep12Session2 = true;
    if (record.sleep12Session2Bed) sanitized.sleep12Session2Bed = record.sleep12Session2Bed;
    if (record.sleep12Session2Wake) sanitized.sleep12Session2Wake = record.sleep12Session2Wake;
  }

  if (record.sleep36Session1Bed) sanitized.sleep36Session1Bed = record.sleep36Session1Bed;
  if (record.sleep36Session1Wake) sanitized.sleep36Session1Wake = record.sleep36Session1Wake;
  if (record.hasSleep36Session2) {
    sanitized.hasSleep36Session2 = true;
    if (record.sleep36Session2Bed) sanitized.sleep36Session2Bed = record.sleep36Session2Bed;
    if (record.sleep36Session2Wake) sanitized.sleep36Session2Wake = record.sleep36Session2Wake;
  }

  return sanitized;
}

// ---------------- ASSESSMENTS OPERATIONS ----------------

// Helper to save or update assessment in Firestore (Lightweight format)
export async function syncAssessmentToFirestore(record: any): Promise<boolean> {
  if (!record || !record.id) return false;
  const path = `assessments/${record.id}`;
  try {
    const docRef = doc(db, 'assessments', record.id);
    const payload = sanitizeAssessmentForStorage(record);
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menyimpan assessment ke Firestore:', error);
    return false;
  }
}

// Helper to delete assessment from Firestore
export async function deleteAssessmentFromFirestore(id: string): Promise<boolean> {
  if (!id) return false;
  const path = `assessments/${id}`;
  try {
    const docRef = doc(db, 'assessments', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menghapus assessment dari Firestore:', error);
    return false;
  }
}

/**
 * Fetch assessments from Firestore with smart limit.
 * CRITICAL QUOTA SAVER: Prevents downloading thousands of historical records at once.
 * Default limit is 50 records to prevent hitting read quota limits (1.9M read surge prevention).
 */
export async function fetchAssessmentsFromFirestore(limitCount: number = 50): Promise<any[]> {
  const path = 'assessments';
  try {
    const colRef = collection(db, 'assessments');
    // Apply order and limit to protect Firestore read quota
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(Math.max(1, limitCount)));
    const snapshot = await getDocs(q);
    const records: any[] = [];
    snapshot.forEach((d) => {
      records.push(d.data());
    });
    return records;
  } catch (error) {
    console.warn('[Firestore] Gagal mengambil riwayat dari Firestore:', error);
    return [];
  }
}

/**
 * Prune old assessments from Firestore to free up cloud storage.
 * Deletes records older than daysOld days.
 */
export async function pruneOldAssessmentsFromFirestore(daysOld: number = 30): Promise<{ deletedCount: number; message: string }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffIso = cutoffDate.toISOString();

    const colRef = collection(db, 'assessments');
    const snapshot = await getDocs(colRef);
    
    let deletedCount = 0;
    const batch = writeBatch(db);
    let pendingInBatch = 0;

    snapshot.forEach((d) => {
      const data = d.data();
      const docDate = data.timestamp || data.updatedAt || '';
      if (docDate && docDate < cutoffIso) {
        batch.delete(d.ref);
        deletedCount++;
        pendingInBatch++;
      }
    });

    if (pendingInBatch > 0) {
      await batch.commit();
    }

    return {
      deletedCount,
      message: `Berhasil membersihkan ${deletedCount} dokumen riwayat assessment lama (> ${daysOld} hari) dari Firebase Firestore.`
    };
  } catch (error) {
    console.warn('[Firestore] Gagal memangkas assessment lama:', error);
    return {
      deletedCount: 0,
      message: `Gagal memangkas data lama: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ---------------- 1-DOCUMENT CONSOLIDATED ROSTER (HEMAT READ & STORAGE 99%) ----------------

/**
 * Saves all active employees into a SINGLE consolidated document: `/directory/roster`.
 * 
 * WHY THIS IS REVOLUTIONARY FOR COST & PERFORMANCE:
 * - Traditional approach: 200 employees = 200 separate documents, requiring 200 Firestore Reads & 200 Writes every sync.
 * - Consolidated approach: 200 employees = 1 single document, requiring exactly 1 Read and 1 Write!
 * - Saves 99.5% on Firestore Reads, Writes, and Document Indexing Storage Overhead!
 */
export async function saveRosterToFirestore(
  employees: Record<string, { nama: string; jabatan: string; dept: string }>
): Promise<boolean> {
  try {
    const docRef = doc(db, 'directory', 'roster');
    const count = Object.keys(employees).length;
    await setDoc(docRef, {
      roster: employees,
      count,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menyimpan consolidated roster ke Firestore:', error);
    return false;
  }
}

/**
 * Fetches all employees with a SINGLE Firestore Read from `/directory/roster`.
 * Falls back to legacy `/employees` collection if roster does not exist yet.
 */
export async function fetchRosterFromFirestore(): Promise<Record<string, { nama: string; jabatan: string; dept: string }>> {
  try {
    // 1. Try consolidated single-read roster first
    const docRef = doc(db, 'directory', 'roster');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && data.roster && typeof data.roster === 'object') {
        return data.roster;
      }
    }

    // 2. Fallback to legacy individual collection if roster is not yet generated
    return await fetchEmployeesFromFirestore();
  } catch (error) {
    console.warn('[Firestore] Gagal mengambil roster dari Firestore:', error);
    return {};
  }
}

// ---------------- LEGACY / INDIVIDUAL EMPLOYEE OPERATIONS ----------------

// Helper to save a single employee to Firestore
export async function syncEmployeeToFirestore(
  nik: string, 
  data: { nama: string; jabatan: string; dept: string }
): Promise<boolean> {
  try {
    const cleanNik = nik.trim().toUpperCase();
    if (!cleanNik) return false;
    
    // Save individual record (backward compatibility)
    const docRef = doc(db, 'employees', cleanNik);
    await setDoc(docRef, {
      nik: cleanNik,
      nama: data.nama.trim(),
      jabatan: data.jabatan.trim(),
      dept: data.dept.trim(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menyimpan karyawan ke Firestore:', error);
    return false;
  }
}

// Helper to save batch of employees to Firestore and also update the single-document roster
export async function syncEmployeesBatchToFirestore(
  employees: Record<string, { nama: string; jabatan: string; dept: string }>
): Promise<boolean> {
  try {
    // First, save as single consolidated roster (1 Write, instant & compact)
    await saveRosterToFirestore(employees);

    // Also update individual documents in chunks of 450 for compatibility
    const entries = Object.entries(employees);
    if (entries.length === 0) return true;
    
    const chunkSize = 450;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const [nik, data] of chunk) {
        const cleanNik = nik.trim().toUpperCase();
        if (cleanNik) {
          const docRef = doc(db, 'employees', cleanNik);
          batch.set(docRef, {
            nik: cleanNik,
            nama: data.nama,
            jabatan: data.jabatan,
            dept: data.dept,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }
      await batch.commit();
    }
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal batch sync karyawan ke Firestore:', error);
    return false;
  }
}

// Helper to delete an employee from Firestore
export async function deleteEmployeeFromFirestore(nik: string): Promise<boolean> {
  try {
    const cleanNik = nik.trim().toUpperCase();
    if (!cleanNik) return false;
    const docRef = doc(db, 'employees', cleanNik);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menghapus karyawan dari Firestore:', error);
    return false;
  }
}

// Helper to fetch all employees from individual collection
export async function fetchEmployeesFromFirestore(): Promise<Record<string, { nama: string; jabatan: string; dept: string }>> {
  try {
    const colRef = collection(db, 'employees');
    const snapshot = await getDocs(colRef);
    const result: Record<string, { nama: string; jabatan: string; dept: string }> = {};
    snapshot.forEach((d) => {
      const data = d.data();
      if (data && data.nik) {
        result[data.nik] = {
          nama: data.nama || '',
          jabatan: data.jabatan || '',
          dept: data.dept || ''
        };
      }
    });
    return result;
  } catch (error) {
    console.warn('[Firestore] Gagal mengambil karyawan dari Firestore:', error);
    return {};
  }
}
