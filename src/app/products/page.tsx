"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { createClient } from "@/lib/supabase-browser";
import { useStore } from "@/contexts/StoreContext";

type ProductSale = {
  name: string;
  productId: string;
  category: string;
  selling_price: number;
  supply_price: number;
  market_commission: number;
  unit_cost: number;
  warehouse_fee: number;
  shipping_fee: number;
  barcode_fee: number;
  box_fee: number;
  other_fee: number;
  profit: number;
  margin_rate: number;
  memo: string;
  base_name: string | null;
  multiplier: number;
};

type Column = {
  label: string;
  key: keyof ProductSale;
  numeric?: boolean;
  highlight?: boolean;
  suffix?: string;
  editable?: boolean;
};

const columns: Column[] = [
  { label: "상품명", key: "name" },
  { label: "상품ID", key: "productId" },
  { label: "구분", key: "category", editable: true },
  { label: "실제 판매가", key: "selling_price", numeric: true, editable: true, suffix: "원" },
  { label: "공급가", key: "supply_price", numeric: true, suffix: "원" },
  { label: "이익금", key: "profit", numeric: true, highlight: true, suffix: "원" },
  { label: "마진율", key: "margin_rate", numeric: true, highlight: true, suffix: "%" },
  { label: "마켓수수료", key: "market_commission", numeric: true, editable: true, suffix: "원" },
  { label: "원가", key: "unit_cost", numeric: true, suffix: "원" },
  { label: "입출고요금", key: "warehouse_fee", numeric: true, editable: true, suffix: "원" },
  { label: "배송비", key: "shipping_fee", numeric: true, editable: true, suffix: "원" },
  { label: "바코드 작업비", key: "barcode_fee", numeric: true, suffix: "원" },
  { label: "박스비", key: "box_fee", numeric: true, suffix: "원" },
  { label: "기타비용", key: "other_fee", numeric: true, editable: true, suffix: "원" },
];

function fmt(v: number) {
  return v.toLocaleString("ko-KR");
}

function calcSupplyPrice(sellingPrice: number): number {
  return Math.round(sellingPrice / 1.1);
}

function calcProfit(sale: ProductSale): number {
  return sale.supply_price - sale.market_commission - sale.unit_cost - sale.warehouse_fee - sale.shipping_fee - sale.barcode_fee - sale.box_fee - sale.other_fee;
}

