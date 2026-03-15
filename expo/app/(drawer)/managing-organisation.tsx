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
import { Pencil, X, Briefcase, CheckSquare, Square, Search, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Patient } from '@/types/patient';
import type { Clinician } from '@/types/clinician';

type Tab = 'per_patient' | 'batch';

interface OrgEditForm {
  managing_org_name_en: string;
  managing_org_name_zh: string;
  managing_org_logo_url: string;
}

const EMPTY_EDIT_FORM: OrgEditForm = {
  managing_org_name_en: '',
  managing_org_name_zh: '',
  managing_org_logo_url: '',
};

interface PatientWithOrg extends Patient {
  managing_org_name_en?: string | null;
  managing_org_name_zh?: string | null;
  managing_org_logo_url?: string | null;
  created_by?: string | null;
}

export default function ManagingOrganisationScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('per_patient');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientWithOrg | null>(null);
  const [editForm, setEditForm] = useState<OrgEditForm>(EMPTY_EDIT_FORM);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<OrgEditForm>(EMPTY_EDIT_FORM);
  const [clinicianFilter, setClinicianFilter] = useState('');

  const patientsQuery = useQuery({
    queryKey: ['patients_org'],
    queryFn: async () => {
      console.log('[ManagingOrg] Fetching patients');
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('patient_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PatientWithOrg[];
    },
  });

  const cliniciansQuery = useQuery({
    queryKey: ['clinicians'],
    queryFn: async () => {
      console.log('[ManagingOrg] Fetching clinicians');
      const { data, error } = await supabase
        .from('clinicians')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Clinician[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: Partial<OrgEditForm> }) => {
      console.log('[ManagingOrg] Updating patient:', payload.id);
      const { error } = await supabase.from('patients').update(payload.data).eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients_org'] });
      setEditModalVisible(false);
      setEditingPatient(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to update');
    },
  });

  const batchMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; data: Partial<OrgEditForm> }) => {
      console.log('[ManagingOrg] Batch updating:', payload.ids.length, 'patients');
      for (const id of payload.ids) {
        const { error } = await supabase.from('patients').update(payload.data).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients_org'] });
      setSelectedIds([]);
      Alert.alert(t('common.success'), t('mo.batch_success'));
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to batch update');
    },
  });

  const handleEdit = useCallback((patient: PatientWithOrg) => {
    setEditingPatient(patient);
    setEditForm({
      managing_org_name_en: patient.managing_org_name_en ?? '',
      managing_org_name_zh: patient.managing_org_name_zh ?? '',
      managing_org_logo_url: patient.managing_org_logo_url ?? '',
    });
    setEditModalVisible(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingPatient) return;
    updateMutation.mutate({
      id: editingPatient.id,
      data: {
        managing_org_name_en: editForm.managing_org_name_en.trim() || null as unknown as string,
        managing_org_name_zh: editForm.managing_org_name_zh.trim() || null as unknown as string,
        managing_org_logo_url: editForm.managing_org_logo_url.trim() || null as unknown as string,
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

  const getFilteredPatients = useCallback(() => {
    const list = patientsQuery.data ?? [];
    if (clinicianFilter) {
      return list.filter((p) => p.created_by === clinicianFilter);
    }
    return list;
  }, [patientsQuery.data, clinicianFilter]);

  const handleSelectAll = useCallback(() => {
    const filtered = getFilteredPatients();
    setSelectedIds(filtered.map((p) => p.id));
  }, [getFilteredPatients]);

  const handleBatchApply = useCallback(() => {
    if (selectedIds.length === 0) {
      Alert.alert('', t('mo.no_selected'));
      return;
    }
    const data: Partial<OrgEditForm> = {};
    if (batchForm.managing_org_name_en.trim()) data.managing_org_name_en = batchForm.managing_org_name_en.trim();
    if (batchForm.managing_org_name_zh.trim()) data.managing_org_name_zh = batchForm.managing_org_name_zh.trim();
    if (batchForm.managing_org_logo_url.trim()) data.managing_org_logo_url = batchForm.managing_org_logo_url.trim();

    if (Object.keys(data).length === 0) {
      Alert.alert('', t('mo.no_fields'));
      return;
    }

    Alert.alert(t('mo.batch_apply'), `${t('mo.batch_apply_confirm')} (${selectedIds.length})`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: () => batchMutation.mutate({ ids: selectedIds, data }) },
    ]);
  }, [selectedIds, batchForm, batchMutation, t]);

  const handleBatchClear = useCallback(() => {
    if (selectedIds.length === 0) {
      Alert.alert('', t('mo.no_selected'));
      return;
    }

    Alert.alert(t('mo.batch_clear'), t('mo.batch_clear_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => batchMutation.mutate({
          ids: selectedIds,
          data: {
            managing_org_name_en: null as unknown as string,
            managing_org_name_zh: null as unknown as string,
            managing_org_logo_url: null as unknown as string,
          },
        }),
      },
    ]);
  }, [selectedIds, batchMutation, t]);

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
      <ScreenHeader title={t('mo.title')} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'per_patient' && styles.tabActive]}
          onPress={() => setActiveTab('per_patient')}
        >
          <Text style={[styles.tabText, activeTab === 'per_patient' && styles.tabTextActive]}>
            {t('mo.per_patient')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'batch' && styles.tabActive]}
          onPress={() => setActiveTab('batch')}
        >
          <Text style={[styles.tabText, activeTab === 'batch' && styles.tabTextActive]}>
            {t('mo.batch_update')}
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
                <Text style={styles.loadingText}>{t('mo.loading')}</Text>
              </View>
            ) : filteredPatientsPerPatient.length === 0 ? (
              <View style={styles.centered}>
                <Briefcase size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('patients.no_patients')}</Text>
              </View>
            ) : (
              filteredPatientsPerPatient.map((patient) => (
                <View key={patient.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{patient.patient_name}</Text>
                      <Text style={styles.cardSubtitle}>{t('mo.created_by')}: {getCreatorName(patient.created_by)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleEdit(patient)} style={styles.editBtn}>
                      <Pencil size={14} color={Colors.accent} />
                      <Text style={styles.editBtnText}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fieldGrid}>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('mo.name_en')}</Text>
                      <Text style={styles.fieldValue}>{patient.managing_org_name_en || '—'}</Text>
                    </View>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('mo.name_zh')}</Text>
                      <Text style={styles.fieldValue}>{patient.managing_org_name_zh || '—'}</Text>
                    </View>
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>{t('mo.logo')}</Text>
                      {patient.managing_org_logo_url ? (
                        <Image source={{ uri: patient.managing_org_logo_url }} style={styles.miniThumb} />
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
            <Text style={styles.sectionTitle}>{t('mo.filter_clinician')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !clinicianFilter && styles.filterChipActive]}
                onPress={() => setClinicianFilter('')}
              >
                <Text style={[styles.filterChipText, !clinicianFilter && styles.filterChipTextActive]}>
                  {t('mo.all')}
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
                <Text style={styles.selectBtnText}>{t('mo.select_all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectBtn} onPress={handleDeselectAll}>
                <Square size={14} color={Colors.textSecondary} />
                <Text style={styles.selectBtnText}>{t('mo.deselect_all')}</Text>
              </TouchableOpacity>
              <Text style={styles.selectedCount}>{selectedIds.length} {t('mo.selected')}</Text>
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
            <Text style={styles.sectionTitle}>{t('mo.batch_fields')}</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mo.name_en')}</Text>
              <TextInput style={styles.input} value={batchForm.managing_org_name_en} onChangeText={(v) => setBatchForm((p) => ({ ...p, managing_org_name_en: v }))} placeholder={t('mo.name_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mo.name_zh')}</Text>
              <TextInput style={styles.input} value={batchForm.managing_org_name_zh} onChangeText={(v) => setBatchForm((p) => ({ ...p, managing_org_name_zh: v }))} placeholder={t('mo.name_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mo.logo_url')}</Text>
              <TextInput style={styles.input} value={batchForm.managing_org_logo_url} onChangeText={(v) => setBatchForm((p) => ({ ...p, managing_org_logo_url: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
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
                  <Text style={styles.batchApplyBtnText}>{t('mo.apply_selected')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchClearBtn, batchMutation.isPending && styles.saveBtnDisabled]}
                onPress={handleBatchClear}
                disabled={batchMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.batchClearBtnText}>{t('mo.clear_selected')}</Text>
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
            <Text style={styles.modalTitle}>{t('mo.edit_org')}</Text>
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
              <Text style={styles.label}>{t('mo.name_en')}</Text>
              <TextInput style={styles.input} value={editForm.managing_org_name_en} onChangeText={(v) => setEditForm((p) => ({ ...p, managing_org_name_en: v }))} placeholder={t('mo.name_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mo.name_zh')}</Text>
              <TextInput style={styles.input} value={editForm.managing_org_name_zh} onChangeText={(v) => setEditForm((p) => ({ ...p, managing_org_name_zh: v }))} placeholder={t('mo.name_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mo.logo_url')}</Text>
              <TextInput style={styles.input} value={editForm.managing_org_logo_url} onChangeText={(v) => setEditForm((p) => ({ ...p, managing_org_logo_url: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
              {editForm.managing_org_logo_url.trim() ? (
                <Image source={{ uri: editForm.managing_org_logo_url }} style={styles.previewImage} resizeMode="contain" />
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
