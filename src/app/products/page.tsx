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
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
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
  profit: number;
  margin_rate: number;
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
  { label: "원가", key: "unit_cost", numeric: true, editable: true, suffix: "원" },
  { label: "입출고요금", key: "warehouse_fee", numeric: true, editable: true, suffix: "원" },
  { label: "배송비", key: "shipping_fee", numeric: true, editable: true, suffix: "원" },
  { label: "바코드 작업비", key: "barcode_fee", numeric: true, suffix: "원" },
  { label: "박스비", key: "box_fee", numeric: true, suffix: "원" },
];

function fmt(v: number) {
  return v.toLocaleString("ko-KR");
}

function calcSupplyPrice(sellingPrice: number): number {
  return Math.round(sellingPrice / 1.1);
}

function calcProfit(sale: ProductSale): number {
  return sale.supply_price - sale.market_commission - sale.unit_cost - sale.warehouse_fee - sale.shipping_fee - sale.barcode_fee - sale.box_fee;
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
  const [mappings, setMappings] = useState<Record<string, { name: string; multiplier: number }[]>>({});
  const [selectedMappings, setSelectedMappings] = useState<{ name: string; multiplier: number }[]>([]);

  useEffect(() => {
    if (!currentStore) return;
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const storeId = currentStore.id;
      const [{ data: avgData }, { data: productsData }, { data: salesData }, mappingRes, coupangNamesRes] = await Promise.all([
        supabase.from("product_averages").select("*").eq("store_id", storeId),
        supabase.from("products").select("id, name").eq("store_id", storeId).order("created_at", { ascending: true }),
        supabase.from("product_sales").select("*").eq("store_id", storeId),
        fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
        supabase.from("daily_sales_items").select("product_name").eq("store_id", storeId),
      ]);

      const uniqueCoupangNames = [...new Set(((coupangNamesRes as { data: { product_name: string }[] }).data || []).map((r: { product_name: string }) => r.product_name))];
      setCoupangNames(uniqueCoupangNames);

      const mappingMap: Record<string, { name: string; multiplier: number }[]> = {};
      ((mappingRes as { data: { coupang_product_name: string; product_sale_name: string; multiplier: number }[] }).data || []).forEach((m) => {
        if (!mappingMap[m.product_sale_name]) mappingMap[m.product_sale_name] = [];
        mappingMap[m.product_sale_name].push({ name: m.coupang_product_name, multiplier: m.multiplier ?? 1 });
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

      const savedSales: Record<string, {
        category: string;
        selling_price: number;
        market_commission: number;
        unit_cost: number;
        warehouse_fee: number;
        shipping_fee: number;
        barcode_fee: number;
        box_fee: number;
        profit: number;
      }> = {};
      salesData?.forEach((s: {
        name: string;
        category: string;
        selling_price: number;
        market_commission: number;
        unit_cost: number;
        warehouse_fee: number;
        shipping_fee: number;
        barcode_fee: number;
        box_fee: number;
        profit: number;
      }) => {
        savedSales[s.name] = s;
      });

      const list: ProductSale[] = Object.keys(productIdMap).map((name) => {
        const saved = savedSales[name];
        if (saved) {
          const sale = {
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
            profit: 0,
            margin_rate: 0,
          };
          sale.profit = calcProfit(sale);
          sale.margin_rate = sale.selling_price > 0 ? Math.round((sale.profit / sale.selling_price) * 1000) / 10 : 0;
          return sale;
        }
        return {
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
          profit: 0,
          margin_rate: 0,
        };
      });

      setSales(list);
      setLoading(false);
    };
    fetchData();
  }, [currentStore]);

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
      profit: updated.profit,
      updated_at: new Date().toISOString(),
    });
  };

  const handleMappingOpen = (productName: string) => {
    setSelectedMappings(mappings[productName] || []);
    setMappingDialog({ open: true, productName });
  };

  const handleAddMapping = (coupangName: string) => {
    if (selectedMappings.some((m) => m.name === coupangName)) return;
    setSelectedMappings((prev) => [...prev, { name: coupangName, multiplier: 1 }]);
  };

  const handleRemoveMapping = (coupangName: string) => {
    setSelectedMappings((prev) => prev.filter((m) => m.name !== coupangName));
  };

  const handleMultiplierChange = (coupangName: string, multiplier: number) => {
    setSelectedMappings((prev) =>
      prev.map((m) => (m.name === coupangName ? { ...m, multiplier } : m))
    );
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
        mappingItems: selectedMappings.map((m) => ({
          coupangProductName: m.name,
          multiplier: m.multiplier,
        })),
      }),
    });

    if (!res.ok) return;

    setMappings((prev) => ({ ...prev, [productName]: selectedMappings }));
    setMappingDialog(null);
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
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", backgroundColor: "grey.100", width: 40 }}>
                매핑
              </TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.numeric ? "right" : "left"}
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    whiteSpace: "nowrap",
                    backgroundColor: col.highlight ? "#e3f2fd" : "grey.100",
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.name} hover>
                <TableCell sx={{ textAlign: "center" }}>
                  <IconButton size="small" onClick={() => handleMappingOpen(sale.name)} sx={{ p: 0.25 }}>
                    <LinkIcon sx={{ fontSize: 16, color: mappings[sale.name]?.length ? "primary.main" : "text.disabled" }} />
                  </IconButton>
                </TableCell>
                {columns.map((col) => {
                  const raw = sale[col.key];
                  let display: string;
                  if (col.numeric) {
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
                        fontWeight: col.highlight ? 700 : 400,
                        backgroundColor: col.highlight ? "#e3f2fd" : "transparent",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: col.numeric ? "flex-end" : "flex-start" }}>
                        {col.editable && (
                          <IconButton
                            size="small"
                            onClick={() => handleEditOpen(sale.name, col.key, col.label)}
                            sx={{ p: 0.25 }}
                          >
                            <EditIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          </IconButton>
                        )}
                        {display}
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
            options={coupangNames.filter((n) => !selectedMappings.some((m) => m.name === n))}
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
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", width: 80 }}>배수</TableCell>
                  <TableCell sx={{ width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedMappings.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{m.name}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={m.multiplier}
                        onChange={(e) => handleMultiplierChange(m.name, parseInt(e.target.value) || 1)}
                        inputProps={{ min: 1, style: { textAlign: "center", padding: "4px" } }}
                        sx={{ width: 60 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleRemoveMapping(m.name)} sx={{ p: 0.25 }}>
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
    </Box>
  );
}
