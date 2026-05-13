"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";

export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          쿠팡 판매 관리
        </Typography>
        <Typography color="text.secondary">
          판매정보 조회 및 순이익 계산
        </Typography>
      </Box>
    </Container>
  );
}
