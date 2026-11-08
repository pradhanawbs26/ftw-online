import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  XCircle,
  Clock,
  Calendar,
  Search,
  Eye,
  X,
  User,
  ShieldAlert,
  BarChart3,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkAssessmentAnomalies } from './utils';

export interface TrendCustomAssessment {
  id: string;
  originalId?: string;
  timestamp: string;
  nik: string;
  nama: string;
  jabatan: string;
  dept: string;
  tanggalPengisian: string;
  jamPengisian: string;
  sleep12Session1Bed?: string;
  sleep12Session1Wake?: string;
  sleep12Session2Bed?: string;
  sleep12Session2Wake?: string;
  hasSleep12Session2?: boolean;
  totalSleep12?: number;
  sleep36Session1Bed?: string;
  sleep36Session1Wake?: string;
  sleep36Session2Bed?: string;
  sleep36Session2Wake?: string;
  hasSleep36Session2?: boolean;
  totalSleep36?: number;
  consumesObat?: boolean;
  hasPersonalProblem?: boolean;
  totalFatigueScore?: number;
  readinessScore?: number;
  fatigueCategory?: string;
  finalDecision: 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT';
}

interface AdminTrendsAnalysisProps {
  history: TrendCustomAssessment[];
  employeeDb: Record<string, { nama: string; jabatan: string; dept: string }>;
  lang: 'ID' | 'EN';
  normalizeDateStr: (d?: string) => string;
  deduplicateAssessments: (records: any[]) => any[];
}

