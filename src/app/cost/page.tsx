"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { createClient } from "@/lib/supabase-browser";
import { useStore } from "@/contexts/StoreContext";
import { generateProductId } from "@/utils/generateId";

type Product = {
  id: string;
  store_id: number;
  name: string;
  country: string;
  exchange_rate: number;
  quantity: number;
  unit_price_foreign: number;
  unit_price_krw: number;
  total_product_price: number;
  purchase_fee_foreign: number;
  purchase_fee: number;
  local_shipping_foreign: number;
  local_shipping: number;
  first_payment: number;
  first_payment_date: string | null;
  inspection_fee: number;
  customs_clearance_fee: number;
  second_payment: number;
  second_payment_date: string | null;
  international_shipping: number;
  origin_certificate_fee: number;
  customs_duty: number;
  vat: number;
  customs_broker_fee: number;
  domestic_shipping: number;
  third_payment: number;
  third_payment_date: string | null;
  total_cost: number;
  unit_cost: number;
  has_options: boolean;
  created_at: string;
};

type ProductOption = {
  id: string;
  product_id: string;
  size: string;
  quantity: number;
  unit_price_foreign: number;
  unit_price_krw: number;
  unit_cost: number;
  total_cost: number;
};

function fmt(v: number) {
  return v.toLocaleString("ko-KR");
}

type Column = {
  label: string;
  key: string;
  numeric?: boolean;
  highlight?: boolean;
  suffix?: string;
  format?: (v: string) => string;
};

const columns: Column[] = [
  { label: "국가", key: "country", format: (v: string) => (v === "US" ? "미국" : "중국") },
  { label: "환율", key: "exchange_rate", numeric: true },
  { label: "수량", key: "quantity", numeric: true },
  { label: "상품가(현지)", key: "unit_price_foreign", numeric: true },
  { label: "상품가(원화)", key: "unit_price_krw", numeric: true, suffix: "원" },
  { label: "총 상품가격", key: "total_product_price", numeric: true, suffix: "원" },
  { label: "구매수수료(현지)", key: "purchase_fee_foreign", numeric: true },
  { label: "구매수수료(원화)", key: "purchase_fee", numeric: true, suffix: "원" },
  { label: "현지배송비(현지)", key: "local_shipping_foreign", numeric: true },
  { label: "현지배송비(원화)", key: "local_shipping", numeric: true, suffix: "원" },
  { label: "1차 결제", key: "first_payment", numeric: true, highlight: true, suffix: "원" },
  { label: "결제일", key: "first_payment_date" },
  { label: "검품 수수료", key: "inspection_fee", numeric: true, suffix: "원" },
  { label: "통관료", key: "customs_clearance_fee", numeric: true, suffix: "원" },
  { label: "2차 결제", key: "second_payment", numeric: true, highlight: true, suffix: "원" },
  { label: "2차 결제일", key: "second_payment_date" },
  { label: "국제운반비", key: "international_shipping", numeric: true, suffix: "원" },
  { label: "원산지발급", key: "origin_certificate_fee", numeric: true, suffix: "원" },
  { label: "관세", key: "customs_duty", numeric: true, suffix: "원" },
  { label: "부가세", key: "vat", numeric: true, suffix: "원" },
  { label: "관세사수수료", key: "customs_broker_fee", numeric: true, suffix: "원" },
  { label: "국내운송료", key: "domestic_shipping", numeric: true, suffix: "원" },
  { label: "3차 결제", key: "third_payment", numeric: true, highlight: true, suffix: "원" },
  { label: "3차 결제일", key: "third_payment_date" },
  { label: "총 비용", key: "total_cost", numeric: true, highlight: true, suffix: "원" },
  { label: "1개 사입비용", key: "unit_cost", numeric: true, highlight: true, suffix: "원" },
];

