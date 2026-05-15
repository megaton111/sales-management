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
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useStore } from '@/contexts/StoreContext';
import useMonthlySales from '@/hooks/useMonthlySales';
import useDailySalesDetail from '@/hooks/useDailySalesDetail';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatNumber(n: number) {
  return n.toLocaleString('ko-KR');
}

function getCalendarWeeks(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);

  for (let d = 1; d <= lastDate; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export default function SalesPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const { currentStore } = useStore();

  const { dailySalesMap, totalMarketplace, totalRocketGrowth, loading } = useMonthlySales(
    currentStore?.id ?? null, year, month
  );

  const { items, loading: detailLoading, selectedDate, selectedChannel, fetchDetail, clear: clearDetail } = useDailySalesDetail(
    currentStore?.id ?? null
  );

  const [batchLoading, setBatchLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  const weeks = getCalendarWeeks(year, month);
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
  const channelLabel = selectedChannel === 'marketplace' ? '판매자배송' : '로켓그로스';

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 1.5 }}>
        {/* 최상단: 연도 + 월 선택 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
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
          {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1 }}>
          <Paper
            variant="outlined"
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1, borderColor: '#e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
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
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#fafafa', borderRadius: 1, borderColor: '#e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
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
            sx={{ p: 1, textAlign: 'center', backgroundColor: '#fafafa', borderRadius: 1, borderColor: '#e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              로켓그로스
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#e65100' }}>
              {loading ? '-' : formatNumber(totalRocketGrowth)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
        </Box>

        {/* 달력 */}
        <Box sx={{ mb: 1 }}>
          {/* 요일 헤더 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {WEEKDAYS.map((day, i) => (
              <Box
                key={day}
                sx={{
                  textAlign: 'center',
                  py: 0.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'grey.100',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    fontSize: 11,
                    color: i === 0 ? '#d32f2f' : i === 6 ? '#1565c0' : 'text.secondary',
                  }}
                >
                  {day}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* 날짜 그리드 */}
          {weeks.map((week, wi) => (
            <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((day, di) => {
                const daySales = day !== null ? dailySalesMap.get(day) : null;
                const mpAmount = daySales?.marketplace ?? 0;
                const rgAmount = daySales?.rocketGrowth ?? 0;
                const hasSale = daySales && (mpAmount > 0 || rgAmount > 0);
                const isSelectedDay = day === selectedDay;
                const dayOfWeek = di;

                return (
                  <Box
                    key={di}
                    sx={{
                      py: 0.5,
                      px: 0.5,
                      minHeight: 64,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {day !== null && (
                      <>
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: isSelectedDay ? 700 : 400,
                            color: dayOfWeek === 0 ? '#d32f2f' : dayOfWeek === 6 ? '#1565c0' : 'text.secondary',
                            mb: 0.3,
                          }}
                        >
                          {day}
                        </Typography>
                        {hasSale && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                            {mpAmount > 0 && (
                              <Typography
                                onClick={() => handleChannelClick(day, 'marketplace')}
                                sx={{
                                  fontSize: 10,
                                  color: isSelectedDay && selectedChannel === 'marketplace' ? '#0d47a1' : '#1565c0',
                                  fontWeight: isSelectedDay && selectedChannel === 'marketplace' ? 700 : 400,
                                  cursor: 'pointer',
                                  '&:hover': { color: '#1565c0' },
                                }}
                              >
                                판매자 {formatNumber(mpAmount)}
                              </Typography>
                            )}
                            {rgAmount > 0 && (
                              <Typography
                                onClick={() => handleChannelClick(day, 'rocket_growth')}
                                sx={{
                                  fontSize: 10,
                                  color: isSelectedDay && selectedChannel === 'rocket_growth' ? '#bf360c' : '#e65100',
                                  fontWeight: isSelectedDay && selectedChannel === 'rocket_growth' ? 700 : 400,
                                  cursor: 'pointer',
                                  '&:hover': { color: '#e65100' },
                                }}
                              >
                                로켓 {formatNumber(rgAmount)}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>

        {/* 하단: 선택한 날짜/채널의 상세 매출 */}
        {selectedDate && selectedChannel && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {month}월 {selectedDay}일 {channelLabel}
            </Typography>

            {detailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.vendor_item_id} hover>
                        <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.product_name}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.vendor_item_name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatNumber(item.quantity)}건</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 700, backgroundColor: '#e3f2fd' }}>{formatNumber(item.sale_amount)}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Box>

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
