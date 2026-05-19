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

export default function DashboardPage() {
  const [year] = useState(new Date().getFullYear());
  const { currentStore } = useStore();
  const { profitMap } = useProductProfits(currentStore?.id ?? null);
  const { loading, totalSales, totalExpenses, totalProfit, salesRanking, currentMonth } = useDashboard(
    currentStore?.id ?? null, year, profitMap
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* 헤더 */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#1a1a1b', letterSpacing: '-0.02em' }}>
            대시보드
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: '#868e96', mt: 0.5 }}>
            {year}년 {currentStore?.name || ''} 운영 현황
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

        {/* 지출 + 순이익 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5, mb: 2.5 }}>
          {/* 지출 */}
          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>지출</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{year}년 총 지출</Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#e03131', letterSpacing: '-0.02em' }}>
                  {loading ? '-' : formatNumber(totalExpenses.yearly)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{currentMonth}월 지출</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: '#e03131', letterSpacing: '-0.02em' }}>
                  {loading ? '-' : formatNumber(totalExpenses.monthly)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* 순이익 */}
          <Paper sx={cardSx}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#868e96', mb: 2 }}>순이익</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{year}년 총 순이익</Typography>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: totalProfit.yearly >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                  {loading ? '-' : formatNumber(totalProfit.yearly)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', mb: 0.5 }}>{currentMonth}월 순이익</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: totalProfit.monthly >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                  {loading ? '-' : formatNumber(totalProfit.monthly)}
                  <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 400, color: '#adb5bd', ml: 0.5 }}>원</Typography>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

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
