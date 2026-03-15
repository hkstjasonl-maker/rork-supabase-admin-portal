import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Pencil, LayoutGrid, Clock, ChevronDown, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import ProgramBuilderModal from '@/components/ProgramBuilderModal';
import CopyProgramModal from '@/components/CopyProgramModal';
import ObjectivesSection from '@/components/ObjectivesSection';
import VideoReviewSection from '@/components/VideoReviewSection';
import type { Patient } from '@/types/patient';
import type { ExerciseProgram, ProgramExercise, ProgramBuilderExercise } from '@/types/program';

let tempCounter = 0;
function makeTempId(): string {
  tempCounter += 1;
  return `t_${Date.now()}_${tempCounter}`;
}

export default function ProgramsScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [builderVisible, setBuilderVisible] = useState(false);
  const [copyVisible, setCopyVisible] = useState(false);
  const [editingProgram, setEditingProgram] = useState(false);

  const [builderInitIssueDate, setBuilderInitIssueDate] = useState<string | undefined>();
  const [builderInitExpiryDate, setBuilderInitExpiryDate] = useState<string | undefined>();
  const [builderInitRemarks, setBuilderInitRemarks] = useState<string | undefined>();
  const [builderInitExercises, setBuilderInitExercises] = useState<ProgramBuilderExercise[] | undefined>();

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

  const selectedPatient = useMemo(() => {
    return (patientsQuery.data ?? []).find((p) => p.id === selectedPatientId) ?? null;
  }, [patientsQuery.data, selectedPatientId]);

  const programQuery = useQuery({
    queryKey: ['program', selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return null;
      console.log('[Programs] Fetching program for patient:', selectedPatientId);
      const { data, error } = await supabase
        .from('exercise_programs')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as ExerciseProgram;
    },
    enabled: !!selectedPatientId,
  });

  const exercisesQuery = useQuery({
    queryKey: ['program_exercises', programQuery.data?.id],
    queryFn: async () => {
      const programId = programQuery.data?.id;
      if (!programId) return [];
      console.log('[Programs] Fetching exercises for program:', programId);
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('program_id', programId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProgramExercise[];
    },
    enabled: !!programQuery.data?.id,
  });

  const saveProgramMutation = useMutation({
    mutationFn: async (payload: {
      issue_date: string;
      expiry_date: string;
      remarks: string;
      exercises: ProgramBuilderExercise[];
    }) => {
      if (!selectedPatientId) throw new Error('No patient selected');

      let programId: string;

      if (editingProgram && programQuery.data?.id) {
        console.log('[Programs] Updating program:', programQuery.data.id);
        const { error } = await supabase
          .from('exercise_programs')
          .update({
            issue_date: payload.issue_date || null,
            expiry_date: payload.expiry_date || null,
            remarks: payload.remarks || null,
          })
          .eq('id', programQuery.data.id);
        if (error) throw error;
        programId = programQuery.data.id;

        console.log('[Programs] Deleting old exercises for program:', programId);
        const { error: delError } = await supabase
          .from('exercises')
          .delete()
          .eq('program_id', programId);
        if (delError) throw delError;
      } else {
        console.log('[Programs] Creating new program for patient:', selectedPatientId);
        const { data: newProg, error } = await supabase
          .from('exercise_programs')
          .insert({
            patient_id: selectedPatientId,
            issue_date: payload.issue_date || null,
            expiry_date: payload.expiry_date || null,
            remarks: payload.remarks || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        programId = newProg.id;
      }

      if (payload.exercises.length > 0) {
        const exerciseRows = payload.exercises.map((ex) => ({
          program_id: programId,
          title_en: ex.title_en,
          title_zh_hant: ex.title_zh_hant || null,
          title_zh_hans: ex.title_zh_hans || null,
          vimeo_video_id: ex.vimeo_video_id || null,
          youtube_video_id: ex.youtube_video_id || null,
          audio_instruction_url_en: ex.audio_instruction_url_en || null,
          audio_instruction_url_zh_hant: ex.audio_instruction_url_zh_hant || null,
          audio_instruction_url_zh_hans: ex.audio_instruction_url_zh_hans || null,
          audio_transcript_en: ex.audio_transcript_en || null,
          audio_transcript_zh_hant: ex.audio_transcript_zh_hant || null,
          audio_transcript_zh_hans: ex.audio_transcript_zh_hans || null,
          narrative_audio_youtube_id: ex.narrative_audio_youtube_id || null,
          narrative_audio_youtube_id_zh_hant: ex.narrative_audio_youtube_id_zh_hant || null,
          narrative_audio_youtube_id_zh_hans: ex.narrative_audio_youtube_id_zh_hans || null,
          duration_minutes: ex.duration_minutes,
          dosage: ex.dosage || null,
          dosage_zh_hant: ex.dosage_zh_hant || null,
          dosage_zh_hans: ex.dosage_zh_hans || null,
          dosage_per_day: ex.dosage_per_day,
          dosage_days_per_week: ex.dosage_days_per_week,
          category: ex.category || null,
          sort_order: ex.sort_order,
        }));

        console.log('[Programs] Inserting', exerciseRows.length, 'exercises');
        const { error: insertError } = await supabase.from('exercises').insert(exerciseRows);
        if (insertError) throw insertError;
      }

      return programId;
    },
    onSuccess: () => {
      console.log('[Programs] Save successful');
      void queryClient.invalidateQueries({ queryKey: ['program', selectedPatientId] });
      void queryClient.invalidateQueries({ queryKey: ['program_exercises'] });
      setBuilderVisible(false);
      setEditingProgram(false);
    },
    onError: (err) => {
      console.error('[Programs] Save error:', err);
      Alert.alert('Error', err.message ?? 'Failed to save program');
    },
  });

  const handleNewProgram = useCallback(() => {
    setEditingProgram(false);
    setBuilderInitIssueDate(new Date().toISOString().split('T')[0]);
    setBuilderInitExpiryDate('');
    setBuilderInitRemarks('');
    setBuilderInitExercises([]);
    setBuilderVisible(true);
  }, []);

  const handleEditProgram = useCallback(() => {
    if (!programQuery.data) return;
    setEditingProgram(true);
    setBuilderInitIssueDate(programQuery.data.issue_date ?? '');
    setBuilderInitExpiryDate(programQuery.data.expiry_date ?? '');
    setBuilderInitRemarks(programQuery.data.remarks ?? '');

    const exList = (exercisesQuery.data ?? []).map((ex): ProgramBuilderExercise => ({
      temp_id: makeTempId(),
      title_en: ex.title_en,
      title_zh_hant: ex.title_zh_hant ?? '',
      title_zh_hans: ex.title_zh_hans ?? '',
      vimeo_video_id: ex.vimeo_video_id ?? '',
      youtube_video_id: ex.youtube_video_id ?? '',
      audio_instruction_url_en: ex.audio_instruction_url_en ?? '',
      audio_instruction_url_zh_hant: ex.audio_instruction_url_zh_hant ?? '',
      audio_instruction_url_zh_hans: ex.audio_instruction_url_zh_hans ?? '',
      audio_transcript_en: ex.audio_transcript_en ?? '',
      audio_transcript_zh_hant: ex.audio_transcript_zh_hant ?? '',
      audio_transcript_zh_hans: ex.audio_transcript_zh_hans ?? '',
      narrative_audio_youtube_id: ex.narrative_audio_youtube_id ?? '',
      narrative_audio_youtube_id_zh_hant: ex.narrative_audio_youtube_id_zh_hant ?? '',
      narrative_audio_youtube_id_zh_hans: ex.narrative_audio_youtube_id_zh_hans ?? '',
      duration_minutes: ex.duration_minutes,
      dosage: ex.dosage ?? '',
      dosage_zh_hant: ex.dosage_zh_hant ?? '',
      dosage_zh_hans: ex.dosage_zh_hans ?? '',
      dosage_per_day: ex.dosage_per_day,
      dosage_days_per_week: ex.dosage_days_per_week,
      category: ex.category ?? '',
      sort_order: ex.sort_order,
    }));

    setBuilderInitExercises(exList);
    setBuilderVisible(true);
  }, [programQuery.data, exercisesQuery.data]);

  const handleCopyFromPatient = useCallback(() => {
    if (!selectedPatientId) return;
    setCopyVisible(true);
  }, [selectedPatientId]);

  const handleCopyResult = useCallback((exercises: ProgramExercise[], program: ExerciseProgram) => {
    setCopyVisible(false);
    setEditingProgram(false);

    setBuilderInitIssueDate(new Date().toISOString().split('T')[0]);
    setBuilderInitExpiryDate('');
    setBuilderInitRemarks(program.remarks ?? '');

    const exList = exercises.map((ex, i): ProgramBuilderExercise => ({
      temp_id: makeTempId(),
      title_en: ex.title_en,
      title_zh_hant: ex.title_zh_hant ?? '',
      title_zh_hans: ex.title_zh_hans ?? '',
      vimeo_video_id: ex.vimeo_video_id ?? '',
      youtube_video_id: ex.youtube_video_id ?? '',
      audio_instruction_url_en: ex.audio_instruction_url_en ?? '',
      audio_instruction_url_zh_hant: ex.audio_instruction_url_zh_hant ?? '',
      audio_instruction_url_zh_hans: ex.audio_instruction_url_zh_hans ?? '',
      audio_transcript_en: ex.audio_transcript_en ?? '',
      audio_transcript_zh_hant: ex.audio_transcript_zh_hant ?? '',
      audio_transcript_zh_hans: ex.audio_transcript_zh_hans ?? '',
      narrative_audio_youtube_id: ex.narrative_audio_youtube_id ?? '',
      narrative_audio_youtube_id_zh_hant: ex.narrative_audio_youtube_id_zh_hant ?? '',
      narrative_audio_youtube_id_zh_hans: ex.narrative_audio_youtube_id_zh_hans ?? '',
      duration_minutes: ex.duration_minutes,
      dosage: ex.dosage ?? '',
      dosage_zh_hant: ex.dosage_zh_hant ?? '',
      dosage_zh_hans: ex.dosage_zh_hans ?? '',
      dosage_per_day: ex.dosage_per_day,
      dosage_days_per_week: ex.dosage_days_per_week,
      category: ex.category ?? '',
      sort_order: i + 1,
    }));

    setBuilderInitExercises(exList);
    setBuilderVisible(true);
  }, []);

  const handleSaveProgram = useCallback((data: {
    issue_date: string;
    expiry_date: string;
    remarks: string;
    exercises: ProgramBuilderExercise[];
  }) => {
    saveProgramMutation.mutate(data);
  }, [saveProgramMutation]);

  const getExTitle = useCallback((ex: ProgramExercise) => {
    if (language === 'zh' && ex.title_zh_hant) return ex.title_zh_hant;
    return ex.title_en;
  }, [language]);

  const program = programQuery.data;
  const programExercises = exercisesQuery.data ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('program.title')} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={programQuery.isRefetching || exercisesQuery.isRefetching}
            onRefresh={() => {
              if (selectedPatientId) {
                void programQuery.refetch();
                void exercisesQuery.refetch();
              }
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.patientSelector}>
          <Text style={styles.selectorLabel}>{t('program.select_patient')}</Text>
          <TouchableOpacity
            style={styles.selectorBtn}
            onPress={() => setShowPatientPicker(!showPatientPicker)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.selectorBtnText, !selectedPatient && styles.selectorPlaceholder]}
              numberOfLines={1}
            >
              {selectedPatient?.patient_name ?? t('program.select_patient')}
            </Text>
            <ChevronDown size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {showPatientPicker && (
            <View style={styles.pickerDropdown}>
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {patientsQuery.isLoading ? (
                  <ActivityIndicator size="small" color={Colors.accent} style={styles.pickerLoader} />
                ) : (
                  (patientsQuery.data ?? []).map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.pickerItem, p.id === selectedPatientId && styles.pickerItemActive]}
                      onPress={() => {
                        setSelectedPatientId(p.id);
                        setShowPatientPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerItemText, p.id === selectedPatientId && styles.pickerItemTextActive]}>
                        {p.patient_name}
                      </Text>
                      <Text style={styles.pickerItemCode}>{p.access_code}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {!selectedPatientId ? (
          <View style={styles.emptyState}>
            <LayoutGrid size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyStateText}>{t('program.no_patient')}</Text>
          </View>
        ) : programQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>{t('program.loading')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleNewProgram} activeOpacity={0.7}>
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('program.new')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyFromPatient} activeOpacity={0.7}>
                <Copy size={16} color={Colors.accent} />
                <Text style={styles.secondaryBtnText}>{t('program.copy')}</Text>
              </TouchableOpacity>
            </View>

            {program ? (
              <View style={styles.programCard}>
                <View style={styles.programHeader}>
                  <Text style={styles.programHeaderTitle}>{t('program.current_program')}</Text>
                  <TouchableOpacity style={styles.editProgramBtn} onPress={handleEditProgram} activeOpacity={0.7}>
                    <Pencil size={14} color={Colors.accent} />
                    <Text style={styles.editProgramBtnText}>{t('program.edit')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.programMeta}>
                  {program.issue_date ? (
                    <View style={styles.metaItem}>
                      <Calendar size={13} color={Colors.green} />
                      <Text style={styles.metaLabel}>{t('program.issue_date')}:</Text>
                      <Text style={styles.metaValue}>{program.issue_date}</Text>
                    </View>
                  ) : null}
                  {program.expiry_date ? (
                    <View style={styles.metaItem}>
                      <Clock size={13} color={Colors.accent} />
                      <Text style={styles.metaLabel}>{t('program.expiry_date')}:</Text>
                      <Text style={styles.metaValue}>{program.expiry_date}</Text>
                    </View>
                  ) : null}
                  {program.remarks ? (
                    <Text style={styles.remarksText}>{program.remarks}</Text>
                  ) : null}
                </View>

                <Text style={styles.exercisesLabel}>{t('program.exercises')} ({programExercises.length})</Text>

                {exercisesQuery.isLoading ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : programExercises.length === 0 ? (
                  <Text style={styles.noExercisesText}>{t('program.no_exercises')}</Text>
                ) : (
                  programExercises.map((ex) => (
                    <View key={ex.id} style={styles.exerciseRow}>
                      <Text style={styles.exOrder}>{ex.sort_order}</Text>
                      <View style={styles.exInfo}>
                        <Text style={styles.exTitle} numberOfLines={1}>{getExTitle(ex)}</Text>
                        <View style={styles.exMetaRow}>
                          {ex.duration_minutes ? (
                            <Text style={styles.exMetaText}>{ex.duration_minutes} min</Text>
                          ) : null}
                          {ex.dosage_per_day ? (
                            <Text style={styles.exMetaText}>{ex.dosage_per_day}{t('program.per_day')}</Text>
                          ) : null}
                          {ex.dosage_days_per_week ? (
                            <Text style={styles.exMetaText}>{ex.dosage_days_per_week}{t('program.days_week')}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))
                )}

                <ObjectivesSection programId={program.id} />
                <VideoReviewSection programId={program.id} programExercises={programExercises} />
              </View>
            ) : (
              <View style={styles.noProgramState}>
                <LayoutGrid size={32} color={Colors.textTertiary} />
                <Text style={styles.noProgramText}>{t('program.no_program')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ProgramBuilderModal
        visible={builderVisible}
        onClose={() => { setBuilderVisible(false); setEditingProgram(false); }}
        onSave={handleSaveProgram}
        saving={saveProgramMutation.isPending}
        initialIssueDate={builderInitIssueDate}
        initialExpiryDate={builderInitExpiryDate}
        initialRemarks={builderInitRemarks}
        initialExercises={builderInitExercises}
      />

      {selectedPatientId && (
        <CopyProgramModal
          visible={copyVisible}
          onClose={() => setCopyVisible(false)}
          onCopy={handleCopyResult}
          excludePatientId={selectedPatientId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  patientSelector: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  selectorBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  selectorPlaceholder: {
    color: Colors.textTertiary,
    fontWeight: '400' as const,
  },
  pickerDropdown: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerScroll: {
    maxHeight: 220,
  },
  pickerLoader: {
    paddingVertical: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerItemActive: {
    backgroundColor: Colors.accentLight,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  pickerItemTextActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  pickerItemCode: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  programCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  programHeaderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  editProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  editProgramBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  programMeta: {
    gap: 6,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  metaValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  remarksText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  exercisesLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  noExercisesText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  exOrder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.inputBg,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    overflow: 'hidden',
  },
  exInfo: {
    flex: 1,
    marginLeft: 10,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  exMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
  },
  exMetaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  noProgramState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  noProgramText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
