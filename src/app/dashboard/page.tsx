'use client';

import { useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { useStore } from '@/contexts/StoreContext';
import useProductProfits from '@/hooks/useProductProfits';
import useDashboard from '@/hooks/useDashboard';

function formatNumber(n: number) {
  return n.toLocaleString('ko-KR');
}

const cardSx = {
  p: 2.5,
  backgroundColor: '#fff',
  borderRadius: 3,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const selectSx = {
  fontWeight: 700,
  fontSize: '1.1rem',
  color: '#1a1a1b',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dee2e6' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#adb5bd' },
  minWidth: 100,
};

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);
  const yearOptions = Array.from({ length: currentYear - 2025 + 1 }, (_, i) => 2025 + i);
  const { currentStore } = useStore();
  const { costMap } = useProductProfits(currentStore?.id ?? null);
  const { loading, totalSales, totalExpenses, totalProfit, chartData, salesRanking } = useDashboard(
    currentStore?.id ?? null, year, costMap, month
  );

  const periodLabel = month ? `${year}년 ${month}월` : `${year}년`;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* 헤더 */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#1a1a1b', letterSpacing: '-0.02em' }}>
              대시보드
            </Typography>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              size="small"
              sx={selectSx}
            >
              {yearOptions.map((y) => (
                <MenuItem key={y} value={y}>{y}년</MenuItem>
              ))}
            </Select>
            <Select
              value={month ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMonth(v === 0 ? null : v);
              }}
              size="small"
              sx={selectSx}
            >
              <MenuItem value={0}>전체</MenuItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <MenuItem key={m} value={m}>{m}월</MenuItem>
              ))}
            </Select>
          </Box>
          <Typography sx={{ fontSize: '0.85rem', color: '#868e96', mt: 0.5 }}>
            {periodLabel} {currentStore?.name || ''} 운영 현황
          </Typography>
        </Box>

        {/* 매출 섹션 */}
        <Paper sx={{ ...cardSx, mb: 2.5 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>매출 현황</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>총 매출</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1b', letterSpacing: '-0.02em' }}>
                {loading ? '-' : formatNumber(totalSales.total)}
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>판매자배송</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1b', letterSpacing: '-0.02em' }}>
                {loading ? '-' : formatNumber(totalSales.marketplace)}
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>로켓그로스</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1b', letterSpacing: '-0.02em' }}>
                {loading ? '-' : formatNumber(totalSales.rocketGrowth)}
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* 지출 + 순이익 + 마진율 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2.5, mb: 2.5 }}>
          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>지출</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{periodLabel} 지출</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#e03131', letterSpacing: '-0.02em' }}>
                {loading ? '-' : formatNumber(totalExpenses)}
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
              </Typography>
            </Box>
          </Paper>

          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>순이익</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{periodLabel} 순이익</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: totalProfit >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                {loading ? '-' : formatNumber(totalProfit)}
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
              </Typography>
            </Box>
          </Paper>

          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>마진율</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{periodLabel} 마진율</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: totalProfit >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                {loading || totalSales.total === 0 ? '-' : (totalProfit / totalSales.total * 100).toFixed(1)}
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>%</Typography>
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* 차트 */}
        {!loading && (
          <Paper sx={{ ...cardSx, mb: 2.5 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>
              {month ? `${month}월 일별 매출 · 지출 · 순이익` : '월별 매출 · 지출 · 순이익'}
            </Typography>
            <Box sx={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: month ? 10 : 12, fill: '#868e96' }}
                    axisLine={{ stroke: '#f1f3f5' }}
                    tickLine={false}
                    interval={month ? 'preserveStartEnd' : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#adb5bd' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => {
                      if (Math.abs(v) >= 10000_0000) return `${(v / 10000_0000).toFixed(1)}억`;
                      if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(0)}만`;
                      return v.toLocaleString();
                    }}
                    width={52}
                  />
                  <Tooltip
                    itemSorter={(item) => (item.dataKey === 'sales' ? 0 : item.dataKey === 'expenses' ? 1 : 2)}
                    formatter={(value, name) => [
                      `${Number(value).toLocaleString('ko-KR')}원`,
                      name === 'sales' ? '매출' : name === 'expenses' ? '지출' : '순이익',
                    ]}
                    labelStyle={{ fontSize: 12, color: '#495057', fontWeight: 600 }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #f1f3f5', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 13 }}
                  />
                  <Legend
                    formatter={(value: string) => (value === 'sales' ? '매출' : value === 'expenses' ? '지출' : '순이익')}
                    wrapperStyle={{ fontSize: 12, color: '#868e96' }}
                  />
                  <ReferenceLine y={0} stroke="#dee2e6" />
                  <Bar dataKey="sales" fill="#a5d8ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#e03131" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="#1864ab" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        )}

        {/* 판매 순위 */}
        <Paper sx={cardSx}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>판매 순위</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#adb5bd', borderBottom: '1px solid #f1f3f5', width: 60, py: 1.2 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#adb5bd', borderBottom: '1px solid #f1f3f5', py: 1.2 }}>제품명</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#adb5bd', borderBottom: '1px solid #f1f3f5', width: 120, py: 1.2 }}>판매건수</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salesRanking.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ textAlign: 'center', py: 5, color: '#adb5bd', borderBottom: 'none' }}>
                      판매 데이터가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  salesRanking.map((item, idx) => (
                    <TableRow key={item.name} sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                      <TableCell sx={{ borderBottom: '1px solid #f1f3f5', py: 1.5 }}>
                        {idx < 3 ? (
                          <Chip
                            label={idx + 1}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              height: 24,
                              minWidth: 24,
                              backgroundColor: idx === 0 ? '#fff9db' : idx === 1 ? '#f1f3f5' : idx === 2 ? '#fff4e6' : 'transparent',
                              color: idx === 0 ? '#e67700' : idx === 1 ? '#868e96' : '#d9480f',
                            }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: '0.85rem', color: '#adb5bd', pl: 0.8 }}>{idx + 1}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', color: '#1a1a1b', fontWeight: idx < 3 ? 600 : 400, borderBottom: '1px solid #f1f3f5', py: 1.5 }}>
                        {item.name}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#495057', borderBottom: '1px solid #f1f3f5', py: 1.5 }}>
                        {formatNumber(item.quantity)}
                        <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>건</Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
  );
}
