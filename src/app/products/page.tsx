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
import Skeleton from "@mui/material/Skeleton";
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
  option_size: string | null;
};

// depth: 0=상품명, 1=채널헤더, 2=옵션/단일옵션
// isHeader: true이면 수익 표시 없이 이름만 (채널 헤더)
type RenderItem = ProductSale & {
  depth: number;
  isHeader: boolean;
  displayLabel: string;
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
  { label: "실제 판매가", key: "selling_price", numeric: true, editable: true, suffix: "원" },
  { label: "공급가", key: "supply_price", numeric: true, suffix: "원" },
  { label: "이익금", key: "profit", numeric: true, highlight: true, suffix: "원" },
  { label: "마진율", key: "margin_rate", numeric: true, highlight: true, suffix: "%" },
  { label: "마켓수수료", key: "market_commission", numeric: true, editable: true, suffix: "원" },
  { label: "원가", key: "unit_cost", numeric: true, suffix: "원" },
  { label: "입출고요금", key: "warehouse_fee", numeric: true, editable: true, suffix: "원" },
  { label: "배송비", key: "shipping_fee", numeric: true, editable: true, suffix: "원" },
  { label: "바코드 작업비", key: "barcode_fee", numeric: true, editable: true, suffix: "원" },
  { label: "박스비", key: "box_fee", numeric: true, editable: true, suffix: "원" },
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
  const [sales, setSales] = useState<RenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    field: keyof ProductSale;
    label: string;
    value: string;
    productName: string;
  } | null>(null);
  const [mappingDialog, setMappingDialog] = useState<{ open: boolean; productName: string } | null>(null);
  const [marketNames, setCoupangNames] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [selectedMappings, setSelectedMappings] = useState<string[]>([]);
  const [memoValues, setMemoValues] = useState<Record<string, string>>({});
  const [bundleDialog, setBundleDialog] = useState<{ open: boolean; baseName: string; baseUnitCost: number; baseBarcordFee: number; baseBoxFee: number } | null>(null);
  const [bundleMultiplier, setBundleMultiplier] = useState(2);
  const [channelDialog, setChannelDialog] = useState<{ open: boolean; baseName: string; baseUnitCost: number; baseBarcordFee: number; baseBoxFee: number } | null>(null);
  const [channelType, setChannelType] = useState("판매자배송");
  const [optionDialog, setOptionDialog] = useState<{ open: boolean; parentName: string; baseName: string } | null>(null);
  const [optionInfoMap, setOptionInfoMap] = useState<Record<string, { size: string; avgUnitCost: number }[]>>({});
  const [costHistory, setCostHistory] = useState<{ open: boolean; productName: string; multiplier: number; items: { created_at: string; average_unit_cost: number }[]; currentAvg: number } | null>(null);

  const fetchData = async () => {
    if (!currentStore) return;
    setLoading(true);
    const supabase = createClient();
    const storeId = currentStore.id;
    const [{ data: avgData }, { data: productsData }, { data: salesData }, mappingRes] = await Promise.all([
      supabase.from("product_averages").select("*").eq("store_id", storeId),
      supabase.from("products").select("id, name, has_options").eq("store_id", storeId).order("created_at", { ascending: true }),
      supabase.from("product_sales").select("*").eq("store_id", storeId),
      fetch(`/api/product-mapping?storeId=${storeId}`).then(r => r.json()),
    ]);

    const allProductNames = new Set<string>();
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("daily_sales_items")
        .select("product_name, vendor_item_name")
        .eq("store_id", storeId)
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      data.forEach((r: { product_name: string; vendor_item_name: string }) => {
        allProductNames.add(r.product_name);
        if (r.vendor_item_name) allProductNames.add(r.vendor_item_name);
      });
      if (data.length < pageSize) break;
      from += pageSize;
    }
    setCoupangNames([...allProductNames]);

    const mappingMap: Record<string, string[]> = {};
    ((mappingRes as { data: { coupang_product_name: string; product_sale_name: string }[] }).data || []).forEach((m) => {
      if (!mappingMap[m.product_sale_name]) mappingMap[m.product_sale_name] = [];
      mappingMap[m.product_sale_name].push(m.coupang_product_name);
    });
    setMappings(mappingMap);

    const productIdMap: Record<string, string> = {};
    const optionProductIds: string[] = [];
    const optionProductNameById: Record<string, string> = {};
    productsData?.forEach((p: { id: string; name: string; has_options: boolean }) => {
      if (!productIdMap[p.name]) productIdMap[p.name] = p.id;
      if (p.has_options) {
        optionProductIds.push(p.id);
        optionProductNameById[p.id] = p.name;
      }
    });

    const optInfoMap: Record<string, { size: string; avgUnitCost: number }[]> = {};
    if (optionProductIds.length > 0) {
      const { data: allOptData } = await supabase
        .from("product_options")
        .select("product_id, size, unit_cost")
        .in("product_id", optionProductIds);
      const sizeCosts: Record<string, Record<string, number[]>> = {};
      allOptData?.forEach((o: { product_id: string; size: string; unit_cost: number }) => {
        const pName = optionProductNameById[o.product_id];
        if (!pName) return;
        if (!sizeCosts[pName]) sizeCosts[pName] = {};
        if (!sizeCosts[pName][o.size]) sizeCosts[pName][o.size] = [];
        sizeCosts[pName][o.size].push(o.unit_cost);
      });
      Object.entries(sizeCosts).forEach(([pName, sizes]) => {
        optInfoMap[pName] = Object.entries(sizes).map(([size, costs]) => ({
          size,
          avgUnitCost: Math.round(costs.reduce((a, b) => a + b, 0) / costs.length),
        }));
      });
    }
    setOptionInfoMap(optInfoMap);

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
      option_size: string | null;
    };

    const savedSales: Record<string, SalesRow> = {};
    (salesData as SalesRow[] || []).forEach((s) => {
      savedSales[s.name] = s;
    });

    const buildProductSale = (s: SalesRow, pid: string = ""): ProductSale => {
      const sale: ProductSale = {
        name: s.name,
        productId: pid,
        category: s.category,
        selling_price: s.selling_price,
        supply_price: calcSupplyPrice(s.selling_price),
        market_commission: s.market_commission || Math.round(s.selling_price * 0.12),
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
        option_size: s.option_size ?? null,
      };
      sale.profit = calcProfit(sale);
      sale.margin_rate = sale.selling_price > 0 ? Math.round((sale.profit / sale.selling_price) * 1000) / 10 : 0;
      return sale;
    };

    const emptyProductSale = (name: string, baseName: string, unitCost = 0): ProductSale => ({
      name,
      productId: "",
      category: "",
      selling_price: 0,
      supply_price: 0,
      market_commission: 0,
      unit_cost: unitCost,
      warehouse_fee: 0,
      shipping_fee: 0,
      barcode_fee: 150,
      box_fee: 100,
      other_fee: 0,
      profit: 0,
      margin_rate: 0,
      memo: "",
      base_name: baseName,
      multiplier: 1,
      option_size: null,
    });

    const list: RenderItem[] = [];

    Object.keys(productIdMap).forEach((baseName) => {
      const saved = savedSales[baseName];

      // 채널 변형들 (option_size=null, multiplier=1, name≠baseName)
      const channelVariants = Object.values(savedSales)
        .filter(s => s.base_name === baseName && s.multiplier === 1 && !s.option_size && s.name !== baseName && !productIdMap[s.name])
        .sort((a, b) => a.name.localeCompare(b.name));

      // 채널+옵션 그룹화: "baseName [채널] [옵션]" 패턴에서 채널명 추출
      const channelOptionMap = new Map<string, SalesRow[]>();
      Object.values(savedSales)
        .filter(s => s.base_name === baseName && !!s.option_size && !productIdMap[s.name])
        .forEach(s => {
          const brackets = s.name.match(/\[[^\]]+\]/g) || [];
          if (brackets.length >= 2) {
            const channelName = brackets[brackets.length - 2].slice(1, -1);
            if (!channelOptionMap.has(channelName)) channelOptionMap.set(channelName, []);
            channelOptionMap.get(channelName)!.push(s);
          }
        });

      // 직접 옵션 (채널 없는 옵션: 대괄호 1개)
      const directOptions = Object.values(savedSales)
        .filter(s => s.base_name === baseName && !!s.option_size && !productIdMap[s.name] &&
          (s.name.match(/\[[^\]]+\]/g) || []).length < 2)
        .sort((a, b) => a.name.localeCompare(b.name));

      // 배수 상품 (채널별 그룹화: category 기준)
      const bundlesByChannel = new Map<string, SalesRow[]>();
      const unboundBundles: SalesRow[] = [];
      Object.values(savedSales)
        .filter(s => s.base_name === baseName && s.multiplier > 1 && !productIdMap[s.name])
        .sort((a, b) => a.multiplier - b.multiplier)
        .forEach(s => {
          if (s.category) {
            if (!bundlesByChannel.has(s.category)) bundlesByChannel.set(s.category, []);
            bundlesByChannel.get(s.category)!.push(s);
          } else {
            unboundBundles.push(s);
          }
        });

      const hasChannelStructure = channelVariants.length > 0 || channelOptionMap.size > 0;

      // depth 0: 기본 상품 행
      const baseSale = saved
        ? buildProductSale(saved, productIdMap[baseName])
        : emptyProductSale(baseName, baseName, avgMap[baseName] || 0);
      baseSale.productId = productIdMap[baseName];

      list.push({
        ...baseSale,
        depth: 0,
        isHeader: hasChannelStructure,
        displayLabel: baseName,
      });

      if (hasChannelStructure) {
        // 모든 채널 이름 수집 (실제 채널 행 + 채널+옵션에서 추출)
        const allChannelNames = new Set<string>();
        channelVariants.forEach(cv => {
          const channelName = cv.name.slice(baseName.length + 2, -1); // "baseName [채널]" → "채널"
          allChannelNames.add(channelName);
        });
        channelOptionMap.forEach((_, channelName) => allChannelNames.add(channelName));

        // 채널 순서 정렬
        const sortedChannels = [...allChannelNames].sort((a, b) => {
          const order = ["로켓그로스", "판매자배송", "스마트스토어"];
          const ai = order.indexOf(a);
          const bi = order.indexOf(b);
          if (ai === -1 && bi === -1) return a.localeCompare(b);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

        sortedChannels.forEach(channelName => {
          const channelSaleName = `${baseName} [${channelName}]`;
          const channelSale = savedSales[channelSaleName];
          const options = (channelOptionMap.get(channelName) || [])
            .sort((a, b) => {
              const sizeOrder = ["xs", "s", "m", "l", "xl", "2xl", "3xl"];
              const ai = sizeOrder.indexOf((a.option_size || "").toLowerCase());
              const bi = sizeOrder.indexOf((b.option_size || "").toLowerCase());
              if (ai !== -1 && bi !== -1) return ai - bi;
              return a.name.localeCompare(b.name);
            });

          // depth 1: 채널 헤더 (수익 없이 이름만)
          const channelBase = channelSale
            ? buildProductSale(channelSale)
            : emptyProductSale(channelSaleName, baseName);

          list.push({
            ...channelBase,
            depth: 1,
            isHeader: true,
            displayLabel: channelName,
          });

          // 이 채널에 속한 배수 상품
          const channelBundles = bundlesByChannel.get(channelName) || [];

          if (options.length === 0) {
            // 단일상품 or 1개: 배수 옵션 등록 여부에 따라 구분
            list.push({
              ...channelBase,
              name: channelSale?.name ?? channelSaleName,
              depth: 2,
              isHeader: false,
              displayLabel: channelBundles.length > 0 ? "1개" : "단일상품",
            });
            // 배수들: 2개, 3개, ...
            channelBundles.forEach(bundle => {
              const bundleSale = buildProductSale(bundle);
              list.push({
                ...bundleSale,
                depth: 2,
                isHeader: false,
                displayLabel: `${bundle.multiplier}개`,
              });
            });
          } else {
            // 옵션들: depth 2
            options.forEach(opt => {
              const optSale = buildProductSale(opt);
              list.push({
                ...optSale,
                depth: 2,
                isHeader: false,
                displayLabel: opt.option_size || opt.name,
              });
            });
          }
        });

        // 직접 옵션 (채널 없는) depth 1
        directOptions.forEach(opt => {
          const optSale = buildProductSale(opt);
          list.push({
            ...optSale,
            depth: 1,
            isHeader: false,
            displayLabel: opt.option_size || opt.name,
          });
        });

        // 채널에 연결 안 된 배수 상품 (category 없는 경우) depth 1
        unboundBundles.forEach(bundle => {
          const bundleSale = buildProductSale(bundle);
          list.push({
            ...bundleSale,
            depth: 1,
            isHeader: false,
            displayLabel: `${bundle.multiplier}개`,
          });
        });
      } else {
        // 채널 구조 없는 상품의 배수 (hasChannelStructure=false일 때)
        unboundBundles.forEach(bundle => {
          const bundleSale = buildProductSale(bundle);
          list.push({
            ...bundleSale,
            depth: 1,
            isHeader: false,
            displayLabel: `${bundle.multiplier}개`,
          });
        });
        bundlesByChannel.forEach((chBundles) => {
          chBundles.forEach(bundle => {
            const bundleSale = buildProductSale(bundle);
            list.push({
              ...bundleSale,
              depth: 1,
              isHeader: false,
              displayLabel: `${bundle.multiplier}개`,
            });
          });
        });
      }
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

  const handleDelete = async (itemName: string) => {
    if (!currentStore) return;
    if (!confirm(`"${itemName}" 항목을 삭제하시겠습니까?`)) return;

    const supabase = createClient();
    await supabase.from("product_sales").delete().eq("name", itemName).eq("store_id", currentStore.id);

    await fetch(`/api/product-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: currentStore.id,
        productSaleName: itemName,
        mappingItems: [],
      }),
    });

    fetchData();
  };

  const handleChannelAdd = async () => {
    if (!channelDialog || !currentStore) return;
    const { baseName, baseUnitCost, baseBarcordFee, baseBoxFee } = channelDialog;
    const variantName = `${baseName} [${channelType}]`;
    const storeId = currentStore.id;

    const supabase = createClient();
    const { error } = await supabase.from("product_sales").upsert({
      name: variantName,
      store_id: storeId,
      base_name: baseName,
      multiplier: 1,
      category: channelType,
      selling_price: 0,
      market_commission: 0,
      unit_cost: baseUnitCost,
      warehouse_fee: 0,
      shipping_fee: 0,
      barcode_fee: baseBarcordFee,
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

    setChannelDialog(null);
    setChannelType("판매자배송");
    fetchData();
  };

  const handleOptionAdd = async (parentName: string, baseName: string, optionSize: string, unitCost: number) => {
    if (!currentStore) return;
    const variantName = `${parentName} [${optionSize}]`;
    const storeId = currentStore.id;
    const baseProduct = sales.find((s) => s.name === baseName);

    const supabase = createClient();
    const { error } = await supabase.from("product_sales").upsert({
      name: variantName,
      store_id: storeId,
      base_name: baseName,
      option_size: optionSize,
      multiplier: 1,
      category: "옵션",
      selling_price: 0,
      market_commission: 0,
      unit_cost: unitCost,
      warehouse_fee: 0,
      shipping_fee: 0,
      barcode_fee: baseProduct?.barcode_fee ?? 150,
      box_fee: baseProduct?.box_fee ?? 100,
      other_fee: 0,
      memo: "",
      profit: 0,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(`추가 실패: ${error.message}`);
      return;
    }
    fetchData();
  };

  const handleCostHistoryOpen = async (sale: RenderItem) => {
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

  const getBgColor = (item: RenderItem) => {
    if (item.depth === 0) return "transparent";
    if (item.depth === 1) return item.isHeader ? "#f4f6f8" : "#f8f9fa";
    return "#f0f2f4";
  };

  if (storeLoading || loading) {
    return (
      <Box sx={{ px: 3, py: 3 }}>
        <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.04)", borderRadius: 3, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {Array.from({ length: 15 }).map((_, i) => (
                    <TableCell key={i} sx={{ borderBottom: "1px solid #f1f3f5", py: 1.2 }}>
                      <Skeleton variant="rounded" width={60} height={14} sx={{ borderRadius: 1 }} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 15 }).map((_, j) => (
                      <TableCell key={j} sx={{ borderBottom: "1px solid #f1f3f5", py: 1.5 }}>
                        <Skeleton variant="rounded" width={j === 0 ? 40 : j === 1 ? 120 : 70} height={16} sx={{ borderRadius: 1 }} />
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
              {sales.map((item, idx) => {
                const bgColor = getBgColor(item);

                // 들여쓰기: depth 1 = pl:2, depth 2 = pl:5
                const namePl = item.depth === 2 ? 5 : item.depth === 1 ? 2 : 0;

                // 이름 표시: depth 0은 그대로, 그 외 ↳ 접두어
                let nameDisplay = item.displayLabel;
                if (item.depth > 0) nameDisplay = `↳ ${item.displayLabel}`;

                return (
                  <TableRow key={`${item.name}-${idx}`} sx={{ "&:hover": { backgroundColor: "#f8f9fa" }, backgroundColor: bgColor }}>
                    {/* 관리 버튼 */}
                    <TableCell sx={{ textAlign: "center", borderBottom: "1px solid #f1f3f5" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                        {/* 매핑: isHeader가 아닌 행에서만 */}
                        {!item.isHeader && (
                          <IconButton size="small" onClick={() => handleMappingOpen(item.name)} sx={{ p: 0.25 }}>
                            <LinkIcon sx={{ fontSize: 16, color: mappings[item.name]?.length ? "#343a40" : "#dee2e6" }} />
                          </IconButton>
                        )}

                        {/* depth 0 기본 상품: 채널 추가, 배수 추가 */}
                        {item.depth === 0 && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => setChannelDialog({ open: true, baseName: item.name, baseUnitCost: item.unit_cost, baseBarcordFee: item.barcode_fee, baseBoxFee: item.box_fee })}
                              sx={{ p: 0.25 }}
                              title="채널 추가"
                            >
                              <Typography sx={{ fontSize: 11, color: "#adb5bd", fontWeight: 700, lineHeight: 1 }}>CH</Typography>
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setBundleDialog({ open: true, baseName: item.name, baseUnitCost: item.unit_cost, baseBarcordFee: item.barcode_fee, baseBoxFee: item.box_fee })}
                              sx={{ p: 0.25 }}
                              title="배수 상품 추가"
                            >
                              <AddCircleOutlineIcon sx={{ fontSize: 16, color: "#adb5bd" }} />
                            </IconButton>
                          </>
                        )}

                        {/* depth 1 채널 헤더: 옵션 추가 + 삭제 */}
                        {item.depth === 1 && item.isHeader && (
                          <>
                            {(optionInfoMap[item.base_name!]?.length > 0) && (
                              <IconButton
                                size="small"
                                onClick={() => setOptionDialog({ open: true, parentName: item.name, baseName: item.base_name! })}
                                sx={{ p: 0.25 }}
                                title="옵션 추가"
                              >
                                <Typography sx={{ fontSize: 11, color: "#adb5bd", fontWeight: 700, lineHeight: 1 }}>OPT</Typography>
                              </IconButton>
                            )}
                            <IconButton size="small" onClick={() => handleDelete(item.name)} sx={{ p: 0.25 }} title="삭제">
                              <DeleteOutlineIcon sx={{ fontSize: 16, color: "#adb5bd" }} />
                            </IconButton>
                          </>
                        )}

                        {/* depth 1 배수/직접옵션: 삭제 */}
                        {item.depth === 1 && !item.isHeader && (
                          <IconButton size="small" onClick={() => handleDelete(item.name)} sx={{ p: 0.25 }} title="삭제">
                            <DeleteOutlineIcon sx={{ fontSize: 16, color: "#adb5bd" }} />
                          </IconButton>
                        )}

                        {/* depth 2 옵션: 삭제 */}
                        {item.depth === 2 && (
                          <IconButton size="small" onClick={() => handleDelete(item.name)} sx={{ p: 0.25 }} title="삭제">
                            <DeleteOutlineIcon sx={{ fontSize: 16, color: "#adb5bd" }} />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>

                    {/* 데이터 셀 */}
                    {columns.map((col) => {
                      // 채널 헤더(isHeader=true)이면 상품명만 표시, 나머지 "-"
                      if (item.isHeader && col.key !== "name") {
                        return (
                          <TableCell
                            key={col.key}
                            align={col.numeric ? "right" : "left"}
                            sx={{
                              fontSize: "0.8rem",
                              color: "#adb5bd",
                              borderBottom: "1px solid #f1f3f5",
                              backgroundColor: col.highlight ? "#f4f6f8" : "transparent",
                            }}
                          >
                            —
                          </TableCell>
                        );
                      }

                      const raw = item[col.key];
                      let display: string;
                      if (col.key === "name") {
                        display = nameDisplay;
                      } else if (col.numeric) {
                        display = fmt(raw as number) + (col.suffix || "");
                      } else {
                        display = (raw as string) || "-";
                      }

                      const nameColor =
                        item.depth === 0 ? "#1a1a1b" :
                        item.depth === 1 && item.isHeader ? "#495057" :
                        item.depth === 1 ? "#495057" :
                        "#6c757d";

                      return (
                        <TableCell
                          key={col.key}
                          align={col.numeric ? "right" : "left"}
                          sx={{
                            fontSize: item.depth === 0 ? "0.85rem" : "0.82rem",
                            whiteSpace: "nowrap",
                            color: col.key === "name" ? nameColor : "#1a1a1b",
                            fontWeight: col.highlight ? 700 : item.depth === 0 ? 500 : 400,
                            borderBottom: "1px solid #f1f3f5",
                            backgroundColor: col.highlight ? (item.depth === 0 ? "#f8f9fa" : bgColor) : "transparent",
                            ...(col.key === "name" ? { pl: namePl } : {}),
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex", alignItems: "center", gap: 0.5,
                              justifyContent: col.numeric ? "flex-end" : "flex-start",
                              ...(col.key === "unit_cost" && !item.isHeader ? { cursor: "pointer", "&:hover": { color: "#228be6" } } : {}),
                            }}
                            onClick={col.key === "unit_cost" && !item.isHeader ? () => handleCostHistoryOpen(item) : undefined}
                          >
                            {col.editable && !item.isHeader && (
                              <IconButton
                                size="small"
                                onClick={() => handleEditOpen(item.name, col.key, col.label)}
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

                    {/* 메모 */}
                    <TableCell sx={{ whiteSpace: "nowrap", borderBottom: "1px solid #f1f3f5" }}>
                      {!item.isHeader ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <TextField
                            size="small"
                            value={memoValues[item.name] ?? ""}
                            onChange={(e) => setMemoValues((prev) => ({ ...prev, [item.name]: e.target.value }))}
                            placeholder="메모"
                            sx={{ width: 150 }}
                            inputProps={{ style: { fontSize: "0.8rem", padding: "4px 8px" } }}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleMemoSave(item.name)}
                            disabled={memoValues[item.name] === item.memo}
                            sx={{ minWidth: 40, fontSize: "0.75rem", py: 0.25, borderColor: "#dee2e6", color: "#495057" }}
                          >
                            저장
                          </Button>
                        </Box>
                      ) : <Box />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 필드 편집 다이얼로그 */}
      <Dialog open={editDialog?.open ?? false} onClose={() => setEditDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>{editDialog?.label} 수정</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth autoFocus
            value={editDialog?.value ?? ""}
            onChange={(e) => setEditDialog((prev) => (prev ? { ...prev, value: e.target.value } : null))}
            type={editDialog?.field === "category" ? "text" : "number"}
            size="small" sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)} size="small">취소</Button>
          <Button onClick={handleEditSave} variant="contained" size="small">저장</Button>
        </DialogActions>
      </Dialog>

      {/* 매핑 다이얼로그 */}
      <Dialog open={mappingDialog?.open ?? false} onClose={() => setMappingDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>상품명 매핑 — {mappingDialog?.productName}</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={marketNames.filter((n) => !selectedMappings.includes(n))}
            onChange={(_, value) => { if (value) handleAddMapping(value); }}
            value={null}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="상품명 검색하여 추가" />
            )}
            sx={{ mt: 1, mb: 2 }}
          />
          {selectedMappings.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>상품명</TableCell>
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
      <Dialog open={bundleDialog?.open ?? false} onClose={() => setBundleDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>배수 상품 추가 — {bundleDialog?.baseName}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: "#495057" }}>묶음 수량</Typography>
              <Select size="small" value={bundleMultiplier} onChange={(e) => setBundleMultiplier(e.target.value as number)} fullWidth>
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

      {/* 채널 추가 다이얼로그 */}
      <Dialog open={channelDialog?.open ?? false} onClose={() => setChannelDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>채널 추가 — {channelDialog?.baseName}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: "#495057" }}>채널 선택</Typography>
              <Select size="small" value={channelType} onChange={(e) => setChannelType(e.target.value)} fullWidth>
                {[
                  { value: "판매자배송", label: "쿠팡(판매자배송)" },
                  { value: "로켓그로스", label: "쿠팡(로켓)" },
                  { value: "스마트스토어", label: "스마트스토어" },
                ].map(({ value, label }) => {
                  const alreadyExists = sales.some(
                    s => s.depth === 1 && s.isHeader && s.base_name === channelDialog?.baseName && s.displayLabel === value
                  );
                  return (
                    <MenuItem key={value} value={value} disabled={alreadyExists}>
                      {label}{alreadyExists ? " (등록됨)" : ""}
                    </MenuItem>
                  );
                })}
              </Select>
            </Box>
            <Typography variant="body2" color="text.secondary">
              상품명: {channelDialog?.baseName} [{channelType}]<br />
              원가: {fmt(channelDialog?.baseUnitCost ?? 0)}원 (기본 상품과 동일)<br />
              판매가, 수수료, 배송비 등은 추가 후 직접 입력해주세요.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChannelDialog(null)} size="small">취소</Button>
          <Button onClick={handleChannelAdd} variant="contained" size="small">추가</Button>
        </DialogActions>
      </Dialog>

      {/* 옵션 추가 다이얼로그 */}
      <Dialog open={optionDialog?.open ?? false} onClose={() => setOptionDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>옵션 추가 — {optionDialog?.parentName}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            {optionDialog && (optionInfoMap[optionDialog.baseName] || []).map((opt) => {
              const variantName = `${optionDialog.parentName} [${opt.size}]`;
              const alreadyAdded = sales.some((s) => s.name === variantName);
              return (
                <Box key={opt.size} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1, borderBottom: "1px solid #f1f3f5" }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{opt.size}</Typography>
                    <Typography variant="caption" sx={{ color: "#868e96" }}>평균 사입비용 {fmt(opt.avgUnitCost)}원</Typography>
                  </Box>
                  <Button
                    size="small"
                    variant={alreadyAdded ? "outlined" : "contained"}
                    disabled={alreadyAdded}
                    onClick={() => handleOptionAdd(optionDialog.parentName, optionDialog.baseName, opt.size, opt.avgUnitCost)}
                    sx={{ minWidth: 60 }}
                  >
                    {alreadyAdded ? "추가됨" : "추가"}
                  </Button>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptionDialog(null)} size="small">닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 평균 원가 변동 히스토리 다이얼로그 */}
      <Dialog open={costHistory?.open ?? false} onClose={() => setCostHistory(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>평균 원가 변동 — {costHistory?.productName}</DialogTitle>
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
