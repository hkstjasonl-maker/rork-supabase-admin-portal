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
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, PlayCircle, Send, Eye, EyeOff, ChevronDown, Check, Filter } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import { extractVimeoId, extractYouTubeId } from '@/types/exercise';
import type { KnowledgeVideo, KnowledgeVideoFormData, KnowledgeVideoAssignment, KnowledgeVideoCategory, KnowledgeVideoVisibility } from '@/types/knowledge-video';
import type { Patient } from '@/types/patient';

const CATEGORIES: KnowledgeVideoCategory[] = ['educational', 'condition_knowledge', 'caregiver_guidance', 'other'];
const VISIBILITIES: KnowledgeVideoVisibility[] = ['public', 'push_only'];

const EMPTY_FORM: KnowledgeVideoFormData = {
  title_en: '',
  title_zh: '',
  description_en: '',
  description_zh: '',
  creator_name_en: '',
  creator_name_zh: '',
  category: 'educational',
  visibility: 'public',
  vimeo_video_id: '',
  youtube_video_id: '',
  tags: [],
};

export default function KnowledgeVideosScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'library' | 'pushed'>('library');
  const [formVisible, setFormVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState<KnowledgeVideo | null>(null);
  const [form, setForm] = useState<KnowledgeVideoFormData>(EMPTY_FORM);
  const [tagsInput, setTagsInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<KnowledgeVideoCategory | ''>('');
  const [filterVisibility, setFilterVisibility] = useState<KnowledgeVideoVisibility | ''>('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showVisibilityFilter, setShowVisibilityFilter] = useState(false);

  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [pushVideoId, setPushVideoId] = useState<string | null>(null);
  const [pushMode, setPushMode] = useState<'all' | 'specific'>('all');
  const [pushStartDate, setPushStartDate] = useState('');
  const [pushEndDate, setPushEndDate] = useState('');
  const [pushSelectedPatients, setPushSelectedPatients] = useState<string[]>([]);

  const videosQuery = useQuery({
    queryKey: ['knowledge_videos'],
    queryFn: async () => {
      console.log('[KnowledgeVideos] Fetching videos');
      const { data, error } = await supabase
        .from('knowledge_videos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeVideo[];
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
    queryKey: ['knowledge_video_assignments'],
    queryFn: async () => {
      console.log('[KnowledgeVideos] Fetching assignments');
      const { data, error } = await supabase
        .from('knowledge_video_assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeVideoAssignment[];
    },
  });

  const filteredVideos = (videosQuery.data ?? []).filter((v) => {
    if (filterCategory && v.category !== filterCategory) return false;
    if (filterVisibility && v.visibility !== filterVisibility) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: KnowledgeVideoFormData & { id?: string }) => {
      const row = {
        title_en: payload.title_en.trim(),
        title_zh: payload.title_zh.trim() || null,
        description_en: payload.description_en.trim() || null,
        description_zh: payload.description_zh.trim() || null,
        creator_name_en: payload.creator_name_en.trim() || null,
        creator_name_zh: payload.creator_name_zh.trim() || null,
        category: payload.category,
        visibility: payload.visibility,
        vimeo_video_id: payload.vimeo_video_id ? extractVimeoId(payload.vimeo_video_id) : null,
        youtube_video_id: payload.youtube_video_id ? extractYouTubeId(payload.youtube_video_id) : null,
        tags: payload.tags.length > 0 ? payload.tags : null,
      };
      if (payload.id) {
        console.log('[KnowledgeVideos] Updating:', payload.id);
        const { error } = await supabase.from('knowledge_videos').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        console.log('[KnowledgeVideos] Inserting');
        const { error } = await supabase.from('knowledge_videos').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge_videos'] });
      setFormVisible(false);
      setEditingVideo(null);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[KnowledgeVideos] Deleting:', id);
      const { error } = await supabase.from('knowledge_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge_videos'] }),
  });

  const pushMutation = useMutation({
    mutationFn: async (payload: { video_id: string; patient_ids: (string | null)[]; start_date: string; end_date: string }) => {
      console.log('[KnowledgeVideos] Pushing to patients:', payload.patient_ids.length);
      for (const pid of payload.patient_ids) {
        const { error } = await supabase
          .from('knowledge_video_assignments')
          .upsert(
            {
              video_id: payload.video_id,
              patient_id: pid,
              start_date: payload.start_date || null,
              end_date: payload.end_date || null,
              is_viewed: false,
            },
            { onConflict: 'video_id,patient_id' }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge_video_assignments'] });
      setPushModalVisible(false);
      setPushVideoId(null);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to push'),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('knowledge_video_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge_video_assignments'] }),
  });

  const handleAdd = useCallback(() => {
    setEditingVideo(null);
    setForm(EMPTY_FORM);
    setTagsInput('');
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((video: KnowledgeVideo) => {
    setEditingVideo(video);
    setForm({
      title_en: video.title_en,
      title_zh: video.title_zh ?? '',
      description_en: video.description_en ?? '',
      description_zh: video.description_zh ?? '',
      creator_name_en: video.creator_name_en ?? '',
      creator_name_zh: video.creator_name_zh ?? '',
      category: video.category,
      visibility: video.visibility,
      vimeo_video_id: video.vimeo_video_id ?? '',
      youtube_video_id: video.youtube_video_id ?? '',
      tags: video.tags ?? [],
    });
    setTagsInput((video.tags ?? []).join(', '));
    setFormVisible(true);
  }, []);

  const handleDelete = useCallback((video: KnowledgeVideo) => {
    Alert.alert(t('kv.delete'), t('kv.delete_confirm'), [
      { text: t('kv.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(video.id) },
    ]);
  }, [t, deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.title_en.trim()) {
      Alert.alert('', t('kv.title_required'));
      return;
    }
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
    const patients = patientsQuery.data ?? [];
    let patientIds: (string | null)[];
    if (pushMode === 'all') {
      patientIds = patients.map((p) => p.id);
    } else {
      patientIds = pushSelectedPatients;
    }
    if (patientIds.length === 0) return;
    pushMutation.mutate({
      video_id: pushVideoId,
      patient_ids: patientIds,
      start_date: pushStartDate,
      end_date: pushEndDate,
    });
  }, [pushVideoId, pushMode, pushSelectedPatients, pushStartDate, pushEndDate, patientsQuery.data, pushMutation]);

  const handleRemoveAssignment = useCallback((assignment: KnowledgeVideoAssignment) => {
    Alert.alert(t('kv.remove'), t('kv.remove_confirm'), [
      { text: t('kv.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeAssignmentMutation.mutate(assignment.id) },
    ]);
  }, [t, removeAssignmentMutation]);

  const updateForm = useCallback((key: keyof KnowledgeVideoFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getVideoTitle = useCallback((video: KnowledgeVideo) => {
    if (language === 'zh' && video.title_zh) return video.title_zh;
    return video.title_en;
  }, [language]);

  const getCategoryLabel = useCallback((cat: string) => {
    return t(`kv.cat_${cat}`);
  }, [t]);

  const getVisibilityLabel = useCallback((vis: string) => {
    return t(`kv.vis_${vis}`);
  }, [t]);

  const getVideoById = useCallback((id: string) => {
    return (videosQuery.data ?? []).find((v) => v.id === id);
  }, [videosQuery.data]);

  const getPatientById = useCallback((id: string | null) => {
    if (!id) return null;
    return (patientsQuery.data ?? []).find((p) => p.id === id);
  }, [patientsQuery.data]);

  const togglePushPatient = useCallback((id: string) => {
    setPushSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const assignments = assignmentsQuery.data ?? [];
  const patients = patientsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('kv.title')} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'library' && styles.tabActive]}
          onPress={() => setActiveTab('library')}
          activeOpacity={0.7}
        >
          <PlayCircle size={14} color={activeTab === 'library' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextActive]}>{t('kv.library')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pushed' && styles.tabActive]}
          onPress={() => setActiveTab('pushed')}
          activeOpacity={0.7}
        >
          <Send size={14} color={activeTab === 'pushed' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'pushed' && styles.tabTextActive]}>{t('kv.pushed')}</Text>
        </TouchableOpacity>
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
                <Text style={styles.primaryBtnText}>{t('kv.add')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <TouchableOpacity
                  style={styles.filterBtn}
                  onPress={() => { setShowCategoryFilter(!showCategoryFilter); setShowVisibilityFilter(false); }}
                  activeOpacity={0.7}
                >
                  <Filter size={12} color={Colors.textSecondary} />
                  <Text style={styles.filterBtnText}>
                    {filterCategory ? getCategoryLabel(filterCategory) : t('kv.all_categories')}
                  </Text>
                  <ChevronDown size={12} color={Colors.textSecondary} />
                </TouchableOpacity>
                {showCategoryFilter && (
                  <View style={styles.filterDropdown}>
                    <TouchableOpacity style={styles.filterOption} onPress={() => { setFilterCategory(''); setShowCategoryFilter(false); }}>
                      <Text style={styles.filterOptionText}>{t('kv.all_categories')}</Text>
                    </TouchableOpacity>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity key={cat} style={[styles.filterOption, filterCategory === cat && styles.filterOptionActive]} onPress={() => { setFilterCategory(cat); setShowCategoryFilter(false); }}>
                        <Text style={[styles.filterOptionText, filterCategory === cat && styles.filterOptionTextActive]}>{getCategoryLabel(cat)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.filterItem}>
                <TouchableOpacity
                  style={styles.filterBtn}
                  onPress={() => { setShowVisibilityFilter(!showVisibilityFilter); setShowCategoryFilter(false); }}
                  activeOpacity={0.7}
                >
                  <Eye size={12} color={Colors.textSecondary} />
                  <Text style={styles.filterBtnText}>
                    {filterVisibility ? getVisibilityLabel(filterVisibility) : t('kv.all_visibility')}
                  </Text>
                  <ChevronDown size={12} color={Colors.textSecondary} />
                </TouchableOpacity>
                {showVisibilityFilter && (
                  <View style={styles.filterDropdown}>
                    <TouchableOpacity style={styles.filterOption} onPress={() => { setFilterVisibility(''); setShowVisibilityFilter(false); }}>
                      <Text style={styles.filterOptionText}>{t('kv.all_visibility')}</Text>
                    </TouchableOpacity>
                    {VISIBILITIES.map((vis) => (
                      <TouchableOpacity key={vis} style={[styles.filterOption, filterVisibility === vis && styles.filterOptionActive]} onPress={() => { setFilterVisibility(vis); setShowVisibilityFilter(false); }}>
                        <Text style={[styles.filterOptionText, filterVisibility === vis && styles.filterOptionTextActive]}>{getVisibilityLabel(vis)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {videosQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('kv.loading')}</Text>
              </View>
            ) : filteredVideos.length === 0 ? (
              <View style={styles.centered}>
                <PlayCircle size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('kv.no_videos')}</Text>
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
                      <View style={[styles.visBadge, video.visibility === 'public' ? styles.visBadgePublic : styles.visBadgePush]}>
                        {video.visibility === 'public' ? <Eye size={10} color={Colors.green} /> : <EyeOff size={10} color={Colors.accent} />}
                        <Text style={[styles.visBadgeText, video.visibility === 'public' ? styles.visBadgePublicText : styles.visBadgePushText]}>
                          {getVisibilityLabel(video.visibility)}
                        </Text>
                      </View>
                    </View>
                    {video.vimeo_video_id ? (
                      <Text style={styles.videoIdText}>Vimeo: {video.vimeo_video_id}</Text>
                    ) : null}
                    {video.youtube_video_id ? (
                      <Text style={styles.videoIdText}>YouTube: {video.youtube_video_id}</Text>
                    ) : null}
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
        ) : (
          <>
            {assignmentsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : assignments.length === 0 ? (
              <View style={styles.centered}>
                <Send size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('kv.no_assignments')}</Text>
              </View>
            ) : (
              assignments.map((assignment) => {
                const video = getVideoById(assignment.video_id);
                const patient = getPatientById(assignment.patient_id);
                return (
                  <View key={assignment.id} style={styles.assignCard}>
                    <View style={styles.assignInfo}>
                      <Text style={styles.assignVideoTitle} numberOfLines={1}>
                        {video ? getVideoTitle(video) : '—'}
                      </Text>
                      {video && (
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{getCategoryLabel(video.category)}</Text>
                        </View>
                      )}
                      <Text style={styles.assignPatientName}>
                        {patient ? patient.patient_name : t('kv.push_all')}
                      </Text>
                      {(assignment.start_date || assignment.end_date) && (
                        <Text style={styles.assignPeriod}>
                          {t('kv.period')}: {assignment.start_date ?? '—'} ~ {assignment.end_date ?? '—'}
                        </Text>
                      )}
                      <View style={[styles.viewedBadge, assignment.is_viewed ? styles.viewedBadgeYes : styles.viewedBadgeNo]}>
                        <Text style={[styles.viewedBadgeText, assignment.is_viewed ? styles.viewedBadgeYesText : styles.viewedBadgeNoText]}>
                          {assignment.is_viewed ? t('kv.viewed') : t('kv.not_viewed')}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveAssignment(assignment)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingVideo ? t('kv.edit') : t('kv.add')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.title_en')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={form.title_en} onChangeText={(v) => updateForm('title_en', v)} placeholder={t('kv.title_en')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.title_zh')}</Text>
              <TextInput style={styles.input} value={form.title_zh} onChangeText={(v) => updateForm('title_zh', v)} placeholder={t('kv.title_zh')} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.desc_en')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description_en} onChangeText={(v) => updateForm('description_en', v)} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.desc_zh')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description_zh} onChangeText={(v) => updateForm('description_zh', v)} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.creator_en')}</Text>
              <TextInput style={styles.input} value={form.creator_name_en} onChangeText={(v) => updateForm('creator_name_en', v)} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.creator_zh')}</Text>
              <TextInput style={styles.input} value={form.creator_name_zh} onChangeText={(v) => updateForm('creator_name_zh', v)} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.category')}</Text>
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
              <Text style={styles.label}>{t('kv.visibility')}</Text>
              <View style={styles.chipRow}>
                {VISIBILITIES.map((vis) => (
                  <TouchableOpacity
                    key={vis}
                    style={[styles.chip, form.visibility === vis && styles.chipActive]}
                    onPress={() => setForm((prev) => ({ ...prev, visibility: vis }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, form.visibility === vis && styles.chipTextActive]}>{getVisibilityLabel(vis)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.vimeo_id')}</Text>
              <TextInput style={styles.input} value={form.vimeo_video_id} onChangeText={(v) => updateForm('vimeo_video_id', v)} placeholder="123456789" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.youtube_id')}</Text>
              <TextInput style={styles.input} value={form.youtube_video_id} onChangeText={(v) => updateForm('youtube_video_id', v)} placeholder="dQw4w9WgXcQ" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.tags')}</Text>
              <TextInput style={styles.input} value={tagsInput} onChangeText={setTagsInput} placeholder="tag1, tag2, tag3" placeholderTextColor={Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]} onPress={handleSave} disabled={saveMutation.isPending} activeOpacity={0.8}>
              {saveMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('kv.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={pushModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPushModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPushModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{t('kv.push')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.start_date')}</Text>
              <TextInput style={styles.input} value={pushStartDate} onChangeText={setPushStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('kv.end_date')}</Text>
              <TextInput style={styles.input} value={pushEndDate} onChangeText={setPushEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, pushMode === 'all' && styles.chipActive]}
                  onPress={() => setPushMode('all')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, pushMode === 'all' && styles.chipTextActive]}>{t('kv.push_all')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, pushMode === 'specific' && styles.chipActive]}
                  onPress={() => setPushMode('specific')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, pushMode === 'specific' && styles.chipTextActive]}>{t('kv.push_specific')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {pushMode === 'specific' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('kv.select_patients')}</Text>
                {patients.map((p) => {
                  const isSelected = pushSelectedPatients.includes(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.patientOption, isSelected && styles.patientOptionActive]}
                      onPress={() => togglePushPatient(p.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.patientOptionText, isSelected && styles.patientOptionTextActive]}>{p.patient_name}</Text>
                      {isSelected && <Check size={14} color={Colors.green} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity style={[styles.saveBtn, pushMutation.isPending && styles.saveBtnDisabled]} onPress={handleConfirmPush} disabled={pushMutation.isPending} activeOpacity={0.8}>
              {pushMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('kv.push')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8, backgroundColor: Colors.background },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
  tabActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  tabText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  actionBar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' as const },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
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
  videoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  videoSubTitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  videoCreator: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  catBadge: { backgroundColor: '#eee8f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#7c5cbf', textTransform: 'uppercase' as const },
  visBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  visBadgePublic: { backgroundColor: Colors.greenLight },
  visBadgePush: { backgroundColor: Colors.accentLight },
  visBadgeText: { fontSize: 10, fontWeight: '600' as const },
  visBadgePublicText: { color: Colors.green },
  visBadgePushText: { color: Colors.accent },
  videoIdText: { fontSize: 11, color: Colors.textTertiary, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  videoActions: { gap: 6, marginLeft: 8, alignItems: 'center' },
  pushBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.green, justifyContent: 'center', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.inputBg },
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
  patientOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 6 },
  patientOptionActive: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  patientOptionText: { fontSize: 14, color: Colors.text, fontWeight: '500' as const },
  patientOptionTextActive: { color: Colors.green, fontWeight: '600' as const },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' as const },
});
