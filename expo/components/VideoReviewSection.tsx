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
  Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Video, Eye, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import type { ReviewRequirement, VideoSubmission, ProgramExercise } from '@/types/program';

interface VideoReviewSectionProps {
  programId: string;
  programExercises: ProgramExercise[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function VideoReviewSection({ programId, programExercises }: VideoReviewSectionProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [reqModalVisible, setReqModalVisible] = useState(false);
  const [editingReq, setEditingReq] = useState<ReviewRequirement | null>(null);
  const [reqExerciseName, setReqExerciseName] = useState('');
  const [reqMaxSubmissions, setReqMaxSubmissions] = useState('1');
  const [reqAllowedDays, setReqAllowedDays] = useState<string[]>([]);
  const [reqNotes, setReqNotes] = useState('');
  const [reqIsActive, setReqIsActive] = useState(true);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<VideoSubmission | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'reviewed' | 'redo_requested'>('reviewed');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState('');

  const requirementsQuery = useQuery({
    queryKey: ['review_requirements', programId],
    queryFn: async () => {
      console.log('[VideoReview] Fetching requirements for program:', programId);
      const { data, error } = await supabase
        .from('exercise_review_requirements')
        .select('*')
        .eq('program_id', programId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReviewRequirement[];
    },
    enabled: !!programId,
  });

  const submissionsQuery = useQuery({
    queryKey: ['video_submissions', programId],
    queryFn: async () => {
      console.log('[VideoReview] Fetching submissions for program:', programId);
      const { data, error } = await supabase
        .from('exercise_video_submissions')
        .select('*')
        .eq('program_id', programId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoSubmission[];
    },
    enabled: !!programId,
  });

  const saveReqMutation = useMutation({
    mutationFn: async (payload: {
      exercise_title_en: string;
      max_submissions: number;
      allowed_days: string[];
      notes: string | null;
      is_active: boolean;
    }) => {
      console.log('[VideoReview] Upserting requirement');
      const { error } = await supabase
        .from('exercise_review_requirements')
        .upsert(
          { ...payload, program_id: programId },
          { onConflict: 'program_id,exercise_title_en' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review_requirements', programId] });
      setReqModalVisible(false);
      setEditingReq(null);
    },
    onError: (err) => {
      Alert.alert('Error', err.message ?? 'Failed to save requirement');
    },
  });

  const deleteReqMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercise_review_requirements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review_requirements', programId] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: { id: string; status: string; rating: number | null; reviewer_notes: string | null }) => {
      const { error } = await supabase
        .from('exercise_video_submissions')
        .update({ status: payload.status, rating: payload.rating, reviewer_notes: payload.reviewer_notes })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video_submissions', programId] });
      setReviewModalVisible(false);
      setReviewingSubmission(null);
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (submission: VideoSubmission) => {
      if (submission.storage_path) {
        console.log('[VideoReview] Deleting file from storage:', submission.storage_path);
        const { error: storageError } = await supabase.storage
          .from('review-videos')
          .remove([submission.storage_path]);
        if (storageError) console.error('[VideoReview] Storage delete error:', storageError);
      }
      const { error } = await supabase.from('exercise_video_submissions').delete().eq('id', submission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video_submissions', programId] });
    },
  });

  const handleAddReq = useCallback(() => {
    setEditingReq(null);
    setReqExerciseName('');
    setReqMaxSubmissions('1');
    setReqAllowedDays([]);
    setReqNotes('');
    setReqIsActive(true);
    setReqModalVisible(true);
  }, []);

  const handleEditReq = useCallback((req: ReviewRequirement) => {
    setEditingReq(req);
    setReqExerciseName(req.exercise_title_en);
    setReqMaxSubmissions(req.max_submissions.toString());
    setReqAllowedDays(req.allowed_days ?? []);
    setReqNotes(req.notes ?? '');
    setReqIsActive(req.is_active);
    setReqModalVisible(true);
  }, []);

  const handleDeleteReq = useCallback((req: ReviewRequirement) => {
    Alert.alert(t('review.delete'), t('review.delete_confirm'), [
      { text: t('review.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteReqMutation.mutate(req.id) },
    ]);
  }, [t, deleteReqMutation]);

  const handleSaveReq = useCallback(() => {
    if (!reqExerciseName.trim()) return;
    saveReqMutation.mutate({
      exercise_title_en: reqExerciseName.trim(),
      max_submissions: parseInt(reqMaxSubmissions, 10) || 1,
      allowed_days: reqAllowedDays,
      notes: reqNotes.trim() || null,
      is_active: reqIsActive,
    });
  }, [reqExerciseName, reqMaxSubmissions, reqAllowedDays, reqNotes, reqIsActive, saveReqMutation]);

  const toggleDay = useCallback((day: string) => {
    setReqAllowedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const handleReview = useCallback((sub: VideoSubmission) => {
    setReviewingSubmission(sub);
    setReviewStatus((sub.status === 'redo_requested' ? 'redo_requested' : 'reviewed') as 'reviewed' | 'redo_requested');
    setReviewRating(sub.rating ?? 0);
    setReviewNotes(sub.reviewer_notes ?? '');
    setReviewModalVisible(true);
  }, []);

  const handleSaveReview = useCallback(() => {
    if (!reviewingSubmission) return;
    reviewMutation.mutate({
      id: reviewingSubmission.id,
      status: reviewStatus,
      rating: reviewRating > 0 ? reviewRating : null,
      reviewer_notes: reviewNotes.trim() || null,
    });
  }, [reviewingSubmission, reviewStatus, reviewRating, reviewNotes, reviewMutation]);

  const handleDeleteSubmission = useCallback((sub: VideoSubmission) => {
    Alert.alert(t('review.delete_video'), t('review.delete_video_confirm'), [
      { text: t('review.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteSubmissionMutation.mutate(sub) },
    ]);
  }, [t, deleteSubmissionMutation]);

  const handleWatch = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'reviewed': return { bg: Colors.greenLight, color: Colors.green, label: t('review.status_reviewed') };
      case 'redo_requested': return { bg: '#fde2c8', color: Colors.accent, label: t('review.status_redo') };
      default: return { bg: Colors.borderLight, color: Colors.textSecondary, label: t('review.status_pending') };
    }
  };

  const requirements = requirementsQuery.data ?? [];
  const submissions = submissionsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Video size={16} color={Colors.accent} />
          <Text style={styles.sectionTitle}>{t('review.requirements')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddReq} activeOpacity={0.7}>
          <Plus size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {requirementsQuery.isLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
      ) : requirements.length === 0 ? (
        <Text style={styles.emptyText}>{t('review.no_requirements')}</Text>
      ) : (
        requirements.map((req) => (
          <View key={req.id} style={styles.reqRow}>
            <View style={styles.reqInfo}>
              <Text style={styles.reqName} numberOfLines={1}>{req.exercise_title_en}</Text>
              <View style={styles.reqMeta}>
                <Text style={styles.reqMetaText}>Max: {req.max_submissions}</Text>
                <Text style={styles.reqMetaText}>{(req.allowed_days ?? []).join(', ')}</Text>
              </View>
            </View>
            <View style={[styles.activeDot, !req.is_active && styles.inactiveDot]} />
            <TouchableOpacity onPress={() => handleEditReq(req)} style={styles.iconBtn}><Pencil size={14} color={Colors.accent} /></TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteReq(req)} style={styles.iconBtn}><Trash2 size={14} color={Colors.danger} /></TouchableOpacity>
          </View>
        ))
      )}

      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <View style={styles.sectionTitleRow}>
          <Eye size={16} color={Colors.accent} />
          <Text style={styles.sectionTitle}>{t('review.submissions')}</Text>
        </View>
      </View>

      {submissionsQuery.isLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
      ) : submissions.length === 0 ? (
        <Text style={styles.emptyText}>{t('review.no_submissions')}</Text>
      ) : (
        submissions.map((sub) => {
          const statusInfo = getStatusStyle(sub.status);
          return (
            <View key={sub.id} style={styles.subRow}>
              <View style={styles.subInfo}>
                <Text style={styles.subName} numberOfLines={1}>{sub.exercise_title_en}</Text>
                <Text style={styles.subDate}>{new Date(sub.submitted_at).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
              </View>
              {sub.rating ? (
                <View style={styles.ratingDisplay}>
                  <Star size={12} color="#f0a500" fill="#f0a500" />
                  <Text style={styles.ratingNum}>{sub.rating}</Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={() => handleWatch(sub.video_url)} style={styles.watchBtn} activeOpacity={0.7}>
                <Text style={styles.watchBtnText}>{t('review.watch')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleReview(sub)} style={styles.reviewActionBtn} activeOpacity={0.7}>
                <Text style={styles.reviewActionBtnText}>{t('review.review_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteSubmission(sub)} style={styles.iconBtn}><Trash2 size={14} color={Colors.danger} /></TouchableOpacity>
            </View>
          );
        })
      )}

      <Modal visible={reqModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReqModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReqModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingReq ? t('review.edit_requirement') : t('review.add_requirement')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.exercise_name')} <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowExercisePicker(!showExercisePicker)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !reqExerciseName && styles.pickerPlaceholder]}>
                  {reqExerciseName || t('review.select_exercise')}
                </Text>
              </TouchableOpacity>
              {showExercisePicker && (
                <View style={styles.pickerList}>
                  {programExercises.map((ex) => (
                    <TouchableOpacity
                      key={ex.id}
                      style={styles.pickerItem}
                      onPress={() => { setReqExerciseName(ex.title_en); setShowExercisePicker(false); }}
                    >
                      <Text style={styles.pickerItemText}>{ex.title_en}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.max_submissions')} (1-5)</Text>
              <TextInput style={styles.input} value={reqMaxSubmissions} onChangeText={setReqMaxSubmissions} keyboardType="numeric" placeholder="1" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.allowed_days')}</Text>
              <View style={styles.daysRow}>
                {WEEKDAYS.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, reqAllowedDays.includes(day) && styles.dayChipActive]}
                    onPress={() => toggleDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayChipText, reqAllowedDays.includes(day) && styles.dayChipTextActive]}>
                      {t(`review.${day.toLowerCase()}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.notes')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={reqNotes} onChangeText={setReqNotes} multiline textAlignVertical="top" placeholder={t('review.notes')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('review.is_active')}</Text>
              <Switch value={reqIsActive} onValueChange={setReqIsActive} trackColor={{ false: Colors.borderLight, true: Colors.greenLight }} thumbColor={reqIsActive ? Colors.green : Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saveReqMutation.isPending && styles.saveBtnDisabled]} onPress={handleSaveReq} disabled={saveReqMutation.isPending} activeOpacity={0.8}>
              {saveReqMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('review.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={reviewModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{t('review.review_btn')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.status')}</Text>
              <View style={styles.statusPicker}>
                <TouchableOpacity
                  style={[styles.statusOption, reviewStatus === 'reviewed' && styles.statusOptionActive]}
                  onPress={() => setReviewStatus('reviewed')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statusOptionText, reviewStatus === 'reviewed' && styles.statusOptionTextActive]}>
                    {t('review.status_reviewed')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusOption, reviewStatus === 'redo_requested' && styles.statusOptionRedo]}
                  onPress={() => setReviewStatus('redo_requested')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statusOptionText, reviewStatus === 'redo_requested' && styles.statusOptionRedoText]}>
                    {t('review.status_redo')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.rating')} (1-5)</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setReviewRating(s)} activeOpacity={0.7}>
                    <Star size={28} color="#f0a500" fill={s <= reviewRating ? '#f0a500' : 'transparent'} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('review.reviewer_notes')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={reviewNotes} onChangeText={setReviewNotes} multiline textAlignVertical="top" placeholder={t('review.reviewer_notes')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, reviewMutation.isPending && styles.saveBtnDisabled]} onPress={handleSaveReview} disabled={reviewMutation.isPending} activeOpacity={0.8}>
              {reviewMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('review.save')}</Text>}
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
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reqInfo: {
    flex: 1,
  },
  reqName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  reqMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
  },
  reqMetaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
    marginRight: 6,
  },
  inactiveDot: {
    backgroundColor: Colors.textTertiary,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexWrap: 'wrap',
    gap: 6,
  },
  subInfo: {
    flex: 1,
    minWidth: 100,
  },
  subName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  subDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingNum: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#f0a500',
  },
  watchBtn: {
    backgroundColor: Colors.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  watchBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.green,
  },
  reviewActionBtn: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  reviewActionBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
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
  pickerBtn: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pickerBtnText: {
    fontSize: 15,
    color: Colors.text,
  },
  pickerPlaceholder: {
    color: Colors.textTertiary,
  },
  pickerList: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: 180,
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerItemText: {
    fontSize: 14,
    color: Colors.text,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dayChipActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  dayChipTextActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
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
  statusPicker: {
    flexDirection: 'row',
    gap: 10,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusOptionActive: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.green,
  },
  statusOptionRedo: {
    backgroundColor: '#fde2c8',
    borderColor: Colors.accent,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  statusOptionTextActive: {
    color: Colors.green,
    fontWeight: '600' as const,
  },
  statusOptionRedoText: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
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
