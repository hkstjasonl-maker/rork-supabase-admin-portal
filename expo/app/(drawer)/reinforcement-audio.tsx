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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Music, ChevronDown, Check, Volume2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { ReinforcementAudio, ReinforcementAudioFormData, PatientAudioAssignment } from '@/types/reinforcement-audio';
import type { Patient } from '@/types/patient';

const EMPTY_FORM: ReinforcementAudioFormData = {
  name_en: '',
  name_zh: '',
  youtube_id: '',
  description: '',
  is_default: false,
  audio_url_en: '',
  audio_url_zh_hant: '',
  audio_url_zh_hans: '',
};

export default function ReinforcementAudioScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'library' | 'assign'>('library');
  const [formVisible, setFormVisible] = useState(false);
  const [editingAudio, setEditingAudio] = useState<ReinforcementAudio | null>(null);
  const [form, setForm] = useState<ReinforcementAudioFormData>(EMPTY_FORM);
  const [assignPickerFor, setAssignPickerFor] = useState<string | null>(null);

  const audioQuery = useQuery({
    queryKey: ['reinforcement_audio'],
    queryFn: async () => {
      console.log('[ReinforcementAudio] Fetching audio library');
      const { data, error } = await supabase
        .from('reinforcement_audio')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReinforcementAudio[];
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

  const assignmentsQuery = useQuery({
    queryKey: ['patient_audio_assignments'],
    queryFn: async () => {
      console.log('[ReinforcementAudio] Fetching assignments');
      const { data, error } = await supabase
        .from('patient_audio_assignments')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PatientAudioAssignment[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ReinforcementAudioFormData & { id?: string }) => {
      const row = {
        name_en: payload.name_en.trim(),
        name_zh: payload.name_zh.trim() || null,
        youtube_id: payload.youtube_id.trim() || null,
        description: payload.description.trim() || null,
        is_default: payload.is_default,
        audio_url_en: payload.audio_url_en.trim() || null,
        audio_url_zh_hant: payload.audio_url_zh_hant.trim() || null,
        audio_url_zh_hans: payload.audio_url_zh_hans.trim() || null,
      };
      if (payload.id) {
        console.log('[ReinforcementAudio] Updating:', payload.id);
        const { error } = await supabase.from('reinforcement_audio').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[ReinforcementAudio] Inserting new audio');
        const { error } = await supabase.from('reinforcement_audio').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reinforcement_audio'] });
      setFormVisible(false);
      setEditingAudio(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[ReinforcementAudio] Deleting:', id);
      const { error } = await supabase.from('reinforcement_audio').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reinforcement_audio'] });
    },
  });

  const setDefaultAllMutation = useMutation({
    mutationFn: async () => {
      console.log('[ReinforcementAudio] Setting default for all patients');
      const defaultAudio = (audioQuery.data ?? []).find((a) => a.is_default);
      if (!defaultAudio) {
        throw new Error('No default audio set');
      }
      const patients = patientsQuery.data ?? [];
      for (const p of patients) {
        await supabase
          .from('patient_audio_assignments')
          .upsert(
            { patient_id: p.id, audio_id: null },
            { onConflict: 'patient_id' }
          );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient_audio_assignments'] });
      Alert.alert(t('common.success'), '');
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { patient_id: string; audio_id: string | null }) => {
      console.log('[ReinforcementAudio] Assigning audio to patient:', payload.patient_id);
      const { error } = await supabase
        .from('patient_audio_assignments')
        .upsert(
          { patient_id: payload.patient_id, audio_id: payload.audio_id },
          { onConflict: 'patient_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient_audio_assignments'] });
      setAssignPickerFor(null);
    },
  });

  const handleAdd = useCallback(() => {
    setEditingAudio(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((audio: ReinforcementAudio) => {
    setEditingAudio(audio);
    setForm({
      name_en: audio.name_en,
      name_zh: audio.name_zh ?? '',
      youtube_id: audio.youtube_id ?? '',
      description: audio.description ?? '',
      is_default: audio.is_default,
      audio_url_en: audio.audio_url_en ?? '',
      audio_url_zh_hant: audio.audio_url_zh_hant ?? '',
      audio_url_zh_hans: audio.audio_url_zh_hans ?? '',
    });
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback((audio: ReinforcementAudio) => {
    Alert.alert(t('audio.delete'), t('audio.delete_confirm'), [
      { text: t('audio.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(audio.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.name_en.trim()) {
      Alert.alert('', t('audio.name_required'));
      return;
    }
    saveMutation.mutate({ ...form, id: editingAudio?.id });
  }, [form, editingAudio, saveMutation, t]);

  const updateForm = useCallback((key: keyof ReinforcementAudioFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getAudioName = useCallback((audio: ReinforcementAudio) => {
    if (language === 'zh' && audio.name_zh) return audio.name_zh;
    return audio.name_en;
  }, [language]);

  const getAssignmentForPatient = useCallback((patientId: string) => {
    return (assignmentsQuery.data ?? []).find((a) => a.patient_id === patientId);
  }, [assignmentsQuery.data]);

  const getAudioById = useCallback((id: string | null) => {
    if (!id) return null;
    return (audioQuery.data ?? []).find((a) => a.id === id) ?? null;
  }, [audioQuery.data]);

  const audioList = audioQuery.data ?? [];
  const patients = patientsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('audio.title')} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'library' && styles.tabActive]}
          onPress={() => setActiveTab('library')}
          activeOpacity={0.7}
        >
          <Music size={14} color={activeTab === 'library' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextActive]}>{t('audio.library')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assign' && styles.tabActive]}
          onPress={() => setActiveTab('assign')}
          activeOpacity={0.7}
        >
          <Volume2 size={14} color={activeTab === 'assign' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'assign' && styles.tabTextActive]}>{t('audio.assign')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={audioQuery.isRefetching || assignmentsQuery.isRefetching}
            onRefresh={() => {
              void audioQuery.refetch();
              void assignmentsQuery.refetch();
              void patientsQuery.refetch();
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'library' ? (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('audio.add')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setDefaultAllMutation.mutate()}
                activeOpacity={0.7}
                disabled={setDefaultAllMutation.isPending}
              >
                <Check size={16} color={Colors.accent} />
                <Text style={styles.secondaryBtnText}>{t('audio.set_default_all')}</Text>
              </TouchableOpacity>
            </View>

            {audioQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('audio.loading')}</Text>
              </View>
            ) : audioList.length === 0 ? (
              <View style={styles.centered}>
                <Music size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('audio.no_audio')}</Text>
              </View>
            ) : (
              audioList.map((audio) => (
                <View key={audio.id} style={styles.audioCard}>
                  <View style={styles.audioInfo}>
                    <View style={styles.audioNameRow}>
                      <Text style={styles.audioName} numberOfLines={1}>{getAudioName(audio)}</Text>
                      {audio.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>{t('audio.is_default')}</Text>
                        </View>
                      )}
                    </View>
                    {audio.name_zh && language === 'en' ? (
                      <Text style={styles.audioSubName} numberOfLines={1}>{audio.name_zh}</Text>
                    ) : audio.name_en && language === 'zh' ? (
                      <Text style={styles.audioSubName} numberOfLines={1}>{audio.name_en}</Text>
                    ) : null}
                    {audio.youtube_id ? (
                      <Text style={styles.audioMeta}>YouTube: {audio.youtube_id}</Text>
                    ) : null}
                    {audio.description ? (
                      <Text style={styles.audioDesc} numberOfLines={2}>{audio.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.audioActions}>
                    <TouchableOpacity onPress={() => handleEdit(audio)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(audio)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {patientsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : patients.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>{t('patients.no_patients')}</Text>
              </View>
            ) : (
              patients.map((patient) => {
                const assignment = getAssignmentForPatient(patient.id);
                const assignedAudio = assignment?.audio_id ? getAudioById(assignment.audio_id) : null;
                const isDefault = !assignment || !assignment.audio_id;

                return (
                  <View key={patient.id} style={styles.assignCard}>
                    <View style={styles.assignInfo}>
                      <Text style={styles.assignPatientName}>{patient.patient_name}</Text>
                      <Text style={styles.assignCode}>{patient.access_code}</Text>
                      <View style={styles.assignCurrentRow}>
                        <Text style={styles.assignCurrentLabel}>{t('audio.current_assignment')}:</Text>
                        <View style={[styles.assignBadge, isDefault ? styles.assignBadgeDefault : styles.assignBadgeSpecific]}>
                          <Text style={[styles.assignBadgeText, isDefault ? styles.assignBadgeDefaultText : styles.assignBadgeSpecificText]}>
                            {isDefault ? t('audio.default_global') : (assignedAudio ? getAudioName(assignedAudio) : '—')}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.changeBtn}
                      onPress={() => setAssignPickerFor(assignPickerFor === patient.id ? null : patient.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.changeBtnText}>{t('audio.change')}</Text>
                      <ChevronDown size={14} color={Colors.accent} />
                    </TouchableOpacity>

                    {assignPickerFor === patient.id && (
                      <View style={styles.assignPicker}>
                        <TouchableOpacity
                          style={[styles.assignOption, isDefault && styles.assignOptionActive]}
                          onPress={() => assignMutation.mutate({ patient_id: patient.id, audio_id: null })}
                        >
                          <Text style={[styles.assignOptionText, isDefault && styles.assignOptionTextActive]}>
                            {t('audio.default_global')}
                          </Text>
                          {isDefault && <Check size={14} color={Colors.green} />}
                        </TouchableOpacity>
                        {audioList.map((audio) => {
                          const isSelected = assignment?.audio_id === audio.id;
                          return (
                            <TouchableOpacity
                              key={audio.id}
                              style={[styles.assignOption, isSelected && styles.assignOptionActive]}
                              onPress={() => assignMutation.mutate({ patient_id: patient.id, audio_id: audio.id })}
                            >
                              <Text style={[styles.assignOptionText, isSelected && styles.assignOptionTextActive]}>
                                {getAudioName(audio)}
                              </Text>
                              {isSelected && <Check size={14} color={Colors.green} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingAudio ? t('audio.edit') : t('audio.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.name_en')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.name_en} onChangeText={(v) => updateForm('name_en', v)} placeholder={t('audio.name_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.name_zh')}</Text>
              <TextInput style={styles.input} value={form.name_zh} onChangeText={(v) => updateForm('name_zh', v)} placeholder={t('audio.name_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.youtube_id')}</Text>
              <TextInput style={styles.input} value={form.youtube_id} onChangeText={(v) => updateForm('youtube_id', v)} placeholder="YouTube ID" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.description')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description} onChangeText={(v) => updateForm('description', v)} multiline textAlignVertical="top" placeholder={t('audio.description')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.audio_url_en')}</Text>
              <TextInput style={styles.input} value={form.audio_url_en} onChangeText={(v) => updateForm('audio_url_en', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.audio_url_zh_hant')}</Text>
              <TextInput style={styles.input} value={form.audio_url_zh_hant} onChangeText={(v) => updateForm('audio_url_zh_hant', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('audio.audio_url_zh_hans')}</Text>
              <TextInput style={styles.input} value={form.audio_url_zh_hans} onChangeText={(v) => updateForm('audio_url_zh_hans', v)} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('audio.is_default')}</Text>
              <Switch
                value={form.is_default}
                onValueChange={(v) => updateForm('is_default', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.greenLight }}
                thumbColor={form.is_default ? Colors.green : Colors.textTertiary}
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
                <Text style={styles.saveBtnText}>{t('audio.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
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
    marginBottom: 16,
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
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: Colors.accent,
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
  audioCard: {
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
  audioInfo: {
    flex: 1,
  },
  audioNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  defaultBadge: {
    backgroundColor: Colors.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.green,
    textTransform: 'uppercase' as const,
  },
  audioSubName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  audioMeta: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  audioDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  audioActions: {
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
  assignCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  assignInfo: {
    marginBottom: 8,
  },
  assignPatientName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  assignCode: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  assignCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  assignCurrentLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  assignBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assignBadgeDefault: {
    backgroundColor: Colors.greenLight,
  },
  assignBadgeSpecific: {
    backgroundColor: Colors.accentLight,
  },
  assignBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  assignBadgeDefaultText: {
    color: Colors.green,
  },
  assignBadgeSpecificText: {
    color: Colors.accent,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  assignPicker: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  assignOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  assignOptionActive: {
    backgroundColor: Colors.greenLight,
  },
  assignOptionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  assignOptionTextActive: {
    color: Colors.green,
    fontWeight: '600' as const,
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
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
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
