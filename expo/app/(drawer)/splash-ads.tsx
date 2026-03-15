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
import { Plus, Pencil, Trash2, X, ImageIcon, Check, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { SplashAd, SplashAdFormData, SplashAdTarget } from '@/types/splash-ad';
import type { Patient } from '@/types/patient';

const DURATION_OPTIONS = [3, 5, 8, 10];

const EMPTY_FORM: SplashAdFormData = {
  title: '',
  image_url: '',
  link_url: '',
  duration_seconds: 5,
  target_type: 'all',
  is_active: true,
  start_date: '',
  end_date: '',
  sort_order: '0',
  target_patient_ids: [],
};

function getAdStatus(ad: SplashAd): 'active' | 'expired' | 'scheduled' | 'disabled' {
  if (!ad.is_active) return 'disabled';
  const now = new Date().toISOString().split('T')[0];
  if (ad.start_date && ad.start_date > now) return 'scheduled';
  if (ad.end_date && ad.end_date < now) return 'expired';
  return 'active';
}

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'active': return { bg: Colors.greenLight, text: Colors.green };
    case 'expired': return { bg: Colors.dangerLight, text: Colors.danger };
    case 'scheduled': return { bg: '#e0e8f5', text: '#4a6fa5' };
    case 'disabled': return { bg: Colors.borderLight, text: Colors.textSecondary };
    default: return { bg: Colors.borderLight, text: Colors.textSecondary };
  }
}