export default function ProductsPage() {
  const { currentStore, loading: storeLoading } = useStore();
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    field: keyof ProductSale;
    label: string;
    value: string;
    productName: string;
  } | null>(null);
  const [mappingDialog, setMappingDialog] = useState<{ open: boolean; productName: string } | null>(null);
  const [coupangNames, setCoupangNames] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [selectedMappings, setSelectedMappings] = useState<string[]>([]);
  const [memoValues, setMemoValues] = useState<Record<string, string>>({});
  const [bundleDialog, setBundleDialog] = useState<{ open: boolean; baseName: string; baseUnitCost: number; baseBarcordFee: number; baseBoxFee: number } | null>(null);
  const [bundleMultiplier, setBundleMultiplier] = useState(2);
  const [costHistory, setCostHistory] = useState<{ open: boolean; productName: string; multiplier: number; items: { created_at: string; average_unit_cost: number }[]; currentAvg: number } | null>(null);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    const supabase = createClient();
    const storeId = currentStore.id;
    const [{ data: avgData }, { data: productsData }, { data: salesData }, mappingRes, coupangNamesRes] = await Promise.all([
      supabase.from("product_averages").select("*").eq("store_id", storeId),
      supabase.from("products").select("id, name").eq("store_id", storeId).order("created_at", { ascending: true }),
      supabase.from("product_sales").select("*").eq("store_id", storeId),
      fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
      supabase.from("daily_sales_items").select("product_name").eq("store_id", storeId).limit(10000),
    ]);

    const uniqueCoupangNames = [...new Set(((coupangNamesRes as { data: { product_name: string }[] }).data || []).map((r: { product_name: string }) => r.product_name))];
    setCoupangNames(uniqueCoupangNames);

    const mappingMap: Record<string, string[]> = {};
    ((mappingRes as { data: { coupang_product_name: string; product_sale_name: string }[] }).data || []).forEach((m) => {
      if (!mappingMap[m.product_sale_name]) mappingMap[m.product_sale_name] = [];
      mappingMap[m.product_sale_name].push(m.coupang_product_name);
    });
    setMappings(mappingMap);

    const productIdMap: Record<string, string> = {};
    productsData?.forEach((p: { id: string; name: string }) => {
      if (!productIdMap[p.name]) productIdMap[p.name] = p.id;
    });

    const avgMap: Record<string, number> = {};
    avgData?.forEach((a: { name: string; average_unit_cost: number }) => {
      avgMap[a.name] = a.average_unit_cost;
    });

    type SalesRow = {
      name: string;
      category: string;
      selling_price: number;
      market_commission: number;
      unit_cost: number;
      warehouse_fee: number;
      shipping_fee: number;
      barcode_fee: number;
      box_fee: number;
      other_fee: number;
      profit: number;
      memo: string;
      base_name: string | null;
      multiplier: number;
    };

    const savedSales: Record<string, SalesRow> = {};
    (salesData as SalesRow[] || []).forEach((s) => {
      savedSales[s.name] = s;
    });

    const list: ProductSale[] = [];

    // 1개 상품 (products 테이블 기반)
    const baseNames = new Set<string>();
    Object.keys(productIdMap).forEach((name) => {
      baseNames.add(name);
      const saved = savedSales[name];
      if (saved) {
        const sale: ProductSale = {
          name,
          productId: productIdMap[name],
          category: saved.category,
          selling_price: saved.selling_price,
          supply_price: calcSupplyPrice(saved.selling_price),
          market_commission: saved.market_commission,
          unit_cost: saved.unit_cost,
          warehouse_fee: saved.warehouse_fee,
          shipping_fee: saved.shipping_fee,
          barcode_fee: saved.barcode_fee ?? 150,
          box_fee: saved.box_fee ?? 100,
          other_fee: saved.other_fee ?? 0,
          profit: 0,
          margin_rate: 0,
          memo: saved.memo ?? "",
          base_name: saved.base_name ?? name,
          multiplier: saved.multiplier ?? 1,
        };
        sale.profit = calcProfit(sale);
        sale.margin_rate = sale.selling_price > 0 ? Math.round((sale.profit / sale.selling_price) * 1000) / 10 : 0;
        list.push(sale);
      } else {
        list.push({
          name,
          productId: productIdMap[name],
          category: "",
          selling_price: 0,
          supply_price: 0,
          market_commission: 0,
          unit_cost: avgMap[name] || 0,
          warehouse_fee: 0,
          shipping_fee: 0,
          barcode_fee: 150,
          box_fee: 100,
          other_fee: 0,
          profit: 0,
          margin_rate: 0,
          memo: "",
          base_name: name,
          multiplier: 1,
        });
      }

      // 배수 상품 (base_name이 이 상품인 것들)
      Object.values(savedSales)
        .filter((s) => s.base_name === name && s.multiplier > 1)
        .sort((a, b) => a.multiplier - b.multiplier)
        .forEach((s) => {
          const sale: ProductSale = {
            name: s.name,
            productId: "",
            category: s.category,
            selling_price: s.selling_price,
            supply_price: calcSupplyPrice(s.selling_price),
            market_commission: s.market_commission,
            unit_cost: s.unit_cost,
            warehouse_fee: s.warehouse_fee,
            shipping_fee: s.shipping_fee,
            barcode_fee: s.barcode_fee ?? 150,
            box_fee: s.box_fee ?? 100,
            other_fee: s.other_fee ?? 0,
            profit: 0,
            margin_rate: 0,
            memo: s.memo ?? "",
            base_name: s.base_name,
            multiplier: s.multiplier,
          };
          sale.profit = calcProfit(sale);
          sale.margin_rate = sale.selling_price > 0 ? Math.round((sale.profit / sale.selling_price) * 1000) / 10 : 0;
          list.push(sale);
        });
    });

    setSales(list);
    setMemoValues(Object.fromEntries(list.map((s) => [s.name, s.memo])));
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [currentStore]);

  const handleMemoSave = async (productName: string) => {
    if (!currentStore) return;
    const memo = memoValues[productName] ?? "";
    setSales((prev) => prev.map((s) => s.name === productName ? { ...s, memo } : s));
    const supabase = createClient();
    await supabase.from("product_sales").upsert({
      name: productName,
      store_id: currentStore.id,
      memo,
      updated_at: new Date().toISOString(),
    });
  };

  const handleEditOpen = (productName: string, field: keyof ProductSale, label: string) => {
    const sale = sales.find((s) => s.name === productName);
    if (!sale) return;
    setEditDialog({
      open: true,
      field,
      label,
      value: String(sale[field] || ""),
      productName,
    });
  };

  const handleEditSave = async () => {
    if (!editDialog || !currentStore) return;

    const { productName, field, value } = editDialog;

    setSales((prev) =>
      prev.map((sale) => {
        if (sale.name !== productName) return sale;
        const updated = { ...sale };
        if (field === "category") {
          (updated[field] as string) = value;
        } else {
          (updated[field] as number) = parseFloat(value) || 0;
        }
        updated.supply_price = calcSupplyPrice(updated.selling_price);
        updated.profit = calcProfit(updated);
        updated.margin_rate = updated.selling_price > 0 ? Math.round((updated.profit / updated.selling_price) * 1000) / 10 : 0;
        return updated;
      })
    );

    setEditDialog(null);

    const sale = sales.find((s) => s.name === productName);
    if (!sale) return;

    const updated = { ...sale };
    if (field === "category") {
      (updated[field] as string) = value;
    } else {
      (updated[field] as number) = parseFloat(value) || 0;
    }
    updated.supply_price = calcSupplyPrice(updated.selling_price);
    updated.profit = calcProfit(updated);

    const supabase = createClient();
    await supabase.from("product_sales").upsert({
      name: productName,
      store_id: currentStore.id,
      category: updated.category,
      selling_price: updated.selling_price,
      market_commission: updated.market_commission,
      unit_cost: updated.unit_cost,
      warehouse_fee: updated.warehouse_fee,
      shipping_fee: updated.shipping_fee,
      barcode_fee: updated.barcode_fee,
      box_fee: updated.box_fee,
      other_fee: updated.other_fee,
      memo: updated.memo,
      profit: updated.profit,
      base_name: updated.base_name,
      multiplier: updated.multiplier,
      updated_at: new Date().toISOString(),
    });
  };

  const handleMappingOpen = (productName: string) => {
    setSelectedMappings(mappings[productName] || []);
    setMappingDialog({ open: true, productName });
  };

  const handleAddMapping = (coupangName: string) => {
    if (selectedMappings.includes(coupangName)) return;
    setSelectedMappings((prev) => [...prev, coupangName]);
  };

  const handleRemoveMapping = (coupangName: string) => {
    setSelectedMappings((prev) => prev.filter((n) => n !== coupangName));
  };

  const handleMappingSave = async () => {
    if (!mappingDialog || !currentStore) return;
    const { productName } = mappingDialog;
    const storeId = currentStore.id;

    const res = await fetch(`/api/product-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        productSaleName: productName,
        mappingItems: selectedMappings.map((name) => ({
          coupangProductName: name,
        })),
      }),
    });

    if (!res.ok) return;

    setMappings((prev) => ({ ...prev, [productName]: selectedMappings }));
    setMappingDialog(null);
  };

  const handleBundleAdd = async () => {
    if (!bundleDialog || !currentStore) return;
    const { baseName, baseUnitCost, baseBarcordFee, baseBoxFee } = bundleDialog;
    const bundleName = `${baseName} (x${bundleMultiplier})`;
    const storeId = currentStore.id;

    const supabase = createClient();
    const { error } = await supabase.from("product_sales").upsert({
      name: bundleName,
      store_id: storeId,
      base_name: baseName,
      multiplier: bundleMultiplier,
      category: "",
      selling_price: 0,
      market_commission: 0,
      unit_cost: baseUnitCost * bundleMultiplier,
      warehouse_fee: 0,
      shipping_fee: 0,
      barcode_fee: baseBarcordFee * bundleMultiplier,
      box_fee: baseBoxFee,
      other_fee: 0,
      memo: "",
      profit: 0,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(`추가 실패: ${error.message}`);
      return;
    }

    setBundleDialog(null);
    setBundleMultiplier(2);
    fetchData();
  };

  const handleBundleDelete = async (bundleName: string) => {
    if (!currentStore) return;
    if (!confirm(`"${bundleName}" 상품을 삭제하시겠습니까?`)) return;

    const supabase = createClient();
    await supabase.from("product_sales").delete().eq("name", bundleName).eq("store_id", currentStore.id);

    // 매핑도 삭제
    await fetch(`/api/product-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: currentStore.id,
        productSaleName: bundleName,
        mappingItems: [],
      }),
    });

    fetchData();
  };

  const handleCostHistoryOpen = async (sale: ProductSale) => {
    if (!currentStore) return;
    const baseName = sale.base_name || sale.name;
    const supabase = createClient();
    const [{ data: historyData }, { data: avgData }] = await Promise.all([
      supabase
        .from("product_cost_history")
        .select("created_at, average_unit_cost")
        .eq("name", baseName)
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_averages")
        .select("average_unit_cost")
        .eq("name", baseName)
        .eq("store_id", currentStore.id)
        .single(),
    ]);

    setCostHistory({
      open: true,
      productName: sale.name,
      multiplier: sale.multiplier,
      items: (historyData || []).map((d: { created_at: string; average_unit_cost: number }) => d),
      currentAvg: Number(avgData?.average_unit_cost ?? 0),
    });
  };


  if (storeLoading || loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (sales.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Typography color="text.secondary">등록된 상품이 없습니다.</Typography>
          <Typography variant="body2" color="text.secondary">
            매입가 관리에서 상품을 먼저 등록해주세요.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 3, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap", color: "#adb5bd", borderBottom: "1px solid #f1f3f5", width: 70 }}>
                  관리
                </TableCell>
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
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap", color: "#adb5bd", borderBottom: "1px solid #f1f3f5" }}>
                  메모
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.map((sale) => {
                const isBundle = sale.multiplier > 1;
                return (
                  <TableRow key={sale.name} sx={{ "&:hover": { backgroundColor: "#f8f9fa" }, backgroundColor: isBundle ? "#fafbfc" : "transparent" }}>
                    <TableCell sx={{ textAlign: "center", borderBottom: "1px solid #f1f3f5" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                        <IconButton size="small" onClick={() => handleMappingOpen(sale.name)} sx={{ p: 0.25 }}>
                          <LinkIcon sx={{ fontSize: 16, color: mappings[sale.name]?.length ? "#343a40" : "#dee2e6" }} />
                        </IconButton>
                        {!isBundle && (
                          <IconButton
                            size="small"
                            onClick={() => setBundleDialog({ open: true, baseName: sale.name, baseUnitCost: sale.unit_cost, baseBarcordFee: sale.barcode_fee, baseBoxFee: sale.box_fee })}
                            sx={{ p: 0.25 }}
                          >
                            <AddCircleOutlineIcon sx={{ fontSize: 16, color: "#adb5bd" }} />
                          </IconButton>
                        )}
                        {isBundle && (
                          <IconButton size="small" onClick={() => handleBundleDelete(sale.name)} sx={{ p: 0.25 }}>
                            <DeleteOutlineIcon sx={{ fontSize: 16, color: "#adb5bd" }} />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    {columns.map((col) => {
                      const raw = sale[col.key];
                      let display: string;
                      if (col.numeric) {
                        display = fmt(raw as number) + (col.suffix || "");
                      } else if (col.key === "name" && isBundle) {
                        display = `  ↳ ${raw as string}`;
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
                            color: isBundle && col.key === "name" ? "#868e96" : "#1a1a1b",
                            fontWeight: col.highlight ? 700 : 400,
                            borderBottom: "1px solid #f1f3f5",
                            backgroundColor: col.highlight ? "#f8f9fa" : "transparent",
                          }}
                        >
                          <Box
                          sx={{
                            display: "flex", alignItems: "center", gap: 0.5, justifyContent: col.numeric ? "flex-end" : "flex-start",
                            ...(col.key === "unit_cost" ? { cursor: "pointer", "&:hover": { color: "#228be6" } } : {}),
                          }}
                          onClick={col.key === "unit_cost" ? () => handleCostHistoryOpen(sale) : undefined}
                        >
                            {col.editable && (
                              <IconButton
                                size="small"
                                onClick={() => handleEditOpen(sale.name, col.key, col.label)}
                                sx={{ p: 0.25 }}
                              >
                                <EditIcon sx={{ fontSize: 14, color: "#adb5bd" }} />
                              </IconButton>
                            )}
                            {display}
                          </Box>
                        </TableCell>
                      );
                    })}
                    <TableCell sx={{ whiteSpace: "nowrap", borderBottom: "1px solid #f1f3f5" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TextField
                          size="small"
                          value={memoValues[sale.name] ?? ""}
                          onChange={(e) => setMemoValues((prev) => ({ ...prev, [sale.name]: e.target.value }))}
                          placeholder="메모"
                          sx={{ width: 150 }}
                          inputProps={{ style: { fontSize: "0.8rem", padding: "4px 8px" } }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleMemoSave(sale.name)}
                          disabled={memoValues[sale.name] === sale.memo}
                          sx={{ minWidth: 40, fontSize: "0.75rem", py: 0.25, borderColor: "#dee2e6", color: "#495057" }}
                        >
                          저장
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 필드 편집 다이얼로그 */}
      <Dialog
        open={editDialog?.open ?? false}
        onClose={() => setEditDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "1rem" }}>{editDialog?.label} 수정</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            value={editDialog?.value ?? ""}
            onChange={(e) =>
              setEditDialog((prev) => (prev ? { ...prev, value: e.target.value } : null))
            }
            type={editDialog?.field === "category" ? "text" : "number"}
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)} size="small">
            취소
          </Button>
          <Button onClick={handleEditSave} variant="contained" size="small">
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 매핑 다이얼로그 */}
      <Dialog
        open={mappingDialog?.open ?? false}
        onClose={() => setMappingDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "1rem" }}>
          쿠팡 상품명 매핑 — {mappingDialog?.productName}
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            options={coupangNames.filter((n) => !selectedMappings.includes(n))}
            onChange={(_, value) => { if (value) handleAddMapping(value); }}
            value={null}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="쿠팡 상품명 검색하여 추가" />
            )}
            sx={{ mt: 1, mb: 2 }}
          />
          {selectedMappings.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>쿠팡 상품명</TableCell>
                  <TableCell sx={{ width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedMappings.map((name) => (
                  <TableRow key={name}>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{name}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleRemoveMapping(name)} sx={{ p: 0.25 }}>
                        <Typography sx={{ fontSize: "0.8rem", color: "error.main" }}>✕</Typography>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingDialog(null)} size="small">취소</Button>
          <Button onClick={handleMappingSave} variant="contained" size="small">저장</Button>
        </DialogActions>
      </Dialog>

      {/* 배수 상품 추가 다이얼로그 */}
      <Dialog
        open={bundleDialog?.open ?? false}
        onClose={() => setBundleDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "1rem" }}>
          배수 상품 추가 — {bundleDialog?.baseName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: "#495057" }}>묶음 수량</Typography>
              <Select
                size="small"
                value={bundleMultiplier}
                onChange={(e) => setBundleMultiplier(e.target.value as number)}
                fullWidth
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <MenuItem key={n} value={n}>{n}개 묶음</MenuItem>
                ))}
              </Select>
            </Box>
            <Typography variant="body2" color="text.secondary">
              상품명: {bundleDialog?.baseName} (x{bundleMultiplier})<br />
              원가: {fmt((bundleDialog?.baseUnitCost ?? 0) * bundleMultiplier)}원 (자동 계산)<br />
              판매가, 수수료, 입출고요금, 배송비는 추가 후 직접 입력해주세요.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBundleDialog(null)} size="small">취소</Button>
          <Button onClick={handleBundleAdd} variant="contained" size="small">추가</Button>
        </DialogActions>
      </Dialog>
      {/* 평균 원가 변동 히스토리 다이얼로그 */}
      <Dialog
        open={costHistory?.open ?? false}
        onClose={() => setCostHistory(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "1rem" }}>
          평균 원가 변동 — {costHistory?.productName}
        </DialogTitle>
        <DialogContent>
          {costHistory?.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              원가 변동 이력이 없습니다.
            </Typography>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>변경일</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem" }}>평균 원가</TableCell>
                    {(costHistory?.multiplier ?? 1) > 1 && (
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem" }}>x{costHistory?.multiplier} 원가</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {costHistory?.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: "0.8rem" }}>{new Date(item.created_at).toLocaleDateString("ko-KR")}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{fmt(Number(item.average_unit_cost))}원</TableCell>
                      {(costHistory?.multiplier ?? 1) > 1 && (
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{fmt(Number(item.average_unit_cost) * (costHistory?.multiplier ?? 1))}원</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ mt: 2, p: 1.5, backgroundColor: "#f8f9fa", borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  현재 평균 원가: {fmt(costHistory?.currentAvg ?? 0)}원
                  {(costHistory?.multiplier ?? 1) > 1 && (
                    <> (x{costHistory?.multiplier} = {fmt((costHistory?.currentAvg ?? 0) * (costHistory?.multiplier ?? 1))}원)</>
                  )}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCostHistory(null)} size="small">닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
