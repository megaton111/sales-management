'use client';

import { useState, useEffect, useRef } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '@/contexts/StoreContext';
import useExpenses, { EXPENSE_TYPES } from '@/hooks/useExpenses';

const cardSx = {
  p: 2.5,
  backgroundColor: '#fff',
  borderRadius: 3,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const thSx = {
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#adb5bd',
  borderBottom: '1px solid #f1f3f5',
  py: 1.2,
};

const tdSx = {
  fontSize: '0.85rem',
  color: '#1a1a1b',
  borderBottom: '1px solid #f1f3f5',
};

function formatNumber(n: number) {
  return n.toLocaleString('ko-KR');
}

interface ParsedEntry {
  date: string;
  amount: number;
}

function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s.replace(/\./g, '-');
}

function parseAdRows(rows: string[][]): ParsedEntry[] | null {
  if (rows.length < 2) return null;

  const header = rows[0].map(h => String(h ?? '').trim());

  // 날짜 컬럼: 헤더에서 '날짜'/'일자' 찾거나, YYYYMMDD 값이 있는 첫 번째 컬럼으로 fallback
  let dateIdx = header.findIndex(h => h === '날짜' || h === '일자');
  if (dateIdx === -1) {
    dateIdx = rows[1]?.findIndex(v => /^\d{8}$/.test(String(v ?? '').trim())) ?? -1;
  }

  // 광고비 컬럼: 총비용(VAT포함) 우선, 없으면 광고비
  const normalHeader = header.map(h => h.replace(/\s/g, ''));
  let costIdx = normalHeader.findIndex(h => h.includes('총비용(VAT포함)'));
  if (costIdx === -1) costIdx = header.findIndex(h => h.trim() === '광고비');
  // 헤더에서도 못 찾으면 날짜로부터 11번째 컬럼 (쿠팡 광고보고서 기본 구조)
  if (costIdx === -1 && dateIdx !== -1) costIdx = dateIdx + 11;

  if (dateIdx === -1 || costIdx === -1) return null;

  const dailyMap = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = String(row[dateIdx] ?? '').trim();
    if (!rawDate) continue;

    const dateStr = normalizeDate(rawDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const cost = Number(String(row[costIdx] ?? '').replace(/,/g, '')) || 0;
    if (cost <= 0) continue;

    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + cost);
  }

  if (dailyMap.size === 0) return null;

  return Array.from(dailyMap.entries())
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function ExpensesPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const { currentStore } = useStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = Number(params.get('month'));
    if (m >= 1 && m <= 12) setMonth(m);
  }, []);

  const { rows, loading, totalAmount, totalByType, addExpense, updateExpense, deleteExpense, refetch } = useExpenses(
    currentStore?.id ?? null, year, month
  );

  const monthButtons = Array.from({ length: currentMonth }, (_, i) => i + 1);

  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState(EXPENSE_TYPES[0]);
  const [newAmount, setNewAmount] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  // 광고비 가져오기 다이얼로그
  const [adDialog, setAdDialog] = useState(false);
  const [adTab, setAdTab] = useState(0);
  const [pasteText, setPasteText] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [adImporting, setAdImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAdDialog = () => {
    setAdDialog(true);
    setAdTab(0);
    setPasteText('');
    setParsedEntries(null);
    setParseError('');
  };

  const closeAdDialog = () => {
    setAdDialog(false);
    setParsedEntries(null);
    setParseError('');
    setPasteText('');
  };

  const handleParsePaste = () => {
    setParseError('');
    const rows = pasteText.trim().split('\n').map(l => l.split('\t').map(c => c.trim()));
    const result = parseAdRows(rows);
    if (!result) {
      setParseError('날짜/광고비 컬럼을 찾을 수 없습니다. 쿠팡 광고센터 → 보고서 → 집계단위 "일별"로 다운받은 파일을 붙여넣어 주세요.');
      setParsedEntries(null);
    } else {
      setParsedEntries(result);
    }
  };

  const handleFileUpload = async (file: File) => {
    setParseError('');
    setParsedEntries(null);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false }) as string[][];
      const result = parseAdRows(rawRows);
      if (!result) {
        setParseError('날짜/광고비 컬럼을 찾을 수 없습니다. 쿠팡 광고센터 → 보고서 → 집계단위 "일별"로 다운받은 파일을 업로드해 주세요.');
      } else {
        setParsedEntries(result);
      }
    } catch {
      setParseError('파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const handleAdImport = async () => {
    if (!currentStore || !parsedEntries?.length) return;
    setAdImporting(true);
    try {
      const res = await fetch('/api/expenses/ad-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: currentStore.id, entries: parsedEntries }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await refetch();
      closeAdDialog();
      setSnackbar({ open: true, message: `${parsedEntries.length}일치 광고비 등록 완료`, severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : '등록 실패', severity: 'error' });
    } finally {
      setAdImporting(false);
    }
  };

  const handleAdd = async () => {
    if (!newDate || !newType || !newAmount) {
      setSnackbar({ open: true, message: '모든 항목을 입력해주세요', severity: 'error' });
      return;
    }
    setSaving(true);
    const ok = await addExpense(newDate, newType, Number(newAmount), newMemo);
    setSaving(false);
    if (ok) {
      setNewDate('');
      setNewAmount('');
      setNewMemo('');
      setSnackbar({ open: true, message: '지출이 추가되었습니다', severity: 'success' });
    } else {
      setSnackbar({ open: true, message: '저장 중 오류가 발생했습니다', severity: 'error' });
    }
  };

  const startEdit = (row: typeof rows[0]) => {
    setEditId(row.id);
    setEditDate(row.expense_date);
    setEditType(row.expense_type);
    setEditAmount(String(row.amount));
    setEditMemo(row.memo || '');
  };

  const cancelEdit = () => setEditId(null);

  const handleUpdate = async () => {
    if (!editId || !editDate || !editType || !editAmount) return;
    setSaving(true);
    const ok = await updateExpense(editId, editDate, editType, Number(editAmount), editMemo);
    setSaving(false);
    if (ok) {
      setEditId(null);
      setSnackbar({ open: true, message: '수정되었습니다', severity: 'success' });
    } else {
      setSnackbar({ open: true, message: '수정 중 오류가 발생했습니다', severity: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await deleteExpense(id);
    if (ok) {
      setSnackbar({ open: true, message: '삭제되었습니다', severity: 'success' });
    }
  };

  const lastDay = new Date(year, month, 0).getDate();
  const dateMin = `${year}-${String(month).padStart(2, '0')}-01`;
  const dateMax = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* 월 선택 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#1a1a1b' }}>
            {year}년
          </Typography>
          <ButtonGroup size="small" sx={{ '& .MuiButton-root': { borderColor: '#dee2e6', color: '#868e96', fontWeight: 500, '&.MuiButton-contained': { backgroundColor: '#343a40', borderColor: '#343a40', color: '#fff' } } }}>
            {monthButtons.map((m) => (
              <Button key={m} variant={m === month ? 'contained' : 'outlined'} onClick={() => setMonth(m)} sx={{ minWidth: 40 }}>
                {m}월
              </Button>
            ))}
          </ButtonGroup>
          <Box sx={{ ml: 'auto' }}>
            <Button variant="outlined" size="small" onClick={openAdDialog}
              sx={{ borderColor: '#dee2e6', color: '#495057', fontSize: '0.8rem', fontWeight: 500 }}>
              광고비 가져오기
            </Button>
          </Box>
        </Box>

        {/* 총 지출 — 파이차트 + 리스트 */}
        <Paper sx={cardSx}>
          <Typography sx={{ color: '#adb5bd', fontSize: '0.75rem', mb: 0.5 }}>{month}월 총 지출</Typography>
          {loading ? (
            <Skeleton variant="rounded" width={160} height={28} sx={{ borderRadius: 1, mb: 2 }} />
          ) : (
            <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#e03131', letterSpacing: '-0.02em', mb: 2 }}>
              {formatNumber(totalAmount)}
              <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
            </Typography>
          )}
          {totalAmount > 0 && (() => {
            const PIE_COLORS = ['#343a40', '#495057', '#868e96', '#adb5bd', '#ced4da', '#6c757d', '#212529', '#74c0fc', '#94d82d'];
            const chartData = EXPENSE_TYPES
              .map((type, i) => ({ name: type, value: totalByType.get(type) || 0, color: PIE_COLORS[i % PIE_COLORS.length] }))
              .filter(d => d.value > 0)
              .sort((a, b) => b.value - a.value);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const renderLabel = ({ cx, cy, midAngle, outerRadius, name }: any) => {
              const RADIAN = Math.PI / 180;
              const r = outerRadius + 18;
              const x = cx + r * Math.cos(-midAngle * RADIAN);
              const y = cy + r * Math.sin(-midAngle * RADIAN);
              return (
                <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
                  style={{ fontSize: '0.7rem', fill: '#495057', fontWeight: 500 }}>
                  {name}
                </text>
              );
            };

            return (
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 파이차트 */}
                <Box sx={{ width: '50%', minWidth: 220, height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                        dataKey="value" paddingAngle={2} label={renderLabel} labelLine={{ stroke: '#dee2e6', strokeWidth: 1 }}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${formatNumber(Number(value))}원`, '']}
                        contentStyle={{ fontSize: '0.78rem', borderRadius: 8, border: '1px solid #f1f3f5' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                {/* 리스트 */}
                <Box sx={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {chartData.map((d) => (
                    <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: d.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.8rem', color: '#868e96', flex: 1 }}>{d.name}</Typography>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057' }}>
                        {formatNumber(d.value)}원
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', minWidth: 36, textAlign: 'right' }}>
                        {Math.round(d.value / totalAmount * 100)}%
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Paper>

        {/* 지출 입력 */}
        <Paper sx={cardSx}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField type="date" size="small" value={newDate} onChange={(e) => setNewDate(e.target.value)} inputProps={{ min: dateMin, max: dateMax }} sx={{ width: 170 }} />
            <Select size="small" value={newType} onChange={(e) => setNewType(e.target.value)} sx={{ width: 170, fontSize: '0.85rem' }}>
              {EXPENSE_TYPES.map((type) => (
                <MenuItem key={type} value={type} sx={{ fontSize: '0.85rem' }}>{type}</MenuItem>
              ))}
            </Select>
            <TextField type="number" size="small" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="금액 입력" sx={{ width: 150 }} />
            <TextField size="small" value={newMemo} onChange={(e) => setNewMemo(e.target.value)} placeholder="메모 (선택)" sx={{ flex: 1, minWidth: 120 }} onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} />
            <Button variant="contained" size="small" onClick={handleAdd} disabled={saving} startIcon={<AddIcon />}>등록</Button>
          </Box>
        </Paper>

        {/* 지출 테이블 */}
        <Paper elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...thSx, width: 120 }}>날짜</TableCell>
                  <TableCell sx={{ ...thSx, width: 130 }}>지출타입</TableCell>
                  <TableCell align="right" sx={{ ...thSx, width: 150 }}>금액</TableCell>
                  <TableCell sx={thSx}>메모</TableCell>
                  <TableCell sx={{ ...thSx, width: 80 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ py: 1.2, borderBottom: '1px solid #f1f3f5' }}><Skeleton variant="rounded" width={90} height={18} sx={{ borderRadius: 1 }} /></TableCell>
                      <TableCell sx={{ py: 1.2, borderBottom: '1px solid #f1f3f5' }}><Skeleton variant="rounded" width={100} height={18} sx={{ borderRadius: 1 }} /></TableCell>
                      <TableCell align="right" sx={{ py: 1.2, borderBottom: '1px solid #f1f3f5' }}><Skeleton variant="rounded" width={80} height={18} sx={{ borderRadius: 1, ml: 'auto' }} /></TableCell>
                      <TableCell sx={{ py: 1.2, borderBottom: '1px solid #f1f3f5' }}><Skeleton variant="rounded" width="60%" height={18} sx={{ borderRadius: 1 }} /></TableCell>
                      <TableCell sx={{ py: 1.2, borderBottom: '1px solid #f1f3f5' }} />
                    </TableRow>
                  ))
                ) : null}
                {!loading && rows.map((row) => (
                  editId === row.id ? (
                    <TableRow key={row.id} sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell sx={{ py: 1, borderBottom: '1px solid #f1f3f5' }}>
                        <TextField type="date" size="small" value={editDate} onChange={(e) => setEditDate(e.target.value)} inputProps={{ min: dateMin, max: dateMax }} sx={{ width: '100%' }} />
                      </TableCell>
                      <TableCell sx={{ py: 1, borderBottom: '1px solid #f1f3f5' }}>
                        <Select size="small" value={editType} onChange={(e) => setEditType(e.target.value)} sx={{ width: '100%', fontSize: '0.85rem' }}>
                          {EXPENSE_TYPES.map((type) => (<MenuItem key={type} value={type} sx={{ fontSize: '0.85rem' }}>{type}</MenuItem>))}
                        </Select>
                      </TableCell>
                      <TableCell sx={{ py: 1, borderBottom: '1px solid #f1f3f5' }}>
                        <TextField type="number" size="small" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} sx={{ width: '100%' }} />
                      </TableCell>
                      <TableCell sx={{ py: 1, borderBottom: '1px solid #f1f3f5' }}>
                        <TextField size="small" value={editMemo} onChange={(e) => setEditMemo(e.target.value)} sx={{ width: '100%' }} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') cancelEdit(); }} />
                      </TableCell>
                      <TableCell sx={{ py: 1, whiteSpace: 'nowrap', borderBottom: '1px solid #f1f3f5' }}>
                        <IconButton size="small" onClick={handleUpdate} disabled={saving} sx={{ color: '#2b8a3e' }}><CheckIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={cancelEdit} sx={{ color: '#868e96' }}><CloseIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={row.id} sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                      <TableCell sx={tdSx}>
                        {new Date(row.expense_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                      </TableCell>
                      <TableCell sx={tdSx}>{row.expense_type}</TableCell>
                      <TableCell align="right" sx={{ ...tdSx, fontWeight: 600 }}>{formatNumber(row.amount)}원</TableCell>
                      <TableCell sx={{ ...tdSx, color: '#868e96' }}>{row.memo}</TableCell>
                      <TableCell sx={{ ...tdSx, whiteSpace: 'nowrap' }}>
                        <IconButton size="small" onClick={() => startEdit(row)} sx={{ color: '#adb5bd' }}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => handleDelete(row.id)} sx={{ color: '#adb5bd', '&:hover': { color: '#e03131' } }}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  )
                ))}

                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#adb5bd', borderBottom: 'none' }}>등록된 지출이 없습니다</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* 광고비 가져오기 다이얼로그 */}
      <Dialog open={adDialog} onClose={closeAdDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>쿠팡 광고비 가져오기</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: '0.78rem', color: '#868e96', mb: 2 }}>
            쿠팡 광고센터(ads.coupang.com) → 보고서 → 집계단위 <strong>일별</strong> 선택 후 다운로드
          </Typography>

          <Tabs value={adTab} onChange={(_, v) => { setAdTab(v); setParsedEntries(null); setParseError(''); setPasteText(''); }}
            sx={{ mb: 2, borderBottom: '1px solid #f1f3f5', minHeight: 36,
              '& .MuiTab-root': { fontSize: '0.8rem', minHeight: 36, fontWeight: 500 } }}>
            <Tab label="파일 업로드" />
            <Tab label="텍스트 붙여넣기" />
          </Tabs>

          {adTab === 0 && (
            <Box>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
              <Box onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f); }}
                sx={{ border: '1.5px dashed #dee2e6', borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
                  backgroundColor: '#fafafa', '&:hover': { borderColor: '#adb5bd', backgroundColor: '#f8f9fa' } }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#868e96' }}>
                  클릭하거나 파일을 여기에 드래그하세요
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mt: 0.5 }}>
                  .xlsx, .xls 파일 지원
                </Typography>
              </Box>
            </Box>
          )}

          {adTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#868e96' }}>
                엑셀 파일을 열고 전체 내용을 복사(Ctrl+A → Ctrl+C) 후 붙여넣기하세요
              </Typography>
              <TextField multiline rows={6} fullWidth size="small"
                placeholder="여기에 붙여넣기 (Ctrl+V)"
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setParsedEntries(null); setParseError(''); }}
                sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
              <Button size="small" variant="outlined" onClick={handleParsePaste} disabled={!pasteText.trim()}
                sx={{ alignSelf: 'flex-start', borderColor: '#dee2e6', color: '#495057', fontSize: '0.8rem' }}>
                분석하기
              </Button>
            </Box>
          )}

          {parseError && (
            <Alert severity="error" sx={{ mt: 2, fontSize: '0.78rem' }}>{parseError}</Alert>
          )}

          {parsedEntries && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#495057', fontWeight: 600, mb: 1 }}>
                파싱 결과 — {parsedEntries.length}일 / 총 {formatNumber(parsedEntries.reduce((s, e) => s + e.amount, 0))}원
              </Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f1f3f5', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...thSx, py: 0.8 }}>날짜</TableCell>
                      <TableCell align="right" sx={{ ...thSx, py: 0.8 }}>광고비(VAT포함)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedEntries.map((e) => (
                      <TableRow key={e.date}>
                        <TableCell sx={{ ...tdSx, py: 0.6, fontSize: '0.78rem' }}>{e.date}</TableCell>
                        <TableCell align="right" sx={{ ...tdSx, py: 0.6, fontSize: '0.78rem', fontWeight: 600 }}>{formatNumber(e.amount)}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAdDialog} sx={{ color: '#868e96', fontSize: '0.85rem' }}>취소</Button>
          <Button variant="contained" onClick={handleAdImport}
            disabled={!parsedEntries?.length || adImporting}
            sx={{ fontSize: '0.85rem', backgroundColor: '#343a40', '&:hover': { backgroundColor: '#212529' } }}>
            {adImporting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : `${parsedEntries?.length ?? 0}일치 등록`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}
