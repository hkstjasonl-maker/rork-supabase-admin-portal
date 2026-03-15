import React, { useState, useCallback } from 'react';
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
import { Plus, Pencil, Trash2, X, Gift, Trophy, Calendar, Package, Hash, Eye, EyeOff, Tag, MessageSquare, ImageIcon, TicketPercent, Ticket, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';

interface MarketingCampaign {
  id: string;
  title_en: string;
  title_zh: string;
  description_en: string | null;
  description_zh: string | null;
  start_date: string | null;
  end_date: string | null;
  trigger_on_app_open: boolean;
  trigger_on_exercise_count: number | null;
  trigger_on_video_submit: boolean;
  max_draws_per_day: number | null;
  is_active: boolean;
  created_at: string;
}

type PrizeType = 'discount_code' | 'voucher' | 'redeem_voucher' | 'gift' | 'message';

interface MarketingPrize {
  id: string;
  campaign_id: string;
  prize_name_en: string;
  prize_name_zh: string;
  prize_type: PrizeType;
  discount_code: string | null;
  voucher_image_url: string | null;
  prize_description_en: string | null;
  prize_description_zh: string | null;
  quantity_total: number | null;
  quantity_remaining: number | null;
  probability_weight: number | null;
  expiry_date: string | null;
  redeem_code_prefix: string | null;
  redeem_instructions_en: string | null;
  redeem_instructions_zh: string | null;
  redeem_image_url: string | null;
  gift_details_en: string | null;
  gift_details_zh: string | null;
  gift_collection_instructions: string | null;
  congratulations_message_en: string | null;
  congratulations_message_zh: string | null;
  created_at: string;
}

interface PatientPrizeEntry {
  id: string;
  patient_id: string;
  prize_id: string | null;
  campaign_id: string | null;
  won_at: string;
  viewed: boolean;
  redeem_code: string | null;
  patients?: { patient_name: string } | null;
  marketing_prizes?: {
    prize_name_en: string;
    prize_name_zh: string;
    prize_type: PrizeType;
    discount_code: string | null;
    redeem_code_prefix: string | null;
  } | null;
  marketing_campaigns?: { title_en: string } | null;
}

interface CampaignFormData {
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  start_date: string;
  end_date: string;
  trigger_on_app_open: boolean;
  trigger_on_exercise_count: boolean;
  exercise_count_value: string;
  trigger_on_video_submit: boolean;
  max_draws_per_day: string;
  is_active: boolean;
}

interface PrizeFormData {
  prize_name_en: string;
  prize_name_zh: string;
  prize_type: PrizeType;
  discount_code: string;
  voucher_image_url: string;
  prize_description_en: string;
  prize_description_zh: string;
  quantity_total: string;
  probability_weight: string;
  expiry_date: string;
  redeem_code_prefix: string;
  redeem_instructions_en: string;
  redeem_instructions_zh: string;
  redeem_image_url: string;
  gift_details_en: string;
  gift_details_zh: string;
  gift_collection_instructions: string;
  congratulations_message_en: string;
  congratulations_message_zh: string;
}

const EMPTY_CAMPAIGN_FORM: CampaignFormData = {
  title_en: '',
  title_zh: '',
  description_en: '',
  description_zh: '',
  start_date: '',
  end_date: '',
  trigger_on_app_open: false,
  trigger_on_exercise_count: false,
  exercise_count_value: '',
  trigger_on_video_submit: false,
  max_draws_per_day: '1',
  is_active: true,
};

const EMPTY_PRIZE_FORM: PrizeFormData = {
  prize_name_en: '',
  prize_name_zh: '',
  prize_type: 'discount_code',
  discount_code: '',
  voucher_image_url: '',
  prize_description_en: '',
  prize_description_zh: '',
  quantity_total: '100',
  probability_weight: '50',
  expiry_date: '',
  redeem_code_prefix: '',
  redeem_instructions_en: '',
  redeem_instructions_zh: '',
  redeem_image_url: '',
  gift_details_en: '',
  gift_details_zh: '',
  gift_collection_instructions: '',
  congratulations_message_en: '',
  congratulations_message_zh: '',
};

const PRIZE_TYPES: { value: PrizeType; labelEn: string; labelZh: string; color: string; bg: string }[] = [
  { value: 'discount_code', labelEn: 'Discount Code', labelZh: '折扣碼', color: Colors.green, bg: Colors.greenLight },
  { value: 'voucher', labelEn: 'Voucher Image', labelZh: '優惠券', color: '#7c5cbf', bg: '#ece4f7' },
  { value: 'redeem_voucher', labelEn: 'Redeem Voucher', labelZh: '兌換券', color: '#2a9d8f', bg: '#d4f0ec' },
  { value: 'gift', labelEn: 'Gift', labelZh: '禮品', color: '#c47a2a', bg: '#f5e8d4' },
  { value: 'message', labelEn: 'Message', labelZh: '訊息', color: '#3a7ec0', bg: '#dce8f5' },
];

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

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getCampaignStatus(campaign: MarketingCampaign): { label: string; labelZh: string; bg: string; text: string } {
  if (!campaign.is_active) return { label: 'Disabled', labelZh: '停用', bg: Colors.borderLight, text: Colors.textSecondary };
  const now = new Date();
  if (campaign.start_date && new Date(campaign.start_date) > now) return { label: 'Scheduled', labelZh: '排程', bg: '#e0e8f5', text: '#4a6fa5' };
  if (campaign.end_date && new Date(campaign.end_date) < now) return { label: 'Expired', labelZh: '已過期', bg: Colors.dangerLight, text: Colors.danger };
  return { label: 'Active', labelZh: '啟用中', bg: Colors.greenLight, text: Colors.green };
}

function getPrizeTypeMeta(type: PrizeType) {
  return PRIZE_TYPES.find((t) => t.value === type) ?? PRIZE_TYPES[0];
}

export default function MarketingDrawsScreen() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'log'>('campaigns');

  const [campaignFormVisible, setCampaignFormVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormData>(EMPTY_CAMPAIGN_FORM);

  const [prizeViewCampaignId, setPrizeViewCampaignId] = useState<string | null>(null);
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
    queryKey: ['marketing_prizes', prizeViewCampaignId],
    queryFn: async () => {
      if (!prizeViewCampaignId) return [];
      console.log('[MarketingDraws] Fetching prizes for campaign:', prizeViewCampaignId);
      const { data, error } = await supabase
        .from('marketing_prizes')
        .select('*')
        .eq('campaign_id', prizeViewCampaignId)
        .order('probability_weight', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingPrize[];
    },
    enabled: !!prizeViewCampaignId,
  });

  const prizeLogQuery = useQuery({
    queryKey: ['patient_prizes'],
    queryFn: async () => {
      console.log('[MarketingDraws] Fetching prize log');
      const { data, error } = await supabase
        .from('patient_prizes')
        .select('*, patients(patient_name), marketing_prizes(prize_name_en, prize_name_zh, prize_type, discount_code, redeem_code_prefix), marketing_campaigns(title_en)')
        .order('won_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PatientPrizeEntry[];
    },
  });

  const saveCampaignMutation = useMutation({
    mutationFn: async (payload: CampaignFormData & { id?: string }) => {
      const row: Record<string, unknown> = {
        title_en: payload.title_en.trim(),
        title_zh: payload.title_zh.trim(),
        description_en: payload.description_en.trim() || null,
        description_zh: payload.description_zh.trim() || null,
        start_date: payload.start_date.trim() || null,
        end_date: payload.end_date.trim() || null,
        trigger_on_app_open: payload.trigger_on_app_open,
        trigger_on_exercise_count: payload.trigger_on_exercise_count && payload.exercise_count_value
          ? parseInt(payload.exercise_count_value, 10)
          : null,
        trigger_on_video_submit: payload.trigger_on_video_submit,
        max_draws_per_day: payload.max_draws_per_day ? parseInt(payload.max_draws_per_day, 10) : 1,
        is_active: payload.is_active,
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
      await supabase.from('marketing_prizes').delete().eq('campaign_id', id);
      const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
    },
  });

  const savePrizeMutation = useMutation({
    mutationFn: async (payload: PrizeFormData & { id?: string; campaign_id: string }) => {
      const qtyTotal = payload.quantity_total ? parseInt(payload.quantity_total, 10) : 100;
      const pt = payload.prize_type;
      const row: Record<string, unknown> = {
        campaign_id: payload.campaign_id,
        prize_name_en: payload.prize_name_en.trim(),
        prize_name_zh: payload.prize_name_zh.trim(),
        prize_type: pt,
        discount_code: pt === 'discount_code' ? (payload.discount_code.trim() || null) : null,
        voucher_image_url: pt === 'voucher' ? (payload.voucher_image_url.trim() || null) : null,
        prize_description_en: payload.prize_description_en.trim() || null,
        prize_description_zh: payload.prize_description_zh.trim() || null,
        quantity_total: qtyTotal,
        probability_weight: payload.probability_weight ? parseInt(payload.probability_weight, 10) : 50,
        expiry_date: payload.expiry_date.trim() || null,
        redeem_code_prefix: pt === 'redeem_voucher' ? (payload.redeem_code_prefix.trim() || null) : null,
        redeem_instructions_en: pt === 'redeem_voucher' ? (payload.redeem_instructions_en.trim() || null) : null,
        redeem_instructions_zh: pt === 'redeem_voucher' ? (payload.redeem_instructions_zh.trim() || null) : null,
        redeem_image_url: pt === 'redeem_voucher' ? (payload.redeem_image_url.trim() || null) : null,
        gift_details_en: pt === 'gift' ? (payload.gift_details_en.trim() || null) : null,
        gift_details_zh: pt === 'gift' ? (payload.gift_details_zh.trim() || null) : null,
        gift_collection_instructions: pt === 'gift' ? (payload.gift_collection_instructions.trim() || null) : null,
        congratulations_message_en: pt === 'message' ? (payload.congratulations_message_en.trim() || null) : null,
        congratulations_message_zh: pt === 'message' ? (payload.congratulations_message_zh.trim() || null) : null,
      };
      if (payload.id) {
        console.log('[MarketingDraws] Updating prize:', payload.id);
        const { error } = await supabase.from('marketing_prizes').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[MarketingDraws] Inserting new prize');
        row.quantity_remaining = qtyTotal;
        const { error } = await supabase.from('marketing_prizes').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing_prizes', prizeViewCampaignId] });
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
      void queryClient.invalidateQueries({ queryKey: ['marketing_prizes', prizeViewCampaignId] });
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
      title_en: c.title_en ?? '',
      title_zh: c.title_zh ?? '',
      description_en: c.description_en ?? '',
      description_zh: c.description_zh ?? '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      end_date: c.end_date ? c.end_date.split('T')[0] : '',
      trigger_on_app_open: c.trigger_on_app_open ?? false,
      trigger_on_exercise_count: c.trigger_on_exercise_count != null && c.trigger_on_exercise_count > 0,
      exercise_count_value: c.trigger_on_exercise_count != null ? String(c.trigger_on_exercise_count) : '',
      trigger_on_video_submit: c.trigger_on_video_submit ?? false,
      max_draws_per_day: c.max_draws_per_day != null ? String(c.max_draws_per_day) : '1',
      is_active: c.is_active,
    });
    setCampaignFormVisible(true);
  }, []);

  const handleDeleteCampaign = useCallback((c: MarketingCampaign) => {
    const title = language === 'zh' ? c.title_zh : c.title_en;
    Alert.alert(
      language === 'zh' ? '刪除活動' : 'Delete Campaign',
      language === 'zh' ? `確定要刪除「${title}」嗎？相關獎品也會被刪除。` : `Delete "${title}"? Related prizes will also be deleted.`,
      [
        { text: language === 'zh' ? '取消' : 'Cancel', style: 'cancel' },
        { text: language === 'zh' ? '刪除' : 'Delete', style: 'destructive', onPress: () => deleteCampaignMutation.mutate(c.id) },
      ]
    );
  }, [language, deleteCampaignMutation]);

  const handleSaveCampaign = useCallback(() => {
    if (!campaignForm.title_en.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入英文標題' : 'English title is required');
      return;
    }
    if (!campaignForm.title_zh.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入中文標題' : 'Chinese title is required');
      return;
    }
    saveCampaignMutation.mutate({ ...campaignForm, id: editingCampaign?.id });
  }, [campaignForm, editingCampaign, saveCampaignMutation, language]);

  const handleManagePrizes = useCallback((c: MarketingCampaign) => {
    setPrizeViewCampaignId(c.id);
  }, []);

  const handleAddPrize = useCallback(() => {
    setEditingPrize(null);
    setPrizeForm(EMPTY_PRIZE_FORM);
    setPrizeFormVisible(true);
  }, []);

  const handleEditPrize = useCallback((p: MarketingPrize) => {
    setEditingPrize(p);
    setPrizeForm({
      prize_name_en: p.prize_name_en ?? '',
      prize_name_zh: p.prize_name_zh ?? '',
      prize_type: p.prize_type ?? 'discount_code',
      discount_code: p.discount_code ?? '',
      voucher_image_url: p.voucher_image_url ?? '',
      prize_description_en: p.prize_description_en ?? '',
      prize_description_zh: p.prize_description_zh ?? '',
      quantity_total: p.quantity_total != null ? String(p.quantity_total) : '100',
      probability_weight: p.probability_weight != null ? String(p.probability_weight) : '50',
      expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '',
      redeem_code_prefix: p.redeem_code_prefix ?? '',
      redeem_instructions_en: p.redeem_instructions_en ?? '',
      redeem_instructions_zh: p.redeem_instructions_zh ?? '',
      redeem_image_url: p.redeem_image_url ?? '',
      gift_details_en: p.gift_details_en ?? '',
      gift_details_zh: p.gift_details_zh ?? '',
      gift_collection_instructions: p.gift_collection_instructions ?? '',
      congratulations_message_en: p.congratulations_message_en ?? '',
      congratulations_message_zh: p.congratulations_message_zh ?? '',
    });
    setPrizeFormVisible(true);
  }, []);

  const handleDeletePrize = useCallback((p: MarketingPrize) => {
    const name = language === 'zh' ? p.prize_name_zh : p.prize_name_en;
    Alert.alert(
      language === 'zh' ? '刪除獎品' : 'Delete Prize',
      language === 'zh' ? `確定要刪除「${name}」嗎？` : `Delete "${name}"?`,
      [
        { text: language === 'zh' ? '取消' : 'Cancel', style: 'cancel' },
        { text: language === 'zh' ? '刪除' : 'Delete', style: 'destructive', onPress: () => deletePrizeMutation.mutate(p.id) },
      ]
    );
  }, [language, deletePrizeMutation]);

  const handleSavePrize = useCallback(() => {
    if (!prizeForm.prize_name_en.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入英文獎品名稱' : 'Prize name (EN) is required');
      return;
    }
    if (!prizeForm.prize_name_zh.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入中文獎品名稱' : 'Prize name (繁中) is required');
      return;
    }
    if (!prizeViewCampaignId) return;
    savePrizeMutation.mutate({ ...prizeForm, campaign_id: prizeViewCampaignId, id: editingPrize?.id });
  }, [prizeForm, editingPrize, prizeViewCampaignId, savePrizeMutation, language]);

  const campaigns = campaignsQuery.data ?? [];
  const prizes = prizesQuery.data ?? [];
  const prizeLog = prizeLogQuery.data ?? [];

  const renderTriggerInfo = (c: MarketingCampaign) => {
    const triggers: string[] = [];
    if (c.trigger_on_app_open) triggers.push(language === 'zh' ? '打開App' : 'App Open');
    if (c.trigger_on_exercise_count != null && c.trigger_on_exercise_count > 0)
      triggers.push(language === 'zh' ? `完成${c.trigger_on_exercise_count}個運動` : `${c.trigger_on_exercise_count} Exercises`);
    if (c.trigger_on_video_submit) triggers.push(language === 'zh' ? '提交影片' : 'Video Submit');
    if (triggers.length === 0) return null;
    return (
      <View style={styles.triggerRow}>
        <Text style={styles.triggerLabel}>{language === 'zh' ? '觸發：' : 'Triggers: '}</Text>
        {triggers.map((t) => (
          <View key={t} style={styles.triggerChip}>
            <Text style={styles.triggerChipText}>{t}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderPrizeListView = () => {
    const campaign = campaigns.find((c) => c.id === prizeViewCampaignId);
    const campaignTitle = campaign
      ? (language === 'zh' ? campaign.title_zh : campaign.title_en)
      : '';
    return (
      <>
        <TouchableOpacity
          onPress={() => setPrizeViewCampaignId(null)}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={Colors.accent} />
          <Text style={styles.backBtnText}>{language === 'zh' ? '返回活動列表' : 'Back to Campaigns'}</Text>
        </TouchableOpacity>

        <Text style={styles.prizeViewTitle} numberOfLines={2}>
          {campaignTitle} — {language === 'zh' ? '獎品' : 'Prizes'}
        </Text>

        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddPrize} activeOpacity={0.7}>
            <Plus size={16} color={Colors.white} />
            <Text style={styles.primaryBtnText}>{language === 'zh' ? '新增獎品' : 'Add Prize'}</Text>
          </TouchableOpacity>
        </View>

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
          prizes.map((p) => {
            const typeMeta = getPrizeTypeMeta(p.prize_type);
            const name = language === 'zh' ? p.prize_name_zh : p.prize_name_en;
            const imageUrl = p.voucher_image_url || (p.prize_type === 'redeem_voucher' ? p.redeem_image_url : null);
            const qtyRemaining = p.quantity_remaining ?? 0;
            const isZero = qtyRemaining === 0;
            return (
              <View key={p.id} style={styles.prizeCard}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.prizeImage} />
                ) : (
                  <View style={styles.prizeImagePlaceholder}>
                    <Package size={20} color={Colors.textTertiary} />
                  </View>
                )}
                <View style={styles.prizeInfo}>
                  <Text style={styles.prizeName} numberOfLines={1}>{name}</Text>
                  <View style={styles.prizeMetaRow}>
                    <View style={[styles.typeBadgeSmall, { backgroundColor: typeMeta.bg }]}>
                      <Text style={[styles.typeBadgeSmallText, { color: typeMeta.color }]}>
                        {language === 'zh' ? typeMeta.labelZh : typeMeta.labelEn}
                      </Text>
                    </View>
                  </View>
                  {renderPrizeTypeSpecificInfo(p)}
                  <View style={[styles.prizeMetaRow, { marginTop: 4 }]}>
                    <Text style={[styles.prizeQtyText, isZero && { color: Colors.danger }]}>
                      {p.quantity_remaining ?? '—'} / {p.quantity_total ?? '—'}
                    </Text>
                    <View style={[styles.prizeMetaChip, { backgroundColor: '#e0e8f5' }]}>
                      <Text style={[styles.prizeMetaChipText, { color: '#4a6fa5' }]}>
                        W:{p.probability_weight ?? 0}
                      </Text>
                    </View>
                    {p.expiry_date ? (
                      <Text style={styles.prizeSortText}>{formatDate(p.expiry_date)}</Text>
                    ) : null}
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
            );
          })
        )}
      </>
    );
  };

  const renderCampaignListView = () => (
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
          const title = language === 'zh' ? c.title_zh : c.title_en;
          const desc = language === 'zh' ? c.description_zh : c.description_en;
          return (
            <View key={c.id} style={[styles.campaignCard, !c.is_active && styles.cardInactive]}>
              <View style={styles.campaignHeader}>
                <View style={styles.campaignTitleRow}>
                  <View style={styles.campaignIconCircle}>
                    <Gift size={16} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campaignName} numberOfLines={1}>{title}</Text>
                    {desc ? (
                      <Text style={styles.campaignDesc} numberOfLines={2}>{desc}</Text>
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
                {c.max_draws_per_day != null && (
                  <View style={styles.metaItem}>
                    <Hash size={12} color={Colors.textTertiary} />
                    <Text style={styles.metaText}>
                      {language === 'zh' ? `每日 ${c.max_draws_per_day} 次` : `${c.max_draws_per_day}/day`}
                    </Text>
                  </View>
                )}
              </View>

              {renderTriggerInfo(c)}

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

  const renderCampaignsTab = () => (
    <>
      {prizeViewCampaignId ? renderPrizeListView() : renderCampaignListView()}
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
          const patientName = entry.patients?.patient_name ?? entry.patient_id;
          const prizeName = language === 'zh'
            ? (entry.marketing_prizes?.prize_name_zh ?? '—')
            : (entry.marketing_prizes?.prize_name_en ?? '—');
          const campaignName = entry.marketing_campaigns?.title_en ?? '—';
          const prizeType = entry.marketing_prizes?.prize_type;
          const typeMeta = prizeType ? getPrizeTypeMeta(prizeType) : null;
          const discountCode = entry.marketing_prizes?.discount_code;
          const redeemCode = entry.redeem_code;
          return (
            <View key={entry.id} style={styles.logCard}>
              <View style={styles.logAvatarCircle}>
                <Text style={styles.logAvatarText}>
                  {typeof patientName === 'string' ? patientName.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logPatientName} numberOfLines={1}>{patientName}</Text>
                <View style={styles.logDetailsRow}>
                  <View style={styles.logPrizeBadge}>
                    <Trophy size={10} color={Colors.accent} />
                    <Text style={styles.logPrizeText} numberOfLines={1}>{prizeName}</Text>
                  </View>
                  {typeMeta ? (
                    <View style={[styles.typeBadgeSmall, { backgroundColor: typeMeta.bg }]}>
                      <Text style={[styles.typeBadgeSmallText, { color: typeMeta.color }]}>
                        {language === 'zh' ? typeMeta.labelZh : typeMeta.labelEn}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.logDetailsRow}>
                  <Text style={styles.logCampaignText}>{campaignName}</Text>
                  {discountCode ? (
                    <View style={styles.codeChipSmall}>
                      <Text style={styles.codeChipSmallText}>{discountCode}</Text>
                    </View>
                  ) : null}
                  {prizeType === 'redeem_voucher' && redeemCode ? (
                    <View style={[styles.codeChipSmall, { backgroundColor: '#d4f0ec' }]}>
                      <Text style={[styles.codeChipSmallText, { color: '#2a9d8f' }]}>{redeemCode}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.logRight}>
                <Text style={styles.logDate}>{formatDateTime(entry.won_at)}</Text>
                <View style={[styles.viewedBadge, { backgroundColor: entry.viewed ? Colors.greenLight : Colors.dangerLight }]}>
                  {entry.viewed ? <Eye size={10} color={Colors.green} /> : <EyeOff size={10} color={Colors.danger} />}
                  <Text style={[styles.viewedBadgeText, { color: entry.viewed ? Colors.green : Colors.danger }]}>
                    {entry.viewed ? 'Yes' : 'No'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderDateField = (label: string, value: string, onChange: (v: string) => void, quickButtons?: { label: string; onPress: () => void; bg: string; color: string }[]) => (
    <View>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors.textTertiary}
      />
      {quickButtons && quickButtons.length > 0 ? (
        <View style={styles.quickBtnRow}>
          {quickButtons.map((btn) => (
            <TouchableOpacity key={btn.label} onPress={btn.onPress} style={[styles.quickBtn, { backgroundColor: btn.bg }]} activeOpacity={0.7}>
              <Text style={[styles.quickBtnText, { color: btn.color }]}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
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
            <Text style={styles.formLabel}>Title (EN) *</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.title_en}
              onChangeText={(v) => setCampaignForm((p) => ({ ...p, title_en: v }))}
              placeholder="Campaign title in English"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>Title (繁中) *</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.title_zh}
              onChangeText={(v) => setCampaignForm((p) => ({ ...p, title_zh: v }))}
              placeholder="活動標題"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>Description (EN)</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={campaignForm.description_en}
              onChangeText={(v) => setCampaignForm((p) => ({ ...p, description_en: v }))}
              placeholder="Campaign description"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>Description (繁中)</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={campaignForm.description_zh}
              onChangeText={(v) => setCampaignForm((p) => ({ ...p, description_zh: v }))}
              placeholder="活動描述"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            {renderDateField(
              language === 'zh' ? '開始日期 Start Date' : 'Start Date',
              campaignForm.start_date,
              (v) => setCampaignForm((p) => ({ ...p, start_date: v })),
              [
                { label: 'Today', onPress: () => setCampaignForm((p) => ({ ...p, start_date: todayStr() })), bg: Colors.accentLight, color: Colors.accent },
              ]
            )}

            {renderDateField(
              language === 'zh' ? '結束日期 End Date' : 'End Date',
              campaignForm.end_date,
              (v) => setCampaignForm((p) => ({ ...p, end_date: v })),
              [
                { label: '+30 days', onPress: () => setCampaignForm((p) => ({ ...p, end_date: addDaysStr(30) })), bg: Colors.greenLight, color: Colors.green },
                { label: '+90 days', onPress: () => setCampaignForm((p) => ({ ...p, end_date: addDaysStr(90) })), bg: Colors.borderLight, color: Colors.textSecondary },
              ]
            )}

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>{language === 'zh' ? '觸發規則 Trigger Rules' : 'Trigger Rules'}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setCampaignForm((p) => ({ ...p, trigger_on_app_open: !p.trigger_on_app_open }))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, campaignForm.trigger_on_app_open && styles.checkboxChecked]}>
                {campaignForm.trigger_on_app_open && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>On App Open 打開App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setCampaignForm((p) => ({ ...p, trigger_on_exercise_count: !p.trigger_on_exercise_count }))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, campaignForm.trigger_on_exercise_count && styles.checkboxChecked]}>
                {campaignForm.trigger_on_exercise_count && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>After N Exercises 完成N個運動</Text>
            </TouchableOpacity>
            {campaignForm.trigger_on_exercise_count && (
              <TextInput
                style={[styles.formInput, { marginLeft: 36, marginTop: 6, width: 120 }]}
                value={campaignForm.exercise_count_value}
                onChangeText={(v) => setCampaignForm((p) => ({ ...p, exercise_count_value: v }))}
                placeholder="e.g. 5"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            )}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setCampaignForm((p) => ({ ...p, trigger_on_video_submit: !p.trigger_on_video_submit }))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, campaignForm.trigger_on_video_submit && styles.checkboxChecked]}>
                {campaignForm.trigger_on_video_submit && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>On Video Submit 提交影片</Text>
            </TouchableOpacity>

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>{language === 'zh' ? '限制 Limits' : 'Limits'}</Text>
            </View>

            <Text style={styles.formLabel}>{language === 'zh' ? '每日最多抽獎次數 Max Draws/Day' : 'Max Draws Per Day'}</Text>
            <TextInput
              style={styles.formInput}
              value={campaignForm.max_draws_per_day}
              onChangeText={(v) => setCampaignForm((p) => ({ ...p, max_draws_per_day: v }))}
              placeholder="1"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <View style={styles.formSwitchRow}>
              <Text style={styles.formLabel}>{language === 'zh' ? '啟用 Active' : 'Active'}</Text>
              <Switch
                value={campaignForm.is_active}
                onValueChange={(v) => setCampaignForm((p) => ({ ...p, is_active: v }))}
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

  const renderPrizeTypeSpecificInfo = (p: MarketingPrize) => {
    if (p.prize_type === 'discount_code' && p.discount_code) {
      return (
        <View style={styles.codeChipSmall}>
          <Tag size={9} color={Colors.green} />
          <Text style={styles.codeChipSmallText}>{p.discount_code}</Text>
        </View>
      );
    }
    if (p.prize_type === 'redeem_voucher' && p.redeem_code_prefix) {
      return (
        <View style={[styles.codeChipSmall, { backgroundColor: '#d4f0ec' }]}>
          <Ticket size={9} color="#2a9d8f" />
          <Text style={[styles.codeChipSmallText, { color: '#2a9d8f' }]}>{p.redeem_code_prefix}...</Text>
        </View>
      );
    }
    return null;
  };

  const renderPrizeFormModal = () => {
    const currentType = prizeForm.prize_type;
    return (
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
              <Text style={styles.formLabel}>Prize Name (EN) *</Text>
              <TextInput
                style={styles.formInput}
                value={prizeForm.prize_name_en}
                onChangeText={(v) => setPrizeForm((p) => ({ ...p, prize_name_en: v }))}
                placeholder="Prize name in English"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.formLabel}>Prize Name (繁中) *</Text>
              <TextInput
                style={styles.formInput}
                value={prizeForm.prize_name_zh}
                onChangeText={(v) => setPrizeForm((p) => ({ ...p, prize_name_zh: v }))}
                placeholder="獎品名稱"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.formLabel}>{language === 'zh' ? '獎品類型 Prize Type' : 'Prize Type'}</Text>
              <View style={styles.typePickerRow}>
                {PRIZE_TYPES.map((t) => {
                  const iconColor = currentType === t.value ? t.color : Colors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.typePickerBtn, currentType === t.value && { backgroundColor: t.bg, borderColor: t.color }]}
                      onPress={() => setPrizeForm((p) => ({ ...p, prize_type: t.value }))}
                      activeOpacity={0.7}
                    >
                      {t.value === 'discount_code' && <TicketPercent size={13} color={iconColor} />}
                      {t.value === 'voucher' && <ImageIcon size={13} color={iconColor} />}
                      {t.value === 'redeem_voucher' && <Ticket size={13} color={iconColor} />}
                      {t.value === 'gift' && <Gift size={13} color={iconColor} />}
                      {t.value === 'message' && <MessageSquare size={13} color={iconColor} />}
                      <Text style={[styles.typePickerText, currentType === t.value && { color: t.color, fontWeight: '700' as const }]}>
                        {language === 'zh' ? t.labelZh : t.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {currentType === 'discount_code' && (
                <>
                  <Text style={styles.formLabel}>Discount Code 折扣碼</Text>
                  <TextInput
                    style={[styles.formInput, styles.codeInput]}
                    value={prizeForm.discount_code}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, discount_code: v }))}
                    placeholder="e.g. SAVE20"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="characters"
                  />
                </>
              )}

              {currentType === 'voucher' && (
                <>
                  <Text style={styles.formLabel}>Voucher Image URL 優惠券圖片</Text>
                  <TextInput
                    style={styles.formInput}
                    value={prizeForm.voucher_image_url}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, voucher_image_url: v }))}
                    placeholder="https://..."
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                  />
                  {prizeForm.voucher_image_url.trim() ? (
                    <Image source={{ uri: prizeForm.voucher_image_url.trim() }} style={styles.formImagePreview} />
                  ) : null}
                </>
              )}

              {currentType === 'redeem_voucher' && (
                <>
                  <Text style={styles.formLabel}>Redeem Code Prefix 兌換碼前綴</Text>
                  <TextInput
                    style={[styles.formInput, styles.codeInput]}
                    value={prizeForm.redeem_code_prefix}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, redeem_code_prefix: v }))}
                    placeholder="e.g. RDM-"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="characters"
                  />

                  <Text style={styles.formLabel}>Redeem Instructions (EN) 兌換說明</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={prizeForm.redeem_instructions_en}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, redeem_instructions_en: v }))}
                    placeholder="Instructions for redeeming this voucher"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.formLabel}>Redeem Instructions (繁中) 兌換說明</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={prizeForm.redeem_instructions_zh}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, redeem_instructions_zh: v }))}
                    placeholder="兌換此優惠券的說明"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.formLabel}>Voucher Image (optional) 優惠券圖片</Text>
                  <TextInput
                    style={styles.formInput}
                    value={prizeForm.redeem_image_url}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, redeem_image_url: v }))}
                    placeholder="https://..."
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                  />
                  {prizeForm.redeem_image_url.trim() ? (
                    <Image source={{ uri: prizeForm.redeem_image_url.trim() }} style={styles.formImagePreview} />
                  ) : null}
                </>
              )}

              {currentType === 'gift' && (
                <>
                  <Text style={styles.formLabel}>Gift Details (EN) 禮品詳情</Text>
                  <TextInput
                    style={styles.formInput}
                    value={prizeForm.gift_details_en}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, gift_details_en: v }))}
                    placeholder="Gift description"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.formLabel}>Gift Details (繁中) 禮品詳情</Text>
                  <TextInput
                    style={styles.formInput}
                    value={prizeForm.gift_details_zh}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, gift_details_zh: v }))}
                    placeholder="禮品描述"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.formLabel}>Collection Instructions 領取說明</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={prizeForm.gift_collection_instructions}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, gift_collection_instructions: v }))}
                    placeholder="How to collect the gift"
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}

              {currentType === 'message' && (
                <>
                  <Text style={styles.formLabel}>Congratulations Message (EN) 恭喜訊息</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={prizeForm.congratulations_message_en}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, congratulations_message_en: v }))}
                    placeholder="Congratulations! You won..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.formLabel}>Congratulations Message (繁中) 恭喜訊息</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={prizeForm.congratulations_message_zh}
                    onChangeText={(v) => setPrizeForm((p) => ({ ...p, congratulations_message_zh: v }))}
                    placeholder="恭喜您中獎了..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}

              <Text style={styles.formLabel}>Description (EN)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={prizeForm.prize_description_en}
                onChangeText={(v) => setPrizeForm((p) => ({ ...p, prize_description_en: v }))}
                placeholder="Prize description"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.formLabel}>Description (繁中)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={prizeForm.prize_description_zh}
                onChangeText={(v) => setPrizeForm((p) => ({ ...p, prize_description_zh: v }))}
                placeholder="獎品描述"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.formLabel}>{language === 'zh' ? '總數量 Total Quantity' : 'Total Quantity'}</Text>
              <TextInput
                style={styles.formInput}
                value={prizeForm.quantity_total}
                onChangeText={(v) => setPrizeForm((p) => ({ ...p, quantity_total: v }))}
                placeholder="100"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>{language === 'zh' ? '機率權重 Probability Weight' : 'Probability Weight'}</Text>
              <TextInput
                style={styles.formInput}
                value={prizeForm.probability_weight}
                onChangeText={(v) => setPrizeForm((p) => ({ ...p, probability_weight: v }))}
                placeholder="50"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
              <Text style={styles.formHint}>{language === 'zh' ? '數值越高，中獎機率越大' : 'Higher value = more likely to win'}</Text>

              {renderDateField(
                language === 'zh' ? '過期日期 Expiry Date' : 'Expiry Date',
                prizeForm.expiry_date,
                (v) => setPrizeForm((p) => ({ ...p, expiry_date: v })),
                [
                  { label: '+90 days', onPress: () => setPrizeForm((p) => ({ ...p, expiry_date: addDaysStr(90) })), bg: Colors.greenLight, color: Colors.green },
                  { label: '+180 days', onPress: () => setPrizeForm((p) => ({ ...p, expiry_date: addDaysStr(180) })), bg: Colors.borderLight, color: Colors.textSecondary },
                ]
              )}
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
  };

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
            {language === 'zh' ? '活動 Campaigns' : 'Campaigns'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'log' && styles.tabActive]}
          onPress={() => setActiveTab('log')}
          activeOpacity={0.7}
        >
          <Trophy size={14} color={activeTab === 'log' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'log' && styles.tabTextActive]}>
            {language === 'zh' ? '獎品記錄 Prize Log' : 'Prize Log'}
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
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'campaigns' ? renderCampaignsTab() : renderPrizeLogTab()}
      </ScrollView>

      {renderCampaignFormModal()}
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
    marginBottom: 6,
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
  triggerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 46,
    marginBottom: 8,
  },
  triggerLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
  },
  triggerChip: {
    backgroundColor: '#e0e8f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  triggerChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#4a6fa5',
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
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
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
  logRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
    gap: 4,
  },
  logDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'right' as const,
    minWidth: 80,
  },
  viewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  viewedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  typeBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  codeChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.greenLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  codeChipSmallText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.green,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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

  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
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
  prizeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
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
  prizeQtyText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
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
    minHeight: 64,
    textAlignVertical: 'top' as const,
  },
  formImagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: Colors.inputBg,
  },
  formHint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  formSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  quickBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  sectionDivider: {
    marginTop: 20,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  typePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  typePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  typePickerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  codeInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  prizeViewTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
});
