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
import { X, Plus, Search, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import {
  DOSAGE_PRESETS_EN,
  DURATION_PRESETS,
  DOSAGE_PER_DAY_PRESETS,
  DAYS_PER_WEEK_PRESETS,
} from '@/constants/dosagePresets';
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
  const [jumpModalVisible, setJumpModalVisible] = useState(false);
  const [jumpTargetIndex, setJumpTargetIndex] = useState<number | null>(null);
  const [jumpPosition, setJumpPosition] = useState('');

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
      audio_transcript_en: ex.audio_transcript_en ?? '',
      audio_transcript_zh_hant: ex.audio_transcript_zh_hant ?? '',
      audio_transcript_zh_hans: ex.audio_transcript_zh_hans ?? '',
      narrative_audio_youtube_id: ex.narrative_audio_youtube_id ?? '',
      narrative_audio_youtube_id_zh_hant: ex.narrative_audio_youtube_id_zh_hant ?? '',
      narrative_audio_youtube_id_zh_hans: ex.narrative_audio_youtube_id_zh_hans ?? '',
      duration_minutes: ex.default_duration_minutes,
      dosage: ex.default_dosage ?? '',
      dosage_zh_hant: ex.default_dosage_zh_hant ?? '',
      dosage_zh_hans: ex.default_dosage_zh_hans ?? '',
      dosage_per_day: ex.default_dosage_per_day,
      dosage_days_per_week: ex.default_dosage_days_per_week,
      category: ex.category ?? '',
      subtitle_url_en: ex.subtitle_url_en ?? '',
      subtitle_url_zh_hant: ex.subtitle_url_zh_hant ?? '',
      subtitle_url_zh_hans: ex.subtitle_url_zh_hans ?? '',
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

  const handleJumpToPosition = useCallback(() => {
    if (jumpTargetIndex == null) return;
    const pos = parseInt(jumpPosition, 10);
    if (isNaN(pos) || pos < 1 || pos > exercises.length) return;
    const targetPos = pos - 1;
    if (targetPos === jumpTargetIndex) { setJumpModalVisible(false); return; }
    setExercises((prev) => {
      const updated = [...prev];
      const [item] = updated.splice(jumpTargetIndex, 1);
      updated.splice(targetPos, 0, item);
      return updated.map((e, i) => ({ ...e, sort_order: i + 1 }));
    });
    setJumpModalVisible(false);
  }, [jumpTargetIndex, jumpPosition, exercises.length]);

  const openJumpModal = useCallback((index: number) => {
    setJumpTargetIndex(index);
    setJumpPosition(String(index + 1));
    setJumpModalVisible(true);
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
              <TouchableOpacity
                key={ex.temp_id}
                style={styles.programExCard}
                onLongPress={() => openJumpModal(index)}
                activeOpacity={0.85}
                delayLongPress={400}
              >
                <View style={styles.programExHeader}>
                  <View style={styles.gripHandle}>
                    <GripVertical size={16} color={Colors.textTertiary} />
                  </View>
                  <TouchableOpacity onLongPress={() => openJumpModal(index)} delayLongPress={400} activeOpacity={0.7}>
                    <Text style={styles.programExOrder}>{ex.sort_order}</Text>
                  </TouchableOpacity>
                  <Text style={styles.programExTitle} numberOfLines={1}>{getExTitle(ex)}</Text>
                  <View style={styles.programExActions}>
                    <TouchableOpacity
                      onPress={() => handleMoveUp(index)}
                      style={[styles.moveBtn, index === 0 ? styles.moveBtnDisabled : styles.moveBtnEnabled]}
                      disabled={index === 0}
                      activeOpacity={0.7}
                    >
                      <ChevronUp size={18} color={index === 0 ? Colors.textTertiary : Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleMoveDown(index)}
                      style={[styles.moveBtn, index === exercises.length - 1 ? styles.moveBtnDisabled : styles.moveBtnEnabled]}
                      disabled={index === exercises.length - 1}
                      activeOpacity={0.7}
                    >
                      <ChevronDown size={18} color={index === exercises.length - 1 ? Colors.textTertiary : Colors.accent} />
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

                <View style={styles.presetSection}>
                  <Text style={styles.presetSectionLabel}>Duration</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.presetRow}>
                      {DURATION_PRESETS.map((val) => (
                        <TouchableOpacity
                          key={val}
                          onPress={() => handleUpdateField(ex.temp_id, 'duration_minutes', val)}
                          style={[styles.presetChip, ex.duration_minutes === val && styles.presetChipActive]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.presetChipText, ex.duration_minutes === val && styles.presetChipTextActive]}>{val} min</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.presetSection}>
                  <Text style={styles.presetSectionLabel}>Dosage</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.presetRow}>
                      {DOSAGE_PRESETS_EN.map((preset) => (
                        <TouchableOpacity
                          key={preset}
                          onPress={() => handleUpdateField(ex.temp_id, 'dosage', preset)}
                          style={[styles.presetChip, ex.dosage === preset && styles.presetChipActive]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.presetChipText, ex.dosage === preset && styles.presetChipTextActive]}>{preset}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.presetSection}>
                  <Text style={styles.presetSectionLabel}>Per Day / Days per Week</Text>
                  <View style={styles.presetDoubleRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetHalf}>
                      <View style={styles.presetRow}>
                        {DOSAGE_PER_DAY_PRESETS.map((val) => (
                          <TouchableOpacity
                            key={val}
                            onPress={() => handleUpdateField(ex.temp_id, 'dosage_per_day', val)}
                            style={[styles.presetChip, ex.dosage_per_day === val && styles.presetChipActive]}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.presetChipText, ex.dosage_per_day === val && styles.presetChipTextActive]}>{val}x/day</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetHalf}>
                      <View style={styles.presetRow}>
                        {DAYS_PER_WEEK_PRESETS.map((val) => (
                          <TouchableOpacity
                            key={val}
                            onPress={() => handleUpdateField(ex.temp_id, 'dosage_days_per_week', val)}
                            style={[styles.presetChip, ex.dosage_days_per_week === val && styles.presetChipActive]}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.presetChipText, ex.dosage_days_per_week === val && styles.presetChipTextActive]}>{val}d/wk</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={jumpModalVisible} transparent animationType="fade" onRequestClose={() => setJumpModalVisible(false)}>
        <TouchableOpacity style={styles.jumpOverlay} activeOpacity={1} onPress={() => setJumpModalVisible(false)}>
          <View style={styles.jumpModal}>
            <Text style={styles.jumpTitle}>Move to position</Text>
            <Text style={styles.jumpSubtitle}>
              Currently at position {jumpTargetIndex != null ? jumpTargetIndex + 1 : ''} of {exercises.length}
            </Text>
            <TextInput
              style={styles.jumpInput}
              value={jumpPosition}
              onChangeText={setJumpPosition}
              keyboardType="numeric"
              placeholder={`1 - ${exercises.length}`}
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.jumpActions}>
              <TouchableOpacity style={styles.jumpCancelBtn} onPress={() => setJumpModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.jumpCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.jumpConfirmBtn} onPress={handleJumpToPosition} activeOpacity={0.7}>
                <Text style={styles.jumpConfirmText}>Move</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    gap: 6,
  },
  gripHandle: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  moveBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveBtnEnabled: {
    backgroundColor: Colors.accentLight,
  },
  moveBtnDisabled: {
    backgroundColor: Colors.borderLight,
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
  jumpOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  jumpModal: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  jumpTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  jumpSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  jumpInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  jumpActions: {
    flexDirection: 'row',
    gap: 10,
  },
  jumpCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  jumpCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  jumpConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  jumpConfirmText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  presetSection: {
    marginTop: 8,
  },
  presetSectionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  presetRow: {
    flexDirection: 'row' as const,
    gap: 6,
    paddingVertical: 2,
  },
  presetDoubleRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  presetHalf: {
    flex: 1,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  presetChipActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  presetChipTextActive: {
    color: Colors.accent,
  },
});
