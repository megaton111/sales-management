"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

const menus = [
  { label: "매입가 관리", href: "/cost" },
  { label: "상품관리", href: "/products" },
  { label: "매출 분석", href: "/sales" },
];

export default function GNB() {
  const pathname = usePathname();

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ backgroundColor: "transparent", borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar variant="dense">
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {menus.map((menu) => (
            <Button
              key={menu.href}
              component={Link}
              href={menu.href}
              size="small"
              sx={{
                color: pathname === menu.href ? "primary.main" : "text.secondary",
                fontWeight: pathname === menu.href ? 700 : 400,
              }}
            >
              {menu.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
