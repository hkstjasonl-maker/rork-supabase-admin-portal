import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Gift, Trophy, Calendar, Package, Hash, Percent } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Patient } from '@/types/patient';

interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  max_draws_per_patient: number | null;
  created_at: string;
}

interface MarketingPrize {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  quantity: number | null;
  probability: number | null;
  sort_order: number;
  created_at: string;
}

interface MarketingPrizeLog {
  id: string;
  patient_id: string;
  prize_id: string | null;
  campaign_id: string | null;
  prize_name: string | null;
  campaign_name: string | null;
  won_at: string;
  created_at: string;
}

interface CampaignFormData {
  name: string;
  description: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  max_draws_per_patient: string;
}

interface PrizeFormData {
  name: string;
  description: string;
  image_url: string;
  quantity: string;
  probability: string;
  sort_order: string;
}

const EMPTY_CAMPAIGN_FORM: CampaignFormData = {
  name: '',
  description: '',
  is_active: true,
  start_date: '',
  end_date: '',
  max_draws_per_patient: '',
};

const EMPTY_PRIZE_FORM: PrizeFormData = {
  name: '',
  description: '',
  image_url: '',
  quantity: '',
  probability: '',
  sort_order: '0',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-CA');
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-CA')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return dateStr;
  }
}

function getCampaignStatus(campaign: MarketingCampaign): { label: string; labelZh: string; bg: string; text: string } {
  if (!campaign.is_active) return { label: 'Disabled', labelZh: '停用', bg: Colors.borderLight, text: Colors.textSecondary };
  const now = new Date();
  if (campaign.start_date && new Date(campaign.start_date) > now) return { label: 'Scheduled', labelZh: '排程', bg: '#e0e8f5', text: '#4a6fa5' };
  if (campaign.end_date && new Date(campaign.end_date) < now) return { label: 'Expired', labelZh: '已過期', bg: Colors.dangerLight, text: Colors.danger };
  return { label: 'Active', labelZh: '啟用中', bg: Colors.greenLight, text: Colors.green };
}

