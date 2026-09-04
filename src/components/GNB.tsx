"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import StorefrontIcon from "@mui/icons-material/Storefront";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import SyncIcon from "@mui/icons-material/Sync";
import { useStore } from "@/contexts/StoreContext";

const menus = [
  { label: "대시보드", href: "/dashboard" },
  { label: "매입가 관리", href: "/cost" },
  { label: "상품관리", href: "/products" },
  { label: "매출 분석", href: "/sales" },
  { label: "재고관리", href: "/inventory" },
  { label: "지출관리", href: "/expenses" },
  { label: "마진계산기", href: "/margin" },
  { label: "스토어 관리", href: "/stores" },
];

export default function GNB() {
  const pathname = usePathname();
  const { stores, currentStore, setCurrentStore, addStore, loading } = useStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<{ platform: string; is_active: boolean }[]>([]);
  const [coupangLoading, setCoupangLoading] = useState(false);
  const [naverLoading, setNaverLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (!currentStore) { setIntegrations([]); return; }
    fetch(`/api/stores/integrations?storeId=${currentStore.id}`)
      .then(r => r.json())
      .then(({ data }) => setIntegrations(data || []))
      .catch(() => setIntegrations([]));
  }, [currentStore]);

  const hasCoupang = integrations.some(i => i.platform === 'coupang' && i.is_active);
  const hasNaver = integrations.some(i => i.platform === 'smartstore' && i.is_active);

  const syncDateRange = () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { dateFrom: monthStart, dateTo: today };
  };

  const handleCoupangSync = async () => {
    if (!currentStore) return;
    setCoupangLoading(true);
    try {
      const { dateFrom, dateTo } = syncDateRange();
      const res = await fetch('/api/sales/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: currentStore.id, dateFrom, dateTo }),
      });
      const json = await res.json();
      setSnackbar({ open: true, message: res.ok ? '쿠팡 동기화 완료' : json.error || '동기화 실패', severity: res.ok ? 'success' : 'error' });
    } catch {
      setSnackbar({ open: true, message: '동기화 중 오류 발생', severity: 'error' });
    } finally {
      setCoupangLoading(false);
    }
  };

  const handleNaverSync = async () => {
    if (!currentStore) return;
    setNaverLoading(true);
    try {
      const { dateFrom, dateTo } = syncDateRange();
      const res = await fetch('/api/sales/naver/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: currentStore.id, dateFrom, dateTo }),
      });
      const json = await res.json();
      setSnackbar({ open: true, message: res.ok ? '스마트스토어 동기화 완료' : json.error || '동기화 실패', severity: res.ok ? 'success' : 'error' });
    } catch {
      setSnackbar({ open: true, message: '동기화 중 오류 발생', severity: 'error' });
    } finally {
      setNaverLoading(false);
    }
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    setSaving(true);
    const created = await addStore(newStoreName.trim());
    if (created) {
      setCurrentStore(created);
    }
    setNewStoreName("");
    setSaving(false);
    setAddDialog(false);
    setAnchorEl(null);
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ backgroundColor: "#fff", borderBottom: "1px solid #f1f3f5", top: 0, zIndex: 1100 }}
      >
        <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {menus.map((menu) => (
              <Button
                key={menu.href}
                component={Link}
                href={menu.href}
                size="small"
                sx={{
                  color: pathname === menu.href ? "#1a1a1b" : "#868e96",
                  fontWeight: pathname === menu.href ? 700 : 500,
                  fontSize: "0.85rem",
                  "&:hover": { backgroundColor: "#f8f9fa" },
                }}
              >
                {menu.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {!loading && currentStore && (
              <>
                <Tooltip title={hasNaver ? "스마트스토어 이번 달 동기화" : "스마트스토어 연동 없음"}>
                  <span>
                    <Button
                      size="small"
                      onClick={handleNaverSync}
                      disabled={naverLoading || !hasNaver}
                      startIcon={
                        <SyncIcon sx={{
                          fontSize: "0.9rem !important",
                          ...(naverLoading && { animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }),
                        }} />
                      }
                      sx={{
                        fontSize: "0.78rem", fontWeight: 500, px: 1, py: 0.4,
                        color: hasNaver ? "#03c75a" : "#adb5bd",
                        borderRadius: 1.5,
                        "&:hover": { backgroundColor: hasNaver ? "#f0fdf4" : "transparent" },
                        "&.Mui-disabled": { color: "#dee2e6" },
                        minWidth: 0,
                      }}
                    >
                      {naverLoading ? "동기화 중..." : "스마트스토어"}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={hasCoupang ? "쿠팡 이번 달 동기화" : "쿠팡 연동 없음"}>
                  <span>
                    <Button
                      size="small"
                      onClick={handleCoupangSync}
                      disabled={coupangLoading || !hasCoupang}
                      startIcon={
                        <SyncIcon sx={{
                          fontSize: "0.9rem !important",
                          ...(coupangLoading && { animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }),
                        }} />
                      }
                      sx={{
                        fontSize: "0.78rem", fontWeight: 500, px: 1, py: 0.4,
                        color: hasCoupang ? "#495057" : "#adb5bd",
                        borderRadius: 1.5,
                        "&:hover": { backgroundColor: hasCoupang ? "#f8f9fa" : "transparent" },
                        "&.Mui-disabled": { color: "#dee2e6" },
                        minWidth: 0,
                      }}
                    >
                      {coupangLoading ? "동기화 중..." : "쿠팡"}
                    </Button>
                  </span>
                </Tooltip>
                <Box sx={{ width: "1px", height: 16, backgroundColor: "#f1f3f5", mx: 0.5 }} />
              </>
            )}
            {!loading && currentStore && (
              <Button
                size="small"
                startIcon={<StorefrontIcon sx={{ fontSize: 18, color: "#868e96" }} />}
                endIcon={<ArrowDropDownIcon sx={{ color: "#adb5bd" }} />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ color: "#1a1a1b", fontWeight: 600, fontSize: "0.85rem", "&:hover": { backgroundColor: "#f8f9fa" } }}
              >
                {currentStore.name}
              </Button>
            )}
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: "1px solid #f1f3f5" } } }}
          >
            {stores.map((store) => (
              <MenuItem
                key={store.id}
                onClick={() => {
                  setCurrentStore(store);
                  setAnchorEl(null);
                }}
                selected={store.id === currentStore?.id}
                sx={{ fontSize: "0.85rem", "&.Mui-selected": { backgroundColor: "#f8f9fa" } }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {store.id === currentStore?.id ? <CheckIcon fontSize="small" sx={{ color: "#1a1a1b" }} /> : null}
                </ListItemIcon>
                <ListItemText>{store.name}</ListItemText>
              </MenuItem>
            ))}
            <Divider sx={{ borderColor: "#f1f3f5" }} />
            <MenuItem onClick={() => { setAddDialog(true); }} sx={{ fontSize: "0.85rem" }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <AddIcon fontSize="small" sx={{ color: "#868e96" }} />
              </ListItemIcon>
              <ListItemText>스토어 추가</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ fontSize: "0.85rem" }} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem", fontWeight: 600, color: "#1a1a1b" }}>스토어 추가</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            label="스토어명"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            size="small"
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddStore();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)} size="small" sx={{ color: "#868e96" }}>
            취소
          </Button>
          <Button onClick={handleAddStore} variant="contained" size="small" disabled={saving || !newStoreName.trim()}>
            추가
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
