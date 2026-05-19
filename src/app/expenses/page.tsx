'use client';

import { useState } from 'react';
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

export default function ExpensesPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const { currentStore } = useStore();

  const { rows, loading, totalAmount, totalByType, addExpense, updateExpense, deleteExpense } = useExpenses(
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
        </Box>

        {/* 총 지출 */}
        <Paper sx={cardSx}>
          <Typography sx={{ color: '#adb5bd', fontSize: '0.75rem', mb: 0.5 }}>{month}월 총 지출</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#e03131', letterSpacing: '-0.02em', mb: 1.5 }}>
            {loading ? '-' : formatNumber(totalAmount)}
            <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
          </Typography>
          {totalAmount > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {EXPENSE_TYPES.map((type) => {
                const amount = totalByType.get(type) || 0;
                if (amount === 0) return null;
                return (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#868e96' }}>{type}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057' }}>{formatNumber(amount)}원</Typography>
                  </Box>
                );
              })}
            </Box>
          )}
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
                {rows.map((row) => (
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

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}
