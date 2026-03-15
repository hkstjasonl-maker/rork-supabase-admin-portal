import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { X, Plus, Search, Trash2, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/types/exercise';
import type { ProgramBuilderExercise } from '@/types/program';

interface ProgramBuilderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    issue_date: string;
    expiry_date: string;
    remarks: string;
    exercises: ProgramBuilderExercise[];
  }) => void;
  saving?: boolean;
  initialIssueDate?: string;
  initialExpiryDate?: string;
  initialRemarks?: string;
  initialExercises?: ProgramBuilderExercise[];
}

let tempIdCounter = 0;
function nextTempId(): string {
  tempIdCounter += 1;
  return `temp_${Date.now()}_${tempIdCounter}`;
}

export default function ProgramBuilderModal({
  visible,
  onClose,
  onSave,
  saving,
  initialIssueDate,
  initialExpiryDate,
  initialRemarks,
  initialExercises,
}: ProgramBuilderModalProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [exercises, setExercises] = useState<ProgramBuilderExercise[]>([]);
  const [libSearch, setLibSearch] = useState('');

  const libraryQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .order('title_en', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });

  useEffect(() => {
    if (visible) {
      setIssueDate(initialIssueDate ?? new Date().toISOString().split('T')[0]);
      setExpiryDate(initialExpiryDate ?? '');
      setRemarks(initialRemarks ?? '');
      setExercises(initialExercises ?? []);
      setLibSearch('');
    }
  }, [visible, initialIssueDate, initialExpiryDate, initialRemarks, initialExercises]);

  const filteredLibrary = useMemo(() => {
    const lib = libraryQuery.data ?? [];
    if (!libSearch.trim()) return lib;
    const q = libSearch.toLowerCase().trim();
    return lib.filter(
      (e) =>
        e.title_en.toLowerCase().includes(q) ||
        (e.title_zh_hant ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q)
    );
  }, [libraryQuery.data, libSearch]);

  const handleAddFromLibrary = useCallback((ex: Exercise) => {
    const newEx: ProgramBuilderExercise = {
      temp_id: nextTempId(),
      title_en: ex.title_en,
      title_zh_hant: ex.title_zh_hant ?? '',
      title_zh_hans: ex.title_zh_hans ?? '',
      vimeo_video_id: ex.vimeo_video_id ?? '',
      youtube_video_id: ex.youtube_video_id ?? '',
      audio_instruction_url_en: ex.audio_instruction_url_en ?? '',
      audio_instruction_url_zh_hant: ex.audio_instruction_url_zh_hant ?? '',
      audio_instruction_url_zh_hans: ex.audio_instruction_url_zh_hans ?? '',
      audio_transcript_en: '',
      audio_transcript_zh_hant: '',
      audio_transcript_zh_hans: '',
      narrative_audio_youtube_id: ex.narrative_audio_youtube_id ?? '',
      narrative_audio_youtube_id_zh_hant: ex.narrative_audio_youtube_id_zh_hant ?? '',
      narrative_audio_youtube_id_zh_hans: ex.narrative_audio_youtube_id_zh_hans ?? '',
      duration_minutes: ex.default_duration_minutes,
      dosage: ex.default_dosage ?? '',
      dosage_zh_hant: '',
      dosage_zh_hans: '',
      dosage_per_day: ex.default_dosage_per_day,
      dosage_days_per_week: ex.default_dosage_days_per_week,
      category: ex.category ?? '',
      sort_order: exercises.length + 1,
    };
    setExercises((prev) => [...prev, newEx]);
  }, [exercises.length]);

  const handleRemoveExercise = useCallback((tempId: string) => {
    setExercises((prev) => {
      const updated = prev.filter((e) => e.temp_id !== tempId);
      return updated.map((e, i) => ({ ...e, sort_order: i + 1 }));
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setExercises((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated.map((e, i) => ({ ...e, sort_order: i + 1 }));
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setExercises((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated.map((e, i) => ({ ...e, sort_order: i + 1 }));
    });
  }, []);

  const handleUpdateField = useCallback((tempId: string, field: string, value: string | number | null) => {
    setExercises((prev) =>
      prev.map((e) => (e.temp_id === tempId ? { ...e, [field]: value } : e))
    );
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      issue_date: issueDate,
      expiry_date: expiryDate,
      remarks,
      exercises,
    });
  }, [issueDate, expiryDate, remarks, exercises, onSave]);

  const getExTitle = useCallback((ex: Exercise | ProgramBuilderExercise) => {
    if (language === 'zh') {
      const zhTitle = 'title_zh_hant' in ex ? ex.title_zh_hant : null;
      if (zhTitle) return zhTitle;
    }
    return ex.title_en;
  }, [language]);

  const renderLibraryItem = useCallback(({ item }: { item: Exercise }) => (
    <View style={styles.libItem}>
      <View style={styles.libItemInfo}>
        <Text style={styles.libItemTitle} numberOfLines={1}>{getExTitle(item)}</Text>
        {item.category ? (
          <Text style={styles.libItemCategory}>{item.category}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.addLibBtn}
        onPress={() => handleAddFromLibrary(item)}
        activeOpacity={0.7}
      >
        <Plus size={16} color={Colors.white} />
      </TouchableOpacity>
    </View>
  ), [getExTitle, handleAddFromLibrary]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top + 4 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('program.builder_title')}</Text>
          <TouchableOpacity
            style={[styles.saveHeaderBtn, saving && styles.saveHeaderBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.saveHeaderBtnText}>{t('program.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>{t('program.issue_date')}</Text>
              <TextInput
                style={styles.dateInput}
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder={t('program.date_format')}
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>{t('program.expiry_date')}</Text>
              <TextInput
                style={styles.dateInput}
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder={t('program.date_format')}
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.remarksField}>
            <Text style={styles.fieldLabel}>{t('program.remarks')}</Text>
            <TextInput
              style={styles.remarksInput}
              value={remarks}
              onChangeText={setRemarks}
              placeholder={t('program.remarks')}
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.sectionTitle}>{t('program.library')}</Text>
          <View style={styles.libSearchBar}>
            <Search size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.libSearchInput}
              value={libSearch}
              onChangeText={setLibSearch}
              placeholder={t('program.search_library')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.libList}>
            {libraryQuery.isLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={styles.libLoader} />
            ) : (
              <FlatList
                data={filteredLibrary}
                renderItem={renderLibraryItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                style={styles.libFlatList}
              />
            )}
          </View>

          <Text style={styles.sectionTitle}>
            {t('program.program_exercises')} ({exercises.length})
          </Text>

          {exercises.length === 0 ? (
            <View style={styles.emptyProgram}>
              <Text style={styles.emptyProgramText}>{t('program.no_exercises')}</Text>
            </View>
          ) : (
            exercises.map((ex, index) => (
              <View key={ex.temp_id} style={styles.programExCard}>
                <View style={styles.programExHeader}>
                  <Text style={styles.programExOrder}>{ex.sort_order}</Text>
                  <Text style={styles.programExTitle} numberOfLines={1}>{getExTitle(ex)}</Text>
                  <View style={styles.programExActions}>
                    <TouchableOpacity
                      onPress={() => handleMoveUp(index)}
                      style={styles.moveBtn}
                      disabled={index === 0}
                      activeOpacity={0.7}
                    >
                      <ChevronUp size={16} color={index === 0 ? Colors.textTertiary : Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleMoveDown(index)}
                      style={styles.moveBtn}
                      disabled={index === exercises.length - 1}
                      activeOpacity={0.7}
                    >
                      <ChevronDown size={16} color={index === exercises.length - 1 ? Colors.textTertiary : Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveExercise(ex.temp_id)}
                      style={styles.removeBtn}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.programExFields}>
                  <View style={styles.inlineField}>
                    <Text style={styles.inlineLabel}>{t('program.duration_min')}</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={ex.duration_minutes?.toString() ?? ''}
                      onChangeText={(v) => handleUpdateField(ex.temp_id, 'duration_minutes', v ? parseInt(v, 10) || null : null)}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <Text style={styles.inlineLabel}>{t('program.dosage')}{t('program.per_day')}</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={ex.dosage_per_day?.toString() ?? ''}
                      onChangeText={(v) => handleUpdateField(ex.temp_id, 'dosage_per_day', v ? parseInt(v, 10) || null : null)}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <Text style={styles.inlineLabel}>{t('program.days_week')}</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={ex.dosage_days_per_week?.toString() ?? ''}
                      onChangeText={(v) => handleUpdateField(ex.temp_id, 'dosage_days_per_week', v ? parseInt(v, 10) || null : null)}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  saveHeaderBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  saveHeaderBtnDisabled: {
    opacity: 0.7,
  },
  saveHeaderBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  dateInput: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  remarksField: {
    marginBottom: 16,
  },
  remarksInput: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minHeight: 60,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
  libSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 2,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 8,
  },
  libSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  libList: {
    maxHeight: 200,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  libFlatList: {
    maxHeight: 200,
  },
  libLoader: {
    paddingVertical: 20,
  },
  libItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  libItemInfo: {
    flex: 1,
  },
  libItemTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  libItemCategory: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  addLibBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyProgram: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyProgramText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  programExCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  programExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  programExOrder: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: Colors.accentLight,
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
    overflow: 'hidden',
  },
  programExTitle: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  programExActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moveBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  programExFields: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  inlineField: {
    flex: 1,
  },
  inlineLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  inlineInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
  },
});
