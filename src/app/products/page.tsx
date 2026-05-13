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
import EditIcon from "@mui/icons-material/Edit";
import { createClient } from "@/lib/supabase-browser";

type ProductSale = {
  store: string;
  name: string;
  productId: string;
  category: string;
  selling_price: number;
  market_commission: number;
  unit_cost: number;
  warehouse_fee: number;
  shipping_fee: number;
  profit: number;
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
  { label: "스토어", key: "store", editable: true },
  { label: "상품명", key: "name" },
  { label: "상품ID", key: "productId" },
  { label: "구분", key: "category", editable: true },
  { label: "실제 판매가", key: "selling_price", numeric: true, editable: true, suffix: "원" },
  { label: "이익금", key: "profit", numeric: true, highlight: true, suffix: "원" },
  { label: "마켓수수료", key: "market_commission", numeric: true, editable: true, suffix: "원" },
  { label: "원가", key: "unit_cost", numeric: true, editable: true, suffix: "원" },
  { label: "입출고요금", key: "warehouse_fee", numeric: true, editable: true, suffix: "원" },
  { label: "배송비", key: "shipping_fee", numeric: true, editable: true, suffix: "원" },
];

function fmt(v: number) {
  return v.toLocaleString("ko-KR");
}

function calcProfit(sale: ProductSale): number {
  return sale.selling_price - sale.market_commission - sale.unit_cost - sale.warehouse_fee - sale.shipping_fee;
}

export default function ProductsPage() {
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    field: keyof ProductSale;
    label: string;
    value: string;
    productName: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [{ data: avgData }, { data: productsData }, { data: salesData }] = await Promise.all([
        supabase.from("product_averages").select("*"),
        supabase.from("products").select("id, name").order("created_at", { ascending: true }),
        supabase.from("product_sales").select("*"),
      ]);

      const productIdMap: Record<string, string> = {};
      productsData?.forEach((p: { id: string; name: string }) => {
        if (!productIdMap[p.name]) productIdMap[p.name] = p.id;
      });

      const avgMap: Record<string, number> = {};
      avgData?.forEach((a: { name: string; average_unit_cost: number }) => {
        avgMap[a.name] = a.average_unit_cost;
      });

      const savedSales: Record<string, {
        store: string;
        category: string;
        selling_price: number;
        market_commission: number;
        unit_cost: number;
        warehouse_fee: number;
        shipping_fee: number;
        profit: number;
      }> = {};
      salesData?.forEach((s: {
        name: string;
        store: string;
        category: string;
        selling_price: number;
        market_commission: number;
        unit_cost: number;
        warehouse_fee: number;
        shipping_fee: number;
        profit: number;
      }) => {
        savedSales[s.name] = s;
      });

      const list: ProductSale[] = Object.keys(productIdMap).map((name) => {
        const saved = savedSales[name];
        if (saved) {
          return {
            store: saved.store,
            name,
            productId: productIdMap[name],
            category: saved.category,
            selling_price: saved.selling_price,
            market_commission: saved.market_commission,
            unit_cost: saved.unit_cost,
            warehouse_fee: saved.warehouse_fee,
            shipping_fee: saved.shipping_fee,
            profit: saved.profit,
          };
        }
        return {
          store: "",
          name,
          productId: productIdMap[name],
          category: "",
          selling_price: 0,
          market_commission: 0,
          unit_cost: avgMap[name] || 0,
          warehouse_fee: 0,
          shipping_fee: 0,
          profit: 0,
        };
      });

      setSales(list);
      setLoading(false);
    };
    fetchData();
  }, []);

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
    if (!editDialog) return;

    const { productName, field, value } = editDialog;

    setSales((prev) =>
      prev.map((sale) => {
        if (sale.name !== productName) return sale;
        const updated = { ...sale };
        if (field === "category" || field === "store") {
          (updated[field] as string) = value;
        } else {
          (updated[field] as number) = parseFloat(value) || 0;
        }
        updated.profit = calcProfit(updated);
        return updated;
      })
    );

    setEditDialog(null);

    const sale = sales.find((s) => s.name === productName);
    if (!sale) return;

    const updated = { ...sale };
    if (field === "category" || field === "store") {
      (updated[field] as string) = value;
    } else {
      (updated[field] as number) = parseFloat(value) || 0;
    }
    updated.profit = calcProfit(updated);

    const supabase = createClient();
    await supabase.from("product_sales").upsert({
      name: productName,
      store: updated.store,
      category: updated.category,
      selling_price: updated.selling_price,
      market_commission: updated.market_commission,
      unit_cost: updated.unit_cost,
      warehouse_fee: updated.warehouse_fee,
      shipping_fee: updated.shipping_fee,
      profit: updated.profit,
      updated_at: new Date().toISOString(),
    });
  };

  if (loading) {
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
            type={editDialog?.field === "category" || editDialog?.field === "store" ? "text" : "number"}
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
    </Box>
  );
}
