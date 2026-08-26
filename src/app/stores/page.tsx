'use client';

import { useState, useEffect, useCallback } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useStore } from '@/contexts/StoreContext';

interface Integration {
  id: number;
  platform: string;
  is_active: boolean;
  updated_at: string;
}

const PLATFORMS: Record<string, { label: string; color: string; fields: { key: string; label: string; placeholder: string }[] }> = {
  coupang: {
    label: '쿠팡',
    color: '#e8420a',
    fields: [
      { key: 'access_key', label: 'Access Key', placeholder: 'Access Key를 입력하세요' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'Secret Key를 입력하세요' },
      { key: 'vendor_id', label: 'Vendor ID', placeholder: 'Vendor ID를 입력하세요 (예: A00123456)' },
    ],
  },
  smartstore: {
    label: '스마트스토어',
    color: '#03c75a',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Client ID를 입력하세요' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Client Secret을 입력하세요' },
    ],
  },
};

const cardSx = {
  p: 2.5,
  backgroundColor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

export default function StoresPage() {
  const { stores, currentStore, setCurrentStore } = useStore();
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPlatform, setDialogPlatform] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const activeStoreId = selectedStoreId ?? currentStore?.id ?? null;

  const fetchIntegrations = useCallback(async (storeId: number) => {
    setLoadingIntegrations(true);
    const res = await fetch(`/api/stores/integrations?storeId=${storeId}`);
    const json = await res.json();
    setIntegrations(res.ok ? json.data : []);
    setLoadingIntegrations(false);
  }, []);

  useEffect(() => {
    if (activeStoreId) fetchIntegrations(activeStoreId);
  }, [activeStoreId, fetchIntegrations]);

  const openDialog = (platform: string) => {
    setDialogPlatform(platform);
    const fields = PLATFORMS[platform]?.fields ?? [];
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f.key] = ''; });
    setFormValues(init);
    setShowFields({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!activeStoreId) return;
    const fields = PLATFORMS[dialogPlatform]?.fields ?? [];
    const empty = fields.find(f => !formValues[f.key]?.trim());
    if (empty) {
      setSnackbar({ open: true, message: `${empty.label}을(를) 입력해주세요`, severity: 'error' });
      return;
    }
    setSaving(true);
    const res = await fetch('/api/stores/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: activeStoreId, platform: dialogPlatform, credentials: formValues }),
    });
    setSaving(false);
    if (res.ok) {
      setSnackbar({ open: true, message: '저장되었습니다', severity: 'success' });
      setDialogOpen(false);
      fetchIntegrations(activeStoreId);
    } else {
      setSnackbar({ open: true, message: '저장에 실패했습니다', severity: 'error' });
    }
  };

  const handleDelete = async (platform: string) => {
    if (!activeStoreId) return;
    const res = await fetch(`/api/stores/integrations?storeId=${activeStoreId}&platform=${platform}`, { method: 'DELETE' });
    if (res.ok) {
      setSnackbar({ open: true, message: '연동이 해제되었습니다', severity: 'success' });
      fetchIntegrations(activeStoreId);
    }
    setDeleteConfirm(null);
  };

  const connectedPlatforms = new Set(integrations.map(i => i.platform));
  const availablePlatforms = Object.keys(PLATFORMS).filter(p => !connectedPlatforms.has(p));

  return (
    <Container maxWidth="lg" sx={{ pt: 3, pb: 4 }}>
      <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>

        {/* 좌: 스토어 목록 */}
        <Box sx={{ width: 200, flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#adb5bd', mb: 1, px: 0.5 }}>스토어</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {stores.map(store => (
              <Box
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
                sx={{
                  px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                  backgroundColor: activeStoreId === store.id ? '#343a40' : 'transparent',
                  color: activeStoreId === store.id ? '#fff' : '#495057',
                  fontWeight: activeStoreId === store.id ? 600 : 400,
                  fontSize: '0.875rem',
                  '&:hover': { backgroundColor: activeStoreId === store.id ? '#343a40' : '#f1f3f5' },
                  transition: 'all 0.1s',
                }}
              >
                {store.name}
              </Box>
            ))}
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ borderColor: '#f1f3f5' }} />

        {/* 우: 플랫폼 연동 */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1b' }}>
              {stores.find(s => s.id === activeStoreId)?.name ?? ''} 플랫폼 연동
            </Typography>
            {availablePlatforms.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {availablePlatforms.map(platform => (
                  <Button
                    key={platform}
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => openDialog(platform)}
                    sx={{
                      borderRadius: 2, fontSize: '0.8rem', fontWeight: 500,
                      color: PLATFORMS[platform].color,
                      border: `1px solid ${PLATFORMS[platform].color}`,
                      '&:hover': { backgroundColor: `${PLATFORMS[platform].color}11` },
                    }}
                  >
                    {PLATFORMS[platform].label} 연동
                  </Button>
                ))}
              </Box>
            )}
          </Box>

          {loadingIntegrations ? (
            <Typography sx={{ color: '#adb5bd', fontSize: '0.85rem' }}>불러오는 중...</Typography>
          ) : integrations.length === 0 ? (
            <Paper elevation={0} sx={{ ...cardSx, textAlign: 'center', py: 5 }}>
              <Typography sx={{ color: '#adb5bd', fontSize: '0.85rem' }}>연동된 플랫폼이 없습니다</Typography>
              <Typography sx={{ color: '#ced4da', fontSize: '0.78rem', mt: 0.5 }}>위 버튼으로 플랫폼을 추가해보세요</Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {integrations.map(integration => {
                const p = PLATFORMS[integration.platform];
                if (!p) return null;
                return (
                  <Paper key={integration.platform} elevation={0} sx={cardSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: integration.is_active ? '#2b8a3e' : '#adb5bd',
                        }} />
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: p.color }}>
                          {p.label}
                        </Typography>
                        <Chip
                          label={integration.is_active ? '연동됨' : '비활성'}
                          size="small"
                          sx={{
                            fontSize: '0.7rem', height: 20,
                            backgroundColor: integration.is_active ? '#ebfbee' : '#f1f3f5',
                            color: integration.is_active ? '#2b8a3e' : '#868e96',
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', color: '#adb5bd', mr: 1 }}>
                          {new Date(integration.updated_at).toLocaleDateString('ko-KR')} 수정
                        </Typography>
                        <IconButton size="small" onClick={() => openDialog(integration.platform)} sx={{ color: '#868e96' }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteConfirm(integration.platform)} sx={{ color: '#adb5bd' }}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.78rem', color: '#adb5bd', mt: 1 }}>
                      API 키: ••••••••••••••••
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* 연동 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1b' }}>
          {PLATFORMS[dialogPlatform]?.label} API 연동 설정
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {(PLATFORMS[dialogPlatform]?.fields ?? []).map(field => (
            <TextField
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              value={formValues[field.key] ?? ''}
              onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              type={showFields[field.key] ? 'text' : 'password'}
              size="small"
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))}>
                      {showFields[field.key] ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          ))}
          <Typography sx={{ fontSize: '0.75rem', color: '#adb5bd' }}>
            입력한 API 키는 암호화되지 않고 저장됩니다. 타인과 공유하지 마세요.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} size="small" sx={{ color: '#868e96' }}>취소</Button>
          <Button onClick={handleSave} variant="contained" size="small" disabled={saving}
            sx={{ backgroundColor: '#343a40', '&:hover': { backgroundColor: '#212529' } }}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>연동 해제</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#495057' }}>
            {PLATFORMS[deleteConfirm ?? '']?.label} 연동을 해제할까요? 저장된 API 키가 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteConfirm(null)} size="small" sx={{ color: '#868e96' }}>취소</Button>
          <Button onClick={() => handleDelete(deleteConfirm!)} variant="contained" size="small"
            sx={{ backgroundColor: '#e03131', '&:hover': { backgroundColor: '#c92a2a' } }}>
            해제
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}
