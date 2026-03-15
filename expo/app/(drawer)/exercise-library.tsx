import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, BarChart3, Play, Clock, ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import ExerciseFormModal from '@/components/ExerciseFormModal';
import type { Exercise, ExerciseFormData } from '@/types/exercise';

export default function ExerciseLibraryScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      console.log('[Exercises] Fetching exercises...');
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .order('title_en', { ascending: true });
      if (error) {
        console.error('[Exercises] Fetch error:', error);
        throw error;
      }
      console.log('[Exercises] Fetched', data?.length ?? 0, 'exercises');
      return (data ?? []) as Exercise[];
    },
  });

  const categories = useMemo(() => {
    const exercises = exercisesQuery.data ?? [];
    const cats = new Set<string>();
    exercises.forEach((e) => {
      if (e.category) cats.add(e.category);
    });
    return Array.from(cats).sort();
  }, [exercisesQuery.data]);

  const filteredExercises = useMemo(() => {
    let exercises = exercisesQuery.data ?? [];
    if (selectedCategory) {
      exercises = exercises.filter((e) => e.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      exercises = exercises.filter(
        (e) =>
          e.title_en.toLowerCase().includes(q) ||
          (e.title_zh_hant ?? '').toLowerCase().includes(q) ||
          (e.category ?? '').toLowerCase().includes(q) ||
          (e.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return exercises;
  }, [exercisesQuery.data, search, selectedCategory]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ExerciseFormData }) => {
      const payload = {
        ...data,
        tags: data.tags.length > 0 ? data.tags : null,
        vimeo_video_id: data.vimeo_video_id || null,
        youtube_video_id: data.youtube_video_id || null,
        category: data.category || null,
        default_dosage: data.default_dosage || null,
        audio_instruction_url_en: data.audio_instruction_url_en || null,
        audio_instruction_url_zh_hant: data.audio_instruction_url_zh_hant || null,
        audio_instruction_url_zh_hans: data.audio_instruction_url_zh_hans || null,
        narrative_audio_youtube_id: data.narrative_audio_youtube_id || null,
        narrative_audio_youtube_id_zh_hant: data.narrative_audio_youtube_id_zh_hant || null,
        narrative_audio_youtube_id_zh_hans: data.narrative_audio_youtube_id_zh_hans || null,
        subtitle_url_en: data.subtitle_url_en || null,
        subtitle_url_zh_hant: data.subtitle_url_zh_hant || null,
        subtitle_url_zh_hans: data.subtitle_url_zh_hans || null,
        audio_transcript_en: data.audio_transcript_en || null,
        audio_transcript_zh_hant: data.audio_transcript_zh_hant || null,
        audio_transcript_zh_hans: data.audio_transcript_zh_hans || null,
        default_dosage_zh_hant: data.default_dosage_zh_hant || null,
        default_dosage_zh_hans: data.default_dosage_zh_hans || null,
        title_zh_hant: data.title_zh_hant || null,
        title_zh_hans: data.title_zh_hans || null,
      };
      if (id) {
        console.log('[Exercises] Updating exercise:', id);
        const { error } = await supabase.from('exercise_library').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        console.log('[Exercises] Creating new exercise');
        const { error } = await supabase.from('exercise_library').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      console.log('[Exercises] Save successful');
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setModalVisible(false);
      setEditingExercise(null);
    },
    onError: (err) => {
      console.error('[Exercises] Save error:', err);
      Alert.alert('Error', err.message ?? 'Failed to save exercise');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Exercises] Deleting exercise:', id);
      const { error } = await supabase.from('exercise_library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      console.log('[Exercises] Delete successful');
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: (err) => {
      console.error('[Exercises] Delete error:', err);
      Alert.alert('Error', err.message ?? 'Failed to delete exercise');
    },
  });

  const handleAdd = useCallback(() => {
    setEditingExercise(null);
    setModalVisible(true);
  }, []);

  const handleEdit = useCallback((exercise: Exercise) => {
    setEditingExercise(exercise);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((exercise: Exercise) => {
    Alert.alert(
      t('exercise.delete_title'),
      t('exercise.delete_confirm'),
      [
        { text: t('exercise.cancel'), style: 'cancel' },
        {
          text: t('exercise.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(exercise.id),
        },
      ]
    );
  }, [t, deleteMutation]);

  const handleSave = useCallback((data: ExerciseFormData) => {
    saveMutation.mutate({ id: editingExercise?.id, data });
  }, [editingExercise, saveMutation]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingExercise(null);
  }, []);

  const getTitle = useCallback((ex: Exercise) => {
    if (language === 'zh' && ex.title_zh_hant) return ex.title_zh_hant;
    return ex.title_en;
  }, [language]);

  const getVimeoThumb = useCallback((vimeoId: string | null) => {
    if (!vimeoId) return null;
    return `https://vumbnail.com/${vimeoId}.jpg`;
  }, []);

  const renderExercise = useCallback(({ item }: { item: Exercise }) => {
    const thumbUrl = getVimeoThumb(item.vimeo_video_id);
    return (
      <View style={styles.exerciseCard}>
        <View style={styles.cardTop}>
          <View style={styles.thumbContainer}>
            {thumbUrl ? (
              <View style={styles.thumbPlaceholder}>
                <Play size={18} color={Colors.white} />
              </View>
            ) : (
              <View style={styles.thumbPlaceholder}>
                <BarChart3 size={18} color={Colors.white} />
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.exerciseTitle} numberOfLines={2}>{getTitle(item)}</Text>
            {item.title_en !== getTitle(item) && (
              <Text style={styles.exerciseSubtitle} numberOfLines={1}>{item.title_en}</Text>
            )}
            <View style={styles.metaRow}>
              {item.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              ) : null}
              {item.default_duration_minutes ? (
                <View style={styles.durationBadge}>
                  <Clock size={11} color={Colors.textSecondary} />
                  <Text style={styles.durationText}>{item.default_duration_minutes} {t('exercise.min')}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {item.tags && item.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 4).map((tag, i) => (
              <View key={i} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.tags.length > 4 && (
              <Text style={styles.moreTagsText}>+{item.tags.length - 4}</Text>
            )}
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
          >
            <Pencil size={14} color={Colors.accent} />
            <Text style={styles.actionBtnText}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color={Colors.danger} />
            <Text style={[styles.actionBtnText, styles.deleteBtnText]}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [getTitle, getVimeoThumb, handleEdit, handleDelete, t]);

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  const addButton = (
    <TouchableOpacity
      style={styles.addButton}
      onPress={handleAdd}
      activeOpacity={0.7}
      testID="add-exercise-button"
    >
      <Plus size={20} color={Colors.white} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('exercise.title')} rightContent={addButton} />

      <View style={styles.filtersContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('exercise.search')}
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            testID="exercise-search"
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.categoryDropdown}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryDropdownText} numberOfLines={1}>
              {selectedCategory ?? t('exercise.all_categories')}
            </Text>
            <ChevronDown size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          {exercisesQuery.data && (
            <Text style={styles.countText}>
              {filteredExercises.length} {t('exercise.total')}
            </Text>
          )}
        </View>

        {showCategoryDropdown && (
          <View style={styles.dropdownList}>
            <TouchableOpacity
              style={[styles.dropdownItem, !selectedCategory && styles.dropdownItemActive]}
              onPress={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
            >
              <Text style={[styles.dropdownItemText, !selectedCategory && styles.dropdownItemTextActive]}>
                {t('exercise.all_categories')}
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.dropdownItem, selectedCategory === cat && styles.dropdownItemActive]}
                onPress={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
              >
                <Text style={[styles.dropdownItemText, selectedCategory === cat && styles.dropdownItemTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {exercisesQuery.isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>{t('exercise.loading')}</Text>
        </View>
      ) : exercisesQuery.isError ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('exercise.error')}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void exercisesQuery.refetch()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>{t('exercise.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredExercises.length === 0 ? (
        <View style={styles.centerContent}>
          <BarChart3 size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{t('exercise.no_exercises')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          renderItem={renderExercise}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={exercisesQuery.isRefetching}
              onRefresh={() => void exercisesQuery.refetch()}
              tintColor={Colors.accent}
            />
          }
        />
      )}

      <ExerciseFormModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSave={handleSave}
        exercise={editingExercise}
        saving={saveMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxWidth: 200,
  },
  categoryDropdownText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  countText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  dropdownList: {
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
    maxHeight: 240,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: {
    backgroundColor: Colors.accentLight,
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.text,
  },
  dropdownItemTextActive: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  exerciseCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumbContainer: {
    width: 56,
    height: 42,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#3a3530',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholder: {
    width: 56,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4a4540',
    borderRadius: 8,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  exerciseSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: '#e8f0eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.green,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginLeft: 68,
  },
  tagChip: {
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  tagText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  moreTagsText: {
    fontSize: 11,
    color: Colors.textTertiary,
    alignSelf: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginLeft: 68,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.accentLight,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
  },
  deleteBtnText: {
    color: Colors.danger,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 15,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  retryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
