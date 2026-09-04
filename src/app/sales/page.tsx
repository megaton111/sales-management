'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useStore } from '@/contexts/StoreContext';
import { createClient } from '@/lib/supabase-browser';
import useMonthlySales from '@/hooks/useMonthlySales';
import useDailySalesDetail from '@/hooks/useDailySalesDetail';
import useProductProfits from '@/hooks/useProductProfits';
import useExpenses from '@/hooks/useExpenses';

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
  return Math.trunc(n).toLocaleString('ko-KR');
}

function getOptionPart(vendorItemName: string | undefined, productName: string): string {
  if (!vendorItemName || vendorItemName === productName) return '';
  if (vendorItemName.startsWith(productName + ' ')) return vendorItemName.slice(productName.length + 1);
  if (vendorItemName.includes(',')) return vendorItemName.split(',').slice(1).join(',').trim();
  return vendorItemName;
}

export default function SalesPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const yearOptions = Array.from({ length: currentYear - 2025 + 1 }, (_, i) => 2025 + i);
  const { currentStore } = useStore();
  const router = useRouter();

  const { costMap } = useProductProfits(currentStore?.id ?? null);
  const { totalAmount: totalExpenses } = useExpenses(currentStore?.id ?? null, year, month);

  const { dailySalesMap, totalMarketplace, totalRocketGrowth, totalSmartstore, totalProfit, totalMarketplaceProfit, totalRocketGrowthProfit, totalSmartstoreProfit, totalRefundCount, totalOrderCount, loading, refetch } = useMonthlySales(
    currentStore?.id ?? null, year, month, costMap
  );

  const netProfit = totalProfit - totalExpenses;

  const { items, loading: detailLoading, selectedDate, selectedChannel, label: detailLabel, fetchDetail, fetchMonthly, clear: clearDetail } = useDailySalesDetail(
    currentStore?.id ?? null
  );

  useEffect(() => {
    if (!loading && currentStore) {
      fetchMonthly(year, month, 'all', `${month}월 전체`);
    }
  }, [loading, currentStore, year, month, fetchMonthly]);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  const [importDialog, setImportDialog] = useState(false);
  const [importChannel, setImportChannel] = useState<'marketplace' | 'rocket_growth'>('marketplace');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const parseCoupangReport = (text: string, channel: 'marketplace' | 'rocket_growth') => {
    const parseNum = (s: string) => Number((s ?? '').replace(/,/g, '').trim()) || 0;
    const allLines = text.trim().split('\n').map(line => line.split('\t'));

    // 포맷 자동 감지: 헤더 행에 '발생일(결제완료일)' 포함 → 판매수수료 리포트, 아니면 판매자배송 리포트
    const headerLine = allLines.find(cols => cols.some(c => c.trim().length > 0)) ?? [];
    const isFeeReport = headerLine.some(c => c.includes('발생일(결제완료일)') || c.trim() === '거래유형');

    const rows = isFeeReport
      ? allLines.filter(cols => cols.length > 27 && cols[6]?.trim() === '주문 정산')
      : allLines.filter(cols => {
          const taxType = cols[1]?.trim();
          const optionId = cols[4]?.trim();
          const cancelDate = cols[22]?.trim();
          return taxType && optionId && parseNum(optionId) > 0 && !cancelDate;
        });

    const dailyMap = new Map<string, { total_sale_amount: number; order_count: number }>();
    const itemMap = new Map<string, { sale_date: string; vendor_item_id: number; product_name: string; vendor_item_name: string; quantity: number; sale_amount: number; unit_profit: number }>();
    const orderRows: { order_id: string; sale_date: string; vendor_item_id: number; paid_at: string; quantity: number; unit_price: number; sale_amount: number }[] = [];

    for (const cols of rows) {
      let sale_date: string, order_id: string, vendor_item_id: number, product_name: string, vendor_item_name: string;
      let unit_price: number, quantity: number, sale_amount: number, unit_profit: number;

      if (isFeeReport) {
        sale_date = cols[3]?.trim();
        order_id = cols[5]?.trim();
        vendor_item_id = parseNum(cols[11]);
        product_name = cols[13]?.trim();
        vendor_item_name = cols[14]?.trim();
        unit_price = parseNum(cols[15]);
        quantity = parseNum(cols[16]);
        sale_amount = parseNum(cols[19]);
        const settlement = parseNum(cols[23]);
        const commission = parseNum(cols[26]);
        const commission_vat = parseNum(cols[27]);
        unit_profit = quantity > 0 ? Math.round((settlement - commission - commission_vat) / quantity) : 0;
      } else {
        sale_date = cols[19]?.trim();
        order_id = cols[0]?.trim();
        vendor_item_id = parseNum(cols[4]);
        product_name = cols[3]?.trim();
        vendor_item_name = cols[5]?.trim();
        unit_price = parseNum(cols[6]);
        quantity = parseNum(cols[7]);
        sale_amount = parseNum(cols[9]) - parseNum(cols[10]);
        const settlement = parseNum(cols[17]);
        unit_profit = quantity > 0 ? Math.round(settlement / quantity) : 0;
      }

      if (!sale_date || !vendor_item_id) continue;

      const daily = dailyMap.get(sale_date) ?? { total_sale_amount: 0, order_count: 0 };
      daily.total_sale_amount += sale_amount;
      daily.order_count += 1;
      dailyMap.set(sale_date, daily);

      const itemKey = `${sale_date}_${vendor_item_id}`;
      const existing = itemMap.get(itemKey);
      if (existing) {
        existing.quantity += quantity;
        existing.sale_amount += sale_amount;
      } else {
        itemMap.set(itemKey, { sale_date, vendor_item_id, product_name, vendor_item_name, quantity, sale_amount, unit_profit });
      }

      const paid_at = channel === 'rocket_growth'
        ? String(new Date(sale_date + 'T00:00:00+09:00').getTime())
        : sale_date + 'T00:00:00';
      orderRows.push({ order_id, sale_date, vendor_item_id, paid_at, quantity, unit_price, sale_amount });
    }
    return { dailyMap, items: Array.from(itemMap.values()), orderRows };
  };

  const handleImport = async () => {
    if (!currentStore || !importText.trim()) return;
    setImporting(true);
    try {
      const { dailyMap, items, orderRows } = parseCoupangReport(importText, importChannel);
      if (items.length === 0) {
        setSnackbar({ open: true, message: '가져올 데이터가 없습니다. 붙여넣기 내용을 확인해주세요.', severity: 'error' });
        return;
      }
      const supabase = createClient();
      const storeId = currentStore.id;
      const channel = importChannel;
      const dates = Array.from(dailyMap.keys());

      // 기존 주문번호 조회 → 신규 주문만 필터
      const { data: existingOrderData } = await supabase
        .from('daily_order_details')
        .select('order_id')
        .eq('store_id', storeId)
        .eq('channel', channel)
        .in('sale_date', dates);
      const existingOrderIds = new Set((existingOrderData || []).map(o => String(o.order_id)));
      const newOrderRows = orderRows.filter(o => !existingOrderIds.has(o.order_id));
      const newOrderDates = new Set(newOrderRows.map(o => o.sale_date));

      // 신규 주문이 있는 날짜만 daily_sales_items 재집계
      if (newOrderDates.size > 0) {
        // 기존 order_details 로드 → 신규 주문과 합산
        const { data: existingOrders } = await supabase
          .from('daily_order_details')
          .select('sale_date, vendor_item_id, quantity, sale_amount, unit_price')
          .eq('store_id', storeId)
          .eq('channel', channel)
          .in('sale_date', Array.from(newOrderDates));

        const mergedItemMap = new Map<string, { sale_date: string; vendor_item_id: number; product_name: string; vendor_item_name: string; quantity: number; sale_amount: number; unit_profit: number }>();

        // 기존 items 중 해당 날짜 것들 기반으로 시작
        for (const item of items) {
          if (!newOrderDates.has(item.sale_date)) continue;
          mergedItemMap.set(`${item.sale_date}_${item.vendor_item_id}`, { ...item });
        }
        // 기존 DB 주문 중 이번 paste에 없는 것 추가
        for (const o of (existingOrders || [])) {
          const key = `${o.sale_date}_${o.vendor_item_id}`;
          if (!mergedItemMap.has(key)) {
            mergedItemMap.set(key, {
              sale_date: o.sale_date,
              vendor_item_id: Number(o.vendor_item_id),
              product_name: '',
              vendor_item_name: '',
              quantity: o.quantity,
              sale_amount: o.sale_amount,
              unit_profit: o.unit_price ?? 0,
            });
          }
        }

        for (const sale_date of newOrderDates) {
          const dayTotal = { total_sale_amount: 0, order_count: 0 };
          for (const [key, item] of mergedItemMap) {
            if (!key.startsWith(sale_date)) continue;
            dayTotal.total_sale_amount += item.sale_amount;
            dayTotal.order_count += item.quantity;
          }
          await supabase.from('daily_sales').upsert({
            store_id: storeId, sale_date, channel,
            total_sale_amount: dayTotal.total_sale_amount,
            total_settlement_amount: 0,
            order_count: newOrderRows.filter(o => o.sale_date === sale_date).length + (existingOrders || []).filter(o => o.sale_date === sale_date).length,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'store_id,sale_date,channel' });

          await supabase.from('daily_sales_items').delete()
            .eq('store_id', storeId).eq('sale_date', sale_date).eq('channel', channel);
        }

        const itemsToInsert = Array.from(mergedItemMap.values()).filter(i => i.product_name || i.quantity > 0);
        if (itemsToInsert.length > 0) {
          await supabase.from('daily_sales_items').insert(itemsToInsert.map(item => ({
            store_id: storeId,
            sale_date: item.sale_date,
            channel,
            vendor_item_id: item.vendor_item_id,
            product_name: item.product_name,
            vendor_item_name: item.vendor_item_name,
            quantity: item.quantity,
            sale_amount: item.sale_amount,
            settlement_amount: 0,
            unit_profit: item.unit_profit,
            sale_type: 'SALE',
          })));
        }
      }

      if (newOrderRows.length > 0) {
        await supabase.from('daily_order_details').insert(newOrderRows.map(o => ({
          store_id: storeId,
          sale_date: o.sale_date,
          channel,
          vendor_item_id: o.vendor_item_id,
          order_id: o.order_id,
          paid_at: o.paid_at,
          quantity: o.quantity,
          unit_price: o.unit_price,
          sale_amount: o.sale_amount,
        })));
      }

      const dateCount = dailyMap.size;
      setImportDialog(false);
      setImportText('');
      await refetch();
      fetchMonthly(year, month, 'all', `${month}월 전체`);
      setSnackbar({ open: true, message: `${dateCount}일치 데이터 가져오기 완료`, severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: `가져오기 실패: ${e instanceof Error ? e.message : String(e)}`, severity: 'error' });
    } finally {
      setImporting(false);
    }
  };




  const lastDate = new Date(year, month, 0).getDate();
  const days = Array.from({ length: lastDate }, (_, i) => i + 1);
  const monthButtons = Array.from({ length: year === currentYear ? currentMonth : 12 }, (_, i) => i + 1);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...days,
  ];

  const handleChannelClick = (day: number, channel: string) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fetchDetail(dateStr, channel);
  };


  const selectedDay = selectedDate ? new Date(selectedDate).getDate() : null;
  const isMonthly = !!detailLabel;

  const [expandedOrderKey, setExpandedOrderKey] = useState<string | null>(null);
  const [orderDetailsMap, setOrderDetailsMap] = useState<Record<string, { orderId: number; paidAt: string; status: string; quantity: number; salesPrice: number; orderPrice: number; discountPrice: number; coupangDiscount: number; saleAmount: number; isRefunded: boolean }[]>>({});
  const [orderLoadingKey, setOrderLoadingKey] = useState<string | null>(null);

  const [expandedRgKey, setExpandedRgKey] = useState<string | null>(null);
  const [rgOrderDetailsMap, setRgOrderDetailsMap] = useState<Record<string, { orderId: number; paidAt: string; quantity: number; unitSalesPrice: number; saleAmount: number; isRefunded: boolean }[]>>({});
  const [rgOrderLoadingKey, setRgOrderLoadingKey] = useState<string | null>(null);

  const [expandedSsKey, setExpandedSsKey] = useState<string | null>(null);
  const [ssOrderDetailsMap, setSsOrderDetailsMap] = useState<Record<string, { orderId: string; paidAt: string; quantity: number; unitPrice: number; saleAmount: number; settlementAmount: number; inflowPath: string; isRefunded: boolean }[]>>({});
  const [ssOrderLoadingKey, setSsOrderLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    setExpandedOrderKey(null);
    setOrderDetailsMap({});
    setExpandedRgKey(null);
    setRgOrderDetailsMap({});
    setExpandedSsKey(null);
    setSsOrderDetailsMap({});
  }, [selectedDate]);

  const STATUS_LABELS: Record<string, string> = {
    ACCEPT: '결제완료',
    INSTRUCT: '상품준비중',
    DEPARTURE: '배송준비중',
    DELIVERING: '배송중',
    FINAL_DELIVERY: '배송완료',
    NONE_TRACKING: '배송완료',
  };

  const handleProductRowClick = async (item: typeof items[0]) => {
    const key = String(item.vendor_item_id);
    if (expandedOrderKey === key) {
      setExpandedOrderKey(null);
      return;
    }
    setExpandedOrderKey(key);
    if (orderDetailsMap[key]) return;
    setOrderLoadingKey(key);
    try {
      const res = await fetch(`/api/sales/orders?date=${selectedDate}&vendorItemId=${key}&storeId=${currentStore?.id}`);
      const json = await res.json();
      if (res.ok) setOrderDetailsMap(prev => ({ ...prev, [key]: json.orders }));
    } finally {
      setOrderLoadingKey(null);
    }
  };

  const handleRgProductRowClick = async (item: typeof items[0]) => {
    const key = String(item.vendor_item_id);
    if (expandedRgKey === key) {
      setExpandedRgKey(null);
      return;
    }
    setExpandedRgKey(key);
    if (rgOrderDetailsMap[key]) return;
    setRgOrderLoadingKey(key);
    try {
      const res = await fetch(`/api/sales/rg-orders?date=${selectedDate}&vendorItemId=${key}&storeId=${currentStore?.id}`);
      const json = await res.json();
      if (res.ok) setRgOrderDetailsMap(prev => ({ ...prev, [key]: json.orders }));
    } finally {
      setRgOrderLoadingKey(null);
    }
  };

  const handleSsProductRowClick = async (item: typeof items[0]) => {
    const key = String(item.vendor_item_id);
    if (expandedSsKey === key) {
      setExpandedSsKey(null);
      return;
    }
    setExpandedSsKey(key);
    if (ssOrderDetailsMap[key]) return;
    setSsOrderLoadingKey(key);
    try {
      const res = await fetch(`/api/sales/ss-orders?date=${selectedDate}&vendorItemId=${key}&storeId=${currentStore?.id}`);
      const json = await res.json();
      if (res.ok) setSsOrderDetailsMap(prev => ({ ...prev, [key]: json.orders }));
    } finally {
      setSsOrderLoadingKey(null);
    }
  };

  const renderRgTable = (tableItems: typeof items) => {
    const totalProfit = tableItems.reduce((sum, item) => {
      const pKey = item.product_name.trim().replace(/\s+/g, ' ');
      const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
      const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
      const itemProfit = cost
        ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
        : item.unit_profit * item.quantity;
      return sum + itemProfit;
    }, 0);
    return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...thSx, width: 28, pr: 0 }} />
            <TableCell sx={thSx}>상품명</TableCell>
            <TableCell sx={thSx}>옵션명</TableCell>
            <TableCell align="right" sx={thSx}>판매건수</TableCell>
            <TableCell align="right" sx={thSx}>매출금액</TableCell>
            <TableCell align="right" sx={thSx}>순이익</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableItems.map((item) => {
            const pKey = item.product_name.trim().replace(/\s+/g, ' ');
            const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
            const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
            const itemProfit = cost
              ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
              : item.unit_profit * item.quantity;
            const key = String(item.vendor_item_id);
            const isExpanded = expandedRgKey === key;
            const isLoadingThis = rgOrderLoadingKey === key;
            const orders = rgOrderDetailsMap[key];
            return (
              <Fragment key={key}>
                <TableRow onClick={() => handleRgProductRowClick(item)} sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f8f9fa' } }}>
                  <TableCell sx={{ ...tdSx, pr: 0, width: 28 }}>
                    {isExpanded
                      ? <KeyboardArrowUpIcon sx={{ fontSize: 16, color: '#adb5bd', verticalAlign: 'middle' }} />
                      : <KeyboardArrowDownIcon sx={{ fontSize: 16, color: '#adb5bd', verticalAlign: 'middle' }} />}
                  </TableCell>
                  <TableCell sx={tdSx}>{item.product_name}</TableCell>
                  <TableCell sx={tdSx}>{getOptionPart(item.vendor_item_name, item.product_name)}</TableCell>
                  <TableCell align="right" sx={tdSx}>{formatNumber(item.quantity)}건</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600 }}>{formatNumber(item.sale_amount)}원</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600, color: itemProfit > 0 ? '#2b8a3e' : '#adb5bd' }}>{itemProfit !== 0 ? `${formatNumber(itemProfit)}원` : '-'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, borderBottom: isExpanded ? '1px solid #f1f3f5' : 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 1.5, backgroundColor: '#f8f9fa' }}>
                        {isLoadingThis ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                            <CircularProgress size={16} sx={{ color: '#adb5bd' }} />
                          </Box>
                        ) : !orders || orders.length === 0 ? (
                          <Typography sx={{ fontSize: '0.78rem', color: '#adb5bd', textAlign: 'center', py: 1 }}>주문 데이터 없음</Typography>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>주문번호</TableCell>
                                <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>결제일시</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>수량</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>단위판매가</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>판매금액</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>마진</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {orders.map((order) => {
                                const kstDate = new Date(Number(order.paidAt) + 9 * 60 * 60 * 1000);
                                const paidAtStr = kstDate.toISOString().slice(5, 16).replace('T', ' ');
                                const orderMargin = cost && !order.isRefunded
                                  ? Math.round(order.saleAmount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * order.quantity
                                  : null;
                                const strikeSx = order.isRefunded ? { textDecoration: 'line-through', opacity: 0.55 } : {};
                                return (
                                  <TableRow key={order.orderId} sx={{ '&:last-child td': { borderBottom: 'none' }, ...(order.isRefunded ? { backgroundColor: '#fff5f5' } : {}) }}>
                                    <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#495057', ...strikeSx }}>{order.orderId}{order.isRefunded && <Box component="span" sx={{ ml: 0.5, fontSize: '0.65rem', color: '#e03131', fontWeight: 700, textDecoration: 'none' }}>반품</Box>}</TableCell>
                                    <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#495057', ...strikeSx }}>{paidAtStr}</TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{order.quantity}건</TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{formatNumber(order.unitSalesPrice)}원</TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: order.isRefunded ? '#e03131' : 'inherit' }}>
                                      {order.isRefunded ? '0원' : `${formatNumber(order.saleAmount)}원`}
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: order.isRefunded ? '#e03131' : orderMargin === null ? '#adb5bd' : orderMargin > 0 ? '#2b8a3e' : '#e03131' }}>
                                      {order.isRefunded ? '0원' : orderMargin !== null ? `${formatNumber(orderMargin)}원` : '-'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
          <TableRow sx={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #e9ecef' }}>
            <TableCell colSpan={4} sx={{ ...tdSx, fontWeight: 700, color: '#495057' }}>합계</TableCell>
            <TableCell />
            <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: totalProfit > 0 ? '#2b8a3e' : '#e03131' }}>{formatNumber(totalProfit)}원</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
    );
  };

  const renderSsTable = (tableItems: typeof items) => {
    const totalProfit = tableItems.reduce((sum, item) => {
      const pKey = item.product_name.trim().replace(/\s+/g, ' ');
      const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
      const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
      const itemProfit = cost
        ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
        : item.unit_profit * item.quantity;
      return sum + itemProfit;
    }, 0);
    const totalSettlement = tableItems.reduce((sum, item) => sum + (item.settlement_amount ?? 0), 0);
    return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...thSx, width: 28, pr: 0 }} />
            <TableCell sx={thSx}>상품명</TableCell>
            <TableCell sx={thSx}>옵션명</TableCell>
            <TableCell align="right" sx={thSx}>판매건수</TableCell>
            <TableCell align="right" sx={thSx}>매출금액</TableCell>
            <TableCell align="right" sx={thSx}>정산예정금액</TableCell>
            <TableCell align="right" sx={thSx}>순이익</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableItems.map((item) => {
            const pKey = item.product_name.trim().replace(/\s+/g, ' ');
            const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
            const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
            const itemProfit = cost
              ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
              : item.unit_profit * item.quantity;
            const key = String(item.vendor_item_id);
            const isExpanded = expandedSsKey === key;
            const isLoadingThis = ssOrderLoadingKey === key;
            const orders = ssOrderDetailsMap[key];
            return (
              <Fragment key={key}>
                <TableRow onClick={() => handleSsProductRowClick(item)} sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f8f9fa' } }}>
                  <TableCell sx={{ ...tdSx, pr: 0, width: 28 }}>
                    {isExpanded
                      ? <KeyboardArrowUpIcon sx={{ fontSize: 16, color: '#adb5bd', verticalAlign: 'middle' }} />
                      : <KeyboardArrowDownIcon sx={{ fontSize: 16, color: '#adb5bd', verticalAlign: 'middle' }} />}
                  </TableCell>
                  <TableCell sx={tdSx}>{item.product_name}</TableCell>
                  <TableCell sx={tdSx}>{getOptionPart(item.vendor_item_name, item.product_name)}</TableCell>
                  <TableCell align="right" sx={tdSx}>{formatNumber(item.quantity)}건</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600 }}>{formatNumber(item.sale_amount)}원</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600, color: '#1971c2' }}>{item.settlement_amount > 0 ? `${formatNumber(item.settlement_amount)}원` : '-'}</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600, color: itemProfit > 0 ? '#2b8a3e' : '#adb5bd' }}>{itemProfit !== 0 ? `${formatNumber(itemProfit)}원` : '-'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, borderBottom: isExpanded ? '1px solid #f1f3f5' : 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 1.5, backgroundColor: '#f8f9fa' }}>
                        {isLoadingThis ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                            <CircularProgress size={16} sx={{ color: '#adb5bd' }} />
                          </Box>
                        ) : !orders || orders.length === 0 ? (
                          <Typography sx={{ fontSize: '0.78rem', color: '#adb5bd', textAlign: 'center', py: 1 }}>주문 데이터 없음</Typography>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>주문번호</TableCell>
                                <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>결제일시</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>수량</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>단위판매가</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>판매금액</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>정산예정</TableCell>
                                <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>마진</TableCell>
                                <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>유입경로</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {orders.map((order) => {
                                const paidAtStr = order.paidAt ? order.paidAt.slice(5, 16).replace('T', ' ') : '-';
                                const orderMargin = cost && !order.isRefunded
                                  ? Math.round(order.saleAmount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * order.quantity
                                  : null;
                                const strikeSx = order.isRefunded ? { textDecoration: 'line-through', opacity: 0.55 } : {};
                                return (
                                  <TableRow key={order.orderId} sx={{ '&:last-child td': { borderBottom: 'none' }, ...(order.isRefunded ? { backgroundColor: '#fff5f5' } : {}) }}>
                                    <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#495057', ...strikeSx }}>{order.orderId}{order.isRefunded && <Box component="span" sx={{ ml: 0.5, fontSize: '0.65rem', color: '#e03131', fontWeight: 700, textDecoration: 'none' }}>반품</Box>}</TableCell>
                                    <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#495057', ...strikeSx }}>{paidAtStr}</TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{order.quantity}건</TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{formatNumber(order.unitPrice)}원</TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: order.isRefunded ? '#e03131' : 'inherit' }}>
                                      {order.isRefunded ? '0원' : `${formatNumber(order.saleAmount)}원`}
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: '#1971c2', ...strikeSx }}>
                                      {order.settlementAmount > 0 ? `${formatNumber(order.settlementAmount)}원` : '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: order.isRefunded ? '#e03131' : orderMargin === null ? '#adb5bd' : orderMargin > 0 ? '#2b8a3e' : '#e03131' }}>
                                      {order.isRefunded ? '0원' : orderMargin !== null ? `${formatNumber(orderMargin)}원` : '-'}
                                    </TableCell>
                                    <TableCell sx={{ ...tdSx, fontSize: '0.75rem', py: 0.8, color: '#868e96' }}>{order.inflowPath || '-'}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
          <TableRow sx={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #e9ecef' }}>
            <TableCell colSpan={4} sx={{ ...tdSx, fontWeight: 700, color: '#495057' }}>합계</TableCell>
            <TableCell align="right" sx={{ ...tdSx, fontWeight: 700 }}>{formatNumber(tableItems.reduce((s, i) => s + i.sale_amount, 0))}원</TableCell>
            <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: '#1971c2' }}>{totalSettlement > 0 ? `${formatNumber(totalSettlement)}원` : '-'}</TableCell>
            <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: totalProfit > 0 ? '#2b8a3e' : '#e03131' }}>{formatNumber(totalProfit)}원</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
    );
  };

  const renderMpTable = (tableItems: typeof items) => {
    const totalProfit = tableItems.reduce((sum, item) => {
      const pKey = item.product_name.trim().replace(/\s+/g, ' ');
      const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
      const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
      const itemProfit = cost
        ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
        : item.unit_profit * item.quantity;
      return sum + itemProfit;
    }, 0);
    return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.04)', borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...thSx, width: 28, pr: 0 }} />
            <TableCell sx={thSx}>상품명</TableCell>
            <TableCell sx={thSx}>옵션명</TableCell>
            <TableCell align="right" sx={thSx}>판매건수</TableCell>
            <TableCell align="right" sx={thSx}>매출금액</TableCell>
            <TableCell align="right" sx={thSx}>순이익</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableItems.map((item) => {
            const pKey = item.product_name.trim().replace(/\s+/g, ' ');
            const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
            const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
            const itemProfit = cost
              ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
              : item.unit_profit * item.quantity;
            const key = String(item.vendor_item_id);
            const isExpanded = expandedOrderKey === key;
            const isLoadingThis = orderLoadingKey === key;
            const orders = orderDetailsMap[key];
            return (
              <Fragment key={key}>
                <TableRow onClick={() => handleProductRowClick(item)} sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f8f9fa' } }}>
                  <TableCell sx={{ ...tdSx, pr: 0, width: 28 }}>
                    {isExpanded
                      ? <KeyboardArrowUpIcon sx={{ fontSize: 16, color: '#adb5bd', verticalAlign: 'middle' }} />
                      : <KeyboardArrowDownIcon sx={{ fontSize: 16, color: '#adb5bd', verticalAlign: 'middle' }} />}
                  </TableCell>
                  <TableCell sx={tdSx}>{item.product_name}</TableCell>
                  <TableCell sx={tdSx}>{getOptionPart(item.vendor_item_name, item.product_name)}</TableCell>
                  <TableCell align="right" sx={tdSx}>{formatNumber(item.quantity)}건</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600 }}>{formatNumber(item.sale_amount)}원</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 600, color: itemProfit > 0 ? '#2b8a3e' : '#adb5bd' }}>{itemProfit !== 0 ? `${formatNumber(itemProfit)}원` : '-'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, borderBottom: isExpanded ? '1px solid #f1f3f5' : 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 1.5, backgroundColor: '#f8f9fa' }}>
                        {isLoadingThis ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                            <CircularProgress size={16} sx={{ color: '#adb5bd' }} />
                          </Box>
                        ) : !orders || orders.length === 0 ? (
                          <Typography sx={{ fontSize: '0.78rem', color: '#adb5bd', textAlign: 'center', py: 1 }}>주문 데이터 없음</Typography>
                        ) : (
                          <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 720 }}>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>주문번호</TableCell>
                                  <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>결제일시</TableCell>
                                  <TableCell sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>상태</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>수량</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>판매가</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>주문가</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>할인금액</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>쿠팡할인</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>실판매금액</TableCell>
                                  <TableCell align="right" sx={{ ...thSx, fontSize: '0.7rem', py: 0.8 }}>마진</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {orders.map((order) => {
                                  const orderMargin = cost && !order.isRefunded
                                    ? Math.round(order.saleAmount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * order.quantity
                                    : null;
                                  const strikeSx = order.isRefunded ? { textDecoration: 'line-through', opacity: 0.55 } : {};
                                  return (
                                    <TableRow key={order.orderId} sx={{ '&:last-child td': { borderBottom: 'none' }, ...(order.isRefunded ? { backgroundColor: '#fff5f5' } : {}) }}>
                                      <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#495057', ...strikeSx }}>{order.orderId}{order.isRefunded && <Box component="span" sx={{ ml: 0.5, fontSize: '0.65rem', color: '#e03131', fontWeight: 700, textDecoration: 'none' }}>반품</Box>}</TableCell>
                                      <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#495057', ...strikeSx }}>
                                        {order.paidAt ? order.paidAt.slice(5, 16).replace('T', ' ') : '-'}
                                      </TableCell>
                                      <TableCell sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>
                                        <Box component="span" sx={{ px: 0.8, py: 0.2, borderRadius: 1, backgroundColor: '#e9ecef', color: '#495057', fontSize: '0.7rem' }}>
                                          {STATUS_LABELS[order.status] ?? order.status}
                                        </Box>
                                      </TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{order.quantity}건</TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{formatNumber(order.salesPrice)}원</TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, ...strikeSx }}>{formatNumber(order.orderPrice)}원</TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#868e96', ...strikeSx }}>{order.discountPrice > 0 ? `-${formatNumber(order.discountPrice)}원` : '-'}</TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, color: '#868e96', ...strikeSx }}>{order.coupangDiscount > 0 ? `-${formatNumber(order.coupangDiscount)}원` : '-'}</TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: order.isRefunded ? '#e03131' : 'inherit' }}>
                                        {order.isRefunded ? '0원' : `${formatNumber(order.saleAmount)}원`}
                                      </TableCell>
                                      <TableCell align="right" sx={{ ...tdSx, fontSize: '0.78rem', py: 0.8, fontWeight: 600, color: order.isRefunded ? '#e03131' : orderMargin === null ? '#adb5bd' : orderMargin > 0 ? '#2b8a3e' : '#e03131' }}>
                                        {order.isRefunded ? '0원' : orderMargin !== null ? `${formatNumber(orderMargin)}원` : '-'}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
          <TableRow sx={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #e9ecef' }}>
            <TableCell colSpan={4} sx={{ ...tdSx, fontWeight: 700, color: '#495057' }}>합계</TableCell>
            <TableCell />
            <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: totalProfit > 0 ? '#2b8a3e' : '#e03131' }}>{formatNumber(totalProfit)}원</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
    );
  };

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
    : items.filter(i => i.channel === 'marketplace').sort((a, b) => b.quantity - a.quantity);
  const rgItems = isMonthly
    ? mergeByVendorItem(items.filter(i => i.channel === 'rocket_growth'))
    : items.filter(i => i.channel === 'rocket_growth').sort((a, b) => b.quantity - a.quantity);
  const ssItems = isMonthly
    ? mergeByVendorItem(items.filter(i => i.channel === 'smartstore'))
    : items.filter(i => i.channel === 'smartstore').sort((a, b) => b.quantity - a.quantity);

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
            const pKey = item.product_name.trim().replace(/\s+/g, ' ');
            const vKey = (item.vendor_item_name || '').trim().replace(/\s+/g, ' ');
            const cost = costMap.get(`${vKey}|${item.channel}`) ?? costMap.get(vKey) ?? costMap.get(`${pKey}|${item.channel}`) ?? costMap.get(pKey);
            const itemProfit = cost
              ? Math.round(item.sale_amount / 1.1) - (cost.market_commission + cost.unit_cost + cost.warehouse_fee + cost.shipping_fee + cost.barcode_fee + cost.box_fee + cost.other_fee) * item.quantity
              : item.unit_profit * item.quantity;
            return (
              <TableRow key={`${item.channel}_${item.vendor_item_id}`} sx={{ '&:hover': { backgroundColor: '#f8f9fa' } }}>
                <TableCell sx={tdSx}>{item.product_name}</TableCell>
                <TableCell sx={tdSx}>{getOptionPart(item.vendor_item_name, item.product_name)}</TableCell>
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
    {/* 좌우 월 이동 버튼 */}
    {(() => {
      const isPrevDisabled = year === 2025 && month === 1;
      const isNextDisabled = year === currentYear && month === currentMonth;
      const btnSx = {
        position: 'fixed' as const,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        width: 40,
        height: 40,
        '&:hover': { backgroundColor: '#f8f9fa', borderColor: '#adb5bd' },
        '&.Mui-disabled': { backgroundColor: '#f8f9fa', borderColor: '#f1f3f5', color: '#dee2e6' },
      };
      const goPrev = () => {
        if (isPrevDisabled) return;
        if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
        clearDetail();
      };
      const goNext = () => {
        if (isNextDisabled) return;
        if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
        clearDetail();
      };
      return (
        <>
          <IconButton onClick={goPrev} disabled={isPrevDisabled} sx={{ ...btnSx, left: 'max(8px, calc(50% - 648px))' }}>
            <ChevronLeftIcon sx={{ fontSize: 22, color: '#495057' }} />
          </IconButton>
          <IconButton onClick={goNext} disabled={isNextDisabled} sx={{ ...btnSx, right: 'max(8px, calc(50% - 648px))' }}>
            <ChevronRightIcon sx={{ fontSize: 22, color: '#495057' }} />
          </IconButton>
        </>
      );
    })()}
    <Container maxWidth="lg" sx={{ pt: 3, pb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 헤더 + 월 선택 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setMonth(1); clearDetail(); }}
            size="small"
            sx={{
              fontWeight: 500,
              fontSize: '0.8125rem',
              color: '#868e96',
              backgroundColor: '#fff',
              height: 30,
              '& .MuiSelect-select': { py: 0, display: 'flex', alignItems: 'center' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dee2e6' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#adb5bd' },
              minWidth: 90,
            }}
          >
            {yearOptions.map((y) => (
              <MenuItem key={y} value={y}>{y}년</MenuItem>
            ))}
          </Select>
          <ButtonGroup size="small" sx={{ '& .MuiButton-root': { borderColor: '#dee2e6', color: '#868e96', fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.7)', '&.MuiButton-contained': { backgroundColor: '#343a40', borderColor: '#343a40', color: '#fff' }, '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' }, '&.MuiButton-contained:hover': { backgroundColor: '#343a40' } } }}>
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
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setImportDialog(true)}
              disabled={!currentStore}
              sx={{
                borderColor: '#dee2e6',
                color: '#495057',
                fontSize: '0.8rem',
                fontWeight: 500,
                borderRadius: 2,
                px: 1.5,
                '&:hover': { borderColor: '#adb5bd', backgroundColor: '#f8f9fa' },
              }}
            >
              엑셀 가져오기
            </Button>
          </Box>
        </Box>

        {/* 월 매출 총합 — B 레이아웃 */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
          {/* 좌: 실순이익 히어로 카드 */}
          <Paper elevation={0} sx={{
            flex: '0 0 240px',
            p: 2.5,
            borderRadius: 3,
            border: `1.5px solid ${loading ? '#e9ecef' : netProfit >= 0 ? '#b2f2bb' : '#ffc9c9'}`,
            backgroundColor: loading ? '#fff' : netProfit >= 0 ? '#f4fbf6' : '#fff5f5',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <Typography sx={{ color: '#868e96', fontSize: '0.75rem', mb: 1.5, fontWeight: 500 }}>{month}월 실순이익</Typography>
            {loading ? (
              <Skeleton variant="rounded" width={160} height={38} sx={{ borderRadius: 1.5 }} />
            ) : (
              <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', color: netProfit >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.03em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {formatNumber(netProfit)}
                <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 400, color: netProfit >= 0 ? '#74c48a' : '#fa8080', ml: 0.5 }}>원</Typography>
              </Typography>
            )}
          </Paper>

          {/* 중: 서브 그리드 */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {[
                { label: `${month}월 매출총합`, value: totalMarketplace + totalRocketGrowth + totalSmartstore, onClick: () => fetchMonthly(year, month, 'all', `${month}월 전체`) },
                { label: '쿠팡(판매자배송)', value: totalMarketplace, onClick: () => fetchMonthly(year, month, 'marketplace', `${month}월 쿠팡(판매자배송)`) },
                { label: '쿠팡(로켓)', value: totalRocketGrowth, onClick: () => fetchMonthly(year, month, 'rocket_growth', `${month}월 쿠팡(로켓)`) },
                { label: '스마트스토어', value: totalSmartstore, onClick: () => fetchMonthly(year, month, 'smartstore', `${month}월 스마트스토어`) },
              ].map(({ label, value, onClick }) => (
                <Paper key={label} elevation={0} onClick={onClick} sx={cardSx}>
                  <Typography sx={{ color: '#868e96', fontSize: '0.75rem', mb: 0.5 }}>{label}</Typography>
                  {loading ? (
                    <Skeleton variant="rounded" width={100} height={22} sx={{ borderRadius: 1, mt: 0.5 }} />
                  ) : (
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#1a1a1b', letterSpacing: '-0.02em' }}>
                      {formatNumber(value)}
                      <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {[
                { label: `${month}월 순이익`, sub: '(원가/수수료 차감)', value: totalProfit },
                { label: '쿠팡(판매자배송)', value: totalMarketplaceProfit },
                { label: '쿠팡(로켓)', value: totalRocketGrowthProfit },
                { label: '스마트스토어', value: totalSmartstoreProfit },
              ].map(({ label, sub, value }) => (
                <Paper key={label} elevation={0} sx={{ ...cardSx, cursor: 'default', '&:hover': {}, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography sx={{ color: '#868e96', fontSize: '0.75rem', mb: 0.5 }}>
                    {label}
                    {sub && <Typography component="span" sx={{ fontSize: '0.7rem', color: '#adb5bd', ml: 0.5 }}>{sub}</Typography>}
                  </Typography>
                  {loading ? (
                    <Skeleton variant="rounded" width={100} height={22} sx={{ borderRadius: 1, mt: 0.5 }} />
                  ) : (
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: value >= 0 ? '#2b8a3e' : '#e03131', letterSpacing: '-0.02em' }}>
                      {formatNumber(value)}
                      <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1 }}>
              <Paper elevation={0} sx={{ ...cardSx, cursor: 'default', '&:hover': {}, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography sx={{ color: '#868e96', fontSize: '0.75rem', mb: 0.5 }}>{month}월 반품</Typography>
                {loading ? (
                  <Skeleton variant="rounded" width={100} height={22} sx={{ borderRadius: 1, mt: 0.5 }} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: totalRefundCount > 0 ? '#e03131' : '#1a1a1b', letterSpacing: '-0.02em' }}>
                      {totalRefundCount}
                      <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>건</Typography>
                    </Typography>
                    {totalOrderCount > 0 && (
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: totalRefundCount > 0 ? '#e03131' : '#adb5bd' }}>
                        {((totalRefundCount / totalOrderCount) * 100).toFixed(1)}%
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
              <Paper elevation={0} onClick={() => router.push(`/expenses?year=${year}&month=${month}`)} sx={{ ...cardSx, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography sx={{ color: '#868e96', fontSize: '0.75rem', mb: 0.5 }}>{month}월 지출</Typography>
                {loading ? (
                  <Skeleton variant="rounded" width={100} height={22} sx={{ borderRadius: 1, mt: 0.5 }} />
                ) : (
                  <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#e03131', letterSpacing: '-0.02em' }}>
                    {formatNumber(totalExpenses)}
                    <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, color: '#adb5bd', ml: 0.3 }}>원</Typography>
                  </Typography>
                )}
              </Paper>
            </Box>
          </Box>

        </Box>

        {/* 달력 UI */}
        <Paper elevation={0} sx={{ p: 2, backgroundColor: '#fff', borderRadius: 3, border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* 요일 헤더 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {weekLabels.map((label, i) => (
            <Box key={label} sx={{ textAlign: 'center', py: 0.8, fontSize: '0.72rem', fontWeight: 600, color: i === 0 ? '#e03131' : i === 6 ? '#1971c2' : '#adb5bd' }}>
              {label}
            </Box>
          ))}
        </Box>
        {/* 날짜 셀 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {calendarCells.map((day, idx) => {
            if (!day) return <Box key={`empty-${idx}`} />;
            const daySales = dailySalesMap.get(day);
            const mpAmount = daySales?.marketplace ?? 0;
            const rgAmount = daySales?.rocketGrowth ?? 0;
            const ssAmount = daySales?.smartstore ?? 0;
            const mpProfit = daySales?.marketplaceProfit ?? 0;
            const rgProfit = daySales?.rocketGrowthProfit ?? 0;
            const ssProfit = daySales?.smartstoreProfit ?? 0;
            const mpRefundCount = daySales?.mpRefundCount ?? 0;
            const rgRefundCount = daySales?.rgRefundCount ?? 0;
            const ssRefundCount = daySales?.ssRefundCount ?? 0;
            const hasRefund = mpRefundCount > 0 || rgRefundCount > 0 || ssRefundCount > 0;
            const totalAmount = mpAmount + rgAmount + ssAmount;
            const totalDayProfit = mpProfit + rgProfit + ssProfit;
            const isSelectedDay = day === selectedDay;
            const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
            const isFuture = new Date(year, month - 1, day) > today;
            const dayOfWeek = (firstDayOfWeek + day - 1) % 7;

            return (
              <Paper
                key={day}
                elevation={0}
                onClick={() => !isFuture && handleChannelClick(day, 'all')}
                sx={{
                  p: 1,
                  minHeight: 96,
                  cursor: isFuture ? 'default' : 'pointer',
                  borderRadius: 2,
                  border: isSelectedDay ? '1.5px solid #343a40' : isToday ? '1px solid #228be6' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: isSelectedDay ? '#f8f9fa' : isToday ? '#e7f5ff' : '#fff',
                  opacity: isFuture ? 0.35 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.3,
                  transition: 'all 0.15s',
                  '&:hover': !isFuture ? { boxShadow: '0 2px 6px rgba(0,0,0,0.06)' } : {},
                }}
              >
                <Typography sx={{
                  fontWeight: isToday ? 700 : 500,
                  fontSize: '0.78rem',
                  color: isToday ? '#228be6' : dayOfWeek === 0 ? '#e03131' : dayOfWeek === 6 ? '#1971c2' : '#495057',
                  mb: 0.2,
                }}>
                  {day}
                </Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                    {[48, 64, 56, 52].map((w, i) => (
                      <Skeleton key={i} variant="rounded" width={`${w}%`} height={10} sx={{ borderRadius: 0.5 }} />
                    ))}
                  </Box>
                ) : (
                  <>
                    {[
                      { label: '스스', bg: '#03c75a', value: ssAmount, color: '#495057', bold: false },
                      { label: '쿠팡판매', bg: '#868e96', value: mpAmount, color: '#495057', bold: false },
                      { label: '쿠팡로켓', bg: '#fd7e14', value: rgAmount, color: '#495057', bold: false },
                      { label: '총매출', bg: '#343a40', value: totalAmount, color: '#1a1a1b', bold: true },
                      { label: '총순익', bg: totalDayProfit >= 0 ? '#2b8a3e' : '#e03131', value: totalDayProfit, color: totalDayProfit >= 0 ? '#2b8a3e' : '#e03131', bold: true },
                    ].map(({ label, bg, value, color, bold }) => (
                      <Box key={label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box component="span" sx={{ fontSize: '0.56rem', fontWeight: 700, color: '#fff', backgroundColor: bg, borderRadius: 0.5, px: 0.4, py: 0.1, lineHeight: 1.4, flexShrink: 0 }}>{label}</Box>
                        <Typography sx={{ fontSize: '0.63rem', fontWeight: bold ? 600 : 400, color, lineHeight: 1.4 }}>{formatNumber(value)}</Typography>
                      </Box>
                    ))}
                    {hasRefund && (
                      <>
                        <Box sx={{ borderTop: '1px solid #f1f3f5', mt: 0.3, mb: 0.1 }} />
                        {[
                          { label: '스스반품', value: ssRefundCount, hide: ssRefundCount === 0 },
                          { label: '쿠팡판매반품', value: mpRefundCount, hide: mpRefundCount === 0 },
                          { label: '쿠팡로켓반품', value: rgRefundCount, hide: rgRefundCount === 0 },
                        ].filter(item => !item.hide).map(({ label, value }) => (
                          <Box key={label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box component="span" sx={{ fontSize: '0.56rem', fontWeight: 700, color: '#fff', backgroundColor: '#e03131', borderRadius: 0.5, px: 0.4, py: 0.1, lineHeight: 1.4, flexShrink: 0 }}>{label}</Box>
                            <Typography sx={{ fontSize: '0.63rem', color: '#e03131', lineHeight: 1.4 }}>{value}건</Typography>
                          </Box>
                        ))}
                      </>
                    )}
                  </>
                )}
              </Paper>
            );
          })}
        </Box>
      </Paper>
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
                          {detailLabel ? `${detailLabel} 쿠팡(판매자배송)` : `${month}월 ${selectedDay}일 쿠팡(판매자배송)`}
                        </Typography>
                        {isMonthly ? renderItemTable(mpItems) : renderMpTable(mpItems)}
                      </Box>
                    )}
                    {rgItems.length > 0 && (
                      <Box>
                        <Typography sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.85rem', color: '#495057' }}>
                          {detailLabel ? `${detailLabel} 쿠팡(로켓)` : `${month}월 ${selectedDay}일 쿠팡(로켓)`}
                        </Typography>
                        {isMonthly ? renderItemTable(rgItems) : renderRgTable(rgItems)}
                      </Box>
                    )}
                    {ssItems.length > 0 && (
                      <Box>
                        <Typography sx={{ mb: 0.5, fontWeight: 600, fontSize: '0.85rem', color: '#03c75a' }}>
                          {detailLabel ? `${detailLabel} 스마트스토어` : `${month}월 ${selectedDay}일 스마트스토어`}
                        </Typography>
                        {isMonthly ? renderItemTable(ssItems) : renderSsTable(ssItems)}
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


      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>

      {/* 쿠팡 Wing 엑셀 가져오기 다이얼로그 */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem' }}>쿠팡 판매수수료 리포트 가져오기</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>채널</Typography>
              <Select size="small" value={importChannel} onChange={(e) => setImportChannel(e.target.value as 'marketplace' | 'rocket_growth')} fullWidth>
                <MenuItem value="marketplace">쿠팡(판매자배송)</MenuItem>
                <MenuItem value="rocket_growth">쿠팡(로켓)</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#495057' }}>
                쿠팡 Wing → 정산관리 → 판매수수료 리포트에서 데이터를 복사해 붙여넣어 주세요
              </Typography>
              <TextField
                multiline
                rows={10}
                fullWidth
                placeholder="헤더 포함하여 붙여넣기..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                size="small"
                sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
              />
              {importText && (() => {
                const rows = importText.trim().split('\n').filter(l => l.split('\t')[6]?.trim() === '주문 정산');
                return rows.length > 0 ? (
                  <Typography variant="caption" sx={{ color: '#2b8a3e', mt: 0.5, display: 'block' }}>
                    {rows.length}건 인식됨
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: '#adb5bd', mt: 0.5, display: 'block' }}>
                    주문 정산 데이터가 없습니다
                  </Typography>
                );
              })()}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialog(false); setImportText(''); }} size="small">취소</Button>
          <Button onClick={handleImport} variant="contained" size="small" disabled={importing || !importText.trim()}>
            {importing ? '가져오는 중...' : '가져오기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
    </>
  );
}
