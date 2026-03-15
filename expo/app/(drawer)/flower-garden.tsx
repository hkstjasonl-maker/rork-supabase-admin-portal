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
import { Plus, Pencil, Trash2, X, Flower2, Users, Crown, Star, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Patient } from '@/types/patient';

interface FlowerType {
  id: string;
  name_en: string;
  name_zh: string | null;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  image_url: string | null;
  description_en: string | null;
  description_zh: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface FlowerTypeFormData {
  name_en: string;
  name_zh: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  image_url: string;
  description_en: string;
  description_zh: string;
  sort_order: string;
  is_active: boolean;
}

interface PatientFlower {
  id: string;
  patient_id: string;
  flower_type_id: string;
  earned_at: string;
  stars_used: number | null;
}

interface GachaDraw {
  id: string;
  patient_id: string;
  flower_type_id: string;
  created_at: string;
}

const EMPTY_FORM: FlowerTypeFormData = {
  name_en: '',
  name_zh: '',
  rarity: 'common',
  image_url: '',
  description_en: '',
  description_zh: '',
  sort_order: '0',
  is_active: true,
};

const RARITY_OPTIONS: FlowerType['rarity'][] = ['common', 'uncommon', 'rare', 'legendary'];

function getRarityStyle(rarity: string): { bg: string; text: string; label: string; labelZh: string } {
  switch (rarity) {
    case 'common': return { bg: '#e8f0eb', text: '#5b8a72', label: 'Common', labelZh: '普通' };
    case 'uncommon': return { bg: '#e0e8f5', text: '#4a6fa5', label: 'Uncommon', labelZh: '稀有' };
    case 'rare': return { bg: '#f0e0f5', text: '#8a4fa5', label: 'Rare', labelZh: '珍貴' };
    case 'legendary': return { bg: '#fdf3e0', text: '#c4841d', label: 'Legendary', labelZh: '傳奇' };
    default: return { bg: Colors.borderLight, text: Colors.textSecondary, label: rarity, labelZh: rarity };
  }
}

export default function FlowerGardenScreen() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'types' | 'gardens'>('types');
  const [formVisible, setFormVisible] = useState(false);
  const [editingFlower, setEditingFlower] = useState<FlowerType | null>(null);
  const [form, setForm] = useState<FlowerTypeFormData>(EMPTY_FORM);
  const [rarityPickerVisible, setRarityPickerVisible] = useState(false);

