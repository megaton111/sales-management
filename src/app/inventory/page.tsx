'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { keyframes } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import SyncIcon from '@mui/icons-material/Sync';
import { useStore } from '@/contexts/StoreContext';

interface InventoryItem {
  vendorItemId: number;
  productName: string;
  vendorItemName: string;
  stock: number;
  salesLast30: number;
  dailyAvg: number;
  daysLeft: number | null;
}

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;

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
  return Math.trunc(n).toLocaleString('ko-KR');
}

function DaysLeftCell({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) {
    return <Typography sx={{ fontSize: '0.85rem', color: '#adb5bd' }}>-</Typography>;
  }
  const isRisky = daysLeft <= 14;
  return (
    <Box
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.3,
        borderRadius: 1,
        backgroundColor: isRisky ? '#fff5f5' : 'transparent',
        color: isRisky ? '#e03131' : '#1a1a1b',
        fontWeight: isRisky ? 600 : 400,
        fontSize: '0.85rem',
      }}
    >
      {daysLeft}일
    </Box>
  );
}

export default function InventoryPage() {
  const { currentStore } = useStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'stock' | 'daysLeft' | 'salesLast30'>('stock');

  const fetchInventory = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/rg?storeId=${currentStore.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setItems(json.data || []);
      setUpdatedAt(json.updatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

  const handleSync = async () => {
    if (!currentStore) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/rg/sync?storeId=${currentStore.id}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '동기화 실패');
      await fetchInventory();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const riskyCount = items.filter(i => i.daysLeft !== null && i.daysLeft <= 14).length;

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    if (sortKey === 'stock') {
      sorted.sort((a, b) => b.stock - a.stock);
    } else if (sortKey === 'salesLast30') {
      sorted.sort((a, b) => b.salesLast30 - a.salesLast30);
    } else {
      sorted.sort((a, b) => {
        if (a.daysLeft === null && b.daysLeft === null) return 0;
        if (a.daysLeft === null) return 1;
        if (b.daysLeft === null) return -1;
        return a.daysLeft - b.daysLeft;
      });
    }
    return sorted;
  }, [items, sortKey]);

  return (
    <Container maxWidth="lg" sx={{ pt: 3, pb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a1b' }}>
              로켓그로스 재고관리
            </Typography>
            {!loading && items.length > 0 && riskyCount > 0 && (
              <Box sx={{ px: 1.5, py: 0.5, borderRadius: 2, backgroundColor: '#fff5f5', border: '1px solid #ffc9c9' }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#e03131', fontWeight: 600 }}>
                  재고 위험 {riskyCount}건 (14일 이하)
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {updatedAt && !loading && (
              <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd' }}>
                {new Date(updatedAt).toLocaleString('ko-KR')} 기준
              </Typography>
            )}
            <ButtonGroup size="small" sx={{ '& .MuiButton-root': { borderColor: '#dee2e6', color: '#868e96', fontWeight: 500, fontSize: '0.8rem', '&.active': { backgroundColor: '#343a40', borderColor: '#343a40', color: '#fff' }, '&:hover': { backgroundColor: '#f8f9fa' } } }}>
            {([['stock', '재고순'], ['daysLeft', '소진일순'], ['salesLast30', '판매량순']] as const).map(([key, label]) => (
              <Button
                key={key}
                className={sortKey === key ? 'active' : ''}
                onClick={() => setSortKey(key)}
                sx={sortKey === key ? { backgroundColor: '#343a40 !important', borderColor: '#343a40 !important', color: '#fff !important' } : {}}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
            <Tooltip title="쿠팡 API에서 최신 재고 불러오기">
              <Button
                size="small"
                startIcon={<SyncIcon sx={{ fontSize: 15, ...(syncing && { animation: `${spin} 1s linear infinite` }) }} />}
                onClick={handleSync}
                disabled={syncing || loading}
                sx={{ fontSize: '0.8rem', color: '#495057', borderColor: '#dee2e6', border: '1px solid', borderRadius: 2, '&:hover': { backgroundColor: '#f8f9fa' } }}
              >
                {syncing ? '동기화 중...' : '재고 동기화'}
              </Button>
            </Tooltip>
          </Box>
        </Box>

        {error ? (
          <Typography sx={{ color: '#e03131', fontSize: '0.85rem' }}>{error}</Typography>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>상품명</TableCell>
                  <TableCell sx={thSx}>옵션명</TableCell>
                  <TableCell align="right" sx={thSx}>판매가능재고</TableCell>
                  <TableCell align="right" sx={thSx}>최근30일 판매량</TableCell>
                  <TableCell align="right" sx={thSx}>일평균 판매량</TableCell>
                  <TableCell align="right" sx={thSx}>예상 소진일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: '1px solid #f1f3f5', py: 1.2 }}>
                          <Skeleton variant="rounded" height={14} width={j === 0 ? '80%' : '60%'} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#adb5bd', fontSize: '0.85rem', borderBottom: 'none' }}>
                      재고 데이터 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map(item => {
                    const isRisky = item.daysLeft !== null && item.daysLeft <= 14;
                    const optionName = item.vendorItemName?.includes(',')
                      ? item.vendorItemName.split(',').slice(1).join(',').trim()
                      : '';
                    return (
                      <TableRow
                        key={item.vendorItemId}
                        sx={{ backgroundColor: isRisky ? '#fff9f9' : 'transparent' }}
                      >
                        <TableCell sx={tdSx}>{item.productName}</TableCell>
                        <TableCell sx={{ ...tdSx, color: '#495057' }}>{optionName}</TableCell>
                        <TableCell align="right" sx={{ ...tdSx, fontWeight: 600 }}>{formatNumber(item.stock)}</TableCell>
                        <TableCell align="right" sx={tdSx}>{formatNumber(item.salesLast30)}</TableCell>
                        <TableCell align="right" sx={tdSx}>{item.dailyAvg.toFixed(1)}</TableCell>
                        <TableCell align="right" sx={tdSx}>
                          <DaysLeftCell daysLeft={item.daysLeft} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && items.length > 0 && (
          <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd', textAlign: 'right' }}>
            총 {items.length}개 상품
          </Typography>
        )}
      </Box>
    </Container>
  );
}