export default function AdminTrendsAnalysis({
  history,
  employeeDb,
  lang,
  normalizeDateStr,
  deduplicateAssessments
}: AdminTrendsAnalysisProps) {
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>('2026-10-31');
  const [statusFilter, setStatusFilter] = useState<'ALL_ISSUES' | 'UNFIT_ONLY' | 'CONDITIONAL_ONLY' | 'REST_ONLY' | 'ANOMALY_ONLY' | 'ALL_EMPLOYEES'>('ALL_ISSUES');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'total_desc' | 'unfit_desc' | 'conditional_desc' | 'rest_desc' | 'name_asc'>('total_desc');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const periodRecords = useMemo(() => {
    const deduped = deduplicateAssessments(history) as TrendCustomAssessment[];
    return deduped.filter(r => {
      const d = normalizeDateStr(r.tanggalPengisian || r.timestamp);
      if (startDate && d && d < startDate) return false;
      if (endDate && d && d > endDate) return false;
      return true;
    });
  }, [history, startDate, endDate, normalizeDateStr, deduplicateAssessments]);

  const employeeStats = useMemo(() => {
    const map = new Map<string, {
      nik: string;
      nama: string;
      jabatan: string;
      dept: string;
      totalAssessments: number;
      fitCount: number;
      unfitCount: number;
      conditionalCount: number;
      restCount: number;
      totalIssues: number;
      anomalyCount: number;
      sleep12Sum: number;
      avgSleep12: number;
      lastIssueDate: string;
      lastIssueTime: string;
      lastIssueDecision: string;
      riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL';
      records: TrendCustomAssessment[];
      issueRecords: TrendCustomAssessment[];
      anomalyRecords: TrendCustomAssessment[];
    }>();

    for (const r of periodRecords) {
      const cleanNik = (r.nik || '').trim().replace(/^0+/, '') || (r.nik || '').trim();
      if (!cleanNik) continue;

      if (!map.has(cleanNik)) {
        const profile = employeeDb[cleanNik] || employeeDb[r.nik];
        map.set(cleanNik, {
          nik: cleanNik,
          nama: r.nama || profile?.nama || '-',
          jabatan: r.jabatan || profile?.jabatan || '-',
          dept: r.dept || profile?.dept || '-',
          totalAssessments: 0,
          fitCount: 0,
          unfitCount: 0,
          conditionalCount: 0,
          restCount: 0,
          totalIssues: 0,
          anomalyCount: 0,
          sleep12Sum: 0,
          avgSleep12: 0,
          lastIssueDate: '',
          lastIssueTime: '',
          lastIssueDecision: '',
          riskLevel: 'NORMAL',
          records: [],
          issueRecords: [],
          anomalyRecords: []
        });
      }

      const item = map.get(cleanNik)!;
      item.totalAssessments++;
      item.sleep12Sum += (r.totalSleep12 || 0);
      item.records.push(r);

      const decision = r.finalDecision;
      const isIssue = decision === 'UNFIT' || decision === 'FIT_CONDITIONAL' || decision === 'REST_BEFORE_WORK';

      if (decision === 'UNFIT') {
        item.unfitCount++;
      } else if (decision === 'FIT_CONDITIONAL') {
        item.conditionalCount++;
      } else if (decision === 'REST_BEFORE_WORK') {
        item.restCount++;
      } else {
        item.fitCount++;
      }

      if (isIssue) {
        item.totalIssues++;
        item.issueRecords.push(r);
        const dStr = normalizeDateStr(r.tanggalPengisian || r.timestamp);
        if (!item.lastIssueDate || dStr >= item.lastIssueDate) {
          item.lastIssueDate = dStr;
          item.lastIssueTime = r.jamPengisian || '';
          item.lastIssueDecision = decision;
        }
      }

      const anomaly = checkAssessmentAnomalies(r);
      if (anomaly.hasAnomaly) {
        item.anomalyCount++;
        item.anomalyRecords.push(r);
      }
    }

    map.forEach(item => {
      item.avgSleep12 = item.totalAssessments > 0 ? parseFloat((item.sleep12Sum / item.totalAssessments).toFixed(1)) : 0;
      if (item.unfitCount >= 2 || item.totalIssues >= 3) {
        item.riskLevel = 'HIGH';
      } else if (item.unfitCount === 1 || item.totalIssues === 2) {
        item.riskLevel = 'MEDIUM';
      } else if (item.totalIssues === 1) {
        item.riskLevel = 'LOW';
      } else {
        item.riskLevel = 'NORMAL';
      }

      item.issueRecords.sort((a, b) => {
        const dA = normalizeDateStr(a.tanggalPengisian || a.timestamp);
        const dB = normalizeDateStr(b.tanggalPengisian || b.timestamp);
        if (dA !== dB) return dB.localeCompare(dA);
        return (b.jamPengisian || '').localeCompare(a.jamPengisian || '');
      });
    });

    return Array.from(map.values());
  }, [periodRecords, employeeDb, normalizeDateStr]);

  const kpis = useMemo(() => {
    let unfitTotal = 0;
    let conditionalTotal = 0;
    let restTotal = 0;
    let unfitEmployees = 0;
    let conditionalEmployees = 0;
    let restEmployees = 0;
    let totalEmployeesWithIssues = 0;
    let totalAnomalies = 0;
    let employeesWithAnomalies = 0;

    employeeStats.forEach(e => {
      unfitTotal += e.unfitCount;
      conditionalTotal += e.conditionalCount;
      restTotal += e.restCount;
      totalAnomalies += e.anomalyCount;
      if (e.unfitCount > 0) unfitEmployees++;
      if (e.conditionalCount > 0) conditionalEmployees++;
      if (e.restCount > 0) restEmployees++;
      if (e.totalIssues > 0) totalEmployeesWithIssues++;
      if (e.anomalyCount > 0) employeesWithAnomalies++;
    });

    const totalIssues = unfitTotal + conditionalTotal + restTotal;
    const totalAssessments = periodRecords.length;
    const issueRate = totalAssessments > 0 ? ((totalIssues / totalAssessments) * 100).toFixed(1) : '0';

    return {
      totalAssessments,
      totalIssues,
      issueRate,
      unfitTotal,
      unfitEmployees,
      conditionalTotal,
      conditionalEmployees,
      restTotal,
      restEmployees,
      totalEmployeesWithIssues,
      totalAnomalies,
      employeesWithAnomalies
    };
  }, [employeeStats, periodRecords]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employeeStats.forEach(e => {
      if (e.dept && e.dept !== '-') set.add(e.dept);
    });
    return Array.from(set).sort();
  }, [employeeStats]);

  const filteredEmployees = useMemo(() => {
    let rows = [...employeeStats];

    if (statusFilter === 'ALL_ISSUES') {
      rows = rows.filter(e => e.totalIssues > 0);
    } else if (statusFilter === 'UNFIT_ONLY') {
      rows = rows.filter(e => e.unfitCount > 0);
    } else if (statusFilter === 'CONDITIONAL_ONLY') {
      rows = rows.filter(e => e.conditionalCount > 0);
    } else if (statusFilter === 'REST_ONLY') {
      rows = rows.filter(e => e.restCount > 0);
    } else if (statusFilter === 'ANOMALY_ONLY') {
      rows = rows.filter(e => e.anomalyCount > 0);
    }

    if (riskFilter !== 'ALL') {
      rows = rows.filter(e => e.riskLevel === riskFilter);
    }

    if (deptFilter !== 'ALL') {
      rows = rows.filter(e => e.dept === deptFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(e =>
        e.nama.toLowerCase().includes(q) ||
        e.nik.toLowerCase().includes(q) ||
        e.jabatan.toLowerCase().includes(q) ||
        e.dept.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      if (sortBy === 'total_desc') {
        if (b.totalIssues !== a.totalIssues) return b.totalIssues - a.totalIssues;
        if (b.unfitCount !== a.unfitCount) return b.unfitCount - a.unfitCount;
        return a.nama.localeCompare(b.nama);
      } else if (sortBy === 'unfit_desc') {
        if (b.unfitCount !== a.unfitCount) return b.unfitCount - a.unfitCount;
        return b.totalIssues - a.totalIssues;
      } else if (sortBy === 'conditional_desc') {
        if (b.conditionalCount !== a.conditionalCount) return b.conditionalCount - a.conditionalCount;
        return b.totalIssues - a.totalIssues;
      } else if (sortBy === 'rest_desc') {
        if (b.restCount !== a.restCount) return b.restCount - a.restCount;
        return b.totalIssues - a.totalIssues;
      } else {
        return a.nama.localeCompare(b.nama);
      }
    });

    return rows;
  }, [employeeStats, statusFilter, riskFilter, deptFilter, searchQuery, sortBy]);

  const dailyTrends = useMemo(() => {
    const map = new Map<string, { date: string; unfit: number; conditional: number; rest: number; total: number }>();
    periodRecords.forEach(r => {
      const d = normalizeDateStr(r.tanggalPengisian || r.timestamp);
      if (!d) return;
      if (!map.has(d)) {
        map.set(d, { date: d, unfit: 0, conditional: 0, rest: 0, total: 0 });
      }
      const item = map.get(d)!;
      item.total++;
      if (r.finalDecision === 'UNFIT') item.unfit++;
      else if (r.finalDecision === 'FIT_CONDITIONAL') item.conditional++;
      else if (r.finalDecision === 'REST_BEFORE_WORK') item.rest++;
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [periodRecords, normalizeDateStr]);

  const handleExportExcel = () => {
    const summaryHeaders = [
      'No',
      'NIK',
      'Nama Karyawan',
      'Jabatan',
      'Departemen',
      'Tingkat Risiko',
      'Frekuensi Unfit',
      'Frekuensi Pengawasan Khusus',
      'Frekuensi Wajib Istirahat',
      'Total Masalah Kelayakan',
      'Total Asesmen Diisi',
      'Rata-rata Tidur 12 Jam (Jam)',
      'Tanggal Kasus Terakhir',
      'Jam Kasus Terakhir',
      'Status Keputusan Terakhir'
    ];

    const summaryRows = filteredEmployees.map((e, idx) => {
      const riskText = e.riskLevel === 'HIGH'
        ? 'Tinggi (Krisis)'
        : (e.riskLevel === 'MEDIUM' ? 'Waspada' : (e.riskLevel === 'LOW' ? 'Ringan' : 'Normal'));
      return [
        idx + 1,
        e.nik,
        e.nama,
        e.jabatan,
        e.dept,
        riskText,
        e.unfitCount,
        e.conditionalCount,
        e.restCount,
        e.totalIssues,
        e.totalAssessments,
        e.avgSleep12,
        e.lastIssueDate || '-',
        e.lastIssueTime || '-',
        e.lastIssueDecision || '-'
      ];
    });

    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    summaryWs['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 25 },
      { wch: 20 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 26 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
      { wch: 20 },
      { wch: 18 },
      { wch: 24 }
    ];

    const detailHeaders = [
      'No',
      'Tanggal Pengisian',
      'Jam Pengisian',
      'ID Tiket',
      'NIK',
      'Nama Karyawan',
      'Jabatan',
      'Departemen',
      'Status Keputusan',
      'Total Tidur 12j (Jam)',
      'Total Tidur 36j (Jam)',
      'Konsumsi Obat',
      'Masalah Pribadi',
      'Skor Fatigue',
      'Skor Kesiapan (%)'
    ];

    const detailRows: any[] = [];
    let dIdx = 1;
    periodRecords.forEach(r => {
      if (r.finalDecision === 'UNFIT' || r.finalDecision === 'FIT_CONDITIONAL' || r.finalDecision === 'REST_BEFORE_WORK') {
        const dStr = normalizeDateStr(r.tanggalPengisian || r.timestamp);
        detailRows.push([
          dIdx++,
          dStr,
          r.jamPengisian || '-',
          r.id || '-',
          r.nik || '-',
          r.nama || '-',
          r.jabatan || '-',
          r.dept || '-',
          r.finalDecision,
          r.totalSleep12 ?? 0,
          r.totalSleep36 ?? 0,
          r.consumesObat ? 'Ya' : 'Tidak',
          r.hasPersonalProblem ? 'Ya' : 'Tidak',
          r.totalFatigueScore ?? '-',
          r.readinessScore ?? '-'
        ]);
      }
    });

    const detailWs = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    detailWs['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 14 },
      { wch: 25 },
      { wch: 20 },
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Rekap Frekuensi Karyawan');
    XLSX.utils.book_append_sheet(wb, detailWs, 'Detail Kasus Unfit & Pantau');

    const fileName = `Rekap_Trend_Fatigue_${startDate || 'Awal'}_sd_${endDate || 'Akhir'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="flex flex-col gap-6 text-ink-900">
      <div data-ui className="bg-ink-900 text-ink-50 rounded-2xl p-5 border border-ink-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 bg-danger-500/20 text-danger-200 rounded-xl">
                <TrendingUp className="w-5 h-5 text-danger-300" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-ink-50">
                {lang === 'ID' ? 'Analisis Tren & Frekuensi Status Karyawan' : 'Fatigue Trend & Frequency Analysis'}
              </h3>
            </div>
            <p className="text-sm text-ink-200 max-w-2xl leading-relaxed">
              {lang === 'ID'
                ? 'Pantau frekuensi karyawan yang teridentifikasi tidak layak kerja, butuh istirahat, atau bekerja dalam pengawasan khusus untuk evaluasi kelelahan berkala.'
                : 'Monitor recurring employee fatigue issues including Unfit, Mandatory Rest, and Special Supervision to detect systemic fatigue trends.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="min-h-11 bg-safe-500 hover:bg-safe-600 text-ink-50 text-sm font-semibold py-2.5 px-4 rounded-xl cursor-pointer transition-colors flex items-center gap-2"
              title="Unduh data tabel rekapitulasi ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-safe-100" aria-hidden="true" />
              <span>{lang === 'ID' ? 'Unduh Rekap (Excel)' : 'Export Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        <div data-ui className="mt-4 pt-4 border-t border-ink-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-danger-300" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink-100">
              {lang === 'ID' ? 'Periode Tanggal Evaluasi:' : 'Evaluation Date Range:'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="trend-start-date" className="flex items-center gap-2 bg-ink-800 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-ink-200 font-semibold">
                {lang === 'ID' ? 'Mulai:' : 'Start:'}
              </span>
              <input
                id="trend-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-ink-950 border border-ink-700 rounded-lg py-1.5 px-2.5 text-sm font-semibold text-ink-50 transition-colors"
              />
            </label>

            <span className="text-ink-200 font-semibold text-xs">s/d</span>

            <label htmlFor="trend-end-date" className="flex items-center gap-2 bg-ink-800 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-ink-200 font-semibold">
                {lang === 'ID' ? 'Selesai:' : 'End:'}
              </span>
              <input
                id="trend-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-ink-950 border border-ink-700 rounded-lg py-1.5 px-2.5 text-sm font-semibold text-ink-50 transition-colors"
              />
            </label>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="min-h-10 text-xs font-semibold text-ink-100 hover:text-ink-50 bg-ink-800 hover:bg-ink-700 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                title={lang === 'ID' ? 'Tampilkan semua tanggal' : 'Show all dates'}
              >
                {lang === 'ID' ? 'Reset Tanggal' : 'All Dates'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div data-ui className="bg-elevated border border-rule rounded-xl p-4">
          <div className="flex items-center justify-between text-ink-500 mb-1">
            <span className="text-xs font-semibold">{lang === 'ID' ? 'Total Kasus Bermasalah' : 'Total Issues'}</span>
            <AlertTriangle className="w-4 h-4 text-warn-500" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-ink-900">{kpis.totalIssues}</span>
            <span className="text-xs font-medium text-ink-400">kejadian</span>
          </div>
          <div className="text-xs text-ink-500 mt-1">
            <span className="font-bold text-danger-600">{kpis.issueRate}%</span> dari {kpis.totalAssessments} laporan
          </div>
        </div>

        <div data-ui className="bg-danger-50 border border-danger-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-danger-700 mb-1">
            <span className="text-xs font-semibold">Unfit Bekerja</span>
            <XCircle className="w-4 h-4 text-danger-600" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-danger-900">{kpis.unfitTotal}</span>
            <span className="text-xs font-medium text-danger-700">kejadian</span>
          </div>
          <div className="text-xs text-danger-800 font-semibold mt-1">
            {kpis.unfitEmployees} karyawan terkena
          </div>
        </div>

        <div data-ui className="bg-warn-50 border border-warn-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-warn-700 mb-1">
            <span className="text-xs font-semibold">Pengawasan Khusus</span>
            <ShieldAlert className="w-4 h-4 text-warn-600" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-warn-900">{kpis.conditionalTotal}</span>
            <span className="text-xs font-medium text-warn-700">kejadian</span>
          </div>
          <div className="text-xs text-warn-800 font-semibold mt-1">
            {kpis.conditionalEmployees} karyawan terkena
          </div>
        </div>

        <div data-ui className="bg-caution-50 border border-caution-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-caution-700 mb-1">
            <span className="text-xs font-semibold">Wajib Istirahat</span>
            <Clock className="w-4 h-4 text-caution-600" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-caution-900">{kpis.restTotal}</span>
            <span className="text-xs font-medium text-caution-700">kejadian</span>
          </div>
          <div className="text-xs text-caution-800 font-semibold mt-1">
            {kpis.restEmployees} karyawan terkena
          </div>
        </div>

        <div data-ui className="bg-surface border border-rule rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-ink-600 mb-1">
            <span className="text-xs font-semibold">{lang === 'ID' ? 'Karyawan Terdampak' : 'Affected Workers'}</span>
            <User className="w-4 h-4 text-ink-500" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-ink-900">{kpis.totalEmployeesWithIssues}</span>
            <span className="text-xs font-medium text-ink-500">orang</span>
          </div>
          <div className="text-xs text-ink-600 font-medium mt-1">
            Memerlukan evaluasi lanjutan
          </div>
        </div>
      </div>

      {dailyTrends.length > 0 && (
        <div data-ui className="bg-elevated rounded-xl border border-rule p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-danger-600" aria-hidden="true" />
              <h4 className="text-sm font-bold text-ink-900">
                {lang === 'ID' ? 'Distribusi Kasus Kelelahan Harian' : 'Daily Fatigue Distribution Timeline'}
              </h4>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-danger-700">
                <span className="h-2.5 w-2.5 rounded-full bg-danger-600" aria-hidden="true"></span> Unfit
              </span>
              <span className="flex items-center gap-1.5 text-warn-700">
                <span className="h-2.5 w-2.5 rounded-full bg-warn-500" aria-hidden="true"></span> Pengawasan
              </span>
              <span className="flex items-center gap-1.5 text-caution-700">
                <span className="h-2.5 w-2.5 rounded-full bg-caution-500" aria-hidden="true"></span> Wajib Istirahat
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-2">
            {dailyTrends.map(day => {
              const dayIssues = day.unfit + day.conditional + day.rest;
              const dateParts = day.date.split('-');
              const displayDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : day.date;
              return (
                <div key={day.date} data-ui className="bg-surface border border-rule rounded-lg p-2 text-center flex flex-col justify-between">
                  <span className="text-xs font-semibold text-ink-500 tabular-nums">{displayDate}</span>
                  <div className="my-1.5 flex flex-col items-center gap-1 min-h-[36px] justify-end">
                    {day.unfit > 0 && (
                      <span className="bg-danger-600 text-ink-50 tabular-nums font-bold text-xs px-1.5 rounded-sm w-full" title={`Unfit: ${day.unfit}`}>
                        {day.unfit}
                      </span>
                    )}
                    {day.conditional > 0 && (
                      <span className="bg-warn-500 text-ink-50 tabular-nums font-bold text-xs px-1.5 rounded-sm w-full" title={`Pengawasan Khusus: ${day.conditional}`}>
                        {day.conditional}
                      </span>
                    )}
                    {day.rest > 0 && (
                      <span className="bg-caution-500 text-ink-50 tabular-nums font-bold text-xs px-1.5 rounded-sm w-full" title={`Wajib Istirahat: ${day.rest}`}>
                        {day.rest}
                      </span>
                    )}
                    {dayIssues === 0 && (
                      <CheckCircle className="w-3.5 h-3.5 text-safe-600" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-ink-700 tabular-nums">
                    {dayIssues} isu
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div data-ui className="bg-elevated rounded-xl border border-rule p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label htmlFor="trend-status-filter" className="block text-xs font-semibold text-ink-600 mb-1">
              {lang === 'ID' ? 'Filter Kategori Masalah:' : 'Issue Category:'}
            </label>
            <select
              id="trend-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full min-h-10 bg-surface border border-rule rounded-lg py-2 px-2.5 text-xs font-semibold text-ink-900 cursor-pointer"
            >
              <option value="ALL_ISSUES">Semua Karyawan Bermasalah</option>
              <option value="UNFIT_ONLY">Hanya yang Pernah Unfit</option>
              <option value="CONDITIONAL_ONLY">Hanya Pengawasan Khusus</option>
              <option value="REST_ONLY">Hanya Wajib Istirahat</option>
              <option value="ALL_EMPLOYEES">Semua Karyawan (Termasuk Fit)</option>
            </select>
          </div>

          <div>
            <label htmlFor="trend-risk-filter" className="block text-xs font-semibold text-ink-600 mb-1">
              {lang === 'ID' ? 'Tingkat Kerawanan:' : 'Risk Level:'}
            </label>
            <select
              id="trend-risk-filter"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="w-full min-h-10 bg-surface border border-rule rounded-lg py-2 px-2.5 text-xs font-semibold text-ink-900 cursor-pointer"
            >
              <option value="ALL">Semua Level Risiko</option>
              <option value="HIGH">Risiko Tinggi (≥2x Unfit / ≥3x Isu)</option>
              <option value="MEDIUM">Perlu Pengawasan (1x Unfit / 2x Isu)</option>
              <option value="LOW">Risiko Ringan (1x Isu)</option>
            </select>
          </div>

          <div>
            <label htmlFor="trend-dept-filter" className="block text-xs font-semibold text-ink-600 mb-1">
              {lang === 'ID' ? 'Departemen:' : 'Department:'}
            </label>
            <select
              id="trend-dept-filter"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full min-h-10 bg-surface border border-rule rounded-lg py-2 px-2.5 text-xs font-semibold text-ink-900 cursor-pointer"
            >
              <option value="ALL">Semua Departemen</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="trend-sort-by" className="block text-xs font-semibold text-ink-600 mb-1">
              {lang === 'ID' ? 'Urutkan Berdasarkan:' : 'Sort By:'}
            </label>
            <select
              id="trend-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full min-h-10 bg-surface border border-rule rounded-lg py-2 px-2.5 text-xs font-semibold text-ink-900 cursor-pointer"
            >
              <option value="total_desc">Kasus Terbanyak (Paling Rentan)</option>
              <option value="unfit_desc">Paling Sering Unfit</option>
              <option value="conditional_desc">Paling Sering Pengawasan Khusus</option>
              <option value="rest_desc">Paling Sering Wajib Istirahat</option>
              <option value="name_asc">Nama Karyawan (A - Z)</option>
            </select>
          </div>

          <div>
            <label htmlFor="trend-search-query" className="block text-xs font-semibold text-ink-600 mb-1">
              {lang === 'ID' ? 'Cari Nama / NIK:' : 'Search Employee:'}
            </label>
            <div className="relative">
              <input
                id="trend-search-query"
                type="text"
                placeholder={lang === 'ID' ? 'Ketik nama, NIK, atau jabatan…' : 'Search name, NIK, role…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-10 bg-surface border border-rule rounded-lg py-2 pl-8 pr-2.5 text-xs font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400"
              />
              <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div data-ui className="bg-elevated rounded-xl border border-rule overflow-hidden">
        <div data-ui className="p-4 bg-surface border-b border-rule flex flex-wrap justify-between items-center gap-2">
          <div>
            <h4 className="text-sm font-bold text-ink-900">
              {lang === 'ID' ? 'Daftar Karyawan & Frekuensi Kasus Kelelahan' : 'Employee Fatigue Frequency Table'}
            </h4>
            <p className="text-xs text-ink-500 mt-0.5">
              Menampilkan <b>{filteredEmployees.length}</b> karyawan pada periode {startDate || 'Awal'} s/d {endDate || 'Sekarang'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">
              Pilih tombol <b>Rincian</b> untuk melihat seluruh tiket tanggal pengisian.
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr data-ui className="bg-surface text-xs font-semibold text-ink-600 border-b border-rule">
                <th className="py-3 px-3 text-right w-12">No</th>
                <th className="py-3 px-3">Identitas Karyawan</th>
                <th className="py-3 px-3">Departemen & Jabatan</th>
                <th className="py-3 px-3 text-center">Tingkat Risiko</th>
                <th className="py-3 px-3 text-right text-danger-700 bg-danger-50/50">Unfit</th>
                <th className="py-3 px-3 text-right text-warn-700 bg-warn-50/50">Pengawasan</th>
                <th className="py-3 px-3 text-right text-caution-700 bg-caution-50/50">Istirahat</th>
                <th className="py-3 px-3 text-right font-bold">Total Kasus</th>
                <th className="py-3 px-3 text-right">Rata-rata Tidur 12J (Jam)</th>
                <th className="py-3 px-3 text-center">Kejadian Terakhir</th>
                <th className="py-3 px-3 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody data-ui className="divide-y divide-rule">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-ink-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="w-8 h-8 text-safe-500" aria-hidden="true" />
                      <span className="font-semibold text-ink-700 text-sm">
                        Tidak ada data karyawan yang cocok dengan kriteria filter pada periode ini.
                      </span>
                      <span className="text-xs text-ink-400">
                        Seluruh karyawan pada periode ini tercatat dalam kondisi Fit atau filter terlalu ketat.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, index) => (
                  <tr key={emp.nik} className="hover:bg-surface transition-colors">
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-ink-400">
                      {index + 1}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-ink-900 text-xs leading-snug">
                        {emp.nama}
                      </div>
                      <div className="tabular-nums text-xs text-ink-500 font-medium">
                        NIK: {emp.nik}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-ink-800 text-xs">
                        {emp.jabatan}
                      </div>
                      <div className="text-xs text-ink-500">
                        {emp.dept}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {emp.riskLevel === 'HIGH' && (
                        <span data-ui className="inline-flex items-center gap-1.5 bg-danger-100 text-danger-800 border border-danger-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          <span className="h-2 w-2 rounded-full bg-danger-600" aria-hidden="true"></span>
                          Tinggi (Krisis)
                        </span>
                      )}
                      {emp.riskLevel === 'MEDIUM' && (
                        <span data-ui className="inline-flex items-center gap-1.5 bg-warn-100 text-warn-800 border border-warn-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          <span className="h-2 w-2 rounded-full bg-warn-600" aria-hidden="true"></span>
                          Waspada
                        </span>
                      )}
                      {emp.riskLevel === 'LOW' && (
                        <span data-ui className="inline-flex items-center gap-1.5 bg-caution-100 text-caution-800 border border-caution-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          Ringan
                        </span>
                      )}
                      {emp.riskLevel === 'NORMAL' && (
                        <span data-ui className="inline-flex items-center gap-1.5 bg-safe-50 text-safe-700 border border-safe-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          Normal (Fit)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right tabular-nums bg-danger-50/30">
                      {emp.unfitCount > 0 ? (
                        <span className="font-bold text-danger-700 bg-danger-100 px-2 py-0.5 rounded text-xs">
                          {emp.unfitCount}
                        </span>
                      ) : (
                        <span className="text-ink-400 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right tabular-nums bg-warn-50/30">
                      {emp.conditionalCount > 0 ? (
                        <span className="font-bold text-warn-800 bg-warn-100 px-2 py-0.5 rounded text-xs">
                          {emp.conditionalCount}
                        </span>
                      ) : (
                        <span className="text-ink-400 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right tabular-nums bg-caution-50/30">
                      {emp.restCount > 0 ? (
                        <span className="font-bold text-caution-800 bg-caution-100 px-2 py-0.5 rounded text-xs">
                          {emp.restCount}
                        </span>
                      ) : (
                        <span className="text-ink-400 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right tabular-nums">
                      <span className={`font-bold text-xs px-2 py-0.5 rounded ${
                        emp.totalIssues >= 3
                          ? 'bg-danger-600 text-ink-50'
                          : (emp.totalIssues >= 1 ? 'bg-ink-800 text-ink-50' : 'text-ink-400')
                      }`}>
                        {emp.totalIssues}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right tabular-nums">
                      <span className={`font-bold ${emp.avgSleep12 < 6 ? 'text-danger-600' : 'text-ink-700'}`}>
                        {emp.avgSleep12 > 0 ? emp.avgSleep12 : '-'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {emp.lastIssueDate ? (
                        <div>
                          <div className="tabular-nums text-xs font-semibold text-ink-800">
                            {emp.lastIssueDate}
                          </div>
                          <div className="text-xs text-ink-500">
                            pukul {emp.lastIssueTime || '-'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployee(emp)}
                        className="min-h-9 bg-ink-900 hover:bg-ink-950 text-ink-50 text-xs font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5 text-danger-300" aria-hidden="true" />
                        <span>Rincian</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-ink-950/60 flex items-center justify-center p-4">
          <div data-ui className="bg-elevated rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col border border-rule overflow-hidden">
            <div className="p-5 bg-ink-900 text-ink-50 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs bg-danger-600 text-ink-50 px-2.5 py-0.5 rounded font-semibold">
                    Profil Rekam Kelelahan
                  </span>
                  {selectedEmployee.riskLevel === 'HIGH' && (
                    <span className="text-xs bg-danger-500 text-ink-50 px-2.5 py-0.5 rounded font-semibold">
                      Risiko Tinggi
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-ink-50">{selectedEmployee.nama}</h3>
                <p className="text-xs text-ink-200 tabular-nums mt-0.5">
                  NIK: {selectedEmployee.nik} | {selectedEmployee.jabatan} | {selectedEmployee.dept}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                aria-label="Tutup rincian karyawan"
                className="min-h-10 min-w-10 p-2 bg-ink-800 hover:bg-ink-700 rounded-lg text-ink-50 cursor-pointer transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div data-ui className="p-4 bg-surface border-b border-rule grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div data-ui className="bg-elevated p-2.5 rounded-xl border border-rule">
                <span className="block text-xs font-semibold text-danger-700">Unfit</span>
                <span className="text-base font-bold tabular-nums text-danger-900">{selectedEmployee.unfitCount}x</span>
              </div>
              <div data-ui className="bg-elevated p-2.5 rounded-xl border border-rule">
                <span className="block text-xs font-semibold text-warn-700">Pengawasan</span>
                <span className="text-base font-bold tabular-nums text-warn-900">{selectedEmployee.conditionalCount}x</span>
              </div>
              <div data-ui className="bg-elevated p-2.5 rounded-xl border border-rule">
                <span className="block text-xs font-semibold text-caution-700">Istirahat</span>
                <span className="text-base font-bold tabular-nums text-caution-900">{selectedEmployee.restCount}x</span>
              </div>
              <div data-ui className="bg-elevated p-2.5 rounded-xl border border-rule">
                <span className="block text-xs font-semibold text-ink-600">Rata-rata Tidur</span>
                <span className="text-base font-bold tabular-nums text-ink-900">{selectedEmployee.avgSleep12} Jam</span>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <h4 className="text-sm font-bold text-ink-800 mb-2">
                Riwayat Kasus Kelelahan ({selectedEmployee.issueRecords.length} Tiket)
              </h4>

              {selectedEmployee.issueRecords.length === 0 ? (
                <div data-ui className="p-6 text-center text-ink-500 bg-surface rounded-xl border border-rule text-xs">
                  Karyawan ini tidak memiliki catatan riwayat kasus Unfit, Pengawasan, atau Istirahat pada rentang tanggal ini.
                </div>
              ) : (
                selectedEmployee.issueRecords.map((rec: TrendCustomAssessment, idx: number) => (
                  <div key={rec.id || idx} data-ui className="bg-elevated rounded-xl border border-rule p-4 space-y-2.5">
                    <div data-ui className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
                      <div className="flex items-center gap-2">
                        <span data-ui className="tabular-nums text-xs bg-surface border border-rule px-2 py-0.5 rounded font-semibold text-ink-700">
                          {rec.id}
                        </span>
                        <span className="text-xs font-bold text-ink-900 tabular-nums">
                          {rec.tanggalPengisian} pukul {rec.jamPengisian}
                        </span>
                      </div>

                      <div>
                        {rec.finalDecision === 'UNFIT' && (
                          <span className="bg-danger-600 text-ink-50 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                            Unfit / Dilarang Bekerja
                          </span>
                        )}
                        {rec.finalDecision === 'FIT_CONDITIONAL' && (
                          <span className="bg-warn-500 text-ink-50 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                            Pengawasan Khusus
                          </span>
                        )}
                        {rec.finalDecision === 'REST_BEFORE_WORK' && (
                          <span className="bg-caution-500 text-ink-50 font-semibold text-xs px-2.5 py-0.5 rounded-full">
                            Wajib Istirahat Sebelum Kerja
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                      <div className="bg-surface p-2 rounded-lg">
                        <span className="block text-xs text-ink-500 font-medium">Tidur 12 Jam</span>
                        <span className={`tabular-nums font-bold ${Number(rec.totalSleep12 || 0) < 6 ? 'text-danger-600' : 'text-ink-900'}`}>
                          {rec.totalSleep12 ?? '-'} Jam
                        </span>
                      </div>
                      <div className="bg-surface p-2 rounded-lg">
                        <span className="block text-xs text-ink-500 font-medium">Tidur 36 Jam</span>
                        <span className="tabular-nums font-bold text-ink-800">{rec.totalSleep36 ?? '-'} Jam</span>
                      </div>
                      <div className="bg-surface p-2 rounded-lg">
                        <span className="block text-xs text-ink-500 font-medium">Minum Obat?</span>
                        <span className={`font-bold ${rec.consumesObat ? 'text-danger-600' : 'text-ink-700'}`}>
                          {rec.consumesObat ? 'Ya (Minum Obat)' : 'Tidak'}
                        </span>
                      </div>
                      <div className="bg-surface p-2 rounded-lg">
                        <span className="block text-xs text-ink-500 font-medium">Masalah Pribadi?</span>
                        <span className={`font-bold ${rec.hasPersonalProblem ? 'text-danger-600' : 'text-ink-700'}`}>
                          {rec.hasPersonalProblem ? 'Ada Masalah' : 'Tidak'}
                        </span>
                      </div>
                    </div>

                    <div data-ui className="bg-surface p-2.5 rounded-lg border border-rule text-xs tabular-nums space-y-1">
                      <div className="flex justify-between items-center text-ink-800">
                        <span className="text-xs text-ink-500 font-medium">Jadwal Tidur 12 Jam:</span>
                        <span>Mulai: <b>{rec.sleep12Session1Bed || '-'}</b> s/d Bangun: <b>{rec.sleep12Session1Wake || '-'}</b></span>
                      </div>
                      {rec.hasSleep12Session2 && (
                        <div data-ui className="flex justify-between items-center text-ink-600 text-xs pt-1 mt-1 border-t border-dashed border-rule">
                          <span className="text-xs text-ink-500 font-medium">Sesi Tambahan:</span>
                          <span>Mulai: {rec.sleep12Session2Bed || '-'} s/d Bangun: {rec.sleep12Session2Wake || '-'}</span>
                        </div>
                      )}
                      <div data-ui className="flex justify-between items-center text-ink-700 pt-1 mt-1 border-t border-rule text-xs">
                        <span className="text-xs text-ink-500 font-medium">Jadwal Tidur 36 Jam:</span>
                        <span>Mulai: <b>{rec.sleep36Session1Bed || '-'}</b> s/d Bangun: <b>{rec.sleep36Session1Wake || '-'}</b></span>
                      </div>
                    </div>

                    {(() => {
                      const anom = checkAssessmentAnomalies(rec);
                      if (!anom.hasAnomaly) return null;
                      return (
                        <div data-ui className="bg-danger-50 border border-danger-300 p-2.5 rounded-lg text-xs text-danger-900 space-y-1">
                          <div className="font-bold text-xs text-danger-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-danger-600" aria-hidden="true" />
                            <span>Temuan Anomali Waktu (Pengawas):</span>
                          </div>
                          {anom.reasons.map((r, i) => (
                            <p key={i} className="text-xs font-medium leading-tight pl-3 relative">
                              <span className="absolute left-0">•</span> {r}
                            </p>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between text-xs pt-1 text-ink-600">
                      <span>Skor Kelelahan: <b className="tabular-nums text-ink-900">{rec.totalFatigueScore ?? '-'}</b> ({rec.fatigueCategory || 'Normal'})</span>
                      <span>Kesiapan Kerja: <b className="tabular-nums text-safe-700">{rec.readinessScore ?? '-'}%</b></span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div data-ui className="p-4 bg-surface border-t border-rule flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="min-h-10 bg-ink-900 hover:bg-ink-950 font-semibold text-xs text-ink-50 py-2 px-5 rounded-xl cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
