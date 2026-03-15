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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, X, UserPlus, Users, Share2, FileCheck,
  ChevronDown, Check, Search,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type { Clinician, ClinicianFormData, SharedExercise, SharedAssessment } from '@/types/clinician';

type TabKey = 'accounts' | 'shared_exercises' | 'shared_assessments';

const EMPTY_FORM: ClinicianFormData = {
  full_name: '',
  email: '',
  password: '',
  organization: '',
  max_patients: '10',
  max_exercises: '50',
  max_feeding_videos: '20',
  is_active: true,
  is_approved: false,
};

async function hashPassword(password: string): Promise<string> {
  const salt = '_slp_jason_salt';
  const data = password + salt;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export default function CliniciansScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('accounts');
  const [formVisible, setFormVisible] = useState(false);
  const [editingClinician, setEditingClinician] = useState<Clinician | null>(null);
  const [form, setForm] = useState<ClinicianFormData>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');

  const [shareExerciseVisible, setShareExerciseVisible] = useState(false);
  const [shareAssessmentVisible, setShareAssessmentVisible] = useState(false);
  const [selectedClinicianId, setSelectedClinicianId] = useState<string>('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [clinicianPickerOpen, setClinicianPickerOpen] = useState(false);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [assessmentPickerOpen, setAssessmentPickerOpen] = useState(false);

  const cliniciansQuery = useQuery({
    queryKey: ['clinicians'],
    queryFn: async () => {
      console.log('[Clinicians] Fetching clinicians');
      const { data, error } = await supabase
        .from('clinicians')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Clinician[];
    },
  });

  const sharedExercisesQuery = useQuery({
    queryKey: ['shared_exercises'],
    queryFn: async () => {
      console.log('[Clinicians] Fetching shared exercises');
      const { data, error } = await supabase
        .from('shared_exercises')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SharedExercise[];
    },
  });

  const sharedAssessmentsQuery = useQuery({
    queryKey: ['shared_assessments'],
    queryFn: async () => {
      console.log('[Clinicians] Fetching shared assessments');
      const { data, error } = await supabase
        .from('shared_assessments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SharedAssessment[];
    },
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercise_library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('id, title_en, title_zh_hant')
        .order('title_en', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; title_en: string; title_zh_hant: string | null }>;
    },
  });

  const assessmentsQuery = useQuery({
    queryKey: ['assessment_library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessment_library')
        .select('id, name_en, name_zh')
        .order('name_en', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name_en: string; name_zh: string | null }>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ClinicianFormData & { id?: string }) => {
      const row: Record<string, unknown> = {
        full_name: payload.full_name.trim(),
        email: payload.email.trim(),
        organization: payload.organization.trim() || null,
        max_patients: parseInt(payload.max_patients, 10) || 10,
        max_exercises: parseInt(payload.max_exercises, 10) || 50,
        max_feeding_videos: parseInt(payload.max_feeding_videos, 10) || 20,
        is_active: payload.is_active,
        is_approved: payload.is_approved,
      };

      if (payload.password.trim()) {
        row.password_hash = await hashPassword(payload.password.trim());
      }

      if (payload.id) {
        console.log('[Clinicians] Updating:', payload.id);
        const { error } = await supabase.from('clinicians').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[Clinicians] Inserting new clinician');
        if (!payload.password.trim()) {
          row.password_hash = await hashPassword('changeme');
        }
        const { error } = await supabase.from('clinicians').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clinicians'] });
      setFormVisible(false);
      setEditingClinician(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Clinicians] Deleting:', id);
      const { error } = await supabase.from('clinicians').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clinicians'] });
    },
  });

  const shareExerciseMutation = useMutation({
    mutationFn: async (payload: { exercise_id: string; clinician_id: string }) => {
      const exercise = (exercisesQuery.data ?? []).find((e) => e.id === payload.exercise_id);
      const clinician = (cliniciansQuery.data ?? []).find((c) => c.id === payload.clinician_id);
      console.log('[Clinicians] Sharing exercise:', payload);
      const { error } = await supabase.from('shared_exercises').insert({
        exercise_id: payload.exercise_id,
        clinician_id: payload.clinician_id,
        exercise_title_en: exercise?.title_en ?? null,
        clinician_name: clinician?.full_name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shared_exercises'] });
      setShareExerciseVisible(false);
      setSelectedClinicianId('');
      setSelectedExerciseId('');
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to share');
    },
  });

  const shareAssessmentMutation = useMutation({
    mutationFn: async (payload: { assessment_id: string; clinician_id: string }) => {
      const assessment = (assessmentsQuery.data ?? []).find((a) => a.id === payload.assessment_id);
      const clinician = (cliniciansQuery.data ?? []).find((c) => c.id === payload.clinician_id);
      console.log('[Clinicians] Sharing assessment:', payload);
      const { error } = await supabase.from('shared_assessments').insert({
        assessment_id: payload.assessment_id,
        clinician_id: payload.clinician_id,
        assessment_name_en: assessment?.name_en ?? null,
        clinician_name: clinician?.full_name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shared_assessments'] });
      setShareAssessmentVisible(false);
      setSelectedClinicianId('');
      setSelectedAssessmentId('');
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to share');
    },
  });

  const removeSharedExerciseMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Clinicians] Removing shared exercise:', id);
      const { error } = await supabase.from('shared_exercises').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shared_exercises'] });
    },
  });

  const removeSharedAssessmentMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Clinicians] Removing shared assessment:', id);
      const { error } = await supabase.from('shared_assessments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shared_assessments'] });
    },
  });

  const handleAdd = useCallback(() => {
    setEditingClinician(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((c: Clinician) => {
    setEditingClinician(c);
    setForm({
      full_name: c.full_name,
      email: c.email,
      password: '',
      organization: c.organization ?? '',
      max_patients: String(c.max_patients),
      max_exercises: String(c.max_exercises),
      max_feeding_videos: String(c.max_feeding_videos),
      is_active: c.is_active,
      is_approved: c.is_approved,
    });
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback((c: Clinician) => {
    Alert.alert(t('clin.delete'), t('clin.delete_confirm'), [
      { text: t('clin.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(c.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.full_name.trim()) {
      Alert.alert('', t('clin.name_required'));
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('', t('clin.email_required'));
      return;
    }
    saveMutation.mutate({ ...form, id: editingClinician?.id });
  }, [form, editingClinician, saveMutation, t]);

  const updateForm = useCallback((key: keyof ClinicianFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleRemoveSharedExercise = useCallback((se: SharedExercise) => {
    Alert.alert(t('clin.remove'), t('clin.remove_confirm'), [
      { text: t('clin.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeSharedExerciseMutation.mutate(se.id) },
    ]);
  }, [t, removeSharedExerciseMutation]);

  const handleRemoveSharedAssessment = useCallback((sa: SharedAssessment) => {
    Alert.alert(t('clin.remove'), t('clin.remove_confirm'), [
      { text: t('clin.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeSharedAssessmentMutation.mutate(sa.id) },
    ]);
  }, [t, removeSharedAssessmentMutation]);

  const filteredClinicians = useMemo(() => {
    const list = cliniciansQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.organization ?? '').toLowerCase().includes(q)
    );
  }, [cliniciansQuery.data, searchQuery]);

  const clinicians = useMemo(() => cliniciansQuery.data ?? [], [cliniciansQuery.data]);
  const exercises = useMemo(() => exercisesQuery.data ?? [], [exercisesQuery.data]);
  const assessments = useMemo(() => assessmentsQuery.data ?? [], [assessmentsQuery.data]);
  const sharedExercises = sharedExercisesQuery.data ?? [];
  const sharedAssessments = sharedAssessmentsQuery.data ?? [];

  const getClinicianName = useCallback((id: string) => {
    return clinicians.find((c) => c.id === id)?.full_name ?? '—';
  }, [clinicians]);

  const getExerciseTitle = useCallback((id: string) => {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return '—';
    if (language === 'zh' && ex.title_zh_hant) return ex.title_zh_hant;
    return ex.title_en;
  }, [exercises, language]);

  const getAssessmentName = useCallback((id: string) => {
    const a = assessments.find((item) => item.id === id);
    if (!a) return '—';
    if (language === 'zh' && a.name_zh) return a.name_zh;
    return a.name_en;
  }, [assessments, language]);

  const selectedClinicianName = selectedClinicianId ? getClinicianName(selectedClinicianId) : t('clin.select_clinician');
  const selectedExerciseTitle = selectedExerciseId ? getExerciseTitle(selectedExerciseId) : t('clin.select_exercise');
  const selectedAssessmentName = selectedAssessmentId ? getAssessmentName(selectedAssessmentId) : t('clin.select_assessment');

  const refetchAll = useCallback(() => {
    void cliniciansQuery.refetch();
    void sharedExercisesQuery.refetch();
    void sharedAssessmentsQuery.refetch();
  }, [cliniciansQuery, sharedExercisesQuery, sharedAssessmentsQuery]);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('clin.title')} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'accounts' && styles.tabActive]}
          onPress={() => setActiveTab('accounts')}
          activeOpacity={0.7}
        >
          <Users size={14} color={activeTab === 'accounts' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'accounts' && styles.tabTextActive]}>{t('clin.accounts')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared_exercises' && styles.tabActive]}
          onPress={() => setActiveTab('shared_exercises')}
          activeOpacity={0.7}
        >
          <Share2 size={14} color={activeTab === 'shared_exercises' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'shared_exercises' && styles.tabTextActive]}>{t('clin.shared_exercises')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared_assessments' && styles.tabActive]}
          onPress={() => setActiveTab('shared_assessments')}
          activeOpacity={0.7}
        >
          <FileCheck size={14} color={activeTab === 'shared_assessments' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'shared_assessments' && styles.tabTextActive]}>{t('clin.shared_assessments')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cliniciansQuery.isRefetching || sharedExercisesQuery.isRefetching || sharedAssessmentsQuery.isRefetching}
            onRefresh={refetchAll}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'accounts' && (
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
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('clin.add')}</Text>
              </TouchableOpacity>
            </View>

            {cliniciansQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('clin.loading')}</Text>
              </View>
            ) : filteredClinicians.length === 0 ? (
              <View style={styles.centered}>
                <UserPlus size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('clin.no_clinicians')}</Text>
              </View>
            ) : (
              filteredClinicians.map((c) => (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName} numberOfLines={1}>{c.full_name}</Text>
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, {
                          backgroundColor: c.is_approved ? Colors.greenLight : '#fff3e0'
                        }]}>
                          <Text style={[styles.badgeText, {
                            color: c.is_approved ? Colors.green : '#e07a3a'
                          }]}>
                            {c.is_approved ? t('clin.status_approved') : t('clin.status_pending')}
                          </Text>
                        </View>
                        {!c.is_active && (
                          <View style={[styles.badge, { backgroundColor: Colors.dangerLight }]}>
                            <Text style={[styles.badgeText, { color: Colors.danger }]}>
                              {t('notif.status_inactive')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.emailText}>{c.email}</Text>
                    {c.organization ? (
                      <Text style={styles.orgText}>{c.organization}</Text>
                    ) : null}
                  </View>
                  <View style={styles.quotaRow}>
                    <View style={styles.quotaItem}>
                      <Text style={styles.quotaValue}>{c.max_patients}</Text>
                      <Text style={styles.quotaLabel}>{t('clin.max_patients')}</Text>
                    </View>
                    <View style={styles.quotaDivider} />
                    <View style={styles.quotaItem}>
                      <Text style={styles.quotaValue}>{c.max_exercises}</Text>
                      <Text style={styles.quotaLabel}>{t('clin.max_exercises')}</Text>
                    </View>
                    <View style={styles.quotaDivider} />
                    <View style={styles.quotaItem}>
                      <Text style={styles.quotaValue}>{c.max_feeding_videos}</Text>
                      <Text style={styles.quotaLabel}>{t('clin.max_feeding_videos')}</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleEdit(c)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(c)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'shared_exercises' && (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                setSelectedClinicianId('');
                setSelectedExerciseId('');
                setShareExerciseVisible(true);
              }} activeOpacity={0.7}>
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('clin.share_exercise')}</Text>
              </TouchableOpacity>
            </View>

            {sharedExercisesQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : sharedExercises.length === 0 ? (
              <View style={styles.centered}>
                <Share2 size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('clin.no_shared_exercises')}</Text>
              </View>
            ) : (
              sharedExercises.map((se) => (
                <View key={se.id} style={styles.shareCard}>
                  <View style={styles.shareInfo}>
                    <Text style={styles.shareTitle} numberOfLines={1}>
                      {se.exercise_title_en ?? getExerciseTitle(se.exercise_id)}
                    </Text>
                    <Text style={styles.shareMeta}>
                      {t('clin.select_clinician')}: {se.clinician_name ?? getClinicianName(se.clinician_id)}
                    </Text>
                    <Text style={styles.shareDate}>
                      {t('clin.date_shared')}: {new Date(se.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveSharedExercise(se)} style={styles.iconBtn}>
                    <Trash2 size={15} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'shared_assessments' && (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                setSelectedClinicianId('');
                setSelectedAssessmentId('');
                setShareAssessmentVisible(true);
              }} activeOpacity={0.7}>
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('clin.share_assessment')}</Text>
              </TouchableOpacity>
            </View>

            {sharedAssessmentsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : sharedAssessments.length === 0 ? (
              <View style={styles.centered}>
                <FileCheck size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('clin.no_shared_assessments')}</Text>
              </View>
            ) : (
              sharedAssessments.map((sa) => (
                <View key={sa.id} style={styles.shareCard}>
                  <View style={styles.shareInfo}>
                    <Text style={styles.shareTitle} numberOfLines={1}>
                      {sa.assessment_name_en ?? getAssessmentName(sa.assessment_id)}
                    </Text>
                    <Text style={styles.shareMeta}>
                      {t('clin.select_clinician')}: {sa.clinician_name ?? getClinicianName(sa.clinician_id)}
                    </Text>
                    <Text style={styles.shareDate}>
                      {t('clin.date_shared')}: {new Date(sa.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveSharedAssessment(sa)} style={styles.iconBtn}>
                    <Trash2 size={15} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Clinician Form Modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingClinician ? t('clin.edit') : t('clin.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.full_name')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.full_name} onChangeText={(v) => updateForm('full_name', v)} placeholder={t('clin.full_name')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.email')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.email} onChangeText={(v) => updateForm('email', v)} placeholder={t('clin.email')} placeholderTextColor={Colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.password')} {!editingClinician && <Text style={styles.required}>*</Text>}</Text>
              <TextInput style={styles.input} value={form.password} onChangeText={(v) => updateForm('password', v)} placeholder={editingClinician ? '(leave blank to keep)' : t('clin.password')} placeholderTextColor={Colors.textTertiary} secureTextEntry />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.organization')}</Text>
              <TextInput style={styles.input} value={form.organization} onChangeText={(v) => updateForm('organization', v)} placeholder={t('clin.organization')} placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>{t('clin.quotas')}</Text>
            </View>
            <View style={styles.quotaInputRow}>
              <View style={styles.quotaInputItem}>
                <Text style={styles.label}>{t('clin.max_patients')}</Text>
                <TextInput style={styles.input} value={form.max_patients} onChangeText={(v) => updateForm('max_patients', v)} keyboardType="numeric" />
              </View>
              <View style={styles.quotaInputItem}>
                <Text style={styles.label}>{t('clin.max_exercises')}</Text>
                <TextInput style={styles.input} value={form.max_exercises} onChangeText={(v) => updateForm('max_exercises', v)} keyboardType="numeric" />
              </View>
              <View style={styles.quotaInputItem}>
                <Text style={styles.label}>{t('clin.max_feeding_videos')}</Text>
                <TextInput style={styles.input} value={form.max_feeding_videos} onChangeText={(v) => updateForm('max_feeding_videos', v)} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('clin.is_active')}</Text>
              <Switch
                value={form.is_active}
                onValueChange={(v) => updateForm('is_active', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.greenLight }}
                thumbColor={form.is_active ? Colors.green : Colors.textTertiary}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('clin.is_approved')}</Text>
              <Switch
                value={form.is_approved}
                onValueChange={(v) => updateForm('is_approved', v)}
                trackColor={{ false: Colors.borderLight, true: Colors.greenLight }}
                thumbColor={form.is_approved ? Colors.green : Colors.textTertiary}
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
                <Text style={styles.saveBtnText}>{t('clin.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Share Exercise Modal */}
      <Modal visible={shareExerciseVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShareExerciseVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShareExerciseVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('clin.share_exercise')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.select_clinician')}</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { setClinicianPickerOpen(!clinicianPickerOpen); setExercisePickerOpen(false); }}>
                <Text style={[styles.pickerBtnText, !selectedClinicianId && styles.pickerBtnPlaceholder]}>{selectedClinicianName}</Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {clinicianPickerOpen && (
                <View style={styles.pickerList}>
                  {clinicians.map((c) => (
                    <TouchableOpacity key={c.id} style={[styles.pickerOption, selectedClinicianId === c.id && styles.pickerOptionActive]} onPress={() => { setSelectedClinicianId(c.id); setClinicianPickerOpen(false); }}>
                      <Text style={styles.pickerOptionText}>{c.full_name}</Text>
                      {selectedClinicianId === c.id && <Check size={16} color={Colors.green} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.select_exercise')}</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { setExercisePickerOpen(!exercisePickerOpen); setClinicianPickerOpen(false); }}>
                <Text style={[styles.pickerBtnText, !selectedExerciseId && styles.pickerBtnPlaceholder]}>{selectedExerciseTitle}</Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {exercisePickerOpen && (
                <View style={styles.pickerList}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {exercises.map((e) => (
                      <TouchableOpacity key={e.id} style={[styles.pickerOption, selectedExerciseId === e.id && styles.pickerOptionActive]} onPress={() => { setSelectedExerciseId(e.id); setExercisePickerOpen(false); }}>
                        <Text style={styles.pickerOptionText}>{language === 'zh' && e.title_zh_hant ? e.title_zh_hant : e.title_en}</Text>
                        {selectedExerciseId === e.id && <Check size={16} color={Colors.green} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, (!selectedClinicianId || !selectedExerciseId || shareExerciseMutation.isPending) && styles.saveBtnDisabled]}
              onPress={() => {
                if (selectedClinicianId && selectedExerciseId) {
                  shareExerciseMutation.mutate({ exercise_id: selectedExerciseId, clinician_id: selectedClinicianId });
                }
              }}
              disabled={!selectedClinicianId || !selectedExerciseId || shareExerciseMutation.isPending}
              activeOpacity={0.8}
            >
              {shareExerciseMutation.isPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t('clin.share_exercise')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Share Assessment Modal */}
      <Modal visible={shareAssessmentVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShareAssessmentVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShareAssessmentVisible(false)} style={styles.closeBtn}>
              <X size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('clin.share_assessment')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.select_clinician')}</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { setClinicianPickerOpen(!clinicianPickerOpen); setAssessmentPickerOpen(false); }}>
                <Text style={[styles.pickerBtnText, !selectedClinicianId && styles.pickerBtnPlaceholder]}>{selectedClinicianName}</Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {clinicianPickerOpen && (
                <View style={styles.pickerList}>
                  {clinicians.map((c) => (
                    <TouchableOpacity key={c.id} style={[styles.pickerOption, selectedClinicianId === c.id && styles.pickerOptionActive]} onPress={() => { setSelectedClinicianId(c.id); setClinicianPickerOpen(false); }}>
                      <Text style={styles.pickerOptionText}>{c.full_name}</Text>
                      {selectedClinicianId === c.id && <Check size={16} color={Colors.green} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('clin.select_assessment')}</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => { setAssessmentPickerOpen(!assessmentPickerOpen); setClinicianPickerOpen(false); }}>
                <Text style={[styles.pickerBtnText, !selectedAssessmentId && styles.pickerBtnPlaceholder]}>{selectedAssessmentName}</Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {assessmentPickerOpen && (
                <View style={styles.pickerList}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {assessments.map((a) => (
                      <TouchableOpacity key={a.id} style={[styles.pickerOption, selectedAssessmentId === a.id && styles.pickerOptionActive]} onPress={() => { setSelectedAssessmentId(a.id); setAssessmentPickerOpen(false); }}>
                        <Text style={styles.pickerOptionText}>{language === 'zh' && a.name_zh ? a.name_zh : a.name_en}</Text>
                        {selectedAssessmentId === a.id && <Check size={16} color={Colors.green} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, (!selectedClinicianId || !selectedAssessmentId || shareAssessmentMutation.isPending) && styles.saveBtnDisabled]}
              onPress={() => {
                if (selectedClinicianId && selectedAssessmentId) {
                  shareAssessmentMutation.mutate({ assessment_id: selectedAssessmentId, clinician_id: selectedClinicianId });
                }
              }}
              disabled={!selectedClinicianId || !selectedAssessmentId || shareAssessmentMutation.isPending}
              activeOpacity={0.8}
            >
              {shareAssessmentMutation.isPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{t('clin.share_assessment')}</Text>
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
    gap: 6,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
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
    fontSize: 11,
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
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
    fontSize: 13,
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
  card: {
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
  cardHeader: {
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  emailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  orgText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  quotaItem: {
    flex: 1,
    alignItems: 'center',
  },
  quotaValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  quotaLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  quotaDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  shareInfo: {
    flex: 1,
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  shareMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  shareDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
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
  sectionLabel: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  quotaInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quotaInputItem: {
    flex: 1,
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
    marginBottom: 12,
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
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pickerBtnText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  pickerBtnPlaceholder: {
    color: Colors.textTertiary,
  },
  pickerList: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    maxHeight: 240,
  },
  pickerScroll: {
    maxHeight: 240,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.card,
  },
  pickerOptionActive: {
    backgroundColor: Colors.greenLight,
  },
  pickerOptionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
});
