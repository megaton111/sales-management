'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';

type Row = {
  id: number;
  sellingPrice: number | '';
  chinaPrice: number | '';
  grossCost: number | '';
};

const emptyRow = (id: number, grossCost: number = 2365): Row => ({ id, sellingPrice: '', chinaPrice: '', grossCost });

const COMMISSION_COUPANG = 0.1155;
const COMMISSION_NAVER = 0.096;

function calc(row: Row, commission: number) {
  const selling = Number(row.sellingPrice) || 0;
  const china = Number(row.chinaPrice) || 0;
  const gross = Number(row.grossCost) || 0;

  const purchasePrice = Math.round(china * 300);
  const vat = Math.round(selling / 11);
  const fee = Math.round(selling * commission);
  const netProfit = selling - purchasePrice - gross - fee - vat;
  const profitRate = purchasePrice > 0 ? Math.round((netProfit / purchasePrice) * 1000) / 10 : 0;

  return { purchasePrice, vat, fee, netProfit, profitRate };
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

const thSx = {
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#adb5bd',
  borderBottom: '1px solid #f1f3f5',
  whiteSpace: 'nowrap' as const,
  py: 1.2,
};

const tdSx = {
  fontSize: '0.85rem',
  borderBottom: '1px solid #f1f3f5',
  py: 1,
};

const inputSx = {
  width: '100%',
  '& .MuiInputBase-root': { backgroundColor: '#eff6ff', borderRadius: 0 },
  '& .MuiInputBase-input': {
    fontSize: '0.85rem', py: 0.9, px: 1.5, textAlign: 'right' as const,
  },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
};

type FocusedCell = { rowId: number; field: keyof Row } | null;

function PriceInput({
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
  placeholder,
  unit = '₩',
}: {
  value: number | '';
  onChange: (val: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
  unit?: string;
}) {
  const displayValue = focused
    ? (value === '' ? '' : String(value))
    : (value === '' ? '' : `${unit}${fmt(Number(value))}`);

  return (
    <TextField
      size="small"
      value={displayValue}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        onChange(raw);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder ?? '0원'}
      sx={inputSx}
      inputProps={{ inputMode: 'numeric' }}
    />
  );
}

function CalcTable({
  title,
  rows,
  setRows,
  commission,
  grossLabel,
  commissionLabel,
}: {
  title: string;
  rows: Row[];
  setRows: (rows: Row[]) => void;
  commission: number;
  grossLabel: string;
  commissionLabel: string;
}) {
  const [focusedCell, setFocusedCell] = useState<FocusedCell>(null);

  const handleChange = (id: number, field: keyof Row, raw: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: raw === '' ? '' : Number(raw) } : r));
  };

  const isFocused = (id: number, field: keyof Row) =>
    focusedCell?.rowId === id && focusedCell?.field === field;

  const profitColor = (n: number) => n >= 0 ? '#2b8a3e' : '#e03131';

  return (
    <Paper elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3, overflow: 'hidden', mb: 4 }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1b' }}>{title}</Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx} align="right">판매가</TableCell>
              <TableCell sx={thSx} align="right">수익률</TableCell>
              <TableCell sx={thSx} align="right">순수익</TableCell>
              <TableCell sx={thSx} align="right">중국원가</TableCell>
              <TableCell sx={thSx} align="right">매입가</TableCell>
              <TableCell sx={thSx} align="right">{grossLabel}</TableCell>
              <TableCell sx={thSx} align="right">{commissionLabel}</TableCell>
              <TableCell sx={thSx} align="right">부가세</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => {
              const { purchasePrice, vat, fee, netProfit, profitRate } = calc(row, commission);
              const hasData = Number(row.sellingPrice) > 0;
              return (
                <TableRow key={row.id} sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                  {/* 판매가 */}
                  <TableCell sx={{ ...tdSx, width: 130, p: 0 }} align="right">
                    <PriceInput
                      value={row.sellingPrice}
                      onChange={v => handleChange(row.id, 'sellingPrice', v)}
                      focused={isFocused(row.id, 'sellingPrice')}
                      onFocus={() => setFocusedCell({ rowId: row.id, field: 'sellingPrice' })}
                      onBlur={() => setFocusedCell(null)}
                    />
                  </TableCell>
                  {/* 수익률 */}
                  <TableCell sx={{ ...tdSx, fontWeight: 700, color: hasData ? profitColor(profitRate) : '#adb5bd', backgroundColor: '#fff' }} align="right">
                    {hasData ? `${profitRate}%` : '-'}
                  </TableCell>
                  {/* 순수익 */}
                  <TableCell sx={{ ...tdSx, fontWeight: 700, color: hasData ? profitColor(netProfit) : '#adb5bd', backgroundColor: '#fff' }} align="right">
                    {hasData ? `₩${fmt(netProfit)}` : '-'}
                  </TableCell>
                  {/* 중국원가 */}
                  <TableCell sx={{ ...tdSx, width: 110, p: 0 }} align="right">
                    <PriceInput
                      value={row.chinaPrice}
                      onChange={v => handleChange(row.id, 'chinaPrice', v)}
                      focused={isFocused(row.id, 'chinaPrice')}
                      onFocus={() => setFocusedCell({ rowId: row.id, field: 'chinaPrice' })}
                      onBlur={() => setFocusedCell(null)}
                      unit="¥"
                    />
                  </TableCell>
                  {/* 매입가 */}
                  <TableCell sx={{ ...tdSx, color: '#495057', backgroundColor: '#fff' }} align="right">
                    {Number(row.chinaPrice) > 0 ? `₩${fmt(purchasePrice)}` : '-'}
                  </TableCell>
                  {/* 그로스/택배 */}
                  <TableCell sx={{ ...tdSx, width: 110, p: 0 }} align="right">
                    <PriceInput
                      value={row.grossCost}
                      onChange={v => handleChange(row.id, 'grossCost', v)}
                      focused={isFocused(row.id, 'grossCost')}
                      onFocus={() => setFocusedCell({ rowId: row.id, field: 'grossCost' })}
                      onBlur={() => setFocusedCell(null)}
                    />
                  </TableCell>
                  {/* 수수료 */}
                  <TableCell sx={{ ...tdSx, color: '#495057', backgroundColor: '#fff' }} align="right">
                    {hasData ? `₩${fmt(fee)}` : '-'}
                  </TableCell>
                  {/* 부가세 */}
                  <TableCell sx={{ ...tdSx, color: '#495057', backgroundColor: '#fff' }} align="right">
                    {hasData ? `₩${fmt(vat)}` : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

    </Paper>
  );
}

export default function MarginPage() {
  const [coupangRows, setCoupangRows] = useState<Row[]>([emptyRow(1), emptyRow(2)]);
  const [naverRows, setNaverRows] = useState<Row[]>([emptyRow(1, 3200), emptyRow(2, 3200)]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#1a1a1b', letterSpacing: '-0.02em', mb: 3 }}>
        마진계산기
      </Typography>

      <CalcTable
        title="쿠팡 마진계산기"
        rows={coupangRows}
        setRows={setCoupangRows}
        commission={COMMISSION_COUPANG}
        grossLabel="그로스비용"
        commissionLabel="수수료 (11.55%)"
      />

      <CalcTable
        title="스마트스토어 마진계산기"
        rows={naverRows}
        setRows={setNaverRows}
        commission={COMMISSION_NAVER}
        grossLabel="택배물류비"
        commissionLabel="수수료 (9.6%)"
      />
    </Container>
  );
}
