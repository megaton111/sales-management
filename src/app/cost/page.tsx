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
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import { createClient } from "@/lib/supabase-browser";
import { useStore } from "@/contexts/StoreContext";

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
  created_at: string;
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

export default function CostPage() {
  const router = useRouter();
  const { currentStore, loading: storeLoading } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);

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

  if (storeLoading || loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", mb: 2 }}>
        <Button variant="outlined" size="small" onClick={() => router.push("/cost/register")} sx={{ borderColor: "#dee2e6", color: "#495057", "&:hover": { borderColor: "#adb5bd", backgroundColor: "#f8f9fa" } }}>
          상품 추가
        </Button>
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

      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ color: "#868e96" }}>
          평균 사입비용
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 700, color: "#1a1a1b" }}>
          {productNames.length > 0 && averages[productNames[selectedTab]] != null
            ? `${fmt(averages[productNames[selectedTab]])}원`
            : "-"}
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 3, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 2000 }}>
            <TableHead>
              <TableRow>
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

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => router.push(`/cost/register?name=${encodeURIComponent(productNames[selectedTab])}`)}
        >
          매입 추가
        </Button>
      </Box>
    </Box>
  );
}
