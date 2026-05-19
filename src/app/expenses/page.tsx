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
import Stack from '@mui/material/Stack';
import { useStore } from '@/contexts/StoreContext';
import useExpenses, { EXPENSE_TYPES } from '@/hooks/useExpenses';

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
    <Container maxWidth="md">
      <Stack direction="column" spacing={3}>
        {/* 월 선택 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 3, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {year}년
          </Typography>
          <ButtonGroup size="small">
            {monthButtons.map((m) => (
              <Button
                key={m}
                variant={m === month ? 'contained' : 'outlined'}
                onClick={() => setMonth(m)}
                sx={{ minWidth: 40 }}
              >
                {m}월
              </Button>
            ))}
          </ButtonGroup>
        </Box>

        {/* 총 지출 */}
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#fff3e0', borderColor: '#ffe0b2' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', mb: 0.5 }}>
            {month}월 총 지출
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#e65100', mb: 1.5 }}>
            {loading ? '-' : formatNumber(totalAmount)}
            <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 500, ml: 0.3 }}>원</Typography>
          </Typography>
          {totalAmount > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {EXPENSE_TYPES.map((type) => {
                const amount = totalByType.get(type) || 0;
                if (amount === 0) return null;
                return (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{type}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatNumber(amount)}원</Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>

        {/* 지출 입력 */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              type="date"
              size="small"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              inputProps={{ min: dateMin, max: dateMax }}
              sx={{ width: 170 }}
            />
            <Select
              size="small"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              sx={{ width: 170, fontSize: '0.85rem' }}
            >
              {EXPENSE_TYPES.map((type) => (
                <MenuItem key={type} value={type} sx={{ fontSize: '0.85rem' }}>{type}</MenuItem>
              ))}
            </Select>
            <TextField
              type="number"
              size="small"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="금액 입력"
              sx={{ width: 150 }}
            />
            <TextField
              size="small"
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              placeholder="메모 (선택)"
              sx={{ flex: 1, minWidth: 120 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleAdd}
              disabled={saving}
              startIcon={<AddIcon />}
            >
              등록
            </Button>
          </Box>
        </Paper>

        {/* 지출 테이블 */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100', width: 120 }}>날짜</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100', width: 130 }}>지출타입</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100', width: 150 }}>금액</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100' }}>메모</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100', width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                editId === row.id ? (
                  <TableRow key={row.id} sx={{ backgroundColor: '#fffde7' }}>
                    <TableCell sx={{ py: 1 }}>
                      <TextField
                        type="date"
                        size="small"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        inputProps={{ min: dateMin, max: dateMax }}
                        sx={{ width: '100%' }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Select
                        size="small"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        sx={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        {EXPENSE_TYPES.map((type) => (
                          <MenuItem key={type} value={type} sx={{ fontSize: '0.85rem' }}>{type}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <TextField
                        type="number"
                        size="small"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        sx={{ width: '100%' }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <TextField
                        size="small"
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        sx={{ width: '100%' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1, whiteSpace: 'nowrap' }}>
                      <IconButton size="small" color="primary" onClick={handleUpdate} disabled={saving}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={cancelEdit}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontSize: '0.85rem' }}>
                      {new Date(row.expense_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{row.expense_type}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {formatNumber(row.amount)}원
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      {row.memo}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" onClick={() => startEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              ))}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    등록된 지출이 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