export default function MarketingDrawsScreen() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'log'>('campaigns');

  const [campaignFormVisible, setCampaignFormVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormData>(EMPTY_CAMPAIGN_FORM);

  const [prizesModalVisible, setPrizesModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [prizeFormVisible, setPrizeFormVisible] = useState(false);
  const [editingPrize, setEditingPrize] = useState<MarketingPrize | null>(null);
  const [prizeForm, setPrizeForm] = useState<PrizeFormData>(EMPTY_PRIZE_FORM);

  const campaignsQuery = useQuery({
    queryKey: ['marketing_campaigns'],
    queryFn: async () => {
      console.log('[MarketingDraws] Fetching campaigns');
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingCampaign[];
    },
  });

  const prizesQuery = useQuery({
    queryKey: ['marketing_prizes', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      console.log('[MarketingDraws] Fetching prizes for campaign:', selectedCampaign.id);
      const { data, error } = await supabase
        .from('marketing_prizes')
        .select('*')
        .eq('campaign_id', selectedCampaign.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarketingPrize[];
    },
    enabled: !!selectedCampaign,
  });

  const prizeLogQuery = useQuery({
    queryKey: ['marketing_prize_log'],
    queryFn: async () => {
      console.log('[MarketingDraws] Fetching prize log');
      const { data, error } = await supabase
        .from('marketing_prize_log')
        .select('*')
        .order('won_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as MarketingPrizeLog[];
    },
  });

  const patientsQuery = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('patient_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const patientMap = useMemo(() => {
    const map: Record<string, Patient> = {};
    (patientsQuery.data ?? []).forEach((p) => { map[p.id] = p; });
    return map;
  }, [patientsQuery.data]);

  const saveCampaignMutation = useMutation({
    mutationFn: async (payload: CampaignFormData & { id?: string }) => {
      const row = {
        name: payload.name.trim(),
        description: payload.description.trim() || null,
        is_active: payload.is_active,
        start_date: payload.start_date.trim() || null,
        end_date: payload.end_date.trim() || null,
        max_draws_per_patient: payload.max_draws_per_patient ? parseInt(payload.max_draws_per_patient, 10) : null,
      };
      if (payload.id) {
        console.log('[MarketingDraws] Updating campaign:', payload.id);
        const { error } = await supabase.from('marketing_campaigns').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[MarketingDraws] Inserting new campaign');
        const { error } = await supabase.from('marketing_campaigns').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
      setCampaignFormVisible(false);
      setEditingCampaign(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[MarketingDraws] Deleting campaign:', id);
      const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
    },
  });

  const savePrizeMutation = useMutation({
    mutationFn: async (payload: PrizeFormData & { id?: string; campaign_id: string }) => {
      const row = {
        campaign_id: payload.campaign_id,
        name: payload.name.trim(),
        description: payload.description.trim() || null,
        image_url: payload.image_url.trim() || null,
        quantity: payload.quantity ? parseInt(payload.quantity, 10) : null,
        probability: payload.probability ? parseFloat(payload.probability) : null,
        sort_order: parseInt(payload.sort_order, 10) || 0,
      };
      if (payload.id) {
        console.log('[MarketingDraws] Updating prize:', payload.id);
        const { error } = await supabase.from('marketing_prizes').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[MarketingDraws] Inserting new prize');
        const { error } = await supabase.from('marketing_prizes').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing_prizes', selectedCampaign?.id] });
      setPrizeFormVisible(false);
      setEditingPrize(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deletePrizeMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[MarketingDraws] Deleting prize:', id);
      const { error } = await supabase.from('marketing_prizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing_prizes', selectedCampaign?.id] });
    },
  });

  const handleAddCampaign = useCallback(() => {
    setEditingCampaign(null);
    setCampaignForm(EMPTY_CAMPAIGN_FORM);
    setCampaignFormVisible(true);
  }, []);

  const handleEditCampaign = useCallback((c: MarketingCampaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name,
      description: c.description ?? '',
      is_active: c.is_active,
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      end_date: c.end_date ? c.end_date.split('T')[0] : '',
      max_draws_per_patient: c.max_draws_per_patient != null ? String(c.max_draws_per_patient) : '',
    });
    setCampaignFormVisible(true);
  }, []);

  const handleDeleteCampaign = useCallback((c: MarketingCampaign) => {
    Alert.alert(
      language === 'zh' ? '刪除活動' : 'Delete Campaign',
      language === 'zh' ? `確定要刪除「${c.name}」嗎？` : `Delete "${c.name}"?`,
      [
        { text: language === 'zh' ? '取消' : 'Cancel', style: 'cancel' },
        { text: language === 'zh' ? '刪除' : 'Delete', style: 'destructive', onPress: () => deleteCampaignMutation.mutate(c.id) },
      ]
    );
  }, [language, deleteCampaignMutation]);

  const handleSaveCampaign = useCallback(() => {
    if (!campaignForm.name.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入活動名稱' : 'Campaign name is required');
      return;
    }
    saveCampaignMutation.mutate({ ...campaignForm, id: editingCampaign?.id });
  }, [campaignForm, editingCampaign, saveCampaignMutation, language]);

  const updateCampaignForm = useCallback((key: keyof CampaignFormData, value: string | boolean) => {
    setCampaignForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleManagePrizes = useCallback((c: MarketingCampaign) => {
    setSelectedCampaign(c);
    setPrizesModalVisible(true);
  }, []);

  const handleAddPrize = useCallback(() => {
    setEditingPrize(null);
    setPrizeForm(EMPTY_PRIZE_FORM);
    setPrizeFormVisible(true);
  }, []);

  const handleEditPrize = useCallback((p: MarketingPrize) => {
    setEditingPrize(p);
    setPrizeForm({
      name: p.name,
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      quantity: p.quantity != null ? String(p.quantity) : '',
      probability: p.probability != null ? String(p.probability) : '',
      sort_order: String(p.sort_order ?? 0),
    });
    setPrizeFormVisible(true);
  }, []);

  const handleDeletePrize = useCallback((p: MarketingPrize) => {
    Alert.alert(
      language === 'zh' ? '刪除獎品' : 'Delete Prize',
      language === 'zh' ? `確定要刪除「${p.name}」嗎？` : `Delete "${p.name}"?`,
      [
        { text: language === 'zh' ? '取消' : 'Cancel', style: 'cancel' },
        { text: language === 'zh' ? '刪除' : 'Delete', style: 'destructive', onPress: () => deletePrizeMutation.mutate(p.id) },
      ]
    );
  }, [language, deletePrizeMutation]);

  const handleSavePrize = useCallback(() => {
    if (!prizeForm.name.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入獎品名稱' : 'Prize name is required');
      return;
    }
    if (!selectedCampaign) return;
    savePrizeMutation.mutate({ ...prizeForm, campaign_id: selectedCampaign.id, id: editingPrize?.id });
  }, [prizeForm, editingPrize, selectedCampaign, savePrizeMutation, language]);

  const updatePrizeForm = useCallback((key: keyof PrizeFormData, value: string) => {
    setPrizeForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const campaigns = campaignsQuery.data ?? [];
  const prizes = prizesQuery.data ?? [];
  const prizeLog = prizeLogQuery.data ?? [];

  const renderCampaignsTab = () => (
    <>
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAddCampaign} activeOpacity={0.7}>
          <Plus size={16} color={Colors.white} />
          <Text style={styles.primaryBtnText}>{language === 'zh' ? '新增活動' : 'Add Campaign'}</Text>
        </TouchableOpacity>
      </View>

      {campaignsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{language === 'zh' ? '載入中...' : 'Loading...'}</Text>
        </View>
      ) : campaigns.length === 0 ? (
        <View style={styles.centered}>
          <Gift size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{language === 'zh' ? '尚無行銷活動' : 'No campaigns yet'}</Text>
        </View>
      ) : (
        campaigns.map((c) => {
          const status = getCampaignStatus(c);
          return (
            <View key={c.id} style={[styles.campaignCard, !c.is_active && styles.cardInactive]}>
              <View style={styles.campaignHeader}>
                <View style={styles.campaignTitleRow}>
                  <View style={styles.campaignIconCircle}>
                    <Gift size={16} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
                    {c.description ? (
                      <Text style={styles.campaignDesc} numberOfLines={2}>{c.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: status.text }]}>
                      {language === 'zh' ? status.labelZh : status.label}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.campaignMetaRow}>
                <View style={styles.metaItem}>
                  <Calendar size={12} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>
                    {formatDate(c.start_date)} → {formatDate(c.end_date)}
                  </Text>
                </View>
                {c.max_draws_per_patient != null && (
                  <View style={styles.metaItem}>
                    <Hash size={12} color={Colors.textTertiary} />
                    <Text style={styles.metaText}>
                      {language === 'zh' ? `每人 ${c.max_draws_per_patient} 次` : `${c.max_draws_per_patient} draws/patient`}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.campaignActions}>
                <TouchableOpacity style={styles.managePrizesBtn} onPress={() => handleManagePrizes(c)} activeOpacity={0.7}>
                  <Trophy size={13} color={Colors.accent} />
                  <Text style={styles.managePrizesBtnText}>{language === 'zh' ? '管理獎品' : 'Manage Prizes'}</Text>
                </TouchableOpacity>
                <View style={styles.campaignActionBtns}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleEditCampaign(c)} activeOpacity={0.7}>
                    <Pencil size={15} color={Colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteCampaign(c)} activeOpacity={0.7}>
                    <Trash2 size={15} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderPrizeLogTab = () => (
    <>
      {prizeLogQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{language === 'zh' ? '載入中...' : 'Loading...'}</Text>
        </View>
      ) : prizeLog.length === 0 ? (
        <View style={styles.centered}>
          <Trophy size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{language === 'zh' ? '尚無獎品記錄' : 'No prize log entries yet'}</Text>
        </View>
      ) : (
        prizeLog.map((entry) => {
          const patient = patientMap[entry.patient_id];
          return (
            <View key={entry.id} style={styles.logCard}>
              <View style={styles.logAvatarCircle}>
                <Text style={styles.logAvatarText}>
                  {patient ? patient.patient_name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logPatientName}>{patient?.patient_name ?? entry.patient_id}</Text>
                <View style={styles.logDetailsRow}>
                  <View style={styles.logPrizeBadge}>
                    <Trophy size={10} color={Colors.accent} />
                    <Text style={styles.logPrizeText}>{entry.prize_name ?? '—'}</Text>
                  </View>
                  {entry.campaign_name ? (
                    <Text style={styles.logCampaignText}>{entry.campaign_name}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.logDate}>{formatDateTime(entry.won_at ?? entry.created_at)}</Text>
            </View>
          );
        })
      )}
    </>
  );

  const renderCampaignFormModal = () => (
    <Modal visible={campaignFormVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingCampaign
                ? (language === 'zh' ? '編輯活動' : 'Edit Campaign')
                : (language === 'zh' ? '新增活動' : 'Add Campaign')}
            </Text>
            <TouchableOpacity onPress={() => { setCampaignFormVisible(false); setEditingCampaign(null); }} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            <Text style={styles.formLabel}>{language === 'zh' ? '活動名稱 *' : 'Campaign Name *'}</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.name}
              onChangeText={(v) => updateCampaignForm('name', v)}
              placeholder={language === 'zh' ? '輸入活動名稱' : 'Enter campaign name'}
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '描述' : 'Description'}</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={campaignForm.description}
              onChangeText={(v) => updateCampaignForm('description', v)}
              placeholder={language === 'zh' ? '活動描述' : 'Campaign description'}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '開始日期' : 'Start Date'}</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.start_date}
              onChangeText={(v) => updateCampaignForm('start_date', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '結束日期' : 'End Date'}</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.end_date}
              onChangeText={(v) => updateCampaignForm('end_date', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '每位患者最多抽獎次數' : 'Max Draws Per Patient'}</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.max_draws_per_patient}
              onChangeText={(v) => updateCampaignForm('max_draws_per_patient', v)}
              placeholder={language === 'zh' ? '留空為不限' : 'Leave empty for unlimited'}
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <View style={styles.formSwitchRow}>
              <Text style={styles.formLabel}>{language === 'zh' ? '啟用' : 'Active'}</Text>
              <Switch
                value={campaignForm.is_active}
                onValueChange={(v) => updateCampaignForm('is_active', v as unknown as string)}
                trackColor={{ false: Colors.border, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setCampaignFormVisible(false); setEditingCampaign(null); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{language === 'zh' ? '取消' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saveCampaignMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSaveCampaign}
              disabled={saveCampaignMutation.isPending}
              activeOpacity={0.7}
            >
              {saveCampaignMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{language === 'zh' ? '儲存' : 'Save'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPrizesModal = () => (
    <Modal visible={prizesModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.prizesModalContent, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {language === 'zh' ? '獎品管理' : 'Manage Prizes'}
              </Text>
              {selectedCampaign && (
                <Text style={styles.prizesSubtitle}>{selectedCampaign.name}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => { setPrizesModalVisible(false); setSelectedCampaign(null); }} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.prizesActionBar}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAddPrize} activeOpacity={0.7}>
              <Plus size={16} color={Colors.white} />
              <Text style={styles.primaryBtnText}>{language === 'zh' ? '新增獎品' : 'Add Prize'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.prizesListContent}>
            {prizesQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : prizes.length === 0 ? (
              <View style={styles.centered}>
                <Package size={36} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{language === 'zh' ? '尚無獎品' : 'No prizes yet'}</Text>
              </View>
            ) : (
              prizes.map((p) => (
                <View key={p.id} style={styles.prizeCard}>
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={styles.prizeImage} />
                  ) : (
                    <View style={styles.prizeImagePlaceholder}>
                      <Package size={20} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.prizeInfo}>
                    <Text style={styles.prizeName} numberOfLines={1}>{p.name}</Text>
                    {p.description ? (
                      <Text style={styles.prizeDesc} numberOfLines={1}>{p.description}</Text>
                    ) : null}
                    <View style={styles.prizeMetaRow}>
                      {p.quantity != null && (
                        <View style={styles.prizeMetaChip}>
                          <Text style={styles.prizeMetaChipText}>
                            {language === 'zh' ? `數量: ${p.quantity}` : `Qty: ${p.quantity}`}
                          </Text>
                        </View>
                      )}
                      {p.probability != null && (
                        <View style={[styles.prizeMetaChip, { backgroundColor: '#e0e8f5' }]}>
                          <Percent size={9} color="#4a6fa5" />
                          <Text style={[styles.prizeMetaChipText, { color: '#4a6fa5' }]}>
                            {p.probability}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.prizeSortText}>#{p.sort_order}</Text>
                    </View>
                  </View>
                  <View style={styles.prizeActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleEditPrize(p)} activeOpacity={0.7}>
                      <Pencil size={14} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeletePrize(p)} activeOpacity={0.7}>
                      <Trash2 size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderPrizeFormModal = () => (
    <Modal visible={prizeFormVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingPrize
                ? (language === 'zh' ? '編輯獎品' : 'Edit Prize')
                : (language === 'zh' ? '新增獎品' : 'Add Prize')}
            </Text>
            <TouchableOpacity onPress={() => { setPrizeFormVisible(false); setEditingPrize(null); }} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            <Text style={styles.formLabel}>{language === 'zh' ? '獎品名稱 *' : 'Prize Name *'}</Text>
            <TextInput
              style={styles.formInput}
              value={prizeForm.name}
              onChangeText={(v) => updatePrizeForm('name', v)}
              placeholder={language === 'zh' ? '輸入獎品名稱' : 'Enter prize name'}
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '描述' : 'Description'}</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={prizeForm.description}
              onChangeText={(v) => updatePrizeForm('description', v)}
              placeholder={language === 'zh' ? '獎品描述' : 'Prize description'}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>Image URL</Text>
            <TextInput
              style={styles.formInput}
              value={prizeForm.image_url}
              onChangeText={(v) => updatePrizeForm('image_url', v)}
              placeholder="https://..."
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
            {prizeForm.image_url ? (
              <Image source={{ uri: prizeForm.image_url }} style={styles.formImagePreview} />
            ) : null}

            <Text style={styles.formLabel}>{language === 'zh' ? '數量' : 'Quantity'}</Text>
            <TextInput
              style={styles.formInput}
              value={prizeForm.quantity}
              onChangeText={(v) => updatePrizeForm('quantity', v)}
              placeholder={language === 'zh' ? '留空為不限' : 'Leave empty for unlimited'}
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '中獎機率' : 'Probability'}</Text>
            <TextInput
              style={styles.formInput}
              value={prizeForm.probability}
              onChangeText={(v) => updatePrizeForm('probability', v)}
              placeholder="e.g. 0.1"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '排序' : 'Sort Order'}</Text>
            <TextInput
              style={styles.formInput}
              value={prizeForm.sort_order}
              onChangeText={(v) => updatePrizeForm('sort_order', v)}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setPrizeFormVisible(false); setEditingPrize(null); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{language === 'zh' ? '取消' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, savePrizeMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSavePrize}
              disabled={savePrizeMutation.isPending}
              activeOpacity={0.7}
            >
              {savePrizeMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{language === 'zh' ? '儲存' : 'Save'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={language === 'zh' ? '行銷抽獎' : 'Marketing Draws'} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'campaigns' && styles.tabActive]}
          onPress={() => setActiveTab('campaigns')}
          activeOpacity={0.7}
        >
          <Gift size={14} color={activeTab === 'campaigns' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'campaigns' && styles.tabTextActive]}>
            {language === 'zh' ? '活動' : 'Campaigns'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'log' && styles.tabActive]}
          onPress={() => setActiveTab('log')}
          activeOpacity={0.7}
        >
          <Trophy size={14} color={activeTab === 'log' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'log' && styles.tabTextActive]}>
            {language === 'zh' ? '獎品記錄' : 'Prize Log'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={campaignsQuery.isRefetching || prizeLogQuery.isRefetching}
            onRefresh={() => {
              void campaignsQuery.refetch();
              void prizeLogQuery.refetch();
              void patientsQuery.refetch();
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'campaigns' ? renderCampaignsTab() : renderPrizeLogTab()}
      </ScrollView>

      {renderCampaignFormModal()}
      {renderPrizesModal()}
      {renderPrizeFormModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  campaignCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardInactive: {
    opacity: 0.55,
  },
  campaignHeader: {
    marginBottom: 10,
  },
  campaignTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  campaignIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  campaignName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  campaignDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  campaignMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingLeft: 46,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  campaignActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 46,
  },
  managePrizesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  managePrizesBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  campaignActionBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  logAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logAvatarText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  logInfo: {
    flex: 1,
    marginLeft: 10,
  },
  logPatientName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  logDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  logPrizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  logPrizeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  logCampaignText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  logDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginLeft: 8,
    textAlign: 'right' as const,
    minWidth: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 16,
  },
  prizesModalContent: {
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  prizesSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prizesActionBar: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  prizesListContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  prizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  prizeImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
  },
  prizeImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prizeInfo: {
    flex: 1,
    marginLeft: 10,
  },
  prizeName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  prizeDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  prizeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  prizeMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prizeMetaChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.green,
  },
  prizeSortText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  prizeActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  formTextArea: {
    minHeight: 72,
    textAlignVertical: 'top' as const,
  },
  formImagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: Colors.inputBg,
  },
  formSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
