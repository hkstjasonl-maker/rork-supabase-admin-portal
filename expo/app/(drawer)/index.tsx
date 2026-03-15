import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, UserRound } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import PatientFormModal from '@/components/PatientFormModal';
import type { Patient, PatientFormData } from '@/types/patient';

function getStatusInfo(patient: Patient, t: (key: string) => string): { label: string; color: string; bg: string } {
  if (patient.is_frozen) {
    return { label: t('patients.status_frozen'), color: '#b07d10', bg: '#fef3cd' };
  }
  if (patient.is_active) {
    return { label: t('patients.status_active'), color: Colors.green, bg: Colors.greenLight };
  }
  return { label: t('patients.status_inactive'), color: Colors.textTertiary, bg: Colors.borderLight };
}

export default function PatientsScreen() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const patientsQuery = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      console.log('[Patients] Fetching patients...');
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('patient_name', { ascending: true });
      if (error) {
        console.error('[Patients] Fetch error:', error);
        throw error;
      }
      console.log('[Patients] Fetched', data?.length ?? 0, 'patients');
      return (data ?? []) as Patient[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: PatientFormData }) => {
      if (id) {
        console.log('[Patients] Updating patient:', id);
        const { error } = await supabase.from('patients').update(data).eq('id', id);
        if (error) throw error;
      } else {
        console.log('[Patients] Creating new patient');
        const { error } = await supabase.from('patients').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      console.log('[Patients] Save successful');
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      setModalVisible(false);
      setEditingPatient(null);
    },
    onError: (err) => {
      console.error('[Patients] Save error:', err);
      Alert.alert('Error', err.message ?? 'Failed to save patient');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Patients] Deleting patient:', id);
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      console.log('[Patients] Delete successful');
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (err) => {
      console.error('[Patients] Delete error:', err);
      Alert.alert('Error', err.message ?? 'Failed to delete patient');
    },
  });

  const filteredPatients = useMemo(() => {
    const patients = patientsQuery.data ?? [];
    if (!search.trim()) return patients;
    const q = search.toLowerCase().trim();
    return patients.filter(
      (p) =>
        p.patient_name.toLowerCase().includes(q) ||
        p.access_code.toLowerCase().includes(q)
    );
  }, [patientsQuery.data, search]);

  const handleAdd = useCallback(() => {
    setEditingPatient(null);
    setModalVisible(true);
  }, []);

  const handleEdit = useCallback((patient: Patient) => {
    setEditingPatient(patient);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((patient: Patient) => {
    Alert.alert(
      t('patients.delete_title'),
      t('patients.delete_confirm'),
      [
        { text: t('patients.cancel'), style: 'cancel' },
        {
          text: t('patients.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(patient.id),
        },
      ]
    );
  }, [t, deleteMutation]);

  const handleSave = useCallback((data: PatientFormData) => {
    saveMutation.mutate({ id: editingPatient?.id, data });
  }, [editingPatient, saveMutation]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingPatient(null);
  }, []);

  const renderPatient = useCallback(({ item }: { item: Patient }) => {
    const status = getStatusInfo(item, t);
    return (
      <View style={styles.patientCard}>
        <View style={styles.patientTop}>
          <View style={styles.avatarSmall}>
            <UserRound size={18} color={Colors.accent} />
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName} numberOfLines={1}>{item.patient_name}</Text>
            <Text style={styles.patientCode}>{item.access_code}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        {item.diagnosis ? (
          <Text style={styles.diagnosisText} numberOfLines={2}>{item.diagnosis}</Text>
        ) : null}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
            testID={`edit-${item.id}`}
          >
            <Pencil size={15} color={Colors.accent} />
            <Text style={styles.actionBtnText}>{t('patients.edit').replace('Patient', '').trim() || 'Edit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
            testID={`delete-${item.id}`}
          >
            <Trash2 size={15} color={Colors.danger} />
            <Text style={[styles.actionBtnText, styles.deleteBtnText]}>{t('patients.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [t, handleEdit, handleDelete]);

  const keyExtractor = useCallback((item: Patient) => item.id, []);

  const addButton = (
    <TouchableOpacity
      style={styles.addButton}
      onPress={handleAdd}
      activeOpacity={0.7}
      testID="add-patient-button"
    >
      <Plus size={20} color={Colors.white} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('patients.title')} rightContent={addButton} />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('patients.search')}
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            testID="patient-search"
          />
        </View>
        {patientsQuery.data && (
          <Text style={styles.countText}>
            {filteredPatients.length} {t('patients.total')}
          </Text>
        )}
      </View>

      {patientsQuery.isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{t('patients.loading')}</Text>
        </View>
      ) : patientsQuery.isError ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('patients.error')}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void patientsQuery.refetch()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>{t('patients.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredPatients.length === 0 ? (
        <View style={styles.centerContent}>
          <UserRound size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{t('patients.no_patients')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPatients}
          renderItem={renderPatient}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={patientsQuery.isRefetching}
              onRefresh={() => void patientsQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
        />
      )}

      <PatientFormModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSave={handleSave}
        patient={editingPatient}
        saving={saveMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  countText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 8,
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  patientCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  patientTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  patientCode: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  diagnosisText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 10,
    marginLeft: 50,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginLeft: 50,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
  },
  deleteBtnText: {
    color: Colors.danger,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 15,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  retryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
