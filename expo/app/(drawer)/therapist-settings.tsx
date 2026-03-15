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
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, X, Settings, CheckSquare, Square, Search, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Patient } from '@/types/patient';
import type { Clinician } from '@/types/clinician';

type Tab = 'per_patient' | 'batch';

interface TherapistEditForm {
  therapist_name_en: string;
  therapist_name_zh: string;
  therapist_photo_url: string;
  therapist_cartoon_url: string;
}

const EMPTY_EDIT_FORM: TherapistEditForm = {
  therapist_name_en: '',
  therapist_name_zh: '',
  therapist_photo_url: '',
  therapist_cartoon_url: '',
};

interface PatientWithTherapist extends Patient {
  therapist_name_en?: string | null;
  therapist_name_zh?: string | null;
  therapist_photo_url?: string | null;
  therapist_cartoon_url?: string | null;
  created_by?: string | null;
}

export default function TherapistSettingsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('per_patient');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientWithTherapist | null>(null);
  const [editForm, setEditForm] = useState<TherapistEditForm>(EMPTY_EDIT_FORM);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<TherapistEditForm>(EMPTY_EDIT_FORM);
  const [clinicianFilter, setClinicianFilter] = useState('');

  const patientsQuery = useQuery({
    queryKey: ['patients_therapist'],
    queryFn: async () => {
      console.log('[TherapistSettings] Fetching patients');
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('patient_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PatientWithTherapist[];
    },
  });

  const cliniciansQuery = useQuery({
    queryKey: ['clinicians'],
    queryFn: async () => {
      console.log('[TherapistSettings] Fetching clinicians');
      const { data, error } = await supabase
        .from('clinicians')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Clinician[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: Partial<TherapistEditForm> }) => {
      console.log('[TherapistSettings] Updating patient:', payload.id);
      const { error } = await supabase.from('patients').update(payload.data).eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients_therapist'] });
      setEditModalVisible(false);
      setEditingPatient(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to update');
    },
  });

  const batchMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; data: Partial<TherapistEditForm> }) => {
      console.log('[TherapistSettings] Batch updating:', payload.ids.length, 'patients');
      for (const id of payload.ids) {
        const { error } = await supabase.from('patients').update(payload.data).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients_therapist'] });
      setSelectedIds([]);
      Alert.alert(t('common.success'), t('ts.batch_success'));
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to batch update');
    },
  });

  const handleEdit = useCallback((patient: PatientWithTherapist) => {
    setEditingPatient(patient);
    setEditForm({
      therapist_name_en: patient.therapist_name_en ?? '',
      therapist_name_zh: patient.therapist_name_zh ?? '',
      therapist_photo_url: patient.therapist_photo_url ?? '',
      therapist_cartoon_url: patient.therapist_cartoon_url ?? '',
    });
    setEditModalVisible(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingPatient) return;
    updateMutation.mutate({
      id: editingPatient.id,
      data: {
        therapist_name_en: editForm.therapist_name_en.trim() || null as unknown as string,
        therapist_name_zh: editForm.therapist_name_zh.trim() || null as unknown as string,
        therapist_photo_url: editForm.therapist_photo_url.trim() || null as unknown as string,
        therapist_cartoon_url: editForm.therapist_cartoon_url.trim() || null as unknown as string,
      },
    });
  }, [editingPatient, editForm, updateMutation]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleBatchApply = useCallback(() => {
    if (selectedIds.length === 0) {
      Alert.alert('', t('ts.no_selected'));
      return;
    }
    const data: Partial<TherapistEditForm> = {};
    if (batchForm.therapist_name_en.trim()) data.therapist_name_en = batchForm.therapist_name_en.trim();
    if (batchForm.therapist_name_zh.trim()) data.therapist_name_zh = batchForm.therapist_name_zh.trim();
    if (batchForm.therapist_photo_url.trim()) data.therapist_photo_url = batchForm.therapist_photo_url.trim();
    if (batchForm.therapist_cartoon_url.trim()) data.therapist_cartoon_url = batchForm.therapist_cartoon_url.trim();

    if (Object.keys(data).length === 0) {
      Alert.alert('', t('ts.no_fields'));
      return;
    }

    Alert.alert(t('ts.batch_apply'), `${t('ts.batch_apply_confirm')} (${selectedIds.length})`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: () => batchMutation.mutate({ ids: selectedIds, data }) },
    ]);
  }, [selectedIds, batchForm, batchMutation, t]);

  const handleBatchClear = useCallback(() => {
    if (selectedIds.length === 0) {
      Alert.alert('', t('ts.no_selected'));
      return;
    }

    Alert.alert(t('ts.batch_clear'), t('ts.batch_clear_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => batchMutation.mutate({
          ids: selectedIds,
          data: {
            therapist_name_en: null as unknown as string,
            therapist_name_zh: null as unknown as string,
            therapist_photo_url: null as unknown as string,
            therapist_cartoon_url: null as unknown as string,
          },
        }),
      },
    ]);
  }, [selectedIds, batchMutation, t]);

  const getFilteredPatients = useCallback(() => {
    const list = patientsQuery.data ?? [];
    let filtered = list;
    if (clinicianFilter) {
      filtered = filtered.filter((p) => p.created_by === clinicianFilter);
    }
    return filtered;
  }, [patientsQuery.data, clinicianFilter]);

  const handleSelectAll = useCallback(() => {
    const filtered = getFilteredPatients();
    setSelectedIds(filtered.map((p) => p.id));
  }, [getFilteredPatients]);

  const getCreatorName = useCallback((createdBy: string | null | undefined) => {
    if (!createdBy) return 'Admin';
    const clinician = (cliniciansQuery.data ?? []).find((c) => c.id === createdBy);
    return clinician?.full_name ?? 'Admin';
  }, [cliniciansQuery.data]);

  const filteredPatientsPerPatient = useMemo(() => {
    const list = patientsQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((p) => p.patient_name.toLowerCase().includes(q));
  }, [patientsQuery.data, searchQuery]);

  const filteredPatientsBatch = useMemo(() => {
    return getFilteredPatients();
  }, [getFilteredPatients]);

  const clinicians = cliniciansQuery.data ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('ts.title')} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'per_patient' && styles.tabActive]}
          onPress={() => setActiveTab('per_patient')}
        >
          <Text style={[styles.tabText, activeTab === 'per_patient' && styles.tabTextActive]}>
            {t('ts.per_patient')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'batch' && styles.tabActive]}
          onPress={() => setActiveTab('batch')}
        >
          <Text style={[styles.tabText, activeTab === 'batch' && styles.tabTextActive]}>
            {t('ts.batch_update')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'per_patient' ? (
        <>
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
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={patientsQuery.isRefetching}
                onRefresh={() => { void patientsQuery.refetch(); }}
                tintColor={Colors.accent}
              />
            }
          >
            {patientsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('ts.loading')}</Text>
              </View>
            ) : filteredPatientsPerPatient.length === 0 ? (
              <View style={styles.centered}>
                <Settings size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('patients.no_patients')}</Text>
              </View>
            ) : (
              filteredPatientsPerPatient.map((patient) => (
                <View key={patient.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{patient.patient_name}</Text>
                      <Text style={styles.cardSubtitle}>{t('ts.created_by')}: {getCreatorName(patient.created_by)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleEdit(patient)} style={styles.editBtn}>
                      <Pencil size={14} color={Colors.accent} />
                      <Text style={styles.editBtnText}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fieldGrid}>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('ts.name_en')}</Text>
                      <Text style={styles.fieldValue}>{patient.therapist_name_en || '—'}</Text>
                    </View>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('ts.name_zh')}</Text>
                      <Text style={styles.fieldValue}>{patient.therapist_name_zh || '—'}</Text>
                    </View>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('ts.photo')}</Text>
                      {patient.therapist_photo_url ? (
                        <Image source={{ uri: patient.therapist_photo_url }} style={styles.miniThumb} />
                      ) : (
                        <Text style={styles.fieldValue}>—</Text>
                      )}
                    </View>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('ts.cartoon')}</Text>
                      {patient.therapist_cartoon_url ? (
                        <Image source={{ uri: patient.therapist_cartoon_url }} style={styles.miniThumb} />
                      ) : (
                        <Text style={styles.fieldValue}>—</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={patientsQuery.isRefetching}
              onRefresh={() => { void patientsQuery.refetch(); }}
              tintColor={Colors.accent}
            />
          }
        >
          <View style={styles.batchSection}>
            <Text style={styles.sectionTitle}>{t('ts.filter_clinician')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !clinicianFilter && styles.filterChipActive]}
                onPress={() => setClinicianFilter('')}
              >
                <Text style={[styles.filterChipText, !clinicianFilter && styles.filterChipTextActive]}>
                  {t('ts.all')}
                </Text>
              </TouchableOpacity>
              {clinicians.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.filterChip, clinicianFilter === c.id && styles.filterChipActive]}
                  onPress={() => setClinicianFilter(c.id)}
                >
                  <Text style={[styles.filterChipText, clinicianFilter === c.id && styles.filterChipTextActive]}>
                    {c.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.batchSection}>
            <View style={styles.selectActions}>
              <TouchableOpacity style={styles.selectBtn} onPress={handleSelectAll}>
                <CheckSquare size={14} color={Colors.accent} />
                <Text style={styles.selectBtnText}>{t('ts.select_all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectBtn} onPress={handleDeselectAll}>
                <Square size={14} color={Colors.textSecondary} />
                <Text style={styles.selectBtnText}>{t('ts.deselect_all')}</Text>
              </TouchableOpacity>
              <Text style={styles.selectedCount}>{selectedIds.length} {t('ts.selected')}</Text>
            </View>

            {filteredPatientsBatch.map((patient) => {
              const selected = selectedIds.includes(patient.id);
              return (
                <TouchableOpacity
                  key={patient.id}
                  style={[styles.patientCheckRow, selected && styles.patientCheckRowActive]}
                  onPress={() => toggleSelect(patient.id)}
                >
                  {selected ? (
                    <CheckSquare size={18} color={Colors.accent} />
                  ) : (
                    <Square size={18} color={Colors.textTertiary} />
                  )}
                  <Text style={styles.patientCheckName}>{patient.patient_name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.batchSection}>
            <Text style={styles.sectionTitle}>{t('ts.batch_fields')}</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.name_en')}</Text>
              <TextInput style={styles.input} value={batchForm.therapist_name_en} onChangeText={(v) => setBatchForm((p) => ({ ...p, therapist_name_en: v }))} placeholder={t('ts.name_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.name_zh')}</Text>
              <TextInput style={styles.input} value={batchForm.therapist_name_zh} onChangeText={(v) => setBatchForm((p) => ({ ...p, therapist_name_zh: v }))} placeholder={t('ts.name_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.photo_url')}</Text>
              <TextInput style={styles.input} value={batchForm.therapist_photo_url} onChangeText={(v) => setBatchForm((p) => ({ ...p, therapist_photo_url: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.cartoon_url')}</Text>
              <TextInput style={styles.input} value={batchForm.therapist_cartoon_url} onChangeText={(v) => setBatchForm((p) => ({ ...p, therapist_cartoon_url: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>

            <View style={styles.batchBtnRow}>
              <TouchableOpacity
                style={[styles.batchApplyBtn, batchMutation.isPending && styles.saveBtnDisabled]}
                onPress={handleBatchApply}
                disabled={batchMutation.isPending}
                activeOpacity={0.8}
              >
                {batchMutation.isPending ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.batchApplyBtnText}>{t('ts.apply_selected')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchClearBtn, batchMutation.isPending && styles.saveBtnDisabled]}
                onPress={handleBatchClear}
                disabled={batchMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.batchClearBtnText}>{t('ts.clear_selected')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('ts.edit_therapist')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            {editingPatient && (
              <View style={styles.patientBanner}>
                <Users size={16} color={Colors.accent} />
                <Text style={styles.patientBannerText}>{editingPatient.patient_name}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.name_en')}</Text>
              <TextInput style={styles.input} value={editForm.therapist_name_en} onChangeText={(v) => setEditForm((p) => ({ ...p, therapist_name_en: v }))} placeholder={t('ts.name_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.name_zh')}</Text>
              <TextInput style={styles.input} value={editForm.therapist_name_zh} onChangeText={(v) => setEditForm((p) => ({ ...p, therapist_name_zh: v }))} placeholder={t('ts.name_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.photo_url')}</Text>
              <TextInput style={styles.input} value={editForm.therapist_photo_url} onChangeText={(v) => setEditForm((p) => ({ ...p, therapist_photo_url: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              {editForm.therapist_photo_url.trim() ? (
                <Image source={{ uri: editForm.therapist_photo_url }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('ts.cartoon_url')}</Text>
              <TextInput style={styles.input} value={editForm.therapist_cartoon_url} onChangeText={(v) => setEditForm((p) => ({ ...p, therapist_cartoon_url: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              {editForm.therapist_cartoon_url.trim() ? (
                <Image source={{ uri: editForm.therapist_cartoon_url }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSaveEdit}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  tabActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  tabText: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent, fontWeight: '600' as const },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderLight, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  cardSubtitle: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accentLight },
  editBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldItem: { width: '47%', backgroundColor: Colors.inputBg, borderRadius: 8, padding: 10 },
  fieldLabel: { fontSize: 11, color: Colors.textTertiary, marginBottom: 4 },
  fieldValue: { fontSize: 13, color: Colors.text, fontWeight: '500' as const },
  miniThumb: { width: 32, height: 32, borderRadius: 6 },
  batchSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 10, marginTop: 8 },
  filterRow: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, marginRight: 8 },
  filterChipActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  filterChipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.accent, fontWeight: '600' as const },
  selectActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectBtnText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  selectedCount: { fontSize: 12, color: Colors.textTertiary, marginLeft: 'auto' },
  patientCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.card, borderRadius: 8, marginBottom: 4 },
  patientCheckRowActive: { backgroundColor: Colors.accentLight },
  patientCheckName: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  batchBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  batchApplyBtn: { flex: 1, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  batchApplyBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' as const },
  batchClearBtn: { flex: 1, backgroundColor: Colors.dangerLight, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  batchClearBtnText: { color: Colors.danger, fontSize: 15, fontWeight: '600' as const },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.card },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  modalBody: { flex: 1 },
  modalBodyContent: { paddingHorizontal: 20, paddingTop: 16 },
  patientBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accentLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  patientBannerText: { fontSize: 15, fontWeight: '600' as const, color: Colors.accent },
  previewImage: { width: '100%', height: 100, borderRadius: 10, marginTop: 8, backgroundColor: Colors.inputBg },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' as const },
});