  const flowerTypesQuery = useQuery({
    queryKey: ['flower_types'],
    queryFn: async () => {
      console.log('[FlowerGarden] Fetching flower types');
      const { data, error } = await supabase
        .from('flower_types')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FlowerType[];
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

  const patientFlowersQuery = useQuery({
    queryKey: ['patient_flowers'],
    queryFn: async () => {
      console.log('[FlowerGarden] Fetching patient flowers');
      const { data, error } = await supabase
        .from('patient_flowers')
        .select('*');
      if (error) throw error;
      return (data ?? []) as PatientFlower[];
    },
  });

  const gachaDrawsQuery = useQuery({
    queryKey: ['gacha_draws'],
    queryFn: async () => {
      console.log('[FlowerGarden] Fetching gacha draws');
      const { data, error } = await supabase
        .from('gacha_draws')
        .select('*');
      if (error) throw error;
      return (data ?? []) as GachaDraw[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FlowerTypeFormData & { id?: string }) => {
      const row = {
        name_en: payload.name_en.trim(),
        name_zh: payload.name_zh.trim() || null,
        rarity: payload.rarity,
        image_url: payload.image_url.trim() || null,
        description_en: payload.description_en.trim() || null,
        description_zh: payload.description_zh.trim() || null,
        sort_order: parseInt(payload.sort_order, 10) || 0,
        is_active: payload.is_active,
      };
      if (payload.id) {
        console.log('[FlowerGarden] Updating flower type:', payload.id);
        const { error } = await supabase.from('flower_types').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[FlowerGarden] Inserting new flower type');
        const { error } = await supabase.from('flower_types').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flower_types'] });
      setFormVisible(false);
      setEditingFlower(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[FlowerGarden] Deleting flower type:', id);
      const { error } = await supabase.from('flower_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flower_types'] });
    },
  });

  const handleAdd = useCallback(() => {
    setEditingFlower(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((flower: FlowerType) => {
    setEditingFlower(flower);
    setForm({
      name_en: flower.name_en,
      name_zh: flower.name_zh ?? '',
      rarity: flower.rarity,
      image_url: flower.image_url ?? '',
      description_en: flower.description_en ?? '',
      description_zh: flower.description_zh ?? '',
      sort_order: String(flower.sort_order ?? 0),
      is_active: flower.is_active,
    });
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback((flower: FlowerType) => {
    Alert.alert(
      language === 'zh' ? '刪除花朵' : 'Delete Flower',
      language === 'zh' ? `確定要刪除「${flower.name_zh || flower.name_en}」嗎？` : `Delete "${flower.name_en}"?`,
      [
        { text: language === 'zh' ? '取消' : 'Cancel', style: 'cancel' },
        { text: language === 'zh' ? '刪除' : 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(flower.id) },
      ]
    );
  }, [language, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.name_en.trim()) {
      Alert.alert('', language === 'zh' ? '請輸入英文名稱' : 'Name (EN) is required');
      return;
    }
    saveMutation.mutate({ ...form, id: editingFlower?.id });
  }, [form, editingFlower, saveMutation, language]);

  const updateForm = useCallback((key: keyof FlowerTypeFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const flowerTypes = flowerTypesQuery.data ?? [];

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    (flowerTypesQuery.data ?? []).forEach((f) => { counts[f.rarity] = (counts[f.rarity] ?? 0) + 1; });
    return counts;
  }, [flowerTypesQuery.data]);

  const patientGardenStats = useMemo(() => {
    const pats = patientsQuery.data ?? [];
    const pFlowers = patientFlowersQuery.data ?? [];
    const gDraws = gachaDrawsQuery.data ?? [];
    const statsMap: Record<string, { totalFlowers: number; typesCollected: Set<string>; totalStars: number; gachaCount: number }> = {};
    pFlowers.forEach((pf) => {
      if (!statsMap[pf.patient_id]) {
        statsMap[pf.patient_id] = { totalFlowers: 0, typesCollected: new Set(), totalStars: 0, gachaCount: 0 };
      }
      statsMap[pf.patient_id].totalFlowers += 1;
      statsMap[pf.patient_id].typesCollected.add(pf.flower_type_id);
      statsMap[pf.patient_id].totalStars += pf.stars_used ?? 0;
    });
    gDraws.forEach((gd) => {
      if (!statsMap[gd.patient_id]) {
        statsMap[gd.patient_id] = { totalFlowers: 0, typesCollected: new Set(), totalStars: 0, gachaCount: 0 };
      }
      statsMap[gd.patient_id].gachaCount += 1;
    });
    return pats
      .filter((p) => statsMap[p.id])
      .map((p) => ({
        patient: p,
        totalFlowers: statsMap[p.id].totalFlowers,
        typesCollected: statsMap[p.id].typesCollected.size,
        totalStars: statsMap[p.id].totalStars,
        gachaCount: statsMap[p.id].gachaCount,
      }))
      .sort((a, b) => b.totalFlowers - a.totalFlowers);
  }, [patientsQuery.data, patientFlowersQuery.data, gachaDrawsQuery.data]);

  const getFlowerName = useCallback((flower: FlowerType) => {
    if (language === 'zh' && flower.name_zh) return flower.name_zh;
    return flower.name_en;
  }, [language]);

  const renderRaritySummary = () => (
    <View style={styles.raritySummaryRow}>
      {RARITY_OPTIONS.map((r) => {
        const rs = getRarityStyle(r);
        return (
          <View key={r} style={[styles.rarityChip, { backgroundColor: rs.bg }]}>
            <Text style={[styles.rarityChipText, { color: rs.text }]}>
              {language === 'zh' ? rs.labelZh : rs.label}: {rarityCounts[r] ?? 0}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderFlowerTypesTab = () => (
    <>
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
          <Plus size={16} color={Colors.white} />
          <Text style={styles.primaryBtnText}>{language === 'zh' ? '新增花朵' : 'Add Flower'}</Text>
        </TouchableOpacity>
      </View>

      {renderRaritySummary()}

      {flowerTypesQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{language === 'zh' ? '載入中...' : 'Loading...'}</Text>
        </View>
      ) : flowerTypes.length === 0 ? (
        <View style={styles.centered}>
          <Flower2 size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{language === 'zh' ? '尚無花朵類型' : 'No flower types yet'}</Text>
        </View>
      ) : (
        flowerTypes.map((flower) => {
          const rs = getRarityStyle(flower.rarity);
          return (
            <View key={flower.id} style={[styles.flowerCard, !flower.is_active && styles.flowerCardInactive]}>
              {flower.image_url ? (
                <Image source={{ uri: flower.image_url }} style={styles.flowerImage} />
              ) : (
                <View style={[styles.flowerImagePlaceholder, { backgroundColor: rs.bg }]}>
                  <Flower2 size={24} color={rs.text} />
                </View>
              )}
              <View style={styles.flowerInfo}>
                <View style={styles.flowerNameRow}>
                  <Text style={styles.flowerName} numberOfLines={1}>{getFlowerName(flower)}</Text>
                  {!flower.is_active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>{language === 'zh' ? '停用' : 'Inactive'}</Text>
                    </View>
                  )}
                </View>
                {language === 'zh' && flower.name_en ? (
                  <Text style={styles.flowerSubName}>{flower.name_en}</Text>
                ) : flower.name_zh ? (
                  <Text style={styles.flowerSubName}>{flower.name_zh}</Text>
                ) : null}
                <View style={styles.flowerMetaRow}>
                  <View style={[styles.rarityBadge, { backgroundColor: rs.bg }]}>
                    <Text style={[styles.rarityBadgeText, { color: rs.text }]}>
                      {language === 'zh' ? rs.labelZh : rs.label}
                    </Text>
                  </View>
                  <Text style={styles.flowerSort}>#{flower.sort_order}</Text>
                </View>
                {(language === 'zh' ? flower.description_zh : flower.description_en) ? (
                  <Text style={styles.flowerDesc} numberOfLines={2}>
                    {language === 'zh' ? (flower.description_zh || flower.description_en) : (flower.description_en || flower.description_zh)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.flowerActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(flower)} activeOpacity={0.7}>
                  <Pencil size={15} color={Colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(flower)} activeOpacity={0.7}>
                  <Trash2 size={15} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderPatientGardensTab = () => (
    <>
      {patientFlowersQuery.isLoading || gachaDrawsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{language === 'zh' ? '載入中...' : 'Loading...'}</Text>
        </View>
      ) : patientGardenStats.length === 0 ? (
        <View style={styles.centered}>
          <Users size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{language === 'zh' ? '尚無患者花田數據' : 'No patient garden data yet'}</Text>
        </View>
      ) : (
        patientGardenStats.map((stat) => (
          <View key={stat.patient.id} style={styles.gardenCard}>
            <View style={styles.gardenHeader}>
              <View style={styles.gardenAvatarCircle}>
                <Text style={styles.gardenAvatarText}>{stat.patient.patient_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.gardenPatientInfo}>
                <Text style={styles.gardenPatientName}>{stat.patient.patient_name}</Text>
                <Text style={styles.gardenPatientCode}>{stat.patient.access_code}</Text>
              </View>
            </View>
            <View style={styles.gardenStatsRow}>
              <View style={styles.gardenStatItem}>
                <View style={[styles.gardenStatIcon, { backgroundColor: '#fce8e8' }]}>
                  <Flower2 size={14} color="#d94f4f" />
                </View>
                <View>
                  <Text style={styles.gardenStatValue}>{stat.totalFlowers}</Text>
                  <Text style={styles.gardenStatLabel}>{language === 'zh' ? '花朵數' : 'Flowers'}</Text>
                </View>
              </View>
              <View style={styles.gardenStatItem}>
                <View style={[styles.gardenStatIcon, { backgroundColor: '#f0e0f5' }]}>
                  <Sparkles size={14} color="#8a4fa5" />
                </View>
                <View>
                  <Text style={styles.gardenStatValue}>{stat.typesCollected}</Text>
                  <Text style={styles.gardenStatLabel}>{language === 'zh' ? '種類' : 'Types'}</Text>
                </View>
              </View>
              <View style={styles.gardenStatItem}>
                <View style={[styles.gardenStatIcon, { backgroundColor: '#fdf3e0' }]}>
                  <Star size={14} color="#c4841d" />
                </View>
                <View>
                  <Text style={styles.gardenStatValue}>{stat.totalStars}</Text>
                  <Text style={styles.gardenStatLabel}>{language === 'zh' ? '星星' : 'Stars'}</Text>
                </View>
              </View>
              <View style={styles.gardenStatItem}>
                <View style={[styles.gardenStatIcon, { backgroundColor: '#e0e8f5' }]}>
                  <Crown size={14} color="#4a6fa5" />
                </View>
                <View>
                  <Text style={styles.gardenStatValue}>{stat.gachaCount}</Text>
                  <Text style={styles.gardenStatLabel}>{language === 'zh' ? '抽獎' : 'Draws'}</Text>
                </View>
              </View>
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderFormModal = () => (
    <Modal visible={formVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingFlower
                ? (language === 'zh' ? '編輯花朵' : 'Edit Flower')
                : (language === 'zh' ? '新增花朵' : 'Add Flower')}
            </Text>
            <TouchableOpacity onPress={() => { setFormVisible(false); setEditingFlower(null); }} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            <Text style={styles.formLabel}>Name (EN) *</Text>
            <TextInput
              style={styles.formInput}
              value={form.name_en}
              onChangeText={(v) => updateForm('name_en', v)}
              placeholder="English name"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>Name (繁中)</Text>
            <TextInput
              style={styles.formInput}
              value={form.name_zh}
              onChangeText={(v) => updateForm('name_zh', v)}
              placeholder="中文名稱"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '稀有度' : 'Rarity'}</Text>
            <TouchableOpacity
              style={styles.formSelect}
              onPress={() => setRarityPickerVisible(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.rarityDot, { backgroundColor: getRarityStyle(form.rarity).text }]} />
                <Text style={styles.formSelectText}>
                  {language === 'zh' ? getRarityStyle(form.rarity).labelZh : getRarityStyle(form.rarity).label}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.formLabel}>Image URL</Text>
            <TextInput
              style={styles.formInput}
              value={form.image_url}
              onChangeText={(v) => updateForm('image_url', v)}
              placeholder="https://..."
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
            {form.image_url ? (
              <Image source={{ uri: form.image_url }} style={styles.formImagePreview} />
            ) : null}

            <Text style={styles.formLabel}>Description (EN)</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={form.description_en}
              onChangeText={(v) => updateForm('description_en', v)}
              placeholder="English description"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>Description (繁中)</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={form.description_zh}
              onChangeText={(v) => updateForm('description_zh', v)}
              placeholder="中文描述"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>{language === 'zh' ? '排序' : 'Sort Order'}</Text>
            <TextInput
              style={styles.formInput}
              value={form.sort_order}
              onChangeText={(v) => updateForm('sort_order', v)}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />

            <View style={styles.formSwitchRow}>
              <Text style={styles.formLabel}>{language === 'zh' ? '啟用' : 'Active'}</Text>
              <Switch
                value={form.is_active}
                onValueChange={(v) => updateForm('is_active', v as unknown as string)}
                trackColor={{ false: Colors.border, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setFormVisible(false); setEditingFlower(null); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{language === 'zh' ? '取消' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saveMutation.isPending}
              activeOpacity={0.7}
            >
              {saveMutation.isPending ? (
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

  const renderRarityPicker = () => (
    <Modal visible={rarityPickerVisible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalOverlay} onPress={() => setRarityPickerVisible(false)} activeOpacity={1}>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>{language === 'zh' ? '選擇稀有度' : 'Select Rarity'}</Text>
          {RARITY_OPTIONS.map((r) => {
            const rs = getRarityStyle(r);
            const selected = form.rarity === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.pickerOption, selected && { backgroundColor: rs.bg }]}
                onPress={() => {
                  updateForm('rarity', r);
                  setRarityPickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.rarityDot, { backgroundColor: rs.text }]} />
                <Text style={[styles.pickerOptionText, selected && { color: rs.text, fontWeight: '600' as const }]}>
                  {language === 'zh' ? rs.labelZh : rs.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={language === 'zh' ? '花田管理' : 'Flower Garden'} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'types' && styles.tabActive]}
          onPress={() => setActiveTab('types')}
          activeOpacity={0.7}
        >
          <Flower2 size={14} color={activeTab === 'types' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'types' && styles.tabTextActive]}>
            {language === 'zh' ? '花朵類型' : 'Flower Types'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gardens' && styles.tabActive]}
          onPress={() => setActiveTab('gardens')}
          activeOpacity={0.7}
        >
          <Users size={14} color={activeTab === 'gardens' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'gardens' && styles.tabTextActive]}>
            {language === 'zh' ? '患者花田' : 'Patient Gardens'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={flowerTypesQuery.isRefetching || patientFlowersQuery.isRefetching}
            onRefresh={() => {
              void flowerTypesQuery.refetch();
              void patientsQuery.refetch();
              void patientFlowersQuery.refetch();
              void gachaDrawsQuery.refetch();
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'types' ? renderFlowerTypesTab() : renderPatientGardensTab()}
      </ScrollView>

      {renderFormModal()}
      {renderRarityPicker()}
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
  raritySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  rarityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rarityChipText: {
    fontSize: 12,
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
  flowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  flowerCardInactive: {
    opacity: 0.55,
  },
  flowerImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
  },
  flowerImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  flowerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
  },
  flowerSubName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  flowerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rarityBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  flowerSort: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  flowerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  flowerActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
  },
  gardenCard: {
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
  gardenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  gardenAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gardenAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  gardenPatientInfo: {
    marginLeft: 10,
    flex: 1,
  },
  gardenPatientName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  gardenPatientCode: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  gardenStatsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gardenStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: 10,
  },
  gardenStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gardenStatValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  gardenStatLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 1,
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
  formSelect: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formSelectText: {
    fontSize: 15,
    color: Colors.text,
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
  rarityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pickerContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 40,
    marginTop: 'auto',
    marginBottom: 'auto',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
});