function OptionsRow({ productId, optionsMap }: { productId: string; optionsMap: Record<string, ProductOption[]> }) {
  const opts = optionsMap[productId] || [];
  if (opts.length === 0) return null;

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, fontSize: "0.72rem", color: "#adb5bd", py: 0.5 }}>옵션명</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.72rem", color: "#adb5bd", py: 0.5 }}>수량</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.72rem", color: "#adb5bd", py: 0.5 }}>현지단가</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.72rem", color: "#adb5bd", py: 0.5 }}>원화단가</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.72rem", color: "#343a40", py: 0.5 }}>개당 사입비용</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.72rem", color: "#343a40", py: 0.5 }}>옵션 총원가</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {opts.map((o) => (
            <TableRow key={o.id}>
              <TableCell sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#495057", py: 0.5, width: 60 }}>{o.size}</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.82rem", color: "#495057", py: 0.5 }}>{fmt(o.quantity)}개</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.82rem", color: "#495057", py: 0.5 }}>{fmt(o.unit_price_foreign)}</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.82rem", color: "#495057", py: 0.5 }}>{fmt(o.unit_price_krw)}원</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1b", py: 0.5 }}>{fmt(o.unit_cost)}원</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1b", py: 0.5 }}>{fmt(o.total_cost)}원</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export default function CostPage() {
  const router = useRouter();
  const { currentStore, stores, loading: storeLoading } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [optionsMap, setOptionsMap] = useState<Record<string, ProductOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);

  const [copyDialog, setCopyDialog] = useState(false);
  const [copyTargetStoreId, setCopyTargetStoreId] = useState<number | "">("");
  const [copySelected, setCopySelected] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  const otherStores = stores.filter((s) => s.id !== currentStore?.id);

  const handleCopyConfirm = async () => {
    if (!currentStore || !copyTargetStoreId || copySelected.length === 0) return;
    setCopying(true);
    const supabase = createClient();
    try {
      for (const name of copySelected) {
        const srcProducts = products.filter((p) => p.name === name);
        for (const src of srcProducts) {
          const newId = generateProductId();
          const { error } = await supabase.from("products").insert({
            ...src,
            id: newId,
            store_id: copyTargetStoreId,
          });
          if (error) throw error;

          if (src.has_options) {
            const opts = optionsMap[src.id] || [];
            if (opts.length > 0) {
              await supabase.from("product_options").insert(
                opts.map((o) => ({ ...o, id: generateProductId(), product_id: newId }))
              );
            }
          }
        }

        const avg = averages[name];
        if (avg != null) {
          await supabase.from("product_averages").upsert({
            store_id: copyTargetStoreId,
            name,
            average_unit_cost: avg,
            updated_at: new Date().toISOString(),
          }, { onConflict: "store_id,name" });
        }
      }
      setCopyDialog(false);
      setCopySelected([]);
      setCopyTargetStoreId("");
      alert(`${copySelected.join(", ")} → ${stores.find(s => s.id === copyTargetStoreId)?.name} 복사 완료`);
    } catch (e) {
      alert(`복사 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCopying(false);
    }
  };

  useEffect(() => {
    if (!currentStore) return;
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const [{ data: productData }, { data: avgData }] = await Promise.all([
        supabase.from("products").select("*").eq("store_id", currentStore.id).order("created_at", { ascending: false }),
        supabase.from("product_averages").select("*").eq("store_id", currentStore.id),
      ]);
      setProducts(productData || []);

      const avgMap: Record<string, number> = {};
      avgData?.forEach((a: { name: string; average_unit_cost: number }) => {
        avgMap[a.name] = a.average_unit_cost;
      });
      setAverages(avgMap);

      const optionProductIds = (productData || []).filter((p: Product) => p.has_options).map((p: Product) => p.id);
      if (optionProductIds.length > 0) {
        const { data: optData } = await supabase.from("product_options").select("*").in("product_id", optionProductIds);
        const map: Record<string, ProductOption[]> = {};
        optData?.forEach((o: ProductOption) => {
          if (!map[o.product_id]) map[o.product_id] = [];
          map[o.product_id].push(o);
        });
        setOptionsMap(map);
      }

      setSelectedTab(0);
      setLoading(false);
    };
    fetchData();
  }, [currentStore]);

  const productNames = useMemo(() => {
    const names: string[] = [];
    products.forEach((p) => {
      if (!names.includes(p.name)) names.push(p.name);
    });
    return names;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (productNames.length === 0) return [];
    return products.filter((p) => p.name === productNames[selectedTab]);
  }, [products, productNames, selectedTab]);

  const currentHasOptions = useMemo(() => filteredProducts.some((p) => p.has_options), [filteredProducts]);

  const optionAverages = useMemo(() => {
    if (!currentHasOptions) return [];
    const sizeMap: Record<string, number[]> = {};
    filteredProducts.filter((p) => p.has_options).forEach((p) => {
      (optionsMap[p.id] || []).forEach((o) => {
        if (!sizeMap[o.size]) sizeMap[o.size] = [];
        sizeMap[o.size].push(o.unit_cost);
      });
    });
    return Object.entries(sizeMap).map(([size, costs]) => ({
      size,
      avg: Math.round(costs.reduce((a, b) => a + b, 0) / costs.length),
    }));
  }, [filteredProducts, currentHasOptions, optionsMap]);

  if (storeLoading || loading) {
    return (
      <Box sx={{ px: 3, py: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="rounded" width={80} height={30} sx={{ borderRadius: 2 }} />
        </Box>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width={80} height={32} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
        <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 3, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 2000 }}>
              <TableHead>
                <TableRow>
                  {Array.from({ length: 27 }).map((_, i) => (
                    <TableCell key={i} sx={{ borderBottom: "1px solid #f1f3f5", py: 1.2 }}>
                      <Skeleton variant="rounded" width={55} height={14} sx={{ borderRadius: 1 }} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 27 }).map((_, j) => (
                      <TableCell key={j} sx={{ borderBottom: "1px solid #f1f3f5", py: 1.5 }}>
                        <Skeleton variant="rounded" width={j === 0 ? 40 : 70} height={16} sx={{ borderRadius: 1 }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  }

  if (products.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Typography color="text.secondary">등록된 매입 내역이 없습니다.</Typography>
          <Button variant="contained" onClick={() => router.push("/cost/register")}>
            상품 추가
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Button variant="outlined" size="small" onClick={() => router.push("/cost/register")} sx={{ borderColor: "#dee2e6", color: "#495057", "&:hover": { borderColor: "#adb5bd", backgroundColor: "#f8f9fa" } }}>
          상품 추가
        </Button>
        {otherStores.length > 0 && (
          <Button variant="outlined" size="small" onClick={() => setCopyDialog(true)} sx={{ borderColor: "#dee2e6", color: "#495057", "&:hover": { borderColor: "#adb5bd", backgroundColor: "#f8f9fa" } }}>
            다른 스토어로 복사
          </Button>
        )}
      </Box>

      <Tabs
        value={selectedTab}
        onChange={(_, v) => setSelectedTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: "1px solid #f1f3f5", mb: 2, "& .MuiTab-root": { color: "#868e96", fontWeight: 500, "&.Mui-selected": { color: "#1a1a1b", fontWeight: 700 } }, "& .MuiTabs-indicator": { backgroundColor: "#343a40" } }}
      >
        {productNames.map((name) => (
          <Tab key={name} label={name} />
        ))}
      </Tabs>

      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "#868e96" }}>
          평균 사입비용
        </Typography>
        {currentHasOptions ? (
          optionAverages.map(({ size, avg }) => (
            <Box key={size} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: "#adb5bd", fontSize: "0.78rem" }}>{size}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#1a1a1b" }}>{fmt(avg)}원</Typography>
            </Box>
          ))
        ) : (
          <Typography variant="body1" sx={{ fontWeight: 700, color: "#1a1a1b" }}>
            {productNames.length > 0 && averages[productNames[selectedTab]] != null
              ? `${fmt(averages[productNames[selectedTab]])}원`
              : "-"}
          </Typography>
        )}
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 3, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 2000 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#adb5bd", borderBottom: "1px solid #f1f3f5", whiteSpace: "nowrap" }} />
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.numeric ? "right" : "left"}
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                      color: "#adb5bd",
                      borderBottom: "1px solid #f1f3f5",
                      backgroundColor: col.highlight ? "#f8f9fa" : "#fff",
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} sx={{ "&:hover": { backgroundColor: "#f8f9fa" } }}>
                  <TableCell sx={{ borderBottom: "1px solid #f1f3f5", whiteSpace: "nowrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => router.push(`/cost/register?id=${product.id}`)}
                      sx={{ fontSize: "0.75rem", borderColor: "#dee2e6", color: "#495057", "&:hover": { borderColor: "#adb5bd", backgroundColor: "#f8f9fa" } }}
                    >
                      수정
                    </Button>
                  </TableCell>
                  {columns.map((col) => {
                    const raw = product[col.key as keyof Product];
                    let display: string;
                    if (col.format) {
                      display = col.format(raw as string);
                    } else if (col.numeric) {
                      display = fmt(raw as number) + (col.suffix || "");
                    } else {
                      display = (raw as string) || "-";
                    }
                    return (
                      <TableCell
                        key={col.key}
                        align={col.numeric ? "right" : "left"}
                        sx={{
                          fontSize: "0.85rem",
                          whiteSpace: "nowrap",
                          color: "#1a1a1b",
                          fontWeight: col.highlight ? 700 : 400,
                          borderBottom: "1px solid #f1f3f5",
                          backgroundColor: col.highlight ? "#f8f9fa" : "transparent",
                        }}
                      >
                        {display}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {filteredProducts.filter((p) => p.has_options).map((product) => (
        <Paper key={`${product.id}-opts`} elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 2, overflow: "hidden", mt: 1.5 }}>
          <OptionsRow productId={product.id} optionsMap={optionsMap} />
        </Paper>
      ))}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => router.push(`/cost/register?name=${encodeURIComponent(productNames[selectedTab])}`)}
        >
          매입 추가
        </Button>
      </Box>

      {/* 다른 스토어로 복사 다이얼로그 */}
      <Dialog open={copyDialog} onClose={() => setCopyDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>다른 스토어로 복사</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: "#495057" }}>대상 스토어</Typography>
              <Select
                size="small"
                fullWidth
                value={copyTargetStoreId}
                onChange={(e) => setCopyTargetStoreId(e.target.value as number)}
                displayEmpty
              >
                <MenuItem value="" disabled>스토어 선택</MenuItem>
                {otherStores.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: "#495057" }}>복사할 상품</Typography>
              {productNames.map((name) => (
                <FormControlLabel
                  key={name}
                  control={
                    <Checkbox
                      size="small"
                      checked={copySelected.includes(name)}
                      onChange={(e) =>
                        setCopySelected((prev) =>
                          e.target.checked ? [...prev, name] : prev.filter((n) => n !== name)
                        )
                      }
                    />
                  }
                  label={<Typography variant="body2">{name}</Typography>}
                  sx={{ display: "flex" }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialog(false)} size="small">취소</Button>
          <Button
            onClick={handleCopyConfirm}
            variant="contained"
            size="small"
            disabled={copying || !copyTargetStoreId || copySelected.length === 0}
          >
            {copying ? "복사 중..." : "복사"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
