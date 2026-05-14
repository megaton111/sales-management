"use client";

import { useState, useMemo, Suspense } from "react";
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
  const prefillName = searchParams.get("name") || "";
  const [form, setForm] = useState<FormData>({ ...initialForm, name: prefillName });
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const currency = form.country === "US" ? "USD" : "CNY";

  const calc = useMemo(() => {
    const exchangeRate = num(form.exchangeRate);
    const quantity = num(form.quantity);
    const unitPriceForeign = num(form.unitPriceForeign);

    const unitPriceKrw = Math.round(unitPriceForeign * exchangeRate);
    const totalProductPrice = unitPriceKrw * quantity;

    const purchaseFeeForeign = num(form.purchaseFeeForeign);
    const purchaseFeeKrw = Math.round(purchaseFeeForeign * exchangeRate);
    const localShippingForeign = num(form.localShippingForeign);
    const localShippingKrw = Math.round(localShippingForeign * exchangeRate);
    const firstPayment = totalProductPrice + purchaseFeeKrw + localShippingKrw;

    const inspectionFee = num(form.inspectionFee);
    const customsClearanceFee = num(form.customsClearanceFee);
    const secondPayment = inspectionFee + customsClearanceFee;

    const internationalShipping = num(form.internationalShipping);
    const originCertificateFee = num(form.originCertificateFee);
    const customsDuty = num(form.customsDuty);
    const vat = num(form.vat);
    const customsBrokerFee = num(form.customsBrokerFee);
    const domesticShipping = num(form.domesticShipping);
    const thirdPayment =
      internationalShipping + originCertificateFee + customsDuty + vat + customsBrokerFee + domesticShipping;

    const totalCost = firstPayment + secondPayment + thirdPayment;
    const unitCost = quantity > 0 ? Math.round(totalCost / quantity) : 0;

    return { unitPriceKrw, totalProductPrice, purchaseFeeKrw, localShippingKrw, firstPayment, secondPayment, thirdPayment, totalCost, unitCost };
  }, [form]);

  const handleSave = async () => {
    if (!currentStore) {
      setSnackbar({ open: true, message: "스토어를 먼저 선택해주세요.", severity: "error" });
      return;
    }
    if (!form.name || !form.exchangeRate || !form.quantity || !form.unitPriceForeign) {
      setSnackbar({ open: true, message: "상품명, 환율, 수량, 상품가를 입력해주세요.", severity: "error" });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const id = generateProductId();
      const storeId = currentStore.id;

      const { error } = await supabase.from("products").insert({
        id,
        store_id: storeId,
        name: form.name,
        country: form.country,
        exchange_rate: num(form.exchangeRate),
        quantity: num(form.quantity),
        unit_price_foreign: num(form.unitPriceForeign),
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
      });

      if (error) throw error;

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

      const { data: saleRow } = await supabase
        .from("product_sales")
        .select("selling_price, market_commission, warehouse_fee, shipping_fee")
        .eq("name", form.name)
        .eq("store_id", storeId)
        .single();

      if (saleRow) {
        const profit = saleRow.selling_price - saleRow.market_commission - avgCost - saleRow.warehouse_fee - saleRow.shipping_fee;
        await supabase.from("product_sales").update({
          unit_cost: avgCost,
          profit,
          updated_at: new Date().toISOString(),
        }).eq("name", form.name).eq("store_id", storeId);
      }

      setSnackbar({ open: true, message: `저장 완료 (ID: ${id})`, severity: "success" });
      setTimeout(() => router.push("/cost"), 1000);
    } catch (err) {
      setSnackbar({ open: true, message: `저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h5">상품 등록</Typography>
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
            <TextField fullWidth label="상품명" value={form.name} onChange={set("name")} size="small" />
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
            <TextField fullWidth label="1개 사입비용" value={fmt(calc.unitCost)} size="small" slotProps={{ input: { readOnly: true } }} />
          </Grid>

          <Grid size={12}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
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