export default function SplashAdsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [formVisible, setFormVisible] = useState(false);
  const [editingAd, setEditingAd] = useState<SplashAd | null>(null);
  const [form, setForm] = useState<SplashAdFormData>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);

  const adsQuery = useQuery({
    queryKey: ['splash_ads'],
    queryFn: async () => {
      console.log('[SplashAds] Fetching ads');
      const { data, error } = await supabase
        .from('splash_ads')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SplashAd[];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ['splash_ad_targets'],
    queryFn: async () => {
      console.log('[SplashAds] Fetching targets');
      const { data, error } = await supabase
        .from('splash_ad_targets')
        .select('*');
      if (error) throw error;
      return (data ?? []) as SplashAdTarget[];
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

  const saveMutation = useMutation({
    mutationFn: async (payload: SplashAdFormData & { id?: string }) => {
      const row = {
        title: payload.title.trim(),
        image_url: payload.image_url.trim(),
        link_url: payload.link_url.trim() || null,
        duration_seconds: payload.duration_seconds,
        target_type: payload.target_type,
        is_active: payload.is_active,
        start_date: payload.start_date.trim() || null,
        end_date: payload.end_date.trim() || null,
        sort_order: parseInt(payload.sort_order, 10) || 0,
      };

      let adId = payload.id;

      if (payload.id) {
        console.log('[SplashAds] Updating:', payload.id);
        const { error } = await supabase.from('splash_ads').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[SplashAds] Inserting new ad');
        const { data, error } = await supabase.from('splash_ads').insert(row).select('id').single();
        if (error) throw error;
        adId = data.id;
      }

      if (adId) {
        await supabase.from('splash_ad_targets').delete().eq('splash_ad_id', adId);
        if (payload.target_type === 'specific' && payload.target_patient_ids.length > 0) {
          const targets = payload.target_patient_ids.map((pid) => ({
            splash_ad_id: adId as string,
            patient_id: pid,
          }));
          const { error: tErr } = await supabase.from('splash_ad_targets').insert(targets);
          if (tErr) throw tErr;
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['splash_ads'] });
      void queryClient.invalidateQueries({ queryKey: ['splash_ad_targets'] });
      setFormVisible(false);
      setEditingAd(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[SplashAds] Deleting:', id);
      await supabase.from('splash_ad_targets').delete().eq('splash_ad_id', id);
      const { error } = await supabase.from('splash_ads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['splash_ads'] });
      void queryClient.invalidateQueries({ queryKey: ['splash_ad_targets'] });
    },
  });

  const handleAdd = useCallback(() => {
    setEditingAd(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((ad: SplashAd) => {
    const adTargets = (targetsQuery.data ?? []).filter((t) => t.splash_ad_id === ad.id);
    setEditingAd(ad);
    setForm({
      title: ad.title,
      image_url: ad.image_url,
      link_url: ad.link_url ?? '',
      duration_seconds: ad.duration_seconds,
      target_type: ad.target_type,
      is_active: ad.is_active,
      start_date: ad.start_date ?? '',
      end_date: ad.end_date ?? '',
      sort_order: String(ad.sort_order ?? 0),
      target_patient_ids: adTargets.map((t) => t.patient_id),
    });
    setFormVisible(true);
  }, [targetsQuery.data]);

  const handleDelete = useCallback((ad: SplashAd) => {
    Alert.alert(t('splash.delete'), t('splash.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(ad.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.title.trim()) {
      Alert.alert('', t('splash.title_required'));
      return;
    }
    if (!form.image_url.trim()) {
      Alert.alert('', t('splash.image_required'));
      return;
    }
    saveMutation.mutate({ ...form, id: editingAd?.id });
  }, [form, editingAd, saveMutation, t]);

  const updateForm = useCallback((key: keyof SplashAdFormData, value: string | boolean | number | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePatient = useCallback((patientId: string) => {
    setForm((prev) => {
      const ids = prev.target_patient_ids.includes(patientId)
        ? prev.target_patient_ids.filter((id) => id !== patientId)
        : [...prev.target_patient_ids, patientId];
      return { ...prev, target_patient_ids: ids };
    });
  }, []);

  const getTargetLabel = useCallback((ad: SplashAd) => {
    if (ad.target_type === 'all') return t('splash.target_all');
    const targets = (targetsQuery.data ?? []).filter((t) => t.splash_ad_id === ad.id);
    return `${targets.length} ${t('splash.target_specific').toLowerCase()}`;
  }, [t, targetsQuery.data]);

  const filteredAds = useMemo(() => {
    const list = adsQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((a) => a.title.toLowerCase().includes(q));
  }, [adsQuery.data, searchQuery]);

  const patients = patientsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('splash.title')} />

      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('patients.search')}
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
          <Plus size={16} color={Colors.white} />
          <Text style={styles.primaryBtnText}>{t('splash.add')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={adsQuery.isRefetching}
            onRefresh={() => {
              void adsQuery.refetch();
              void targetsQuery.refetch();
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {adsQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>{t('splash.loading')}</Text>
          </View>
        ) : filteredAds.length === 0 ? (
          <View style={styles.centered}>
            <ImageIcon size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>{t('splash.no_ads')}</Text>
          </View>
        ) : (
          filteredAds.map((ad) => {
            const status = getAdStatus(ad);
            const statusColor = getStatusColor(status);
            return (
              <View key={ad.id} style={styles.card}>
                <View style={styles.cardRow}>
                  {ad.image_url ? (
                    <Image source={{ uri: ad.image_url }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                      <ImageIcon size={20} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{ad.title}</Text>
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: ad.target_type === 'all' ? '#e0e8f5' : '#f0e8f5' }]}>
                          <Text style={[styles.badgeText, { color: ad.target_type === 'all' ? '#4a6fa5' : '#7a5ba5' }]}>
                            {getTargetLabel(ad)}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.badgeText, { color: statusColor.text }]}>
                            {t(`splash.status_${status}`)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.metaText}>{t('splash.duration')}: {ad.duration_seconds}s</Text>
                      {(ad.start_date || ad.end_date) ? (
                        <Text style={styles.metaText}>
                          {ad.start_date ?? '—'} → {ad.end_date ?? '—'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleEdit(ad)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(ad)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingAd ? t('splash.edit') : t('splash.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('splash.title_field')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.title} onChangeText={(v) => updateForm('title', v)} placeholder={t('splash.title_field')} placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('splash.image_url')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.image_url} onChangeText={(v) => updateForm('image_url', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              {form.image_url.trim() ? (
                <Image source={{ uri: form.image_url }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('splash.link_url')}</Text>
              <TextInput style={styles.input} value={form.link_url} onChangeText={(v) => updateForm('link_url', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('splash.duration')}</Text>
              <View style={styles.chipRow}>
                {DURATION_OPTIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, form.duration_seconds === d && styles.chipActive]}
                    onPress={() => updateForm('duration_seconds', d)}
                  >
                    <Text style={[styles.chipText, form.duration_seconds === d && styles.chipTextActive]}>
                      {d}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('splash.target')}</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, form.target_type === 'all' && styles.chipActive]}
                  onPress={() => updateForm('target_type', 'all')}
                >
                  <Text style={[styles.chipText, form.target_type === 'all' && styles.chipTextActive]}>
                    {t('splash.target_all')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, form.target_type === 'specific' && styles.chipActive]}
                  onPress={() => updateForm('target_type', 'specific')}
                >
                  <Text style={[styles.chipText, form.target_type === 'specific' && styles.chipTextActive]}>
                    {t('splash.target_specific')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {form.target_type === 'specific' && (
              <View style={styles.fieldGroup}>
                <TouchableOpacity
                  style={styles.selectPatientsBtn}
                  onPress={() => setPatientPickerVisible(true)}
                >
                  <Text style={styles.selectPatientsBtnText}>
                    {t('splash.select_patients')} ({form.target_patient_ids.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.label}>{t('splash.start_date')}</Text>
                <TextInput style={styles.input} value={form.start_date} onChangeText={(v) => updateForm('start_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.label}>{t('splash.end_date')}</Text>
                <TextInput style={styles.input} value={form.end_date} onChangeText={(v) => updateForm('end_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('splash.sort_order')}</Text>
              <TextInput style={styles.input} value={form.sort_order} onChangeText={(v) => updateForm('sort_order', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('splash.is_active')}</Text>
              <Switch
                value={form.is_active}
                onValueChange={(v) => updateForm('is_active', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.greenLight }}
                thumbColor={form.is_active ? Colors.green : Colors.textTertiary}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saveMutation.isPending}
              activeOpacity={0.8}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t('splash.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={patientPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPatientPickerVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPatientPickerVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('splash.select_patients')}</Text>
            <TouchableOpacity onPress={() => setPatientPickerVisible(false)} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}>
            {patients.map((p) => {
              const selected = form.target_patient_ids.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.patientOption, selected && styles.patientOptionActive]}
                  onPress={() => togglePatient(p.id)}
                >
                  <View style={styles.patientOptionInfo}>
                    <Text style={styles.patientOptionName}>{p.patient_name}</Text>
                    <Text style={styles.patientOptionCode}>{p.access_code}</Text>
                  </View>
                  {selected && <Check size={18} color={Colors.green} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderLight, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' as const },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 60, height: 60, borderRadius: 10, backgroundColor: Colors.inputBg },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 4 },
  cardTitleRow: { gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  cardMeta: { gap: 2 },
  metaText: { fontSize: 11, color: Colors.textTertiary },
  cardActions: { gap: 4 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.inputBg },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.card },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  modalBody: { flex: 1 },
  modalBodyContent: { paddingHorizontal: 20, paddingTop: 16 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6 },
  required: { color: Colors.danger },
  input: { backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  previewImage: { width: '100%', height: 120, borderRadius: 10, marginTop: 8, backgroundColor: Colors.inputBg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
  chipActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  chipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent, fontWeight: '600' as const },
  selectPatientsBtn: { backgroundColor: Colors.accentLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  selectPatientsBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.accent },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  dateField: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 20 },
  toggleLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' as const },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.accent },
  doneBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.white },
  patientOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.card },
  patientOptionActive: { backgroundColor: Colors.greenLight },
  patientOptionInfo: { flex: 1 },
  patientOptionName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  patientOptionCode: { fontSize: 12, color: Colors.textTertiary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
});
