import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Calendar, 
  Search, 
  Download, 
  Eye, 
  X, 
  User, 
  Filter, 
  ShieldAlert, 
  ChevronRight, 
  BarChart3, 
  CheckCircle,
  Pill,
  Brain,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
  totalSleep12?: number;
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
  // Date range filters (Start Date & End Date)
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>('2026-10-31');

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL_ISSUES' | 'UNFIT_ONLY' | 'CONDITIONAL_ONLY' | 'REST_ONLY' | 'ALL_EMPLOYEES'>('ALL_ISSUES');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'total_desc' | 'unfit_desc' | 'conditional_desc' | 'rest_desc' | 'name_asc'>('total_desc');

  // Modal
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Filter records within date range
  const periodRecords = useMemo(() => {
    const deduped = deduplicateAssessments(history) as TrendCustomAssessment[];
    return deduped.filter(r => {
      const d = normalizeDateStr(r.tanggalPengisian || r.timestamp);
      if (startDate && d && d < startDate) return false;
      if (endDate && d && d > endDate) return false;
      return true;
    });
  }, [history, startDate, endDate, normalizeDateStr, deduplicateAssessments]);

  // Aggregate stats per employee
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
      sleep12Sum: number;
      avgSleep12: number;
      lastIssueDate: string;
      lastIssueTime: string;
      lastIssueDecision: string;
      riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL';
      records: TrendCustomAssessment[];
      issueRecords: TrendCustomAssessment[];
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
          sleep12Sum: 0,
          avgSleep12: 0,
          lastIssueDate: '',
          lastIssueTime: '',
          lastIssueDecision: '',
          riskLevel: 'NORMAL',
          records: [],
          issueRecords: []
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
    }

    // Determine risk level & calculate average sleep
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

      // Sort issue records newest-first
      item.issueRecords.sort((a, b) => {
        const dA = normalizeDateStr(a.tanggalPengisian || a.timestamp);
        const dB = normalizeDateStr(b.tanggalPengisian || b.timestamp);
        if (dA !== dB) return dB.localeCompare(dA);
        return (b.jamPengisian || '').localeCompare(a.jamPengisian || '');
      });
    });

    return Array.from(map.values());
  }, [periodRecords, employeeDb, normalizeDateStr]);

  // Overall Period KPIs
  const kpis = useMemo(() => {
    let unfitTotal = 0;
    let conditionalTotal = 0;
    let restTotal = 0;
    let unfitEmployees = 0;
    let conditionalEmployees = 0;
    let restEmployees = 0;
    let totalEmployeesWithIssues = 0;

    employeeStats.forEach(e => {
      unfitTotal += e.unfitCount;
      conditionalTotal += e.conditionalCount;
      restTotal += e.restCount;
      if (e.unfitCount > 0) unfitEmployees++;
      if (e.conditionalCount > 0) conditionalEmployees++;
      if (e.restCount > 0) restEmployees++;
      if (e.totalIssues > 0) totalEmployeesWithIssues++;
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
      totalEmployeesWithIssues
    };
  }, [employeeStats, periodRecords]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employeeStats.forEach(e => {
      if (e.dept && e.dept !== '-') set.add(e.dept);
    });
    return Array.from(set).sort();
  }, [employeeStats]);

  // Filtered & Sorted Employee Rows for the table
  const filteredEmployees = useMemo(() => {
    let rows = [...employeeStats];

    // Status filter
    if (statusFilter === 'ALL_ISSUES') {
      rows = rows.filter(e => e.totalIssues > 0);
    } else if (statusFilter === 'UNFIT_ONLY') {
      rows = rows.filter(e => e.unfitCount > 0);
    } else if (statusFilter === 'CONDITIONAL_ONLY') {
      rows = rows.filter(e => e.conditionalCount > 0);
    } else if (statusFilter === 'REST_ONLY') {
      rows = rows.filter(e => e.restCount > 0);
    }

    // Risk level filter
    if (riskFilter !== 'ALL') {
      rows = rows.filter(e => e.riskLevel === riskFilter);
    }

    // Department filter
    if (deptFilter !== 'ALL') {
      rows = rows.filter(e => e.dept === deptFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(e => 
        e.nama.toLowerCase().includes(q) ||
        e.nik.toLowerCase().includes(q) ||
        e.jabatan.toLowerCase().includes(q) ||
        e.dept.toLowerCase().includes(q)
      );
    }

    // Sort
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

  // Daily trend aggregation for visualization
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
      .slice(-14); // show last 14 active dates in period
  }, [periodRecords, normalizeDateStr]);

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    // 1. Sheet 1: Rekap Frekuensi Per Karyawan
    const summaryHeaders = [
      'No',
      'NIK',
      'Nama Karyawan',
      'Jabatan',
      'Departemen',
      'Tingkat Risiko',
      'Frekuensi UNFIT',
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
        ? 'TINGGI (KRISIS)' 
        : (e.riskLevel === 'MEDIUM' ? 'SEDANG' : (e.riskLevel === 'LOW' ? 'RINGAN' : 'NORMAL'));
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

    // 2. Sheet 2: Detail Kasus Unfit & Pengawasan Khusus
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
          r.consumesObat ? 'YA' : 'TIDAK',
          r.hasPersonalProblem ? 'YA' : 'TIDAK',
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
    <div className="flex flex-col gap-6 animate-fadeIn text-neutral-800">
      
      {/* 1. Header Banner & Date Range Selection */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-neutral-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 bg-rose-600/30 text-rose-300 rounded-xl border border-rose-500/40">
                <TrendingUp className="w-5 h-5 text-rose-400" />
              </span>
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                {lang === 'ID' ? 'Analisis Trend & Frekuensi Status Karyawan' : 'Fatigue Trend & Frequency Analysis'}
              </h3>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                HSE Monitoring
              </span>
            </div>
            <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
              {lang === 'ID'
                ? 'Pantau frekuensi karyawan yang teridentifikasi UNFIT, butuh istirahat, atau bekerja dalam pengawasan khusus untuk evaluasi kelelahan berkala.'
                : 'Monitor recurring employee fatigue issues including Unfit, Mandatory Rest, and Special Supervision to detect systemic fatigue trends.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black uppercase py-2.5 px-4 rounded-xl cursor-pointer transition shadow-xs flex items-center gap-2"
              title="Unduh data tabel rekapitulasi ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>{lang === 'ID' ? 'Unduh Rekap (Excel)' : 'Export Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Date Range Selection Bar */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
              {lang === 'ID' ? 'Periode Tanggal Evaluasi:' : 'Evaluation Date Range:'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <span className="text-[11px] text-neutral-300 font-bold uppercase tracking-wider">
                {lang === 'ID' ? 'Mulai:' : 'Start:'}
              </span>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/50 border border-white/20 rounded-lg py-1 px-2.5 text-xs font-bold text-white outline-none focus:border-rose-400 transition"
              />
            </div>

            <span className="text-neutral-400 font-bold text-xs">s/d</span>

            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <span className="text-[11px] text-neutral-300 font-bold uppercase tracking-wider">
                {lang === 'ID' ? 'Selesai:' : 'End:'}
              </span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/50 border border-white/20 rounded-lg py-1 px-2.5 text-xs font-bold text-white outline-none focus:border-rose-400 transition"
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] font-bold text-neutral-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg border border-white/15 cursor-pointer transition"
                title={lang === 'ID' ? 'Tampilkan semua tanggal' : 'Show all dates'}
              >
                ✕ {lang === 'ID' ? 'Semua Tanggal' : 'All Dates'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Issues */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">{lang === 'ID' ? 'TOTAL KASUS BERMASALAH' : 'TOTAL ISSUES'}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-neutral-900">{kpis.totalIssues}</span>
            <span className="text-xs font-bold text-neutral-400">Kejadian</span>
          </div>
          <div className="text-[10.5px] text-neutral-500 mt-1">
            <span className="font-bold text-rose-600">{kpis.issueRate}%</span> dari {kpis.totalAssessments} laporan
          </div>
        </div>

        {/* Card 2: UNFIT */}
        <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">🔴 UNFIT BEKERJA</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-900">{kpis.unfitTotal}</span>
            <span className="text-xs font-bold text-rose-600">Kejadian</span>
          </div>
          <div className="text-[10.5px] text-rose-700 font-bold mt-1">
            👤 {kpis.unfitEmployees} Karyawan Terkena
          </div>
        </div>

        {/* Card 3: PENGAWASAN KHUSUS */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">🟡 PENGAWASAN KHUSUS</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-950">{kpis.conditionalTotal}</span>
            <span className="text-xs font-bold text-amber-700">Kejadian</span>
          </div>
          <div className="text-[10.5px] text-amber-800 font-bold mt-1">
            👤 {kpis.conditionalEmployees} Karyawan Terkena
          </div>
        </div>

        {/* Card 4: WAJIB ISTIRAHAT */}
        <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-orange-700 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">🟠 WAJIB ISTIRAHAT</span>
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-orange-950">{kpis.restTotal}</span>
            <span className="text-xs font-bold text-orange-700">Kejadian</span>
          </div>
          <div className="text-[10.5px] text-orange-800 font-bold mt-1">
            👤 {kpis.restEmployees} Karyawan Terkena
          </div>
        </div>

        {/* Card 5: Karyawan Terdampak */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">{lang === 'ID' ? 'KARYAWAN TERDAMPAK' : 'AFFECTED WORKERS'}</span>
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">{kpis.totalEmployeesWithIssues}</span>
            <span className="text-xs font-bold text-slate-500">Orang</span>
          </div>
          <div className="text-[10.5px] text-slate-600 font-semibold mt-1">
            Memerlukan evaluasi/intervensi
          </div>
        </div>
      </div>

      {/* 3. Visual Timeline Trend Mini-Chart */}
      {dailyTrends.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                {lang === 'ID' ? 'Distribusi Kasus Kelelahan Harian (Trend Timeline)' : 'Daily Fatigue Distribution Timeline'}
              </h4>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600"></span> Unfit
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Pengawasan
              </span>
              <span className="flex items-center gap-1 text-orange-700">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span> Wajib Istirahat
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-2">
            {dailyTrends.map(day => {
              const dayIssues = day.unfit + day.conditional + day.rest;
              const dateParts = day.date.split('-');
              const displayDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : day.date;
              return (
                <div key={day.date} className="bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-center flex flex-col justify-between hover:bg-rose-50/40 transition">
                  <span className="text-[10px] font-bold text-neutral-500 font-mono">{displayDate}</span>
                  <div className="my-1.5 flex flex-col items-center gap-0.5 min-h-[36px] justify-end">
                    {day.unfit > 0 && (
                      <span className="bg-rose-600 text-white font-mono font-black text-[9px] px-1 rounded-sm w-full" title={`Unfit: ${day.unfit}`}>
                        {day.unfit}
                      </span>
                    )}
                    {day.conditional > 0 && (
                      <span className="bg-amber-500 text-white font-mono font-black text-[9px] px-1 rounded-sm w-full" title={`Pengawasan Khusus: ${day.conditional}`}>
                        {day.conditional}
                      </span>
                    )}
                    {day.rest > 0 && (
                      <span className="bg-orange-500 text-white font-mono font-black text-[9px] px-1 rounded-sm w-full" title={`Wajib Istirahat: ${day.rest}`}>
                        {day.rest}
                      </span>
                    )}
                    {dayIssues === 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                    )}
                  </div>
                  <span className="text-[9px] font-black text-neutral-700">
                    {dayIssues} isu
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Controls & Filters Toolbar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
              {lang === 'ID' ? 'Filter Kategori Masalah:' : 'Issue Category:'}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-bold text-neutral-900 outline-none cursor-pointer focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL_ISSUES">⚠️ Semua Karyawan Bermasalah</option>
              <option value="UNFIT_ONLY">🔴 Hanya yang Pernah UNFIT</option>
              <option value="CONDITIONAL_ONLY">🟡 Hanya Pengawasan Khusus</option>
              <option value="REST_ONLY">🟠 Hanya Wajib Istirahat</option>
              <option value="ALL_EMPLOYEES">👥 Semua Karyawan (Termasuk Fit)</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
              {lang === 'ID' ? 'Tingkat Kerawanan:' : 'Risk Level:'}
            </label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-bold text-neutral-900 outline-none cursor-pointer focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">Semua Level Risiko</option>
              <option value="HIGH">🔴 Risiko Tinggi (≥2x Unfit / ≥3x Isu)</option>
              <option value="MEDIUM">🟡 Perlu Pengawasan (1x Unfit / 2x Isu)</option>
              <option value="LOW">🟠 Risiko Ringan (1x Isu)</option>
            </select>
          </div>

          {/* Departemen */}
          <div>
            <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
              {lang === 'ID' ? 'Departemen:' : 'Department:'}
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-bold text-neutral-900 outline-none cursor-pointer focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">Semua Departemen</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Urutkan */}
          <div>
            <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
              {lang === 'ID' ? 'Urutkan Berdasarkan:' : 'Sort By:'}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 px-2 text-xs font-bold text-neutral-900 outline-none cursor-pointer focus:ring-1 focus:ring-rose-500 font-extrabold"
            >
              <option value="total_desc">🔥 Kasus Terbanyak (Paling Rentan)</option>
              <option value="unfit_desc">🔴 Paling Sering UNFIT</option>
              <option value="conditional_desc">🟡 Paling Sering Pengawasan Khusus</option>
              <option value="rest_desc">🟠 Paling Sering Wajib Istirahat</option>
              <option value="name_asc">🔤 Nama Karyawan (A - Z)</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[9px] font-black text-neutral-600 uppercase mb-1 tracking-wider">
              {lang === 'ID' ? 'Cari Nama / NIK:' : 'Search Employee:'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={lang === 'ID' ? 'Ketik nama / NIK / jabatan...' : 'Search name, NIK, role...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-250 rounded-lg py-1.5 pl-7 pr-2 text-xs font-bold text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 outline-none focus:ring-1 focus:ring-rose-500"
              />
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Daftar Karyawan & Frekuensi Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span>
              <span>{lang === 'ID' ? 'Daftar Karyawan & Frekuensi Kasus Kelelahan' : 'Employee Fatigue Frequency Table'}</span>
            </h4>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Menampilkan <b>{filteredEmployees.length}</b> karyawan pada periode {startDate || 'Awal'} s/d {endDate || 'Sekarang'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-neutral-500">
              * Klik tombol <b>Rincian</b> untuk melihat seluruh tiket tanggal pengisian.
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100 text-[10px] font-black text-neutral-600 uppercase tracking-wider border-b border-neutral-200">
                <th className="py-2.5 px-3 text-center w-12">No</th>
                <th className="py-2.5 px-3">Identitas Karyawan</th>
                <th className="py-2.5 px-3">Departemen & Jabatan</th>
                <th className="py-2.5 px-3 text-center">Tingkat Risiko</th>
                <th className="py-2.5 px-3 text-center text-rose-700 bg-rose-50/50">🔴 Unfit</th>
                <th className="py-2.5 px-3 text-center text-amber-700 bg-amber-50/50">🟡 Pengawasan</th>
                <th className="py-2.5 px-3 text-center text-orange-700 bg-orange-50/50">🟠 Istirahat</th>
                <th className="py-2.5 px-3 text-center font-black">Total Kasus</th>
                <th className="py-2.5 px-3 text-center">Rata2 Tidur 12j</th>
                <th className="py-2.5 px-3 text-center">Kejadian Terakhir</th>
                <th className="py-2.5 px-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-150">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="w-8 h-8 text-emerald-500" />
                      <span className="font-bold text-neutral-600 text-xs">
                        Tidak ada data karyawan yang cocok dengan kriteria filter pada periode ini.
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        Seluruh karyawan pada periode ini tercatat dalam kondisi FIT atau filter terlalu ketat.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, index) => {
                  return (
                    <tr key={emp.nik} className="hover:bg-neutral-50/80 transition">
                      {/* No */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-neutral-400">
                        {index + 1}
                      </td>

                      {/* Identitas Karyawan */}
                      <td className="py-2.5 px-3">
                        <div className="font-black text-neutral-900 text-xs leading-snug">
                          {emp.nama}
                        </div>
                        <div className="font-mono text-[10.5px] text-neutral-500 font-bold">
                          NIK: {emp.nik}
                        </div>
                      </td>

                      {/* Jabatan & Dept */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-neutral-800 text-[11px]">
                          {emp.jabatan}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-medium">
                          {emp.dept}
                        </div>
                      </td>

                      {/* Level Risiko */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {emp.riskLevel === 'HIGH' && (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200 text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                            TINGGI (KRISIS)
                          </span>
                        )}
                        {emp.riskLevel === 'MEDIUM' && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-200 text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600"></span>
                            WASPADA
                          </span>
                        )}
                        {emp.riskLevel === 'LOW' && (
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-850 border border-orange-200 text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full">
                            RINGAN
                          </span>
                        )}
                        {emp.riskLevel === 'NORMAL' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full">
                            NORMAL (FIT)
                          </span>
                        )}
                      </td>

                      {/* Unfit Count */}
                      <td className="py-2.5 px-3 text-center bg-rose-50/30">
                        {emp.unfitCount > 0 ? (
                          <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-xs">
                            {emp.unfitCount}x
                          </span>
                        ) : (
                          <span className="text-neutral-300 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Conditional Count */}
                      <td className="py-2.5 px-3 text-center bg-amber-50/30">
                        {emp.conditionalCount > 0 ? (
                          <span className="font-mono font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-xs">
                            {emp.conditionalCount}x
                          </span>
                        ) : (
                          <span className="text-neutral-300 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Rest Count */}
                      <td className="py-2.5 px-3 text-center bg-orange-50/30">
                        {emp.restCount > 0 ? (
                          <span className="font-mono font-black text-orange-800 bg-orange-100 px-2 py-0.5 rounded text-xs">
                            {emp.restCount}x
                          </span>
                        ) : (
                          <span className="text-neutral-300 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Total Issues */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                          emp.totalIssues >= 3 
                            ? 'bg-rose-600 text-white font-extrabold' 
                            : (emp.totalIssues >= 1 ? 'bg-neutral-800 text-white' : 'text-neutral-400')
                        }`}>
                          {emp.totalIssues}
                        </span>
                      </td>

                      {/* Rata-rata Tidur 12j */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className={`font-bold ${emp.avgSleep12 < 6 ? 'text-rose-600 font-black' : 'text-neutral-700'}`}>
                          {emp.avgSleep12 > 0 ? `${emp.avgSleep12} Jam` : '-'}
                        </span>
                      </td>

                      {/* Tanggal Terakhir Kejadian */}
                      <td className="py-2.5 px-3 text-center">
                        {emp.lastIssueDate ? (
                          <div>
                            <div className="font-mono text-[10.5px] font-bold text-neutral-800">
                              {emp.lastIssueDate}
                            </div>
                            <div className="text-[9.5px] text-neutral-500 font-medium">
                              pukul {emp.lastIssueTime || '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-300 font-mono">-</span>
                        )}
                      </td>

                      {/* Aksi Button */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(emp)}
                          className="bg-neutral-900 hover:bg-black active:scale-[0.98] text-white text-[10px] font-black uppercase py-1 px-2.5 rounded-lg cursor-pointer transition shadow-2xs flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3 h-3 text-rose-400" />
                          <span>Rincian</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Modal Detail Riwayat Karyawan Terpilih */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-rose-950 text-white flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-rose-600 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                    Profil Rekam Fatigue
                  </span>
                  {selectedEmployee.riskLevel === 'HIGH' && (
                    <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded font-black uppercase">
                      Risiko Tinggi
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black">{selectedEmployee.nama}</h3>
                <p className="text-xs text-neutral-300 font-mono">
                  NIK: {selectedEmployee.nik} • {selectedEmployee.jabatan} • {selectedEmployee.dept}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Summary KPI Strip */}
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                <span className="block text-[9.5px] font-black text-rose-700 uppercase">🔴 UNFIT</span>
                <span className="text-base font-black font-mono text-rose-900">{selectedEmployee.unfitCount}x</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                <span className="block text-[9.5px] font-black text-amber-700 uppercase">🟡 PENGAWASAN</span>
                <span className="text-base font-black font-mono text-amber-900">{selectedEmployee.conditionalCount}x</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                <span className="block text-[9.5px] font-black text-orange-700 uppercase">🟠 ISTIRAHAT</span>
                <span className="text-base font-black font-mono text-orange-900">{selectedEmployee.restCount}x</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                <span className="block text-[9.5px] font-black text-neutral-600 uppercase">RATA2 TIDUR</span>
                <span className="text-base font-black font-mono text-neutral-900">{selectedEmployee.avgSleep12} Jam</span>
              </div>
            </div>

            {/* Modal Body: Ticket Incident List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider mb-2">
                Timeline Kasus Masalah Kelelahan ({selectedEmployee.issueRecords.length} Tiket)
              </h4>

              {selectedEmployee.issueRecords.length === 0 ? (
                <div className="p-6 text-center text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                  Karyawan ini tidak memiliki catatan riwayat kasus Unfit / Pengawasan / Istirahat pada rentang tanggal ini.
                </div>
              ) : (
                selectedEmployee.issueRecords.map((rec: TrendCustomAssessment, idx: number) => {
                  return (
                    <div key={rec.id || idx} className="bg-white rounded-xl border border-neutral-250 p-4 shadow-2xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-150 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-neutral-100 border border-neutral-250 px-2 py-0.5 rounded font-black text-neutral-700">
                            {rec.id}
                          </span>
                          <span className="text-xs font-black text-neutral-900">
                            📅 {rec.tanggalPengisian} pukul {rec.jamPengisian}
                          </span>
                        </div>

                        <div>
                          {rec.finalDecision === 'UNFIT' && (
                            <span className="bg-rose-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                              🔴 UNFIT / DILARANG BEKERJA
                            </span>
                          )}
                          {rec.finalDecision === 'FIT_CONDITIONAL' && (
                            <span className="bg-amber-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                              🟡 PENGAWASAN KHUSUS
                            </span>
                          )}
                          {rec.finalDecision === 'REST_BEFORE_WORK' && (
                            <span className="bg-orange-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                              🟠 WAJIB ISTIRAHAT SEBELUM KERJA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                        <div className="bg-neutral-50 p-2 rounded-lg">
                          <span className="block text-[9.5px] text-neutral-500 font-bold uppercase">Tidur 12 Jam</span>
                          <span className={`font-mono font-black ${Number(rec.totalSleep12 || 0) < 6 ? 'text-rose-600' : 'text-neutral-900'}`}>
                            {rec.totalSleep12 ?? '-'} Jam
                          </span>
                        </div>
                        <div className="bg-neutral-50 p-2 rounded-lg">
                          <span className="block text-[9.5px] text-neutral-500 font-bold uppercase">Tidur 36 Jam</span>
                          <span className="font-mono font-bold text-neutral-800">{rec.totalSleep36 ?? '-'} Jam</span>
                        </div>
                        <div className="bg-neutral-50 p-2 rounded-lg">
                          <span className="block text-[9.5px] text-neutral-500 font-bold uppercase">Minum Obat?</span>
                          <span className={`font-bold ${rec.consumesObat ? 'text-rose-600' : 'text-neutral-700'}`}>
                            {rec.consumesObat ? '⚠️ Ya (Minum Obat)' : 'Tidak'}
                          </span>
                        </div>
                        <div className="bg-neutral-50 p-2 rounded-lg">
                          <span className="block text-[9.5px] text-neutral-500 font-bold uppercase">Masalah Pribadi?</span>
                          <span className={`font-bold ${rec.hasPersonalProblem ? 'text-rose-600' : 'text-neutral-700'}`}>
                            {rec.hasPersonalProblem ? '⚠️ Ada Masalah' : 'Tidak'}
                          </span>
                        </div>
                      </div>

                      {/* Fatigue score & readiness */}
                      <div className="flex items-center justify-between text-[11px] pt-1 text-neutral-600">
                        <span>Skor Kelelahan: <b className="font-mono text-neutral-900">{rec.totalFatigueScore ?? '-'}</b> ({rec.fatigueCategory || 'NORMAL'})</span>
                        <span>Kesiapan Kerja: <b className="font-mono text-emerald-700">{rec.readinessScore ?? '-'}%</b></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-100 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="bg-neutral-900 hover:bg-black font-black text-xs text-white uppercase py-2 px-5 rounded-xl cursor-pointer"
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
