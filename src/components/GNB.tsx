"use client";

import { useState } from "react";
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
import StorefrontIcon from "@mui/icons-material/Storefront";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { useStore } from "@/contexts/StoreContext";

const menus = [
  { label: "대시보드", href: "/dashboard" },
  { label: "매입가 관리", href: "/cost" },
  { label: "상품관리", href: "/products" },
  { label: "매출 분석", href: "/sales" },
  { label: "지출관리", href: "/expenses" },
];

export default function GNB() {
  const pathname = usePathname();
  const { stores, currentStore, setCurrentStore, addStore, loading } = useStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [saving, setSaving] = useState(false);

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
        position="static"
        elevation={0}
        sx={{ backgroundColor: "#fff", borderBottom: "1px solid #f1f3f5" }}
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
