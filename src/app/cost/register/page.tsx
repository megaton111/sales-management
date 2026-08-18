"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { createClient } from "@/lib/supabase-browser";
import { generateProductId } from "@/utils/generateId";
import { useStore } from "@/contexts/StoreContext";

type FormData = {
  name: string;
  country: "US" | "CN";
  exchangeRate: string;
  quantity: string;
  unitPriceForeign: string;
  purchaseFeeForeign: string;
  localShippingForeign: string;
  firstPaymentDate: string;
  inspectionFee: string;
  customsClearanceFee: string;
  secondPaymentDate: string;
  internationalShipping: string;
  originCertificateFee: string;
  customsDuty: string;
  vat: string;
  customsBrokerFee: string;
  domesticShipping: string;
  thirdPaymentDate: string;
};

type OptionRow = {
  size: string;
  quantity: string;
  unitPriceForeign: string;
};

const INITIAL_OPTIONS: OptionRow[] = [
  { size: "", quantity: "", unitPriceForeign: "" },
  { size: "", quantity: "", unitPriceForeign: "" },
];

const initialForm: FormData = {
  name: "",
  country: "CN",
  exchangeRate: "",
  quantity: "",
  unitPriceForeign: "",
  purchaseFeeForeign: "",
  localShippingForeign: "",
  firstPaymentDate: "",
  inspectionFee: "",
  customsClearanceFee: "",
  secondPaymentDate: "",
  internationalShipping: "",
  originCertificateFee: "",
  customsDuty: "",
  vat: "",
  customsBrokerFee: "",
  domesticShipping: "",
  thirdPaymentDate: "",
};

function num(v: string) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmt(v: number) {
  return v.toLocaleString("ko-KR");
}

function str(v: number | null | undefined) {
  if (v == null || v === 0) return "";
  return String(v);
}

export default function CostRegisterPage() {
  return (
    <Suspense>
      <CostRegisterForm />
    </Suspense>
  );
}

function CostRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentStore } = useStore();
  const editId = searchParams.get("id") || "";
  const prefillName = searchParams.get("name") || "";
  const isEdit = !!editId;

  const [form, setForm] = useState<FormData>({ ...initialForm, name: prefillName });
  const [hasOptions, setHasOptions] = useState(false);
  const [options, setOptions] = useState<OptionRow[]>(INITIAL_OPTIONS.map((o) => ({ ...o })));
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    if (!isEdit) return;
    const fetchProduct = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("products").select("*").eq("id", editId).single();
      if (error || !data) {
        setSnackbar({ open: true, message: "데이터를 불러오지 못했습니다.", severity: "error" });
        setLoadingEdit(false);
        return;
      }
      setForm({
        name: data.name,
        country: data.country as "US" | "CN",
        exchangeRate: str(data.exchange_rate),
        quantity: str(data.quantity),
        unitPriceForeign: str(data.unit_price_foreign),
        purchaseFeeForeign: str(data.purchase_fee_foreign),
        localShippingForeign: str(data.local_shipping_foreign),
        firstPaymentDate: data.first_payment_date || "",
        inspectionFee: str(data.inspection_fee),
        customsClearanceFee: str(data.customs_clearance_fee),
        secondPaymentDate: data.second_payment_date || "",
        internationalShipping: str(data.international_shipping),
        originCertificateFee: str(data.origin_certificate_fee),
        customsDuty: str(data.customs_duty),
        vat: str(data.vat),
        customsBrokerFee: str(data.customs_broker_fee),
        domesticShipping: str(data.domestic_shipping),
        thirdPaymentDate: data.third_payment_date || "",
      });

      if (data.has_options) {
        setHasOptions(true);
        const { data: optData } = await supabase.from("product_options").select("*").eq("product_id", editId);
        if (optData && optData.length > 0) {
          setOptions(optData.map((o: { size: string; quantity: number; unit_price_foreign: number }) => ({
            size: o.size,
            quantity: String(o.quantity),
            unitPriceForeign: String(o.unit_price_foreign),
          })));
        }
      }

      setLoadingEdit(false);
    };
    fetchProduct();
  }, [editId, isEdit]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const setOption = (index: number, field: "size" | "quantity" | "unitPriceForeign") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: e.target.value } : o)));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { size: "", quantity: "", unitPriceForeign: "" }]);
  };

  const currency = form.country === "US" ? "USD" : "CNY";

  const calc = useMemo(() => {
    const exchangeRate = num(form.exchangeRate);
    const purchaseFeeForeign = num(form.purchaseFeeForeign);
    const purchaseFeeKrw = Math.round(purchaseFeeForeign * exchangeRate);
    const localShippingForeign = num(form.localShippingForeign);
    const localShippingKrw = Math.round(localShippingForeign * exchangeRate);
    const inspectionFee = num(form.inspectionFee);
    const customsClearanceFee = num(form.customsClearanceFee);
    const secondPayment = inspectionFee + customsClearanceFee;
    const internationalShipping = num(form.internationalShipping);
    const originCertificateFee = num(form.originCertificateFee);
    const customsDuty = num(form.customsDuty);
    const vat = num(form.vat);
    const customsBrokerFee = num(form.customsBrokerFee);
    const domesticShipping = num(form.domesticShipping);
    const thirdPayment = internationalShipping + originCertificateFee + customsDuty + vat + customsBrokerFee + domesticShipping;

    if (hasOptions) {
      const totalQuantity = options.reduce((s, o) => s + num(o.quantity), 0);
      const totalProductPrice = options.reduce((s, o) => s + Math.round(num(o.unitPriceForeign) * exchangeRate) * num(o.quantity), 0);
      const unitPriceKrw = totalQuantity > 0 ? Math.round(totalProductPrice / totalQuantity) : 0;
      const firstPayment = totalProductPrice + purchaseFeeKrw + localShippingKrw;
      const sharedCosts = purchaseFeeKrw + localShippingKrw + secondPayment + thirdPayment;
      const sharedCostPerUnit = totalQuantity > 0 ? Math.round(sharedCosts / totalQuantity) : 0;
      const totalCost = totalProductPrice + sharedCosts;
      const unitCost = totalQuantity > 0 ? Math.round(totalCost / totalQuantity) : 0;

      const optionCalcs = options.map((o) => {
        const optQty = num(o.quantity);
        const optUnitPriceKrw = Math.round(num(o.unitPriceForeign) * exchangeRate);
        const optUnitCost = optUnitPriceKrw + sharedCostPerUnit;
        const optTotalCost = optUnitCost * optQty;
        return { ...o, unitPriceKrw: optUnitPriceKrw, unitCost: optUnitCost, totalCost: optTotalCost };
      });

      return { unitPriceKrw, totalProductPrice, purchaseFeeKrw, localShippingKrw, firstPayment, secondPayment, thirdPayment, totalCost, unitCost, totalQuantity, sharedCostPerUnit, optionCalcs };
    } else {
      const quantity = num(form.quantity);
      const unitPriceKrw = Math.round(num(form.unitPriceForeign) * exchangeRate);
      const totalProductPrice = unitPriceKrw * quantity;
      const firstPayment = totalProductPrice + purchaseFeeKrw + localShippingKrw;
      const totalCost = firstPayment + secondPayment + thirdPayment;
      const unitCost = quantity > 0 ? Math.round(totalCost / quantity) : 0;

      return { unitPriceKrw, totalProductPrice, purchaseFeeKrw, localShippingKrw, firstPayment, secondPayment, thirdPayment, totalCost, unitCost, totalQuantity: quantity, sharedCostPerUnit: 0, optionCalcs: [] };
    }
  }, [form, hasOptions, options]);

  const handleSave = async () => {
    if (!currentStore) {
      setSnackbar({ open: true, message: "스토어를 먼저 선택해주세요.", severity: "error" });
      return;
    }

    if (hasOptions) {
      const activeOptions = options.filter((o) => num(o.quantity) > 0 && num(o.unitPriceForeign) > 0);
      if (!form.name || !form.exchangeRate || activeOptions.length === 0) {
        setSnackbar({ open: true, message: "상품명, 환율, 최소 1개 이상의 옵션(수량+단가)을 입력해주세요.", severity: "error" });
        return;
      }
    } else {
      if (!form.name || !form.exchangeRate || !form.quantity || !form.unitPriceForeign) {
        setSnackbar({ open: true, message: "상품명, 환율, 수량, 상품가를 입력해주세요.", severity: "error" });
        return;
      }
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const storeId = currentStore.id;

      const payload = {
        store_id: storeId,
        name: form.name,
        country: form.country,
        exchange_rate: num(form.exchangeRate),
        has_options: hasOptions,
        quantity: calc.totalQuantity,
        unit_price_foreign: hasOptions ? 0 : num(form.unitPriceForeign),
        unit_price_krw: calc.unitPriceKrw,
        total_product_price: calc.totalProductPrice,
        purchase_fee_foreign: num(form.purchaseFeeForeign),
        purchase_fee: calc.purchaseFeeKrw,
        local_shipping_foreign: num(form.localShippingForeign),
        local_shipping: calc.localShippingKrw,
        first_payment: calc.firstPayment,
        first_payment_date: form.firstPaymentDate || null,
        inspection_fee: num(form.inspectionFee),
        customs_clearance_fee: num(form.customsClearanceFee),
        second_payment: calc.secondPayment,
        second_payment_date: form.secondPaymentDate || null,
        international_shipping: num(form.internationalShipping),
        origin_certificate_fee: num(form.originCertificateFee),
        customs_duty: num(form.customsDuty),
        vat: num(form.vat),
        customs_broker_fee: num(form.customsBrokerFee),
        domestic_shipping: num(form.domesticShipping),
        third_payment: calc.thirdPayment,
        third_payment_date: form.thirdPaymentDate || null,
        total_cost: calc.totalCost,
        unit_cost: calc.unitCost,
      };

      let savedId = editId;

      if (isEdit) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
        if (hasOptions) {
          await supabase.from("product_options").delete().eq("product_id", editId);
        }
      } else {
        savedId = generateProductId();
        const { error } = await supabase.from("products").insert({ id: savedId, ...payload });
        if (error) throw error;
      }

      if (hasOptions) {
        const optionRows = calc.optionCalcs
          .filter((o) => num(o.quantity) > 0 && num(o.unitPriceForeign) > 0)
          .map((o) => ({
            product_id: savedId,
            size: o.size,
            quantity: num(o.quantity),
            unit_price_foreign: num(o.unitPriceForeign),
            unit_price_krw: o.unitPriceKrw,
            unit_cost: o.unitCost,
            total_cost: o.totalCost,
          }));
        const { error } = await supabase.from("product_options").insert(optionRows);
        if (error) throw error;
      }

      const { data: allEntries } = await supabase
        .from("products")
        .select("unit_cost")
        .eq("name", form.name)
        .eq("store_id", storeId);
      const costs = allEntries?.map((e) => e.unit_cost) || [];
      const avgCost = Math.round(costs.reduce((a: number, b: number) => a + b, 0) / costs.length);

      await supabase.from("product_averages").upsert({
        name: form.name,
        store_id: storeId,
        average_unit_cost: avgCost,
        updated_at: new Date().toISOString(),
      });

      await supabase.from("product_cost_history").insert({
        name: form.name,
        store_id: storeId,
        average_unit_cost: avgCost,
      });

      const { data: saleRow } = await supabase
        .from("product_sales")
        .select("selling_price, market_commission, warehouse_fee, shipping_fee, barcode_fee, box_fee")
        .eq("name", form.name)
        .eq("store_id", storeId)
        .single();

      if (saleRow) {
        const profit = saleRow.selling_price - saleRow.market_commission - avgCost - saleRow.warehouse_fee - saleRow.shipping_fee - saleRow.barcode_fee - saleRow.box_fee;
        await supabase.from("product_sales").update({
          unit_cost: avgCost,
          profit,
          updated_at: new Date().toISOString(),
        }).eq("name", form.name).eq("store_id", storeId);
      }

      const { data: bundleSales } = await supabase
        .from("product_sales")
        .select("name, multiplier, selling_price, market_commission, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee")
        .eq("base_name", form.name)
        .eq("store_id", storeId)
        .gt("multiplier", 1);

      for (const bs of bundleSales || []) {
        const bundleUnitCost = avgCost * bs.multiplier;
        const supplyPrice = Math.round(bs.selling_price / 1.1);
        const bundleProfit = supplyPrice - bs.market_commission - bundleUnitCost - bs.warehouse_fee - bs.shipping_fee - bs.barcode_fee - bs.box_fee - (bs.other_fee || 0);
        await supabase.from("product_sales").update({
          unit_cost: bundleUnitCost,
          profit: bundleProfit,
          updated_at: new Date().toISOString(),
        }).eq("name", bs.name).eq("store_id", storeId);
      }

      const { data: channelVariants } = await supabase
        .from("product_sales")
        .select("name, selling_price, market_commission, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee")
        .eq("base_name", form.name)
        .eq("store_id", storeId)
        .eq("multiplier", 1)
        .neq("name", form.name)
        .is("option_size", null);

      for (const cv of channelVariants || []) {
        const supplyPrice = Math.round(cv.selling_price / 1.1);
        const cvProfit = supplyPrice - cv.market_commission - avgCost - cv.warehouse_fee - cv.shipping_fee - cv.barcode_fee - cv.box_fee - (cv.other_fee || 0);
        await supabase.from("product_sales").update({
          unit_cost: avgCost,
          profit: cvProfit,
          updated_at: new Date().toISOString(),
        }).eq("name", cv.name).eq("store_id", storeId);
      }

      // 옵션 변형 원가 연쇄 업데이트
      if (hasOptions) {
        const { data: allProductIds } = await supabase
          .from("products")
          .select("id")
          .eq("name", form.name)
          .eq("store_id", storeId);

        const productIds = (allProductIds || []).map((p: { id: string }) => p.id);
        if (productIds.length > 0) {
          const { data: allOptData } = await supabase
            .from("product_options")
            .select("size, unit_cost")
            .in("product_id", productIds);

          const sizeCosts: Record<string, number[]> = {};
          (allOptData || []).forEach((o: { size: string; unit_cost: number }) => {
            if (!sizeCosts[o.size]) sizeCosts[o.size] = [];
            sizeCosts[o.size].push(o.unit_cost);
          });

          for (const [size, costs] of Object.entries(sizeCosts)) {
            const optAvgCost = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length);
            const { data: optVariants } = await supabase
              .from("product_sales")
              .select("name, selling_price, market_commission, warehouse_fee, shipping_fee, barcode_fee, box_fee, other_fee")
              .eq("base_name", form.name)
              .eq("store_id", storeId)
              .eq("option_size", size);

            for (const v of optVariants || []) {
              const supplyPrice = Math.round(v.selling_price / 1.1);
              const vProfit = supplyPrice - v.market_commission - optAvgCost - v.warehouse_fee - v.shipping_fee - v.barcode_fee - v.box_fee - (v.other_fee || 0);
              await supabase.from("product_sales").update({
                unit_cost: optAvgCost,
                profit: vProfit,
                updated_at: new Date().toISOString(),
              }).eq("name", v.name).eq("store_id", storeId);
            }
          }
        }
      }

      setSnackbar({ open: true, message: isEdit ? "수정 완료" : "저장 완료", severity: "success" });
      setTimeout(() => router.push("/cost"), 1000);
    } catch (err) {
      setSnackbar({ open: true, message: `저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h5">{isEdit ? "매입 수정" : "상품 등록"}</Typography>
          <Button variant="outlined" size="small" onClick={() => router.push("/cost")}>
            목록으로
          </Button>
        </Box>

        <Grid container spacing={2}>
          {/* 기본 정보 */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary">
              기본 정보
            </Typography>
          </Grid>
          <Grid size={6}>
            <TextField fullWidth label="상품명" value={form.name} onChange={set("name")} size="small" disabled={isEdit} />
          </Grid>
          <Grid size={3}>
            <TextField fullWidth select label="국가" value={form.country} onChange={set("country")} size="small">
              <MenuItem value="CN">중국</MenuItem>
              <MenuItem value="US">미국</MenuItem>
            </TextField>
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label="환율" value={form.exchangeRate} onChange={set("exchangeRate")} size="small" type="number" />
          </Grid>

          {/* 옵션 토글 */}
          <Grid size={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={hasOptions}
                  onChange={(e) => setHasOptions(e.target.checked)}
                  disabled={isEdit}
                  size="small"
                />
              }
              label={<Typography variant="body2" color="text.secondary">옵션 있음</Typography>}
            />
          </Grid>

          {/* 단일 상품: 수량 + 단가 */}
          {!hasOptions && (
            <>
              <Grid size={3}>
                <TextField fullWidth label="수량" value={form.quantity} onChange={set("quantity")} size="small" type="number" />
              </Grid>
              <Grid size={3}>
                <TextField
                  fullWidth
                  label={`상품가(${currency})`}
                  value={form.unitPriceForeign}
                  onChange={set("unitPriceForeign")}
                  size="small"
                  type="number"
                />
              </Grid>
              <Grid size={3}>
                <TextField fullWidth label="상품가(원화)" value={fmt(calc.unitPriceKrw)} size="small" slotProps={{ input: { readOnly: true } }} />
              </Grid>
              <Grid size={3}>
                <TextField fullWidth label="총 상품가격" value={fmt(calc.totalProductPrice)} size="small" slotProps={{ input: { readOnly: true } }} />
              </Grid>
            </>
          )}

          {/* 옵션 상품: 사이즈별 입력 테이블 */}
          {hasOptions && (
            <Grid size={12}>
              <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f8f9fa" }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#868e96" }}>옵션명</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#868e96" }}>수량</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#868e96" }}>현지단가 ({currency})</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#868e96" }}>원화단가</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#343a40" }}>개당 사입비용</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#343a40" }}>옵션 총원가</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {calc.optionCalcs.map((o, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ width: 120 }}>
                          <TextField
                            value={options[i].size}
                            onChange={setOption(i, "size")}
                            size="small"
                            variant="standard"
                            placeholder="예: XL, 레드"
                            slotProps={{ input: { sx: { fontSize: "0.85rem" } } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>
                          <TextField
                            value={options[i].quantity}
                            onChange={setOption(i, "quantity")}
                            size="small"
                            type="number"
                            variant="standard"
                            slotProps={{ input: { sx: { textAlign: "right", fontSize: "0.85rem" } } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ width: 130 }}>
                          <TextField
                            value={options[i].unitPriceForeign}
                            onChange={setOption(i, "unitPriceForeign")}
                            size="small"
                            type="number"
                            variant="standard"
                            slotProps={{ input: { sx: { textAlign: "right", fontSize: "0.85rem" } } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", color: "#495057" }}>
                          {num(options[i].unitPriceForeign) > 0 ? `${fmt(o.unitPriceKrw)}원` : "-"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#1a1a1b" }}>
                          {num(options[i].quantity) > 0 && num(options[i].unitPriceForeign) > 0 ? `${fmt(o.unitCost)}원` : "-"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#1a1a1b" }}>
                          {num(options[i].quantity) > 0 && num(options[i].unitPriceForeign) > 0 ? `${fmt(o.totalCost)}원` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: "#f8f9fa" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#495057" }}>합계</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem" }}>{fmt(calc.totalQuantity)}개</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#1a1a1b" }}>
                        개당공통비: {fmt(calc.sharedCostPerUnit)}원
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#1a1a1b" }}>
                        {fmt(calc.totalProductPrice)}원
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
              <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-start" }}>
                <Button size="small" variant="text" onClick={addOption} sx={{ color: "#868e96", fontSize: "0.78rem" }}>
                  + 옵션 추가
                </Button>
              </Box>
            </Grid>
          )}

          <Grid size={12}>
            <Divider />
          </Grid>

          {/* 1차 결제 */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary">
              1차 결제
            </Typography>
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label={`구매수수료(${currency})`} value={form.purchaseFeeForeign} onChange={set("purchaseFeeForeign")} size="small" type="number" />
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label="구매수수료(원화)" value={fmt(calc.purchaseFeeKrw)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label={`현지배송비(${currency})`} value={form.localShippingForeign} onChange={set("localShippingForeign")} size="small" type="number" />
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label="현지배송비(원화)" value={fmt(calc.localShippingKrw)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="1차 결제비용" value={fmt(calc.firstPayment)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>
          <Grid size={4}>
            <TextField
              fullWidth
              label="결제일"
              type="date"
              value={form.firstPaymentDate}
              onChange={set("firstPaymentDate")}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={12}>
            <Divider />
          </Grid>

          {/* 2차 결제 */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary">
              2차 결제
            </Typography>
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label="검품 수수료" value={form.inspectionFee} onChange={set("inspectionFee")} size="small" type="number" />
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label="통관료" value={form.customsClearanceFee} onChange={set("customsClearanceFee")} size="small" type="number" />
          </Grid>
          <Grid size={3}>
            <TextField fullWidth label="2차 결제비용" value={fmt(calc.secondPayment)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>
          <Grid size={3}>
            <TextField
              fullWidth
              label="2차 결제일"
              type="date"
              value={form.secondPaymentDate}
              onChange={set("secondPaymentDate")}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={12}>
            <Divider />
          </Grid>

          {/* 3차 결제 */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary">
              3차 결제
            </Typography>
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="국제운반비" value={form.internationalShipping} onChange={set("internationalShipping")} size="small" type="number" />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="원산지발급비용" value={form.originCertificateFee} onChange={set("originCertificateFee")} size="small" type="number" />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="관세" value={form.customsDuty} onChange={set("customsDuty")} size="small" type="number" />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="부가세" value={form.vat} onChange={set("vat")} size="small" type="number" />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="관세사수수료" value={form.customsBrokerFee} onChange={set("customsBrokerFee")} size="small" type="number" />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="한국내 운송료" value={form.domesticShipping} onChange={set("domesticShipping")} size="small" type="number" />
          </Grid>
          <Grid size={4}>
            <TextField fullWidth label="3차 결제비용" value={fmt(calc.thirdPayment)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>
          <Grid size={4}>
            <TextField
              fullWidth
              label="3차 결제일"
              type="date"
              value={form.thirdPaymentDate}
              onChange={set("thirdPaymentDate")}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={12}>
            <Divider />
          </Grid>

          {/* 합계 */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary">
              합계
            </Typography>
          </Grid>
          <Grid size={6}>
            <TextField fullWidth label="총 비용" value={fmt(calc.totalCost)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>
          <Grid size={6}>
            <TextField fullWidth label="평균 사입비용 (개당)" value={fmt(calc.unitCost)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>

          <Grid size={12}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : isEdit ? "수정 완료" : "저장"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
