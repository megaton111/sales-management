'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ButtonGroup from '@mui/material/ButtonGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Backdrop from '@mui/material/Backdrop';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import SyncIcon from '@mui/icons-material/Sync';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useStore } from '@/contexts/StoreContext';
import useMonthlySales from '@/hooks/useMonthlySales';
import useDailySalesDetail from '@/hooks/useDailySalesDetail';
import useProductProfits from '@/hooks/useProductProfits';

const cardSx = {
  p: 2,
  backgroundColor: '#fff',
  borderRadius: 3,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  border: '1px solid rgba(0,0,0,0.04)',
  cursor: 'pointer',
  '&:hover': { boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
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

export default function SalesPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const yearOptions = Array.from({ length: currentYear - 2025 + 1 }, (_, i) => 2025 + i);
  const { currentStore } = useStore();

  const { costMap } = useProductProfits(currentStore?.id ?? null);

  const { dailySalesMap, totalMarketplace, totalRocketGrowth, totalProfit, loading } = useMonthlySales(
    currentStore?.id ?? null, year, month, costMap
  );

  const { items, loading: detailLoading, selectedDate, selectedChannel, label: detailLabel, fetchDetail, fetchMonthly, clear: clearDetail } = useDailySalesDetail(
    currentStore?.id ?? null
  );

  useEffect(() => {
    if (!loading && currentStore) {
      fetchMonthly(year, month, 'all', `${month}월 전체`);
    }
  }, [loading, currentStore, year, month, fetchMonthly]);

  const [isLocal, setIsLocal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  useEffect(() => {
    setIsLocal(window.location.hostname === 'localhost');
  }, []);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDay = yesterday.getMonth() + 1 === month && yesterday.getFullYear() === year ? yesterday.getDate() : null;
  const yesterdaySales = yesterdayDay ? dailySalesMap.get(yesterdayDay) : null;
  const ydMp = yesterdaySales?.marketplace ?? 0;
  const ydRg = yesterdaySales?.rocketGrowth ?? 0;
  const ydProfit = (yesterdaySales?.marketplaceProfit ?? 0) + (yesterdaySales?.rocketGrowthProfit ?? 0);

  const lastDate = new Date(year, month, 0).getDate();
  const days = Array.from({ length: lastDate }, (_, i) => i + 1);
  const monthButtons = Array.from({ length: year === currentYear ? currentMonth : 12 }, (_, i) => i + 1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const CARD_WIDTH = 168; // 160 minWidth + 8 gap

  const scrollByCard = useCallback((direction: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction * CARD_WIDTH, behavior: 'smooth' });
  }, []);

  // 이번 달: 오늘 날짜를 중앙에, 과거 달: 1일부터
  useEffect(() => {
    if (!scrollRef.current || loading) return;
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    if (!isCurrentMonth) {
      scrollRef.current.scrollLeft = 0;
      return;
    }
    const containerWidth = scrollRef.current.clientWidth;
    const scrollTarget = (today.getDate() - 1) * CARD_WIDTH - containerWidth / 2 + CARD_WIDTH / 2;
    scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
  }, [loading, month, year]);

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
  const isMonthly = !!detailLabel;

  const mergeByVendorItem = (list: typeof items) => {
    const merged = new Map<number, typeof items[0]>();
    for (const item of list) {
      const existing = merged.get(item.vendor_item_id);
      if (existing) {
        existing.quantity += item.quantity;
        existing.sale_amount += item.sale_amount;
      } else {
        merged.set(item.vendor_item_id, { ...item });
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.sale_amount - a.sale_amount);
  };

  const mpItems = isMonthly
    ? mergeByVendorItem(items.filter(i => i.channel === 'marketplace'))
    : items.filter(i => i.channel === 'marketplace');
  const rgItems = isMonthly
    ? mergeByVendorItem(items.filter(i => i.channel === 'rocket_growth'))
    : items.filter(i => i.channel === 'rocket_growth');

  const renderItemTable = (tableItems: typeof items) => (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={thSx}>상품명</TableCell>
            <TableCell sx={thSx}>옵션명</TableCell>
            <TableCell align="right" sx={thSx}>판매건수</TableCell>
            <TableCell align="right" sx={thSx}>매출금액</TableCell>
            <TableCell align="right" sx={thSx}>순이익</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableItems.map((item) => {
            const cost = costMap.get(item.product_name);
            const itemProfit = cost
              ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
              : item.unit_profit * item.quantity;
            return (
              <TableRow key={`${item.channel}_${item.vendor_item_id}`} sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                <TableCell sx={tdSx}>{item.product_name}</TableCell>
                <TableCell sx={tdSx}>{item.vendor_item_name?.includes(',') ? item.vendor_item_name.split(',').slice(1).join(',').trim() : ''}</TableCell>
                <TableCell align="right" sx={tdSx}>{formatNumber(item.quantity)}건</TableCell>
                <TableCell align="right" sx={{ ...tdSx, fontWeight: 600 }}>{formatNumber(item.sale_amount)}원</TableCell>
                <TableCell align="right" sx={{ ...tdSx, fontWeight: 600, color: itemProfit > 0 ? '#2b8a3e' : '#adb5bd' }}>{itemProfit !== 0 ? `${formatNumber(itemProfit)}원` : '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <>
    <Container maxWidth="lg" sx={{ pt: 3, pb: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 헤더 + 월 선택 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setMonth(1); clearDetail(); }}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: '#1a1a1b',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dee2e6' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#adb5bd' },
              minWidth: 100,
            }}
          >
            {yearOptions.map((y) => (
              <MenuItem key={y} value={y}>{y}년</MenuItem>
            ))}
          </Select>
          <ButtonGroup size="small" sx={{ '& .MuiButton-root': { borderColor: '#dee2e6', color: '#868e96', fontWeight: 500, '&.MuiButton-contained': { backgroundColor: '#343a40', borderColor: '#343a40', color: '#fff' } } }}>
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
              variant="outlined"
              size="small"
              onClick={handleBatchSync}
              disabled={batchLoading || !currentStore}
              startIcon={
                <SyncIcon
                  sx={{
                    fontSize: '1rem !important',
                    ...(batchLoading && {
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                    }),
                  }}
                />
              }
              sx={{
                ml: 'auto',
                borderColor: '#dee2e6',
                color: '#495057',
                fontSize: '0.8rem',
                fontWeight: 500,
                borderRadius: 2,
                px: 1.5,
                '&:hover': { borderColor: '#adb5bd', backgroundColor: '#f8f9fa' },
                '&.Mui-disabled': { borderColor: '#f1f3f5', color: '#adb5bd' },
              }}
            >
              {batchLoading ? '동기화 중...' : '매출 동기화'}
            </Button>
          )}
        </Box>

        {/* 월 매출 총합 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          <Paper elevation={0} onClick={() => fetchMonthly(year, month, 'all', `${month}월 전체`)} sx={cardSx}>
            <Typography sx={{ color: '#adb5bd', fontSize: '0.75rem', mb: 0.5 }}>{month}월 매출총합</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#1a1a1b', letterSpacing: '-0.02em' }}>
              {loading ? '-' : formatNumber(totalMarketplace + totalRocketGrowth)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
          <Paper elevation={0} onClick={() => fetchMonthly(year, month, 'marketplace', `${month}월 판매자배송`)} sx={cardSx}>
            <Typography sx={{ color: '#adb5bd', fontSize: '0.75rem', mb: 0.5 }}>판매자배송</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#1a1a1b', letterSpacing: '-0.02em' }}>
              {loading ? '-' : formatNumber(totalMarketplace)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
          <Paper elevation={0} onClick={() => fetchMonthly(year, month, 'rocket_growth', `${month}월 로켓그로스`)} sx={cardSx}>
            <Typography sx={{ color: '#adb5bd', fontSize: '0.75rem', mb: 0.5 }}>로켓그로스</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#1a1a1b', letterSpacing: '-0.02em' }}>
              {loading ? '-' : formatNumber(totalRocketGrowth)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ ...cardSx, cursor: 'default', '&:hover': {} }}>
            <Typography sx={{ color: '#adb5bd', fontSize: '0.75rem', mb: 0.5 }}>{month}월 순이익(지출비용제외)</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: totalProfit >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
              {loading ? '-' : formatNumber(totalProfit)}
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
            </Typography>
          </Paper>
        </Box>

        {/* 전날 매출 */}
        {yesterdayDay && !loading && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
            {[
              { label: '어제 매출', value: ydMp + ydRg, color: '#1a1a1b' },
              { label: '어제 판매자배송', value: ydMp, color: '#1a1a1b' },
              { label: '어제 로켓그로스', value: ydRg, color: '#1a1a1b' },
              { label: '어제 순이익', value: ydProfit, color: ydProfit >= 0 ? '#2b8a3e' : '#e03131' },
            ].map((item) => (
              <Paper key={item.label} elevation={0} sx={{ ...cardSx, cursor: 'default', '&:hover': {}, py: 1.5 }}>
                <Typography sx={{ color: '#adb5bd', fontSize: '0.7rem', mb: 0.3 }}>{item.label}</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: item.color, letterSpacing: '-0.02em' }}>
                  {item.value !== 0 ? formatNumber(item.value) : '-'}
                  {item.value !== 0 && <Typography component="span" sx={{ fontSize: '0.7rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}

      </Box>
    </Container>

    {/* 일별 매출 가로 스크롤 — 버튼은 카드 영역 바로 옆 */}
    <Container maxWidth="lg" sx={{ position: 'relative', my: 2 }}>
      <IconButton onClick={() => scrollByCard(-1)} size="small" sx={{ position: 'absolute', left: -36, top: '50%', transform: 'translateY(-50%)', zIndex: 2, border: '1px solid #dee2e6', borderRadius: 1.5, p: 0.5, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', '&:hover': { backgroundColor: '#f8f9fa' } }}>
        <ChevronLeftIcon sx={{ fontSize: 18, color: '#495057' }} />
      </IconButton>
      <Box ref={scrollRef} sx={{ overflowX: 'auto', pb: 1, scrollbarWidth: 'thin', '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#dee2e6', borderRadius: 3 } }}>
        <Box sx={{ display: 'flex', gap: 1, minWidth: 'max-content' }}>
            {days.map((day) => {
              const daySales = dailySalesMap.get(day);
              const mpAmount = daySales?.marketplace ?? 0;
              const rgAmount = daySales?.rocketGrowth ?? 0;
              const mpProfit = daySales?.marketplaceProfit ?? 0;
              const rgProfit = daySales?.rocketGrowthProfit ?? 0;
              const totalAmount = mpAmount + rgAmount;
              const totalDayProfit = mpProfit + rgProfit;
              const isSelectedDay = day === selectedDay;
              const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;

              return (
                <Paper
                  key={day}
                  elevation={0}
                  onClick={() => handleChannelClick(day, 'all')}
                  sx={{
                    p: 2,
                    minWidth: 160,
                    cursor: 'pointer',
                    borderRadius: 2,
                    border: isSelectedDay ? '1.5px solid #343a40' : isToday ? '1px solid #228be6' : '1px solid rgba(0,0,0,0.04)',
                    backgroundColor: isSelectedDay ? '#f8f9fa' : isToday ? '#e7f5ff' : '#fff',
                    '&:hover': { boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#495057', mb: 1 }}>{day}일</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#868e96' }}>판매자</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#495057' }}>{formatNumber(mpAmount)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#868e96' }}>로켓</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#495057' }}>{formatNumber(rgAmount)}</Typography>
                    </Box>
                    <Box sx={{ borderTop: '1px solid #f1f3f5', mt: 0.3, pt: 0.5, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a1a1b' }}>합계</Typography>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a1a1b' }}>{formatNumber(totalAmount)}</Typography>
                    </Box>
                    {totalDayProfit !== 0 && (() => {
                      const prevSales = dailySalesMap.get(day - 1);
                      const prevProfit = prevSales ? (prevSales.marketplaceProfit ?? 0) + (prevSales.rocketGrowthProfit ?? 0) : 0;
                      const pctChange = prevProfit !== 0 ? ((totalDayProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;
                      const arrow = pctChange > 0 ? '▲' : pctChange < 0 ? '▼' : '';
                      const changeColor = pctChange > 0 ? '#e03131' : pctChange < 0 ? '#1971c2' : '#868e96';
                      return (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#2b8a3e' }}>이익</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            {arrow && (
                              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: changeColor }}>
                                {arrow}{Math.abs(Math.round(pctChange))}%
                              </Typography>
                            )}
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#2b8a3e' }}>{formatNumber(totalDayProfit)}</Typography>
                          </Box>
                        </Box>
                      );
                    })()}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      <IconButton onClick={() => scrollByCard(1)} size="small" sx={{ position: 'absolute', right: -36, top: '50%', transform: 'translateY(-50%)', zIndex: 2, border: '1px solid #dee2e6', borderRadius: 1.5, p: 0.5, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', '&:hover': { backgroundColor: '#f8f9fa' } }}>
        <ChevronRightIcon sx={{ fontSize: 18, color: '#495057' }} />
      </IconButton>
    </Container>

    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* 상품 상세 리스트 */}
        <Box>
            {(selectedDate || detailLabel) && selectedChannel ? (
              <>
                {detailLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={20} sx={{ color: '#868e96' }} />
                  </Box>
                ) : items.length === 0 ? (
                  <Typography sx={{ color: '#adb5bd', fontSize: '0.85rem' }}>매출 데이터 없음</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {mpItems.length > 0 && (
                      <Box>
                        <Typography sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.85rem', color: '#495057' }}>
                          {detailLabel ? `${detailLabel} 판매자배송` : `${month}월 ${selectedDay}일 판매자배송`}
                        </Typography>
                        {renderItemTable(mpItems)}
                      </Box>
                    )}
                    {rgItems.length > 0 && (
                      <Box>
                        <Typography sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.85rem', color: '#495057' }}>
                          {detailLabel ? `${detailLabel} 로켓그로스` : `${month}월 ${selectedDay}일 로켓그로스`}
                        </Typography>
                        {renderItemTable(rgItems)}
                      </Box>
                    )}
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                <Typography sx={{ color: '#adb5bd', fontSize: '0.85rem' }}>
                  일자별 매출을 클릭하면 상세 내역이 표시됩니다
                </Typography>
              </Box>
            )}
          </Box>
      </Box>

      <Backdrop open={batchLoading} sx={{ zIndex: (theme) => theme.zIndex.modal + 1, flexDirection: 'column', gap: 2, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <Box sx={{ width: 320, textAlign: 'center' }}>
          <Typography sx={{ color: '#fff', mb: 2, fontWeight: 500 }}>매출을 불러오는 중입니다.</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 3, fontSize: '0.85rem' }}>잠시만 기다려주세요</Typography>
          <LinearProgress sx={{ borderRadius: 1, height: 6 }} />
        </Box>
      </Backdrop>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
    </>
  );
}
