import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBMw_xLTuTK66i2TFn6Iotg43AFvFBtxZ8",
  authDomain: "ftw-wbs.firebaseapp.com",
  projectId: "ftw-wbs",
  storageBucket: "ftw-wbs.firebasestorage.app",
  messagingSenderId: "558288446517",
  appId: "1:558288446517:web:f7dde6f01f4accb1163d7c"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Helper to save or update assessment in Firestore
export async function syncAssessmentToFirestore(record: any): Promise<boolean> {
  try {
    if (!record || !record.id) return false;
    const docRef = doc(db, 'assessments', record.id);
    await setDoc(docRef, {
      ...record,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menyimpan assessment ke Firestore:', error);
    return false;
  }
}

// Helper to delete assessment from Firestore
export async function deleteAssessmentFromFirestore(id: string): Promise<boolean> {
  try {
    if (!id) return false;
    const docRef = doc(db, 'assessments', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.warn('[Firestore] Gagal menghapus assessment dari Firestore:', error);
    return false;
  }
}

// Helper to fetch all assessments from Firestore
export async function fetchAssessmentsFromFirestore(): Promise<any[]> {
  try {
    const colRef = collection(db, 'assessments');
    const snapshot = await getDocs(colRef);
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

// Helper to save a single employee to Firestore
export async function syncEmployeeToFirestore(
  nik: string, 
  data: { nama: string; jabatan: string; dept: string }
): Promise<boolean> {
  try {
    const cleanNik = nik.trim().toUpperCase();
    if (!cleanNik) return false;
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

// Helper to save batch of employees to Firestore
export async function syncEmployeesBatchToFirestore(
  employees: Record<string, { nama: string; jabatan: string; dept: string }>
): Promise<boolean> {
  try {
    const entries = Object.entries(employees);
    if (entries.length === 0) return true;
    
    // Process in chunks of 450 (Firestore limit is 500 operations per batch)
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

// Helper to fetch all employees from Firestore
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
