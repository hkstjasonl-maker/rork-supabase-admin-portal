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
  Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, X, Coffee, Send, ChevronDown, Check, Filter,
  Video, Eye, Star,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import { extractVimeoId, extractYouTubeId } from '@/types/exercise';
import type {
  FeedingSkillVideo,
  FeedingSkillVideoFormData,
  FeedingSkillAssignment,
  FeedingSkillCategory,
  FeedingSkillReviewRequirement,
  FeedingSkillVideoSubmission,
} from '@/types/feeding-skill';
import type { Patient } from '@/types/patient';

const CATEGORIES: FeedingSkillCategory[] = [
  'texture_modified', 'thickened_fluids', 'positioning',
  'feeding_technique', 'oral_care', 'safety_signs', 'other',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_FORM: FeedingSkillVideoFormData = {
  title_en: '', title_zh: '', description_en: '', description_zh: '',
  creator_name_en: '', creator_name_zh: '', category: 'texture_modified',
  vimeo_video_id: '', youtube_video_id: '', tags: [],
};

export default function FeedingSkillsScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'library' | 'pushed' | 'review'>('library');
  const [formVisible, setFormVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState<FeedingSkillVideo | null>(null);
  const [form, setForm] = useState<FeedingSkillVideoFormData>(EMPTY_FORM);
  const [tagsInput, setTagsInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<FeedingSkillCategory | ''>('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [pushVideoId, setPushVideoId] = useState<string | null>(null);
  const [pushMode, setPushMode] = useState<'all' | 'specific'>('all');
  const [pushStartDate, setPushStartDate] = useState('');
  const [pushEndDate, setPushEndDate] = useState('');
  const [pushSelectedPatients, setPushSelectedPatients] = useState<string[]>([]);

  const [reviewPatientId, setReviewPatientId] = useState<string | null>(null);
  const [showReviewPatientPicker, setShowReviewPatientPicker] = useState(false);
  const [reqModalVisible, setReqModalVisible] = useState(false);
  const [editingReq, setEditingReq] = useState<FeedingSkillReviewRequirement | null>(null);
  const [reqSkillName, setReqSkillName] = useState('');
  const [reqMaxSubmissions, setReqMaxSubmissions] = useState('1');
  const [reqAllowedDays, setReqAllowedDays] = useState<string[]>([]);
  const [reqNotes, setReqNotes] = useState('');
  const [reqIsActive, setReqIsActive] = useState(true);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<FeedingSkillVideoSubmission | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'reviewed' | 'redo_requested'>('reviewed');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState('');

  const videosQuery = useQuery({
    queryKey: ['feeding_skill_videos'],
    queryFn: async () => {
      console.log('[FeedingSkills] Fetching videos');
      const { data, error } = await supabase
        .from('feeding_skill_videos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedingSkillVideo[];
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
    queryKey: ['feeding_skill_assignments'],
    queryFn: async () => {
      console.log('[FeedingSkills] Fetching assignments');
      const { data, error } = await supabase
        .from('feeding_skill_assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedingSkillAssignment[];
    },
  });

  const reviewPatientAssignments = useQuery({
    queryKey: ['feeding_skill_assignments_for_patient', reviewPatientId],
    queryFn: async () => {
      if (!reviewPatientId) return [];
      const { data, error } = await supabase
        .from('feeding_skill_assignments')
        .select('*')
        .eq('patient_id', reviewPatientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeedingSkillAssignment[];
    },
    enabled: !!reviewPatientId,
  });

  const reviewRequirementsQuery = useQuery({
    queryKey: ['feeding_skill_review_requirements', reviewPatientId],
    queryFn: async () => {
      if (!reviewPatientId) return [];
      console.log('[FeedingSkills] Fetching review requirements for patient:', reviewPatientId);
      const patientAssignments = reviewPatientAssignments.data ?? [];
      if (patientAssignments.length === 0) return [];
      const programIds = patientAssignments.map((a) => a.id);
      const { data, error } = await supabase
        .from('feeding_skill_review_requirements')
        .select('*')
        .in('program_id', programIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeedingSkillReviewRequirement[];
    },
    enabled: !!reviewPatientId && (reviewPatientAssignments.data ?? []).length > 0,
  });

  const reviewSubmissionsQuery = useQuery({
    queryKey: ['feeding_skill_video_submissions', reviewPatientId],
    queryFn: async () => {
      if (!reviewPatientId) return [];
      console.log('[FeedingSkills] Fetching submissions for patient:', reviewPatientId);
      const patientAssignments = reviewPatientAssignments.data ?? [];
      if (patientAssignments.length === 0) return [];
      const programIds = patientAssignments.map((a) => a.id);
      const { data, error } = await supabase
        .from('feeding_skill_video_submissions')
        .select('*')
        .in('program_id', programIds)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedingSkillVideoSubmission[];
    },
    enabled: !!reviewPatientId && (reviewPatientAssignments.data ?? []).length > 0,
  });

  const filteredVideos = (videosQuery.data ?? []).filter((v) => {
    if (filterCategory && v.category !== filterCategory) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FeedingSkillVideoFormData & { id?: string }) => {
      const row = {
        title_en: payload.title_en.trim(),
        title_zh: payload.title_zh.trim() || null,
        description_en: payload.description_en.trim() || null,
        description_zh: payload.description_zh.trim() || null,
        creator_name_en: payload.creator_name_en.trim() || null,
        creator_name_zh: payload.creator_name_zh.trim() || null,
        category: payload.category,
        vimeo_video_id: payload.vimeo_video_id ? extractVimeoId(payload.vimeo_video_id) : null,
        youtube_video_id: payload.youtube_video_id ? extractYouTubeId(payload.youtube_video_id) : null,
        tags: payload.tags.length > 0 ? payload.tags : null,
      };
      if (payload.id) {
        const { error } = await supabase.from('feeding_skill_videos').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feeding_skill_videos').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feeding_skill_videos'] });
      setFormVisible(false);
      setEditingVideo(null);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feeding_skill_videos'] }),
  });

  const pushMutation = useMutation({
    mutationFn: async (payload: { video_id: string; patient_ids: string[]; start_date: string; end_date: string }) => {
      for (const pid of payload.patient_ids) {
        const { error } = await supabase
          .from('feeding_skill_assignments')
          .upsert(
            { video_id: payload.video_id, patient_id: pid, start_date: payload.start_date || null, end_date: payload.end_date || null, is_viewed: false },
            { onConflict: 'video_id,patient_id' }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feeding_skill_assignments'] });
      setPushModalVisible(false);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to push'),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feeding_skill_assignments'] }),
  });

  const saveReqMutation = useMutation({
    mutationFn: async (payload: {
      program_id: string;
      feeding_skill_title_en: string;
      max_submissions: number;
      allowed_days: string[];
      notes: string | null;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from('feeding_skill_review_requirements')
        .upsert(payload, { onConflict: 'program_id,feeding_skill_title_en' });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feeding_skill_review_requirements', reviewPatientId] });
      setReqModalVisible(false);
      setEditingReq(null);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to save'),
  });

  const deleteReqMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feeding_skill_review_requirements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feeding_skill_review_requirements', reviewPatientId] }),
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: { id: string; status: string; rating: number | null; reviewer_notes: string | null }) => {
      const { error } = await supabase
        .from('feeding_skill_video_submissions')
        .update({ status: payload.status, rating: payload.rating, reviewer_notes: payload.reviewer_notes })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feeding_skill_video_submissions', reviewPatientId] });
      setReviewModalVisible(false);
      setReviewingSubmission(null);
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (submission: FeedingSkillVideoSubmission) => {
      if (submission.storage_path) {
        const { error: storageError } = await supabase.storage.from('review-videos').remove([submission.storage_path]);
        if (storageError) console.error('[FeedingSkills] Storage delete error:', storageError);
      }
      const { error } = await supabase.from('feeding_skill_video_submissions').delete().eq('id', submission.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feeding_skill_video_submissions', reviewPatientId] }),
  });

  const handleAdd = useCallback(() => {
    setEditingVideo(null);
    setForm(EMPTY_FORM);
    setTagsInput('');
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((video: FeedingSkillVideo) => {
    setEditingVideo(video);
    setForm({
      title_en: video.title_en, title_zh: video.title_zh ?? '',
      description_en: video.description_en ?? '', description_zh: video.description_zh ?? '',
      creator_name_en: video.creator_name_en ?? '', creator_name_zh: video.creator_name_zh ?? '',
      category: video.category, vimeo_video_id: video.vimeo_video_id ?? '',
      youtube_video_id: video.youtube_video_id ?? '', tags: video.tags ?? [],
    });
    setTagsInput((video.tags ?? []).join(', '));
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback((video: FeedingSkillVideo) => {
    Alert.alert(t('fs.delete'), t('fs.delete_confirm'), [
      { text: t('fs.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(video.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.title_en.trim()) { Alert.alert('', t('fs.title_required')); return; }
    const tags = tagsInput.split(',').map((s) => s.trim()).filter(Boolean);
    saveMutation.mutate({ ...form, tags, id: editingVideo?.id });
  }, [form, tagsInput, editingVideo, saveMutation, t]);

  const handlePush = useCallback((videoId: string) => {
    setPushVideoId(videoId);
    setPushMode('all');
    setPushStartDate(new Date().toISOString().split('T')[0]);
    setPushEndDate('');
    setPushSelectedPatients([]);
    setPushModalVisible(true);
  }, []);

  const handleConfirmPush = useCallback(() => {
    if (!pushVideoId) return;
    const pts = patientsQuery.data ?? [];
    const ids = pushMode === 'all' ? pts.map((p) => p.id) : pushSelectedPatients;
    if (ids.length === 0) return;
    pushMutation.mutate({ video_id: pushVideoId, patient_ids: ids, start_date: pushStartDate, end_date: pushEndDate });
  }, [pushVideoId, pushMode, pushSelectedPatients, pushStartDate, pushEndDate, patientsQuery.data, pushMutation]);

  const handleRemoveAssignment = useCallback((a: FeedingSkillAssignment) => {
    Alert.alert(t('fs.remove'), t('fs.remove_confirm'), [
      { text: t('fs.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeAssignmentMutation.mutate(a.id) },
    ]);
  }, [t, removeAssignmentMutation]);

  const handleAddReq = useCallback(() => {
    setEditingReq(null);
    setReqSkillName('');
    setReqMaxSubmissions('1');
    setReqAllowedDays([]);
    setReqNotes('');
    setReqIsActive(true);
    setReqModalVisible(true);
  }, []);

  const handleEditReq = useCallback((req: FeedingSkillReviewRequirement) => {
    setEditingReq(req);
    setReqSkillName(req.feeding_skill_title_en);
    setReqMaxSubmissions(req.max_submissions.toString());
    setReqAllowedDays(req.allowed_days ?? []);
    setReqNotes(req.notes ?? '');
    setReqIsActive(req.is_active);
    setReqModalVisible(true);
  }, []);

  const handleDeleteReq = useCallback((req: FeedingSkillReviewRequirement) => {
    Alert.alert(t('common.delete'), t('review.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteReqMutation.mutate(req.id) },
    ]);
  }, [t, deleteReqMutation]);

  const handleSaveReq = useCallback(() => {
    if (!reqSkillName.trim()) return;
    const patientAssignments = reviewPatientAssignments.data ?? [];
    if (patientAssignments.length === 0) return;
    const programId = patientAssignments[0].id;
    saveReqMutation.mutate({
      program_id: programId,
      feeding_skill_title_en: reqSkillName.trim(),
      max_submissions: parseInt(reqMaxSubmissions, 10) || 1,
      allowed_days: reqAllowedDays,
      notes: reqNotes.trim() || null,
      is_active: reqIsActive,
    });
  }, [reqSkillName, reqMaxSubmissions, reqAllowedDays, reqNotes, reqIsActive, reviewPatientAssignments.data, saveReqMutation]);

  const toggleDay = useCallback((day: string) => {
    setReqAllowedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }, []);

  const handleReviewSubmission = useCallback((sub: FeedingSkillVideoSubmission) => {
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

  const handleDeleteSubmission = useCallback((sub: FeedingSkillVideoSubmission) => {
    Alert.alert(t('review.delete_video'), t('review.delete_video_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteSubmissionMutation.mutate(sub) },
    ]);
  }, [t, deleteSubmissionMutation]);

  const updateForm = useCallback((key: keyof FeedingSkillVideoFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getVideoTitle = useCallback((video: FeedingSkillVideo) => {
    if (language === 'zh' && video.title_zh) return video.title_zh;
    return video.title_en;
  }, [language]);

  const getCategoryLabel = useCallback((cat: string) => t(`fs.cat_${cat}`), [t]);

  const getVideoById = useCallback((id: string) => (videosQuery.data ?? []).find((v) => v.id === id), [videosQuery.data]);
  const getPatientById = useCallback((id: string | null) => {
    if (!id) return null;
    return (patientsQuery.data ?? []).find((p) => p.id === id);
  }, [patientsQuery.data]);

  const togglePushPatient = useCallback((id: string) => {
    setPushSelectedPatients((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'reviewed': return { bg: Colors.greenLight, color: Colors.green, label: t('review.status_reviewed') };
      case 'redo_requested': return { bg: '#fde2c8', color: Colors.accent, label: t('review.status_redo') };
      default: return { bg: Colors.borderLight, color: Colors.textSecondary, label: t('review.status_pending') };
    }
  };

  const patients = patientsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const requirements = reviewRequirementsQuery.data ?? [];
  const submissions = reviewSubmissionsQuery.data ?? [];
  const patientActiveAssignments = reviewPatientAssignments.data ?? [];
  const reviewPatient = patients.find((p) => p.id === reviewPatientId);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('fs.title')} />

      <View style={styles.tabBar}>
        {(['library', 'pushed', 'review'] as const).map((tab) => {
          const icons = { library: Coffee, pushed: Send, review: Video };
          const labels = { library: t('fs.library'), pushed: t('fs.pushed'), review: t('fs.video_review') };
          const Icon = icons[tab];
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Icon size={13} color={isActive ? Colors.accent : Colors.textSecondary} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={videosQuery.isRefetching || assignmentsQuery.isRefetching}
            onRefresh={() => {
              void videosQuery.refetch();
              void assignmentsQuery.refetch();
              void patientsQuery.refetch();
              if (reviewPatientId) {
                void reviewPatientAssignments.refetch();
                void reviewRequirementsQuery.refetch();
                void reviewSubmissionsQuery.refetch();
              }
            }}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'library' && (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.7}>
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('fs.add')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <TouchableOpacity
                  style={styles.filterBtn}
                  onPress={() => setShowCategoryFilter(!showCategoryFilter)}
                  activeOpacity={0.7}
                >
                  <Filter size={12} color={Colors.textSecondary} />
                  <Text style={styles.filterBtnText}>
                    {filterCategory ? getCategoryLabel(filterCategory) : t('fs.all_categories')}
                  </Text>
                  <ChevronDown size={12} color={Colors.textSecondary} />
                </TouchableOpacity>
                {showCategoryFilter && (
                  <View style={styles.filterDropdown}>
                    <TouchableOpacity style={styles.filterOption} onPress={() => { setFilterCategory(''); setShowCategoryFilter(false); }}>
                      <Text style={styles.filterOptionText}>{t('fs.all_categories')}</Text>
                    </TouchableOpacity>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity key={cat} style={[styles.filterOption, filterCategory === cat && styles.filterOptionActive]} onPress={() => { setFilterCategory(cat); setShowCategoryFilter(false); }}>
                        <Text style={[styles.filterOptionText, filterCategory === cat && styles.filterOptionTextActive]}>{getCategoryLabel(cat)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {videosQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('fs.loading')}</Text>
              </View>
            ) : filteredVideos.length === 0 ? (
              <View style={styles.centered}>
                <Coffee size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('fs.no_videos')}</Text>
              </View>
            ) : (
              filteredVideos.map((video) => (
                <View key={video.id} style={styles.videoCard}>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={1}>{getVideoTitle(video)}</Text>
                    {video.title_zh && language === 'en' ? (
                      <Text style={styles.videoSubTitle} numberOfLines={1}>{video.title_zh}</Text>
                    ) : video.title_en && language === 'zh' ? (
                      <Text style={styles.videoSubTitle} numberOfLines={1}>{video.title_en}</Text>
                    ) : null}
                    {(video.creator_name_en || video.creator_name_zh) ? (
                      <Text style={styles.videoCreator} numberOfLines={1}>
                        {language === 'zh' && video.creator_name_zh ? video.creator_name_zh : video.creator_name_en}
                      </Text>
                    ) : null}
                    <View style={styles.badgeRow}>
                      <View style={styles.catBadge}>
                        <Text style={styles.catBadgeText}>{getCategoryLabel(video.category)}</Text>
                      </View>
                    </View>
                    {video.vimeo_video_id ? <Text style={styles.videoIdText}>Vimeo: {video.vimeo_video_id}</Text> : null}
                    {video.youtube_video_id ? <Text style={styles.videoIdText}>YouTube: {video.youtube_video_id}</Text> : null}
                  </View>
                  <View style={styles.videoActions}>
                    <TouchableOpacity onPress={() => handlePush(video.id)} style={styles.pushBtn} activeOpacity={0.7}>
                      <Send size={13} color={Colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEdit(video)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(video)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'pushed' && (
          <>
            {assignmentsQuery.isLoading ? (
              <View style={styles.centered}><ActivityIndicator size="large" color={Colors.accent} /></View>
            ) : assignments.length === 0 ? (
              <View style={styles.centered}>
                <Send size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('fs.no_assignments')}</Text>
              </View>
            ) : (
              assignments.map((a) => {
                const video = getVideoById(a.video_id);
                const patient = getPatientById(a.patient_id);
                return (
                  <View key={a.id} style={styles.assignCard}>
                    <View style={styles.assignInfo}>
                      <Text style={styles.assignVideoTitle} numberOfLines={1}>
                        {video ? getVideoTitle(video) : '—'}
                      </Text>
                      {video && (
                        <View style={styles.catBadge}><Text style={styles.catBadgeText}>{getCategoryLabel(video.category)}</Text></View>
                      )}
                      <Text style={styles.assignPatientName}>{patient ? patient.patient_name : t('fs.push_all')}</Text>
                      {(a.start_date || a.end_date) && (
                        <Text style={styles.assignPeriod}>{t('fs.period')}: {a.start_date ?? '—'} ~ {a.end_date ?? '—'}</Text>
                      )}
                      <View style={[styles.viewedBadge, a.is_viewed ? styles.viewedBadgeYes : styles.viewedBadgeNo]}>
                        <Text style={[styles.viewedBadgeText, a.is_viewed ? styles.viewedBadgeYesText : styles.viewedBadgeNoText]}>
                          {a.is_viewed ? t('fs.viewed') : t('fs.not_viewed')}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveAssignment(a)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === 'review' && (
          <>
            <View style={styles.patientSelector}>
              <Text style={styles.selectorLabel}>{t('fs.select_patient')}</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowReviewPatientPicker(!showReviewPatientPicker)}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorBtnText, !reviewPatient && styles.selectorPlaceholder]} numberOfLines={1}>
                  {reviewPatient?.patient_name ?? t('fs.select_patient')}
                </Text>
                <ChevronDown size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              {showReviewPatientPicker && (
                <View style={styles.pickerDropdown}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {patients.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.pickerItem, p.id === reviewPatientId && styles.pickerItemActive]}
                        onPress={() => { setReviewPatientId(p.id); setShowReviewPatientPicker(false); }}
                      >
                        <Text style={[styles.pickerItemText, p.id === reviewPatientId && styles.pickerItemTextActive]}>{p.patient_name}</Text>
                        <Text style={styles.pickerItemCode}>{p.access_code}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {!reviewPatientId ? (
              <View style={styles.centered}>
                <Video size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('fs.select_patient')}</Text>
              </View>
            ) : (
              <>
                <View style={styles.reviewSection}>
                  <View style={styles.reviewSectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Video size={16} color={Colors.accent} />
                      <Text style={styles.sectionTitle}>{t('fs.review_requirements')}</Text>
                    </View>
                    <TouchableOpacity style={styles.addReqBtn} onPress={handleAddReq} activeOpacity={0.7}>
                      <Plus size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </View>

                  {reviewRequirementsQuery.isLoading ? (
                    <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
                  ) : requirements.length === 0 ? (
                    <Text style={styles.emptySmallText}>{t('fs.no_requirements')}</Text>
                  ) : (
                    requirements.map((req) => (
                      <View key={req.id} style={styles.reqRow}>
                        <View style={styles.reqInfo}>
                          <Text style={styles.reqName} numberOfLines={1}>{req.feeding_skill_title_en}</Text>
                          <View style={styles.reqMeta}>
                            <Text style={styles.reqMetaText}>Max: {req.max_submissions}</Text>
                            <Text style={styles.reqMetaText}>{(req.allowed_days ?? []).join(', ')}</Text>
                          </View>
                        </View>
                        <View style={[styles.activeDot, !req.is_active && styles.inactiveDot]} />
                        <TouchableOpacity onPress={() => handleEditReq(req)} style={styles.smallIconBtn}><Pencil size={13} color={Colors.accent} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteReq(req)} style={styles.smallIconBtn}><Trash2 size={13} color={Colors.danger} /></TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.reviewSection}>
                  <View style={styles.reviewSectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Eye size={16} color={Colors.accent} />
                      <Text style={styles.sectionTitle}>{t('fs.submitted_videos')}</Text>
                    </View>
                  </View>

                  {reviewSubmissionsQuery.isLoading ? (
                    <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
                  ) : submissions.length === 0 ? (
                    <Text style={styles.emptySmallText}>{t('fs.no_submissions')}</Text>
                  ) : (
                    submissions.map((sub) => {
                      const statusInfo = getStatusStyle(sub.status);
                      return (
                        <View key={sub.id} style={styles.subRow}>
                          <View style={styles.subInfo}>
                            <Text style={styles.subName} numberOfLines={1}>{sub.feeding_skill_title_en}</Text>
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
                          <TouchableOpacity onPress={() => void Linking.openURL(sub.video_url)} style={styles.watchBtn} activeOpacity={0.7}>
                            <Text style={styles.watchBtnText}>{t('review.watch')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleReviewSubmission(sub)} style={styles.reviewActionBtn} activeOpacity={0.7}>
                            <Text style={styles.reviewActionBtnText}>{t('review.review_btn')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteSubmission(sub)} style={styles.smallIconBtn}><Trash2 size={13} color={Colors.danger} /></TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Add/Edit Video Modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingVideo ? t('fs.edit') : t('fs.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.title_en')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.title_en} onChangeText={(v) => updateForm('title_en', v)} placeholder={t('fs.title_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.title_zh')}</Text>
              <TextInput style={styles.input} value={form.title_zh} onChangeText={(v) => updateForm('title_zh', v)} placeholder={t('fs.title_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.desc_en')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description_en} onChangeText={(v) => updateForm('description_en', v)} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.desc_zh')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description_zh} onChangeText={(v) => updateForm('description_zh', v)} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.creator_en')}</Text>
              <TextInput style={styles.input} value={form.creator_name_en} onChangeText={(v) => updateForm('creator_name_en', v)} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.creator_zh')}</Text>
              <TextInput style={styles.input} value={form.creator_name_zh} onChangeText={(v) => updateForm('creator_name_zh', v)} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.category')}</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, form.category === cat && styles.chipActive]}
                    onPress={() => setForm((prev) => ({ ...prev, category: cat }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{getCategoryLabel(cat)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.vimeo_id')}</Text>
              <TextInput style={styles.input} value={form.vimeo_video_id} onChangeText={(v) => updateForm('vimeo_video_id', v)} placeholder="123456789" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.youtube_id')}</Text>
              <TextInput style={styles.input} value={form.youtube_video_id} onChangeText={(v) => updateForm('youtube_video_id', v)} placeholder="dQw4w9WgXcQ" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.tags')}</Text>
              <TextInput style={styles.input} value={tagsInput} onChangeText={setTagsInput} placeholder="tag1, tag2" placeholderTextColor={Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]} onPress={handleSave} disabled={saveMutation.isPending} activeOpacity={0.8}>
              {saveMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('fs.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Push Modal */}
      <Modal visible={pushModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPushModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPushModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{t('fs.push_to_patients')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.start_date')}</Text>
              <TextInput style={styles.input} value={pushStartDate} onChangeText={setPushStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.end_date')}</Text>
              <TextInput style={styles.input} value={pushEndDate} onChangeText={setPushEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, pushMode === 'all' && styles.chipActive]} onPress={() => setPushMode('all')} activeOpacity={0.7}>
                  <Text style={[styles.chipText, pushMode === 'all' && styles.chipTextActive]}>{t('fs.push_all')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, pushMode === 'specific' && styles.chipActive]} onPress={() => setPushMode('specific')} activeOpacity={0.7}>
                  <Text style={[styles.chipText, pushMode === 'specific' && styles.chipTextActive]}>{t('fs.push_specific')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {pushMode === 'specific' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('fs.select_patients')}</Text>
                {patients.map((p) => {
                  const isSelected = pushSelectedPatients.includes(p.id);
                  return (
                    <TouchableOpacity key={p.id} style={[styles.patientOption, isSelected && styles.patientOptionActive]} onPress={() => togglePushPatient(p.id)} activeOpacity={0.7}>
                      <Text style={[styles.patientOptionText, isSelected && styles.patientOptionTextActive]}>{p.patient_name}</Text>
                      {isSelected && <Check size={14} color={Colors.green} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity style={[styles.saveBtn, pushMutation.isPending && styles.saveBtnDisabled]} onPress={handleConfirmPush} disabled={pushMutation.isPending} activeOpacity={0.8}>
              {pushMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('fs.push')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Review Requirement Modal */}
      <Modal visible={reqModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReqModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReqModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingReq ? t('fs.edit_requirement') : t('fs.add_requirement')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.skill_name')} <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowSkillPicker(!showSkillPicker)} activeOpacity={0.7}>
                <Text style={[styles.pickerBtnText, !reqSkillName && styles.pickerPlaceholder]}>
                  {reqSkillName || t('fs.select_video')}
                </Text>
              </TouchableOpacity>
              {showSkillPicker && (
                <View style={styles.pickerList}>
                  {patientActiveAssignments.map((a) => {
                    const video = getVideoById(a.video_id);
                    if (!video) return null;
                    return (
                      <TouchableOpacity key={a.id} style={styles.pickerListItem} onPress={() => { setReqSkillName(video.title_en); setShowSkillPicker(false); }}>
                        <Text style={styles.pickerListItemText}>{video.title_en}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.max_submissions')} (1-5)</Text>
              <TextInput style={styles.input} value={reqMaxSubmissions} onChangeText={setReqMaxSubmissions} keyboardType="numeric" placeholder="1" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.allowed_days')}</Text>
              <View style={styles.chipRow}>
                {WEEKDAYS.map((day) => (
                  <TouchableOpacity key={day} style={[styles.chip, reqAllowedDays.includes(day) && styles.chipActive]} onPress={() => toggleDay(day)} activeOpacity={0.7}>
                    <Text style={[styles.chipText, reqAllowedDays.includes(day) && styles.chipTextActive]}>{t(`review.${day.toLowerCase()}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('fs.notes')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={reqNotes} onChangeText={setReqNotes} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('fs.is_active')}</Text>
              <Switch value={reqIsActive} onValueChange={setReqIsActive} trackColor={{ false: Colors.borderLight, true: Colors.greenLight }} thumbColor={reqIsActive ? Colors.green : Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saveReqMutation.isPending && styles.saveBtnDisabled]} onPress={handleSaveReq} disabled={saveReqMutation.isPending} activeOpacity={0.8}>
              {saveReqMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Review Submission Modal */}
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
                <TouchableOpacity style={[styles.statusOption, reviewStatus === 'reviewed' && styles.statusOptionActive]} onPress={() => setReviewStatus('reviewed')} activeOpacity={0.7}>
                  <Text style={[styles.statusOptionText, reviewStatus === 'reviewed' && styles.statusOptionTextActive]}>{t('review.status_reviewed')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.statusOption, reviewStatus === 'redo_requested' && styles.statusOptionRedo]} onPress={() => setReviewStatus('redo_requested')} activeOpacity={0.7}>
                  <Text style={[styles.statusOptionText, reviewStatus === 'redo_requested' && styles.statusOptionRedoText]}>{t('review.status_redo')}</Text>
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
              <TextInput style={[styles.input, styles.textArea]} value={reviewNotes} onChangeText={setReviewNotes} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, reviewMutation.isPending && styles.saveBtnDisabled]} onPress={handleSaveReview} disabled={reviewMutation.isPending} activeOpacity={0.8}>
              {reviewMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 6, backgroundColor: Colors.background },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
  tabActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  tabText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  actionBar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' as const },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, zIndex: 10 },
  filterItem: { flex: 1, zIndex: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderLight },
  filterBtnText: { fontSize: 12, fontWeight: '500' as const, color: Colors.textSecondary, flex: 1 },
  filterDropdown: { position: 'absolute', top: 42, left: 0, right: 0, backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, zIndex: 20 },
  filterOption: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  filterOptionActive: { backgroundColor: Colors.accentLight },
  filterOptionText: { fontSize: 13, color: Colors.text },
  filterOptionTextActive: { color: Colors.accent, fontWeight: '600' as const },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySmallText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 16 },
  videoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  videoSubTitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  videoCreator: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  catBadge: { backgroundColor: '#e8f0eb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Colors.green, textTransform: 'uppercase' as const },
  videoIdText: { fontSize: 11, color: Colors.textTertiary, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  videoActions: { gap: 6, marginLeft: 8, alignItems: 'center' },
  pushBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.green, justifyContent: 'center', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.inputBg },
  smallIconBtn: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },
  assignCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  assignInfo: { flex: 1, gap: 4 },
  assignVideoTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  assignPatientName: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  assignPeriod: { fontSize: 11, color: Colors.textTertiary },
  viewedBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  viewedBadgeYes: { backgroundColor: Colors.greenLight },
  viewedBadgeNo: { backgroundColor: Colors.borderLight },
  viewedBadgeText: { fontSize: 10, fontWeight: '600' as const },
  viewedBadgeYesText: { color: Colors.green },
  viewedBadgeNoText: { color: Colors.textSecondary },
  patientSelector: { marginBottom: 16, zIndex: 10 },
  selectorLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' as const },
  selectorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: Colors.borderLight },
  selectorBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  selectorPlaceholder: { color: Colors.textTertiary, fontWeight: '400' as const },
  pickerDropdown: { backgroundColor: Colors.card, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, zIndex: 20 },
  pickerScroll: { maxHeight: 220 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerItemActive: { backgroundColor: Colors.accentLight },
  pickerItemText: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  pickerItemTextActive: { color: Colors.accent, fontWeight: '600' as const },
  pickerItemCode: { fontSize: 12, color: Colors.textTertiary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  reviewSection: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.borderLight },
  reviewSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  addReqBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  loader: { paddingVertical: 16 },
  reqRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderRadius: 10, padding: 12, marginBottom: 6 },
  reqInfo: { flex: 1 },
  reqName: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  reqMeta: { flexDirection: 'row', gap: 10, marginTop: 3 },
  reqMetaText: { fontSize: 11, color: Colors.textTertiary },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green, marginRight: 6 },
  inactiveDot: { backgroundColor: Colors.textTertiary },
  subRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBg, borderRadius: 10, padding: 10, marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  subInfo: { flex: 1, minWidth: 100 },
  subName: { fontSize: 13, fontWeight: '500' as const, color: Colors.text },
  subDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' as const },
  ratingDisplay: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingNum: { fontSize: 12, fontWeight: '600' as const, color: '#f0a500' },
  watchBtn: { backgroundColor: Colors.greenLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  watchBtnText: { fontSize: 11, fontWeight: '600' as const, color: Colors.green },
  reviewActionBtn: { backgroundColor: Colors.accentLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  reviewActionBtnText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accent },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.card },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  modalBody: { flex: 1 },
  modalBodyContent: { paddingHorizontal: 20, paddingTop: 16 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6 },
  required: { color: Colors.danger },
  input: { backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  textArea: { minHeight: 70, paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.borderLight },
  chipActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  chipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent, fontWeight: '600' as const },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 20 },
  toggleLabel: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  pickerBtn: { backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: Colors.borderLight },
  pickerBtnText: { fontSize: 15, color: Colors.text },
  pickerPlaceholder: { color: Colors.textTertiary },
  pickerList: { backgroundColor: Colors.card, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: Colors.borderLight, maxHeight: 180 },
  pickerListItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerListItemText: { fontSize: 14, color: Colors.text },
  patientOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 6 },
  patientOptionActive: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  patientOptionText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const },
  patientOptionTextActive: { color: Colors.green, fontWeight: '600' as const },
  statusPicker: { flexDirection: 'row', gap: 10 },
  statusOption: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.inputBg, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  statusOptionActive: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  statusOptionRedo: { backgroundColor: '#fde2c8', borderColor: Colors.accent },
  statusOptionText: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  statusOptionTextActive: { color: Colors.green, fontWeight: '600' as const },
  statusOptionRedoText: { color: Colors.accent, fontWeight: '600' as const },
  starsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' as const },
});
