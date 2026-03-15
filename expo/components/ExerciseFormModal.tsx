import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { X, ArrowRightLeft } from 'lucide-react-native';
import { trad2simp } from '@/utils/trad2simp';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import {
  DOSAGE_PRESETS_EN,
  DOSAGE_PRESETS_HANT,
  DOSAGE_PRESETS_HANS,
  DURATION_PRESETS,
  DOSAGE_PER_DAY_PRESETS,
  DAYS_PER_WEEK_PRESETS,
} from '@/constants/dosagePresets';
import { useLanguage } from '@/providers/LanguageProvider';
import type { Exercise, ExerciseFormData } from '@/types/exercise';
import { extractVimeoId, extractYouTubeId } from '@/types/exercise';

interface ExerciseFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ExerciseFormData) => void;
  exercise?: Exercise | null;
  saving?: boolean;
}

export default function ExerciseFormModal({
  visible,
  onClose,
  onSave,
  exercise,
  saving,
}: ExerciseFormModalProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [titleEn, setTitleEn] = useState('');
  const [titleZhHant, setTitleZhHant] = useState('');
  const [titleZhHans, setTitleZhHans] = useState('');
  const [vimeoInput, setVimeoInput] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [duration, setDuration] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosagePerDay, setDosagePerDay] = useState('');
  const [dosageDaysPerWeek, setDosageDaysPerWeek] = useState('');
  const [audioEn, setAudioEn] = useState('');
  const [audioZhHant, setAudioZhHant] = useState('');
  const [audioZhHans, setAudioZhHans] = useState('');
  const [narrativeEn, setNarrativeEn] = useState('');
  const [narrativeZhHant, setNarrativeZhHant] = useState('');
  const [narrativeZhHans, setNarrativeZhHans] = useState('');
  const [subtitleEn, setSubtitleEn] = useState('');
  const [subtitleZhHant, setSubtitleZhHant] = useState('');
  const [subtitleZhHans, setSubtitleZhHans] = useState('');
  const [transcriptEn, setTranscriptEn] = useState('');
  const [transcriptZhHant, setTranscriptZhHant] = useState('');
  const [transcriptZhHans, setTranscriptZhHans] = useState('');
  const [dosageZhHant, setDosageZhHant] = useState('');
  const [dosageZhHans, setDosageZhHans] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (exercise) {
        setTitleEn(exercise.title_en);
        setTitleZhHant(exercise.title_zh_hant ?? '');
        setTitleZhHans(exercise.title_zh_hans ?? '');
        setVimeoInput(exercise.vimeo_video_id ?? '');
        setYoutubeInput(exercise.youtube_video_id ?? '');
        setCategory(exercise.category ?? '');
        setTagsInput(exercise.tags?.join(', ') ?? '');
        setDuration(exercise.default_duration_minutes?.toString() ?? '');
        setDosage(exercise.default_dosage ?? '');
        setDosagePerDay(exercise.default_dosage_per_day?.toString() ?? '');
        setDosageDaysPerWeek(exercise.default_dosage_days_per_week?.toString() ?? '');
        setAudioEn(exercise.audio_instruction_url_en ?? '');
        setAudioZhHant(exercise.audio_instruction_url_zh_hant ?? '');
        setAudioZhHans(exercise.audio_instruction_url_zh_hans ?? '');
        setNarrativeEn(exercise.narrative_audio_youtube_id ?? '');
        setNarrativeZhHant(exercise.narrative_audio_youtube_id_zh_hant ?? '');
        setNarrativeZhHans(exercise.narrative_audio_youtube_id_zh_hans ?? '');
        setSubtitleEn(exercise.subtitle_url_en ?? '');
        setSubtitleZhHant(exercise.subtitle_url_zh_hant ?? '');
        setSubtitleZhHans(exercise.subtitle_url_zh_hans ?? '');
        setTranscriptEn(exercise.audio_transcript_en ?? '');
        setTranscriptZhHant(exercise.audio_transcript_zh_hant ?? '');
        setTranscriptZhHans(exercise.audio_transcript_zh_hans ?? '');
        setDosageZhHant(exercise.default_dosage_zh_hant ?? '');
        setDosageZhHans(exercise.default_dosage_zh_hans ?? '');
      } else {
        setTitleEn('');
        setTitleZhHant('');
        setTitleZhHans('');
        setVimeoInput('');
        setYoutubeInput('');
        setCategory('');
        setTagsInput('');
        setDuration('');
        setDosage('');
        setDosagePerDay('');
        setDosageDaysPerWeek('');
        setAudioEn('');
        setAudioZhHant('');
        setAudioZhHans('');
        setNarrativeEn('');
        setNarrativeZhHant('');
        setNarrativeZhHans('');
        setSubtitleEn('');
        setSubtitleZhHant('');
        setSubtitleZhHans('');
        setTranscriptEn('');
        setTranscriptZhHant('');
        setTranscriptZhHans('');
        setDosageZhHant('');
        setDosageZhHans('');
      }
      setError(null);
    }
  }, [visible, exercise]);

  const handleSave = useCallback(() => {
    setError(null);
    if (!titleEn.trim()) {
      setError(t('exercise.title_required'));
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const parsedDuration = duration.trim() ? parseInt(duration, 10) : null;
    const parsedDosagePerDay = dosagePerDay.trim() ? parseInt(dosagePerDay, 10) : null;
    const parsedDosageDaysPerWeek = dosageDaysPerWeek.trim() ? parseInt(dosageDaysPerWeek, 10) : null;

    onSave({
      title_en: titleEn.trim(),
      title_zh_hant: titleZhHant.trim(),
      title_zh_hans: titleZhHans.trim(),
      vimeo_video_id: vimeoInput.trim() ? extractVimeoId(vimeoInput) : '',
      youtube_video_id: youtubeInput.trim() ? extractYouTubeId(youtubeInput) : '',
      category: category.trim(),
      tags,
      default_duration_minutes: isNaN(parsedDuration as number) ? null : parsedDuration,
      default_dosage: dosage.trim(),
      default_dosage_per_day: isNaN(parsedDosagePerDay as number) ? null : parsedDosagePerDay,
      default_dosage_days_per_week: isNaN(parsedDosageDaysPerWeek as number) ? null : parsedDosageDaysPerWeek,
      audio_instruction_url_en: audioEn.trim(),
      audio_instruction_url_zh_hant: audioZhHant.trim(),
      audio_instruction_url_zh_hans: audioZhHans.trim(),
      narrative_audio_youtube_id: narrativeEn.trim(),
      narrative_audio_youtube_id_zh_hant: narrativeZhHant.trim(),
      narrative_audio_youtube_id_zh_hans: narrativeZhHans.trim(),
      subtitle_url_en: subtitleEn.trim(),
      subtitle_url_zh_hant: subtitleZhHant.trim(),
      subtitle_url_zh_hans: subtitleZhHans.trim(),
      audio_transcript_en: transcriptEn.trim(),
      audio_transcript_zh_hant: transcriptZhHant.trim(),
      audio_transcript_zh_hans: transcriptZhHans.trim(),
      default_dosage_zh_hant: dosageZhHant.trim(),
      default_dosage_zh_hans: dosageZhHans.trim(),
    });
  }, [
    titleEn, titleZhHant, titleZhHans, vimeoInput, youtubeInput,
    category, tagsInput, duration, dosage, dosagePerDay, dosageDaysPerWeek,
    audioEn, audioZhHant, audioZhHans, narrativeEn, narrativeZhHant, narrativeZhHans,
    subtitleEn, subtitleZhHant, subtitleZhHans, transcriptEn, transcriptZhHant, transcriptZhHans,
    dosageZhHant, dosageZhHans,
    onSave, t,
  ]);

  const isEditing = !!exercise;

  const renderField = (label: string, value: string, setter: (v: string) => void, opts?: {
    placeholder?: string;
    keyboardType?: 'default' | 'numeric' | 'url';
    multiline?: boolean;
    required?: boolean;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label} {opts?.required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, opts?.multiline && styles.textArea]}
        value={value}
        onChangeText={setter}
        placeholder={opts?.placeholder ?? label}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={opts?.keyboardType ?? 'default'}
        multiline={opts?.multiline}
        textAlignVertical={opts?.multiline ? 'top' : 'center'}
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? t('exercise.edit') : t('exercise.add')}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Basic Info</Text>
          {renderField(t('exercise.title_en'), titleEn, setTitleEn, { required: true })}
          {renderField(t('exercise.title_zh_hant'), titleZhHant, setTitleZhHant)}
          <View style={styles.fieldWithConvert}>
            <View style={styles.fieldFlex}>
              {renderField(t('exercise.title_zh_hans'), titleZhHans, setTitleZhHans)}
            </View>
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={() => setTitleZhHans(trad2simp(titleZhHant))}
              activeOpacity={0.7}
            >
              <ArrowRightLeft size={12} color={Colors.accent} />
              <Text style={styles.convertBtnText}>繁→简</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Video</Text>
          {renderField(t('exercise.vimeo_id'), vimeoInput, setVimeoInput, { placeholder: 'https://vimeo.com/123456789' })}
          {renderField(t('exercise.youtube_id'), youtubeInput, setYoutubeInput, { placeholder: 'https://youtube.com/watch?v=xxx' })}

          <Text style={styles.sectionLabel}>Classification</Text>
          {renderField(t('exercise.category'), category, setCategory)}
          {renderField(t('exercise.tags'), tagsInput, setTagsInput, { placeholder: 'tag1, tag2, tag3' })}

          <Text style={styles.sectionLabel}>Dosage</Text>
          {renderField(t('exercise.duration'), duration, setDuration, { keyboardType: 'numeric' })}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            <View style={styles.presetRow}>
              {DURATION_PRESETS.map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setDuration(String(val))}
                  style={[styles.presetChip, duration === String(val) && styles.presetChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, duration === String(val) && styles.presetChipTextActive]}>{val} min</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {renderField(t('exercise.dosage'), dosage, setDosage)}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            <View style={styles.presetRow}>
              {DOSAGE_PRESETS_EN.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setDosage(preset)}
                  style={[styles.presetChip, dosage === preset && styles.presetChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, dosage === preset && styles.presetChipTextActive]}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {renderField('Dosage (繁中)', dosageZhHant, setDosageZhHant)}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            <View style={styles.presetRow}>
              {DOSAGE_PRESETS_HANT.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setDosageZhHant(preset)}
                  style={[styles.presetChip, dosageZhHant === preset && styles.presetChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, dosageZhHant === preset && styles.presetChipTextActive]}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.fieldWithConvert}>
            <View style={styles.fieldFlex}>
              {renderField('Dosage (简中)', dosageZhHans, setDosageZhHans)}
            </View>
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={() => setDosageZhHans(trad2simp(dosageZhHant))}
              activeOpacity={0.7}
            >
              <ArrowRightLeft size={12} color={Colors.accent} />
              <Text style={styles.convertBtnText}>繁→简</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            <View style={styles.presetRow}>
              {DOSAGE_PRESETS_HANS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setDosageZhHans(preset)}
                  style={[styles.presetChip, dosageZhHans === preset && styles.presetChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, dosageZhHans === preset && styles.presetChipTextActive]}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {renderField(t('exercise.dosage_per_day'), dosagePerDay, setDosagePerDay, { keyboardType: 'numeric' })}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            <View style={styles.presetRow}>
              {DOSAGE_PER_DAY_PRESETS.map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setDosagePerDay(String(val))}
                  style={[styles.presetChip, dosagePerDay === String(val) && styles.presetChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, dosagePerDay === String(val) && styles.presetChipTextActive]}>{val}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {renderField(t('exercise.dosage_days_per_week'), dosageDaysPerWeek, setDosageDaysPerWeek, { keyboardType: 'numeric' })}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            <View style={styles.presetRow}>
              {DAYS_PER_WEEK_PRESETS.map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setDosageDaysPerWeek(String(val))}
                  style={[styles.presetChip, dosageDaysPerWeek === String(val) && styles.presetChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, dosageDaysPerWeek === String(val) && styles.presetChipTextActive]}>{val} days</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionLabel}>Audio Instructions</Text>
          {renderField(t('exercise.audio_en'), audioEn, setAudioEn, { keyboardType: 'url' })}
          {renderField(t('exercise.audio_zh_hant'), audioZhHant, setAudioZhHant, { keyboardType: 'url' })}
          {renderField(t('exercise.audio_zh_hans'), audioZhHans, setAudioZhHans, { keyboardType: 'url' })}

          <Text style={styles.sectionLabel}>Narrative Audio</Text>
          {renderField(t('exercise.narrative_en'), narrativeEn, setNarrativeEn)}
          {renderField(t('exercise.narrative_zh_hant'), narrativeZhHant, setNarrativeZhHant)}
          {renderField(t('exercise.narrative_zh_hans'), narrativeZhHans, setNarrativeZhHans)}

          <Text style={styles.sectionLabel}>Subtitles</Text>
          {renderField('Subtitle URL (EN)', subtitleEn, setSubtitleEn, { keyboardType: 'url' })}
          {renderField('Subtitle URL (繁中)', subtitleZhHant, setSubtitleZhHant, { keyboardType: 'url' })}
          {renderField('Subtitle URL (简中)', subtitleZhHans, setSubtitleZhHans, { keyboardType: 'url' })}

          <Text style={styles.sectionLabel}>Transcripts</Text>
          {renderField('Audio Transcript (EN)', transcriptEn, setTranscriptEn, { multiline: true })}
          {renderField('Audio Transcript (繁中)', transcriptZhHant, setTranscriptZhHant, { multiline: true })}
          <View style={styles.fieldWithConvert}>
            <View style={styles.fieldFlex}>
              {renderField('Audio Transcript (简中)', transcriptZhHans, setTranscriptZhHans, { multiline: true })}
            </View>
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={() => setTranscriptZhHans(trad2simp(transcriptZhHant))}
              activeOpacity={0.7}
            >
              <ArrowRightLeft size={12} color={Colors.accent} />
              <Text style={styles.convertBtnText}>繁→简</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            testID="exercise-save-button"
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t('exercise.save')}</Text>
            )}
          </TouchableOpacity>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
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
  errorContainer: {
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
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  fieldWithConvert: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  fieldFlex: {
    flex: 1,
  },
  convertBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 24,
  },
  convertBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  presetScroll: {
    marginTop: -10,
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row' as const,
    gap: 6,
    paddingVertical: 2,
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
