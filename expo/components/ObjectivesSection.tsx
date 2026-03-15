import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import type { ProgramObjective } from '@/types/program';

interface ObjectivesSectionProps {
  programId: string;
}

export default function ObjectivesSection({ programId }: ObjectivesSectionProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ProgramObjective | null>(null);
  const [objectiveEn, setObjectiveEn] = useState('');
  const [objectiveZhHant, setObjectiveZhHant] = useState('');
  const [objectiveZhHans, setObjectiveZhHans] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const objectivesQuery = useQuery({
    queryKey: ['program_objectives', programId],
    queryFn: async () => {
      console.log('[Objectives] Fetching for program:', programId);
      const { data, error } = await supabase
        .from('program_objectives')
        .select('*')
        .eq('program_id', programId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProgramObjective[];
    },
    enabled: !!programId,
  });

  const saveMutation = useMutation({
    mutationFn: async (obj: { id?: string; data: Partial<ProgramObjective> }) => {
      if (obj.id) {
        const { error } = await supabase.from('program_objectives').update(obj.data).eq('id', obj.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('program_objectives').insert({ ...obj.data, program_id: programId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program_objectives', programId] });
      setModalVisible(false);
      setEditing(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save objective');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('program_objectives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program_objectives', programId] });
    },
  });

  const handleAdd = useCallback(() => {
    setEditing(null);
    setObjectiveEn('');
    setObjectiveZhHant('');
    setObjectiveZhHans('');
    setSortOrder(((objectivesQuery.data?.length ?? 0) + 1).toString());
    setIsActive(true);
    setError(null);
    setModalVisible(true);
  }, [objectivesQuery.data]);

  const handleEdit = useCallback((obj: ProgramObjective) => {
    setEditing(obj);
    setObjectiveEn(obj.objective_en);
    setObjectiveZhHant(obj.objective_zh_hant ?? '');
    setObjectiveZhHans(obj.objective_zh_hans ?? '');
    setSortOrder(obj.sort_order.toString());
    setIsActive(obj.is_active);
    setError(null);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((obj: ProgramObjective) => {
    Alert.alert(t('objectives.delete'), t('objectives.delete_confirm'), [
      { text: t('objectives.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(obj.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!objectiveEn.trim()) {
      setError(t('objectives.required'));
      return;
    }
    saveMutation.mutate({
      id: editing?.id,
      data: {
        objective_en: objectiveEn.trim(),
        objective_zh_hant: objectiveZhHant.trim() || null,
        objective_zh_hans: objectiveZhHans.trim() || null,
        sort_order: parseInt(sortOrder, 10) || 1,
        is_active: isActive,
      },
    });
  }, [objectiveEn, objectiveZhHant, objectiveZhHans, sortOrder, isActive, editing, saveMutation, t]);

  const objectives = objectivesQuery.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Target size={16} color={Colors.accent} />
          <Text style={styles.sectionTitle}>{t('objectives.title')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.7}>
          <Plus size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {objectivesQuery.isLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
      ) : objectives.length === 0 ? (
        <Text style={styles.emptyText}>{t('objectives.no_objectives')}</Text>
      ) : (
        objectives.map((obj) => (
          <View key={obj.id} style={styles.objectiveRow}>
            <Text style={styles.objOrder}>{obj.sort_order}</Text>
            <View style={styles.objContent}>
              <Text style={styles.objText} numberOfLines={2}>{obj.objective_en}</Text>
              {obj.objective_zh_hant ? (
                <Text style={styles.objSubText} numberOfLines={1}>{obj.objective_zh_hant}</Text>
              ) : null}
            </View>
            <View style={[styles.activeBadge, !obj.is_active && styles.inactiveBadge]}>
              <Text style={[styles.activeBadgeText, !obj.is_active && styles.inactiveBadgeText]}>
                {obj.is_active ? '✓' : '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleEdit(obj)} style={styles.iconBtn} activeOpacity={0.7}>
              <Pencil size={14} color={Colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(obj)} style={styles.iconBtn} activeOpacity={0.7}>
              <Trash2 size={14} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? t('objectives.edit') : t('objectives.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('objectives.objective_en')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={[styles.input, styles.textArea]} value={objectiveEn} onChangeText={setObjectiveEn} multiline textAlignVertical="top" placeholder={t('objectives.objective_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('objectives.objective_zh_hant')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={objectiveZhHant} onChangeText={setObjectiveZhHant} multiline textAlignVertical="top" placeholder={t('objectives.objective_zh_hant')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('objectives.objective_zh_hans')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={objectiveZhHans} onChangeText={setObjectiveZhHans} multiline textAlignVertical="top" placeholder={t('objectives.objective_zh_hans')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('objectives.sort_order')}</Text>
              <TextInput style={styles.input} value={sortOrder} onChangeText={setSortOrder} keyboardType="numeric" placeholder="1" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('objectives.is_active')}</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: Colors.borderLight, true: Colors.greenLight }} thumbColor={isActive ? Colors.green : Colors.textTertiary} />
            </View>
            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
            <TouchableOpacity style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]} onPress={handleSave} disabled={saveMutation.isPending} activeOpacity={0.8}>
              {saveMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('objectives.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  objOrder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.accentLight,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
    overflow: 'hidden',
  },
  objContent: {
    flex: 1,
    marginLeft: 10,
  },
  objText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  objSubText: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  activeBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: Colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  inactiveBadge: {
    backgroundColor: Colors.borderLight,
  },
  activeBadgeText: {
    fontSize: 12,
    color: Colors.green,
    fontWeight: '700' as const,
  },
  inactiveBadgeText: {
    color: Colors.textTertiary,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  required: {
    color: Colors.danger,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 70,
    paddingTop: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
