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
import Skeleton from '@mui/material/Skeleton';
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
  const { loading, totalSales, totalExpenses, totalProfit, chartData, salesRanking, expenseByType } = useDashboard(
    currentStore?.id ?? null, year, costMap, month
  );

  const periodLabel = month ? `${year}년 ${month}월` : `${year}년`;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* 헤더 */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        <Paper sx={{ ...cardSx, mb: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>매출 현황</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
            {[
              { label: '총 매출', value: totalSales.total },
              { label: '쿠팡(판매자배송)', value: totalSales.marketplace },
              { label: '쿠팡(로켓)', value: totalSales.rocketGrowth },
              { label: '스마트스토어', value: totalSales.smartstore },
            ].map(({ label, value }) => (
              <Box key={label}>
                <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{label}</Typography>
                {loading ? (
                  <Skeleton variant="rounded" width={120} height={28} sx={{ borderRadius: 1, mt: 0.5 }} />
                ) : (
                  <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1b', letterSpacing: '-0.02em' }}>
                    {formatNumber(value)}
                    <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>

        {/* 지출 + 순이익 + 마진율 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1 }}>
          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>지출</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{periodLabel} 지출</Typography>
              {loading ? (
                <Skeleton variant="rounded" width={140} height={28} sx={{ borderRadius: 1, mt: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#e03131', letterSpacing: '-0.02em' }}>
                  {formatNumber(totalExpenses)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>순이익</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{periodLabel} 순이익</Typography>
              {loading ? (
                <Skeleton variant="rounded" width={140} height={28} sx={{ borderRadius: 1, mt: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: totalProfit >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                  {formatNumber(totalProfit)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>마진율</Typography>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{periodLabel} 마진율</Typography>
              {loading ? (
                <Skeleton variant="rounded" width={100} height={28} sx={{ borderRadius: 1, mt: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: totalProfit >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                  {totalSales.total === 0 ? '-' : (totalProfit / totalSales.total * 100).toFixed(1)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>%</Typography>
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>

        {/* 차트 */}
        <Paper sx={{ ...cardSx, mb: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>
            {month ? `${month}월 일별 매출 · 지출 · 순이익` : '월별 매출 · 지출 · 순이익'}
          </Typography>
          {loading ? (
            <Skeleton variant="rounded" width="100%" height={320} sx={{ borderRadius: 2 }} />
          ) : (
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
          )}
        </Paper>

        {/* 지출 통계 */}
        <Paper sx={{ ...cardSx, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96' }}>지출 통계</Typography>
            {!loading && expenseByType.length > 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd' }}>
                {year}년 연간 합계 {expenseByType.reduce((s, e) => s + e.amount, 0).toLocaleString('ko-KR')}원
              </Typography>
            )}
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Skeleton variant="rounded" width={90} height={14} sx={{ borderRadius: 1, flexShrink: 0 }} />
                  <Skeleton variant="rounded" sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                  <Skeleton variant="rounded" width={80} height={14} sx={{ borderRadius: 1, flexShrink: 0 }} />
                </Box>
              ))}
            </Box>
          ) : expenseByType.length === 0 ? (
            <Typography sx={{ fontSize: '0.85rem', color: '#adb5bd', textAlign: 'center', py: 3 }}>
              지출 데이터 없음
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              {expenseByType.map((item) => (
                <Box key={item.type} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ width: 110, fontSize: '0.8rem', color: '#495057', flexShrink: 0 }}>
                    {item.type}
                  </Typography>
                  <Box sx={{ flex: 1, height: 8, backgroundColor: '#f1f3f5', borderRadius: 4, overflow: 'hidden' }}>
                    <Box sx={{ width: `${item.ratio * 100}%`, height: '100%', backgroundColor: '#74c0fc', borderRadius: 4 }} />
                  </Box>
                  <Typography sx={{ width: 110, textAlign: 'right', fontSize: '0.8rem', color: '#1a1a1b', fontWeight: 600, flexShrink: 0 }}>
                    {item.amount.toLocaleString('ko-KR')}원
                  </Typography>
                  <Typography sx={{ width: 38, textAlign: 'right', fontSize: '0.75rem', color: '#adb5bd', flexShrink: 0 }}>
                    {(item.ratio * 100).toFixed(1)}%
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

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
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f3f5' }}>
                        <Skeleton variant="rounded" width={24} height={24} sx={{ borderRadius: 1 }} />
                      </TableCell>
                      <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f3f5' }}>
                        <Skeleton variant="rounded" width="70%" height={16} sx={{ borderRadius: 1 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px solid #f1f3f5' }}>
                        <Skeleton variant="rounded" width={60} height={16} sx={{ borderRadius: 1, ml: 'auto' }} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : salesRanking.length === 0 ? (
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
