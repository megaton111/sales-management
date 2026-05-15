'use client';

import { useState, useEffect } from 'react';
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
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useStore } from '@/contexts/StoreContext';
import useMonthlySales from '@/hooks/useMonthlySales';
import useDailySalesDetail from '@/hooks/useDailySalesDetail';
import useProductProfits from '@/hooks/useProductProfits';
import { Stack } from '@mui/material';

function formatNumber(n: number) {
  return n.toLocaleString('ko-KR');
}

export default function SalesPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const { currentStore } = useStore();

  const { profitMap } = useProductProfits(currentStore?.id ?? null);

  const { dailySalesMap, totalMarketplace, totalRocketGrowth, totalProfit, loading } = useMonthlySales(
    currentStore?.id ?? null, year, month, profitMap
  );

  const { items, loading: detailLoading, selectedDate, selectedChannel, label: detailLabel, fetchDetail, fetchMonthly, clear: clearDetail } = useDailySalesDetail(
    currentStore?.id ?? null
  );

  const [isLocal, setIsLocal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  useEffect(() => {
    setIsLocal(window.location.hostname === 'localhost');
  }, []);

  const lastDate = new Date(year, month, 0).getDate();
  const days = Array.from({ length: lastDate }, (_, i) => i + 1);
  const monthButtons = Array.from({ length: currentMonth }, (_, i) => i + 1);

  const handleChannelClick = (day: number, channel: string) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fetchDetail(dateStr, channel);
  };

  const handleBatchSync = async () => {
    if (!currentStore) return;
    setBatchLoading(true);
    try {
      const lastDay = new Date(year, month, 0).getDate();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const endDate = new Date(year, month - 1, lastDay);
      const actualEnd = endDate < yesterday ? endDate : yesterday;
      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const dateTo = `${actualEnd.getFullYear()}-${String(actualEnd.getMonth() + 1).padStart(2, '0')}-${String(actualEnd.getDate()).padStart(2, '0')}`;

      const res = await fetch('/api/sales/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo, storeId: currentStore.id }),
      });

      const json = await res.json();
      if (res.ok) {
        setSnackbar({ open: true, message: `매출 데이터 동기화 완료`, severity: 'success' });
        window.location.reload();
      } else {
        setSnackbar({ open: true, message: json.error || '동기화 실패', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: '동기화 중 오류 발생', severity: 'error' });
    } finally {
      setBatchLoading(false);
    }
  };

  const selectedDay = selectedDate ? new Date(selectedDate).getDate() : null;
  const channelLabel = selectedChannel === 'marketplace' ? '판매자배송' : selectedChannel === 'rocket_growth' ? '로켓그로스' : '전체';

  return (
    <Container maxWidth="lg">
      <Stack direction="column" spacing={3}>
        {/* 최상단: 연도 + 월 선택 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 3, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {year}년
          </Typography>
          <ButtonGroup size="small">
            {monthButtons.map((m) => (
              <Button
                key={m}
                variant={m === month ? 'contained' : 'outlined'}
                onClick={() => { setMonth(m); clearDetail(); }}
                sx={{ minWidth: 40 }}
              >
                {m}월
              </Button>
            ))}
          </ButtonGroup>
          {isLocal && (
            <Button
              variant="text"
              size="small"
              onClick={handleBatchSync}
              disabled={batchLoading || !currentStore}
              sx={{ ml: 'auto', color: 'text.secondary' }}
            >
              {batchLoading ? <CircularProgress size={16} /> : '동기화'}
            </Button>
          )}
        </Box>

        {/* 월 매출 총합 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
          <Paper
            variant="outlined"
            onClick={() => fetchMonthly(year, month, 'all', `${month}월 전체`)}
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1, borderColor: '#e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', '&:hover': { borderColor: '#bdbdbd' } }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {month}월 매출총합
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#212121' }}>
              {loading ? '-' : formatNumber(totalMarketplace + totalRocketGrowth)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
          <Paper
            variant="outlined"
            onClick={() => fetchMonthly(year, month, 'marketplace', `${month}월 판매자배송`)}
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#fafafa', borderRadius: 1, borderColor: '#e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', '&:hover': { borderColor: '#bdbdbd' } }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              판매자배송
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#1565c0' }}>
              {loading ? '-' : formatNumber(totalMarketplace)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
          <Paper
            variant="outlined"
            onClick={() => fetchMonthly(year, month, 'rocket_growth', `${month}월 로켓그로스`)}
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#fafafa', borderRadius: 1, borderColor: '#e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', '&:hover': { borderColor: '#bdbdbd' } }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              로켓그로스
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#e65100' }}>
              {loading ? '-' : formatNumber(totalRocketGrowth)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#e8f5e9', borderRadius: 1, borderColor: '#c8e6c9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {month}월 순이익
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#2e7d32' }}>
              {loading ? '-' : formatNumber(totalProfit)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
        </Box>

        {/* 일별 리스트 + 상세 */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* 좌측: 일별 매출 리스트 */}
          <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, flexShrink: 0, maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100', width: 80 }}>일자</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', backgroundColor: 'grey.100' }}>매출</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {days.map((day) => {
                  const daySales = dailySalesMap.get(day);
                  const mpAmount = daySales?.marketplace ?? 0;
                  const rgAmount = daySales?.rocketGrowth ?? 0;
                  const mpProfit = daySales?.marketplaceProfit ?? 0;
                  const rgProfit = daySales?.rocketGrowthProfit ?? 0;
                  const isSelectedDay = day === selectedDay;

                  return (
                    <TableRow key={day} selected={isSelectedDay}>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600, verticalAlign: 'top', py: 1.2 }}>
                        {day}일
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          <Box
                            onClick={() => handleChannelClick(day, 'marketplace')}
                            sx={{ display: 'flex', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                          >
                            <Typography sx={{ fontSize: '0.75rem', width: 70, flexShrink: 0, color: isSelectedDay && selectedChannel === 'marketplace' ? '#0d47a1' : '#1565c0', fontWeight: isSelectedDay && selectedChannel === 'marketplace' ? 700 : 400 }}>
                              판매자매출
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', flex: 1, color: isSelectedDay && selectedChannel === 'marketplace' ? '#0d47a1' : '#1565c0', fontWeight: isSelectedDay && selectedChannel === 'marketplace' ? 700 : 400 }}>
                              {formatNumber(mpAmount)}원
                              {mpProfit !== 0 && <Typography component="span" sx={{ fontSize: '0.7rem', color: '#2e7d32', ml: 0.5 }}>({formatNumber(mpProfit)}원)</Typography>}
                            </Typography>
                          </Box>
                          <Box
                            onClick={() => handleChannelClick(day, 'rocket_growth')}
                            sx={{ display: 'flex', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                          >
                            <Typography sx={{ fontSize: '0.75rem', width: 70, flexShrink: 0, color: isSelectedDay && selectedChannel === 'rocket_growth' ? '#bf360c' : '#e65100', fontWeight: isSelectedDay && selectedChannel === 'rocket_growth' ? 700 : 400 }}>
                              로켓매출
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', flex: 1, color: isSelectedDay && selectedChannel === 'rocket_growth' ? '#bf360c' : '#e65100', fontWeight: isSelectedDay && selectedChannel === 'rocket_growth' ? 700 : 400 }}>
                              {formatNumber(rgAmount)}원
                              {rgProfit !== 0 && <Typography component="span" sx={{ fontSize: '0.7rem', color: '#2e7d32', ml: 0.5 }}>({formatNumber(rgProfit)}원)</Typography>}
                            </Typography>
                          </Box>
                          <Box
                            onClick={() => handleChannelClick(day, 'all')}
                            sx={{ display: 'flex', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                          >
                            <Typography sx={{ fontSize: '0.75rem', width: 70, flexShrink: 0, color: isSelectedDay && selectedChannel === 'all' ? '#212121' : '#616161', fontWeight: isSelectedDay && selectedChannel === 'all' ? 700 : 600 }}>
                              매출총합
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', flex: 1, color: isSelectedDay && selectedChannel === 'all' ? '#212121' : '#616161', fontWeight: isSelectedDay && selectedChannel === 'all' ? 700 : 600 }}>
                              {formatNumber(mpAmount + rgAmount)}원
                              {(mpProfit + rgProfit) !== 0 && <Typography component="span" sx={{ fontSize: '0.7rem', color: '#2e7d32', ml: 0.5 }}>({formatNumber(mpProfit + rgProfit)}원)</Typography>}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 우측: 주문 상품 상세 리스트 */}
          <Box sx={{ flex: 2, minWidth: 0 }}>
            {(selectedDate || detailLabel) && selectedChannel ? (
              <>
                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
                  {detailLabel ?? `${month}월 ${selectedDay}일 ${channelLabel}`}
                </Typography>
                {detailLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : items.length === 0 ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    매출 데이터 없음
                  </Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', backgroundColor: 'grey.100' }}>상품명</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', backgroundColor: 'grey.100' }}>옵션명</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', backgroundColor: 'grey.100' }}>판매건수</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', backgroundColor: '#e3f2fd' }}>매출금액</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', backgroundColor: '#e8f5e9' }}>순이익</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item) => {
                          const unitProfit = profitMap.get(item.product_name) ?? 0;
                          const itemProfit = unitProfit * item.quantity;
                          return (
                          <TableRow key={item.vendor_item_id} hover>
                            <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.product_name}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.vendor_item_name?.includes(',') ? item.vendor_item_name.split(',').slice(1).join(',').trim() : ''}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatNumber(item.quantity)}건</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 700, backgroundColor: '#e3f2fd' }}>{formatNumber(item.sale_amount)}원</TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 700, backgroundColor: '#e8f5e9', color: itemProfit > 0 ? '#2e7d32' : 'text.secondary' }}>{itemProfit !== 0 ? `${formatNumber(itemProfit)}원` : '-'}</TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  일자별 매출을 클릭하면 상세 내역이 표시됩니다
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
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
