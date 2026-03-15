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
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, X, CheckSquare, ClipboardList, Send, FileText,
  ChevronDown, Eye, AlertTriangle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { supabase } from '@/lib/supabase';
import ScreenHeader from '@/components/ScreenHeader';
import type {
  AssessmentLibraryItem,
  AssessmentLibraryFormData,
  AssessmentType,
  QuestionnaireTemplate,
  QuestionnaireTemplateFormData,
  TemplateQuestion,
  QuestionType,
  AssessmentSubmission,
  QuestionnaireResponse,
  AssessmentItem,
  ScoringConfig,
} from '@/types/assessment';
import type { Patient } from '@/types/patient';

function findQuestionText(items: any[] | undefined | null, key: string, lang: string): string {
  if (!items || !Array.isArray(items)) return '';
  for (const item of items) {
    if (item.number != null && String(item.number) === key) {
      return lang === 'zh' ? (item.text_zh || item.text_en || '') : (item.text_en || item.text_zh || '');
    }
    if (item.id && item.id === key) {
      return lang === 'zh' ? (item.text_zh || item.category_zh || item.text_en || item.category_en || '') : (item.text_en || item.category_en || item.text_zh || item.category_zh || '');
    }
    if (item.items && Array.isArray(item.items)) {
      for (const sub of item.items) {
        if (sub.item_number != null && String(sub.item_number) === key) return lang === 'zh' ? (sub.text_zh || sub.text_en || '') : (sub.text_en || sub.text_zh || '');
        if (sub.item_id && sub.item_id === key) return lang === 'zh' ? (sub.text_zh || sub.text_en || '') : (sub.text_en || sub.text_zh || '');
      }
    }
    if (item.assessment_areas && Array.isArray(item.assessment_areas)) {
      for (const area of item.assessment_areas) {
        if (area.items) for (const sub of area.items) {
          if (sub.item_id && sub.item_id === key) return lang === 'zh' ? (sub.text_zh || sub.text_en || '') : (sub.text_en || sub.text_zh || '');
        }
      }
    }
  }
  return '';
}

function getScoreColor(value: number, scoringConfig: any): string {
  const sMin = scoringConfig?.scale_min ?? scoringConfig?.scale_per_item?.min ?? 0;
  const sMax = scoringConfig?.scale_max ?? scoringConfig?.scale_per_item?.max ?? 4;
  const ratio = (value - sMin) / (sMax - sMin);
  if (ratio >= 0.75) return '#d94f4f';
  if (ratio >= 0.5) return '#e07a3a';
  if (ratio >= 0.25) return '#2c2c2c';
  return '#5b8a72';
}

function ComparisonBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#f3f0ec' }}>
      <Minus size={10} color="#7a7a7a" />
      <Text style={{ fontSize: 11, fontWeight: '600' as const, color: '#7a7a7a' }}>Same</Text>
    </View>
  );
  const isUp = diff > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: isUp ? '#fce8e8' : '#e8f0eb' }}>
      {isUp ? <TrendingUp size={10} color="#d94f4f" /> : <TrendingDown size={10} color="#5b8a72" />}
      <Text style={{ fontSize: 11, fontWeight: '600' as const, color: isUp ? '#d94f4f' : '#5b8a72' }}>{isUp ? '+' : ''}{diff}</Text>
    </View>
  );
}

type TabKey = 'clinical' | 'templates' | 'assigned' | 'responses';

const EMPTY_TOOL_FORM: AssessmentLibraryFormData = {
  name_en: '', name_zh: '', type: 'clinician_rated',
  items_json: '[]', scoring_config_json: '{}', reference: '',
  interpretation_en: '', interpretation_zh: '',
};

const EMPTY_TEMPLATE_FORM: QuestionnaireTemplateFormData = {
  name: '', description_en: '', description_zh_hant: '', description_zh_hans: '',
  scoring_method: '', questions: [],
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function AssessmentsScreen() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('clinical');

  const [toolFormVisible, setToolFormVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<AssessmentLibraryItem | null>(null);
  const [toolForm, setToolForm] = useState<AssessmentLibraryFormData>(EMPTY_TOOL_FORM);

  const [templateFormVisible, setTemplateFormVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<QuestionnaireTemplateFormData>(EMPTY_TEMPLATE_FORM);

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignPatientId, setAssignPatientId] = useState<string | null>(null);
  const [assignAssessmentId, setAssignAssessmentId] = useState<string | null>(null);
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [assignDate, setAssignDate] = useState('');
  const [showAssignPatientPicker, setShowAssignPatientPicker] = useState(false);
  const [showAssignAssessmentPicker, setShowAssignAssessmentPicker] = useState(false);

  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<AssessmentSubmission | null>(null);
  const [viewingQuestionnaireResponse, setViewingQuestionnaireResponse] = useState<QuestionnaireResponse | null>(null);
  const [previousSubmission, setPreviousSubmission] = useState<AssessmentSubmission | null>(null);
  const [previousQResponse, setPreviousQResponse] = useState<QuestionnaireResponse | null>(null);

  const toolsQuery = useQuery({
    queryKey: ['assessment_library'],
    queryFn: async () => {
      console.log('[Assessments] Fetching assessment library');
      const { data, error } = await supabase
        .from('assessment_library')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssessmentLibraryItem[];
    },
  });

  const templatesQuery = useQuery({
    queryKey: ['questionnaire_templates'],
    queryFn: async () => {
      console.log('[Assessments] Fetching questionnaire templates');
      const { data, error } = await supabase
        .from('questionnaire_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuestionnaireTemplate[];
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

  const submissionsQuery = useQuery({
    queryKey: ['assessment_submissions'],
    queryFn: async () => {
      console.log('[Assessments] Fetching submissions');
      const { data, error } = await supabase
        .from('assessment_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssessmentSubmission[];
    },
  });

  const questionnaireResponsesQuery = useQuery({
    queryKey: ['questionnaire_responses'],
    queryFn: async () => {
      console.log('[Assessments] Fetching questionnaire responses');
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuestionnaireResponse[];
    },
  });

  const patients = useMemo(() => patientsQuery.data ?? [], [patientsQuery.data]);
  const tools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const submissions = useMemo(() => submissionsQuery.data ?? [], [submissionsQuery.data]);
  const qResponses = useMemo(() => questionnaireResponsesQuery.data ?? [], [questionnaireResponsesQuery.data]);

  const completedResponses = useMemo(() => {
    const clinicalCompleted = submissions
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        id: s.id,
        patient_id: s.patient_id,
        assessment_id: s.assessment_id,
        template_id: s.template_id,
        type: 'clinical' as const,
        total_score: s.total_score,
        severity_rating: s.severity_rating,
        completed_at: s.completed_at ?? s.created_at,
        responses: s.responses,
        subscale_scores: s.subscale_scores,
      }));
    const customCompleted = qResponses.map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      assessment_id: null as string | null,
      template_id: r.template_id,
      type: 'custom' as const,
      total_score: r.total_score,
      severity_rating: null as string | null,
      completed_at: r.completed_at,
      responses: r.responses,
      subscale_scores: null as Record<string, number> | null,
    }));
    return [...clinicalCompleted, ...customCompleted].sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
  }, [submissions, qResponses]);

  const saveToolMutation = useMutation({
    mutationFn: async (payload: AssessmentLibraryFormData & { id?: string }) => {
      let parsedItems: AssessmentItem[] = [];
      let parsedScoring: ScoringConfig | null = null;
      try { parsedItems = JSON.parse(payload.items_json); } catch { parsedItems = []; }
      try { parsedScoring = JSON.parse(payload.scoring_config_json); } catch { parsedScoring = null; }
      const row = {
        name_en: payload.name_en.trim(),
        name_zh: payload.name_zh.trim() || null,
        type: payload.type,
        items: parsedItems,
        scoring_config: parsedScoring,
        reference: payload.reference.trim() || null,
        interpretation_en: payload.interpretation_en.trim() || null,
        interpretation_zh: payload.interpretation_zh.trim() || null,
      };
      if (payload.id) {
        const { error } = await supabase.from('assessment_library').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assessment_library').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assessment_library'] });
      setToolFormVisible(false);
      setEditingTool(null);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to save'),
  });

  const deleteToolMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['assessment_library'] }),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: QuestionnaireTemplateFormData & { id?: string }) => {
      const row = {
        name: payload.name.trim(),
        description_en: payload.description_en.trim() || null,
        description_zh_hant: payload.description_zh_hant.trim() || null,
        description_zh_hans: payload.description_zh_hans.trim() || null,
        scoring_method: payload.scoring_method.trim() || null,
        questions: payload.questions,
      };
      if (payload.id) {
        const { error } = await supabase.from('questionnaire_templates').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questionnaire_templates').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['questionnaire_templates'] });
      setTemplateFormVisible(false);
      setEditingTemplate(null);
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to save'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questionnaire_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['questionnaire_templates'] }),
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { patient_id: string; assessment_id: string | null; template_id: string | null; scheduled_date: string | null }) => {
      const { error } = await supabase.from('assessment_submissions').insert({
        patient_id: payload.patient_id,
        assessment_id: payload.assessment_id,
        template_id: payload.template_id,
        scheduled_date: payload.scheduled_date || null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assessment_submissions'] });
      setAssignModalVisible(false);
      resetAssignForm();
    },
    onError: (err) => Alert.alert('Error', err.message ?? 'Failed to assign'),
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_submissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['assessment_submissions'] }),
  });

  const resetAssignForm = useCallback(() => {
    setAssignPatientId(null);
    setAssignAssessmentId(null);
    setAssignTemplateId(null);
    setAssignDate('');
    setShowAssignPatientPicker(false);
    setShowAssignAssessmentPicker(false);
  }, []);

  const handleAddTool = useCallback(() => {
    setEditingTool(null);
    setToolForm(EMPTY_TOOL_FORM);
    setToolFormVisible(true);
  }, []);

  const handleEditTool = useCallback((tool: AssessmentLibraryItem) => {
    setEditingTool(tool);
    setToolForm({
      name_en: tool.name_en,
      name_zh: tool.name_zh ?? '',
      type: tool.type,
      items_json: JSON.stringify(tool.items ?? [], null, 2),
      scoring_config_json: JSON.stringify(tool.scoring_config ?? {}, null, 2),
      reference: tool.reference ?? '',
      interpretation_en: tool.interpretation_en ?? '',
      interpretation_zh: tool.interpretation_zh ?? '',
    });
    setToolFormVisible(true);
  }, []);

  const handleDeleteTool = useCallback((tool: AssessmentLibraryItem) => {
    Alert.alert(t('assess.delete_tool'), t('assess.delete_tool_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteToolMutation.mutate(tool.id) },
    ]);
  }, [t, deleteToolMutation]);

  const handleSaveTool = useCallback(() => {
    if (!toolForm.name_en.trim()) { Alert.alert('', t('assess.name_required')); return; }
    saveToolMutation.mutate({ ...toolForm, id: editingTool?.id });
  }, [toolForm, editingTool, saveToolMutation, t]);

  const handleAddTemplate = useCallback(() => {
    setEditingTemplate(null);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setTemplateFormVisible(true);
  }, []);

  const handleEditTemplate = useCallback((tpl: QuestionnaireTemplate) => {
    setEditingTemplate(tpl);
    setTemplateForm({
      name: tpl.name,
      description_en: tpl.description_en ?? '',
      description_zh_hant: tpl.description_zh_hant ?? '',
      description_zh_hans: tpl.description_zh_hans ?? '',
      scoring_method: tpl.scoring_method ?? '',
      questions: tpl.questions ?? [],
    });
    setTemplateFormVisible(true);
  }, []);

  const handleDeleteTemplate = useCallback((tpl: QuestionnaireTemplate) => {
    Alert.alert(t('assess.delete_template'), t('assess.delete_template_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteTemplateMutation.mutate(tpl.id) },
    ]);
  }, [t, deleteTemplateMutation]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateForm.name.trim()) { Alert.alert('', t('assess.template_name_required')); return; }
    saveTemplateMutation.mutate({ ...templateForm, id: editingTemplate?.id });
  }, [templateForm, editingTemplate, saveTemplateMutation, t]);

  const addQuestion = useCallback(() => {
    const q: TemplateQuestion = {
      id: generateId(),
      type: 'numeric_scale',
      text_en: '',
      text_zh_hant: '',
      text_zh_hans: '',
      scale_min: 0,
      scale_max: 5,
      choices: [],
    };
    setTemplateForm((prev) => ({ ...prev, questions: [...prev.questions, q] }));
  }, []);

  const updateQuestion = useCallback((qId: string, field: string, value: string | number) => {
    setTemplateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => q.id === qId ? { ...q, [field]: value } : q),
    }));
  }, []);

  const removeQuestion = useCallback((qId: string) => {
    setTemplateForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== qId),
    }));
  }, []);

  const addChoice = useCallback((qId: string) => {
    setTemplateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qId) return q;
        const choices = [...(q.choices ?? []), { value: '', label_en: '', label_zh_hant: '', label_zh_hans: '' }];
        return { ...q, choices };
      }),
    }));
  }, []);

  const updateChoice = useCallback((qId: string, cIndex: number, field: string, value: string) => {
    setTemplateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qId) return q;
        const choices = (q.choices ?? []).map((c, i) => i === cIndex ? { ...c, [field]: value } : c);
        return { ...q, choices };
      }),
    }));
  }, []);

  const removeChoice = useCallback((qId: string, cIndex: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qId) return q;
        const choices = (q.choices ?? []).filter((_, i) => i !== cIndex);
        return { ...q, choices };
      }),
    }));
  }, []);

  const handleOpenAssign = useCallback(() => {
    resetAssignForm();
    setAssignModalVisible(true);
  }, [resetAssignForm]);

  const handleConfirmAssign = useCallback(() => {
    if (!assignPatientId) return;
    if (!assignAssessmentId && !assignTemplateId) return;
    assignMutation.mutate({
      patient_id: assignPatientId,
      assessment_id: assignAssessmentId,
      template_id: assignTemplateId,
      scheduled_date: assignDate,
    });
  }, [assignPatientId, assignAssessmentId, assignTemplateId, assignDate, assignMutation]);

  const handleDeleteSubmission = useCallback((sub: AssessmentSubmission) => {
    Alert.alert(t('assess.delete_assignment'), t('assess.delete_assignment_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteSubmissionMutation.mutate(sub.id) },
    ]);
  }, [t, deleteSubmissionMutation]);

  const handleViewClinicalResponse = useCallback(async (sub: AssessmentSubmission) => {
    setViewingSubmission(sub);
    setViewingQuestionnaireResponse(null);
    setPreviousSubmission(null);
    setPreviousQResponse(null);
    if (sub.assessment_id && sub.patient_id) {
      try {
        const { data } = await supabase
          .from('assessment_submissions')
          .select('*')
          .eq('patient_id', sub.patient_id)
          .eq('assessment_id', sub.assessment_id)
          .eq('status', 'completed')
          .lt('completed_at', sub.completed_at ?? sub.created_at)
          .order('completed_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) setPreviousSubmission(data[0]);
      } catch (e) { console.warn('Failed to fetch previous:', e); }
    }
    setResponseModalVisible(true);
  }, []);

  const handleViewCustomResponse = useCallback(async (resp: QuestionnaireResponse) => {
    setViewingQuestionnaireResponse(resp);
    setViewingSubmission(null);
    setPreviousSubmission(null);
    setPreviousQResponse(null);
    if (resp.template_id && resp.patient_id) {
      try {
        const { data } = await supabase
          .from('questionnaire_responses')
          .select('*')
          .eq('patient_id', resp.patient_id)
          .eq('template_id', resp.template_id)
          .lt('completed_at', resp.completed_at)
          .order('completed_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) setPreviousQResponse(data[0]);
      } catch (e) { console.warn('Failed to fetch previous:', e); }
    }
    setResponseModalVisible(true);
  }, []);

  const handleViewResponse = useCallback((item: typeof completedResponses[0]) => {
    if (item.type === 'clinical') {
      const sub = submissions.find((s) => s.id === item.id);
      if (sub) void handleViewClinicalResponse(sub);
    } else {
      const resp = qResponses.find((r) => r.id === item.id);
      if (resp) void handleViewCustomResponse(resp);
    }
  }, [submissions, qResponses, handleViewClinicalResponse, handleViewCustomResponse]);

  const getPatientName = useCallback((id: string) => {
    const p = patients.find((pt) => pt.id === id);
    return p?.patient_name ?? '—';
  }, [patients]);

  const getAssessmentName = useCallback((id: string | null) => {
    if (!id) return '—';
    const a = tools.find((t) => t.id === id);
    if (!a) return '—';
    return language === 'zh' && a.name_zh ? a.name_zh : a.name_en;
  }, [tools, language]);

  const getTemplateName = useCallback((id: string | null) => {
    if (!id) return '—';
    const tpl = templates.find((t) => t.id === id);
    return tpl?.name ?? '—';
  }, [templates]);

  const getToolById = useCallback((id: string | null) => {
    if (!id) return null;
    return tools.find((t) => t.id === id) ?? null;
  }, [tools]);

  const getTemplateById = useCallback((id: string | null) => {
    if (!id) return null;
    return templates.find((t) => t.id === id) ?? null;
  }, [templates]);

  const allAssessmentOptions = useMemo(() => {
    const toolOpts = tools.map((t) => ({ id: t.id, name: language === 'zh' && t.name_zh ? t.name_zh : t.name_en, isTool: true }));
    const templateOpts = templates.map((t) => ({ id: t.id, name: t.name, isTool: false }));
    return [...toolOpts, ...templateOpts];
  }, [tools, templates, language]);

  const renderTypeBadge = (type: AssessmentType) => {
    const isClinician = type === 'clinician_rated';
    return (
      <View style={[styles.typeBadge, isClinician ? styles.typeBadgeClinician : styles.typeBadgePatient]}>
        <Text style={[styles.typeBadgeText, isClinician ? styles.typeBadgeClinText : styles.typeBadgePatText]}>
          {isClinician ? t('assess.type_clinician') : t('assess.type_patient')}
        </Text>
      </View>
    );
  };

  const renderResponseDetailModal = () => {
    if (viewingSubmission) {
      const tool = getToolById(viewingSubmission.assessment_id);
      const scoringConfig = tool?.scoring_config;
      const items = tool?.items ?? [];
      const cutoff = scoringConfig?.cutoff;
      const isAboveCutoff = cutoff != null && (viewingSubmission.total_score ?? 0) >= cutoff;
      const severityLevels = scoringConfig?.severity_levels ?? [];
      const currentSeverity = severityLevels.find(
        (lvl) => (viewingSubmission.total_score ?? 0) >= lvl.min && (viewingSubmission.total_score ?? 0) <= lvl.max
      );
      const domains = scoringConfig?.domains ?? [];
      const subscaleScores = viewingSubmission.subscale_scores ?? {};
      const responses = viewingSubmission.responses ?? {};
      const prevResponses = previousSubmission?.responses ?? {};
      const prevSubscaleScores = previousSubmission?.subscale_scores ?? {};
      const maxTotal = scoringConfig?.max_total;
      const lang = language;

      return (
        <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.responseHeader}>
            <Text style={styles.responseAssessName}>
              {tool ? (language === 'zh' && tool.name_zh ? tool.name_zh : tool.name_en) : '—'}
            </Text>
            <Text style={styles.responsePatientLabel}>{getPatientName(viewingSubmission.patient_id)}</Text>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreBig}>{viewingSubmission.total_score ?? '—'}</Text>
              {maxTotal != null && <Text style={styles.scoreMax}>/ {maxTotal}</Text>}
              <Text style={styles.scoreLabel}>{t('assess.total_score')}</Text>
            </View>
            {previousSubmission && (
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>vs. previous ({new Date(previousSubmission.completed_at ?? previousSubmission.created_at).toLocaleDateString()})</Text>
                <ComparisonBadge current={viewingSubmission.total_score ?? null} previous={previousSubmission.total_score ?? null} />
              </View>
            )}
            {viewingSubmission.severity_rating && (
              <View style={[styles.severityBadge, currentSeverity?.color ? { backgroundColor: currentSeverity.color + '22' } : {}]}>
                <Text style={[styles.severityText, currentSeverity?.color ? { color: currentSeverity.color } : {}]}>
                  {viewingSubmission.severity_rating}
                </Text>
              </View>
            )}
            {(viewingSubmission as any).language && (
              <Text style={styles.languageNote}>Language: {(viewingSubmission as any).language}</Text>
            )}
          </View>

          {cutoff != null && (
            <View style={[styles.interpretBox, isAboveCutoff ? styles.interpretBoxDanger : styles.interpretBoxSafe]}>
              <AlertTriangle size={16} color={isAboveCutoff ? Colors.danger : Colors.green} />
              <Text style={[styles.interpretBoxText, { color: isAboveCutoff ? Colors.danger : Colors.green }]}>
                {isAboveCutoff ? t('assess.above_cutoff') : t('assess.below_cutoff')} (cutoff: {cutoff})
              </Text>
            </View>
          )}

          {(tool?.interpretation_en || tool?.interpretation_zh) && (
            <View style={styles.interpretSection}>
              <Text style={styles.sectionLabel}>{t('assess.interpretation')}</Text>
              <Text style={styles.interpretText}>
                {language === 'zh' && tool?.interpretation_zh ? tool.interpretation_zh : tool?.interpretation_en}
              </Text>
            </View>
          )}

          {domains.length > 0 && (
            <View style={styles.subscaleSection}>
              <Text style={styles.sectionLabel}>{t('assess.subscale_scores')}</Text>
              <View style={styles.subscaleGrid}>
                {domains.map((d) => {
                  const currentVal = subscaleScores[d.key] ?? null;
                  const prevVal = prevSubscaleScores[d.key] ?? null;
                  return (
                    <View key={d.key} style={styles.subscaleItem}>
                      <Text style={styles.subscaleScore}>{currentVal ?? '—'}</Text>
                      <Text style={styles.subscaleLabel}>{language === 'zh' && d.label_zh ? d.label_zh : d.label_en}</Text>
                      {previousSubmission && <ComparisonBadge current={currentVal} previous={prevVal} />}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {Object.keys(responses).length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.sectionLabel}>{t('assess.item_responses')}</Text>
              {Object.entries(responses).map(([key, value]) => {
                const qText = findQuestionText(items as any[], key, lang);
                const scoreNum = typeof value === 'number' ? value : parseInt(String(value), 10);
                const scoreColor = !isNaN(scoreNum) ? getScoreColor(scoreNum, scoringConfig) : Colors.text;
                const prevVal = prevResponses[key];
                const prevNum = prevVal != null ? (typeof prevVal === 'number' ? prevVal : parseInt(String(prevVal), 10)) : null;
                return (
                  <View key={key} style={styles.itemRow}>
                    <View style={[styles.itemScoreCircle, { borderColor: scoreColor }]}>
                      <Text style={[styles.itemScoreText, { color: scoreColor }]}>{value ?? '—'}</Text>
                    </View>
                    <View style={styles.itemTextWrap}>
                      <View style={styles.itemHeaderRow}>
                        <Text style={styles.itemNumber}>Item {key}</Text>
                        {prevNum != null && !isNaN(scoreNum) && <ComparisonBadge current={scoreNum} previous={prevNum} />}
                      </View>
                      {qText ? <Text style={styles.itemText} numberOfLines={3}>{qText}</Text>
                        : <Text style={styles.itemTextMissing}>(Question text not available)</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {viewingSubmission.completed_at && (
            <View style={styles.dateInfoSection}>
              <Text style={styles.dateInfoText}>{t('assess.completed_date')}: {new Date(viewingSubmission.completed_at).toLocaleDateString()} {new Date(viewingSubmission.completed_at).toLocaleTimeString()}</Text>
            </View>
          )}

          {tool?.reference && (
            <View style={styles.referenceSection}>
              <Text style={styles.referenceLabel}>{t('assess.reference')}</Text>
              <Text style={styles.referenceText}>{tool.reference}</Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (viewingQuestionnaireResponse) {
      const tpl = getTemplateById(viewingQuestionnaireResponse.template_id);
      const questions = tpl?.questions ?? [];
      const responses = viewingQuestionnaireResponse.responses ?? {};
      const prevResponses = previousQResponse?.responses ?? {};

      return (
        <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.responseHeader}>
            <Text style={styles.responseAssessName}>{tpl?.name ?? '—'}</Text>
            <Text style={styles.responsePatientLabel}>{getPatientName(viewingQuestionnaireResponse.patient_id)}</Text>
            {viewingQuestionnaireResponse.total_score != null && (
              <View style={styles.scoreCard}>
                <Text style={styles.scoreBig}>{viewingQuestionnaireResponse.total_score}</Text>
                <Text style={styles.scoreLabel}>{t('assess.total_score')}</Text>
              </View>
            )}
            {previousQResponse && (
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>vs. previous ({new Date(previousQResponse.completed_at).toLocaleDateString()})</Text>
                <ComparisonBadge current={viewingQuestionnaireResponse.total_score ?? null} previous={previousQResponse.total_score ?? null} />
              </View>
            )}
          </View>

          {tpl?.description_en && (
            <View style={styles.interpretSection}>
              <Text style={styles.interpretText}>
                {language === 'zh' && tpl.description_zh_hant ? tpl.description_zh_hant : tpl.description_en}
              </Text>
            </View>
          )}

          {questions.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.sectionLabel}>{t('assess.question_responses')}</Text>
              {questions.map((q, idx) => {
                const responseVal = responses[q.id];
                const scoreNum = typeof responseVal === 'number' ? responseVal : parseInt(String(responseVal), 10);
                const scoreColor = !isNaN(scoreNum) ? getScoreColor(scoreNum, null) : Colors.accent;
                const prevVal = prevResponses[q.id];
                const prevNum = prevVal != null ? (typeof prevVal === 'number' ? prevVal : parseInt(String(prevVal), 10)) : null;
                const qText = q.text_en || (q as any).en || '';
                const qTextZh = q.text_zh_hant || (q as any).zh_hant || '';
                const displayText = language === 'zh' && qTextZh ? qTextZh : qText;
                const choiceLabel = q.type === 'single_choice' && q.choices
                  ? q.choices.find((c) => c.value === String(responseVal))
                  : null;
                return (
                  <View key={q.id} style={styles.itemRow}>
                    <View style={[styles.itemScoreCircle, { borderColor: scoreColor }]}>
                      <Text style={[styles.itemScoreText, { color: scoreColor }]}>{responseVal ?? '—'}</Text>
                    </View>
                    <View style={styles.itemTextWrap}>
                      <View style={styles.itemHeaderRow}>
                        <Text style={styles.itemNumber}>Q{idx + 1}</Text>
                        {prevNum != null && !isNaN(scoreNum) && <ComparisonBadge current={scoreNum} previous={prevNum} />}
                      </View>
                      {displayText ? <Text style={styles.itemText} numberOfLines={3}>{displayText}</Text>
                        : <Text style={styles.itemTextMissing}>(Question text not available)</Text>}
                      {choiceLabel && (
                        <Text style={styles.choiceLabel}>
                          {language === 'zh' && choiceLabel.label_zh_hant ? choiceLabel.label_zh_hant : choiceLabel.label_en}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.dateInfoSection}>
            <Text style={styles.dateInfoText}>{t('assess.completed_date')}: {new Date(viewingQuestionnaireResponse.completed_at).toLocaleDateString()} {new Date(viewingQuestionnaireResponse.completed_at).toLocaleTimeString()}</Text>
            {tpl?.scoring_method && <Text style={styles.dateInfoText}>Scoring: {tpl.scoring_method}</Text>}
          </View>
        </ScrollView>
      );
    }

    return null;
  };

  const refreshAll = useCallback(() => {
    void toolsQuery.refetch();
    void templatesQuery.refetch();
    void patientsQuery.refetch();
    void submissionsQuery.refetch();
    void questionnaireResponsesQuery.refetch();
  }, [toolsQuery, templatesQuery, patientsQuery, submissionsQuery, questionnaireResponsesQuery]);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('assess.title')} />

      <View style={styles.tabBar}>
        {([
          { key: 'clinical' as TabKey, icon: CheckSquare, label: t('assess.clinical_tools') },
          { key: 'templates' as TabKey, icon: ClipboardList, label: t('assess.custom_templates') },
          { key: 'assigned' as TabKey, icon: Send, label: t('assess.assigned') },
          { key: 'responses' as TabKey, icon: FileText, label: t('assess.responses') },
        ]).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
              testID={`assess-tab-${tab.key}`}
            >
              <Icon size={12} color={isActive ? Colors.accent : Colors.textSecondary} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
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
            refreshing={toolsQuery.isRefetching || submissionsQuery.isRefetching}
            onRefresh={refreshAll}
            tintColor={Colors.accent}
          />
        }
      >
        {activeTab === 'clinical' && (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAddTool} activeOpacity={0.7} testID="add-tool-btn">
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('assess.add_tool')}</Text>
              </TouchableOpacity>
            </View>

            {toolsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('assess.loading')}</Text>
              </View>
            ) : tools.length === 0 ? (
              <View style={styles.centered}>
                <CheckSquare size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('assess.no_tools')}</Text>
              </View>
            ) : (
              tools.map((tool) => (
                <View key={tool.id} style={styles.toolCard}>
                  <View style={styles.toolInfo}>
                    <Text style={styles.toolName} numberOfLines={1}>
                      {language === 'zh' && tool.name_zh ? tool.name_zh : tool.name_en}
                    </Text>
                    {tool.name_zh && language === 'en' && (
                      <Text style={styles.toolNameSub} numberOfLines={1}>{tool.name_zh}</Text>
                    )}
                    {tool.name_en && language === 'zh' && (
                      <Text style={styles.toolNameSub} numberOfLines={1}>{tool.name_en}</Text>
                    )}
                    <View style={styles.toolMeta}>
                      {renderTypeBadge(tool.type)}
                      <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>{(tool.items ?? []).length} {t('assess.items_count')}</Text>
                      </View>
                    </View>
                    {tool.reference && (
                      <Text style={styles.toolReference} numberOfLines={1}>{tool.reference}</Text>
                    )}
                  </View>
                  <View style={styles.toolActions}>
                    <TouchableOpacity onPress={() => handleEditTool(tool)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTool(tool)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'templates' && (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAddTemplate} activeOpacity={0.7} testID="add-template-btn">
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('assess.add_template')}</Text>
              </TouchableOpacity>
            </View>

            {templatesQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>{t('assess.loading')}</Text>
              </View>
            ) : templates.length === 0 ? (
              <View style={styles.centered}>
                <ClipboardList size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('assess.no_templates')}</Text>
              </View>
            ) : (
              templates.map((tpl) => (
                <View key={tpl.id} style={styles.toolCard}>
                  <View style={styles.toolInfo}>
                    <Text style={styles.toolName} numberOfLines={1}>{tpl.name}</Text>
                    {tpl.description_en && (
                      <Text style={styles.toolNameSub} numberOfLines={2}>
                        {language === 'zh' && tpl.description_zh_hant ? tpl.description_zh_hant : tpl.description_en}
                      </Text>
                    )}
                    <View style={styles.toolMeta}>
                      <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>{(tpl.questions ?? []).length} {t('assess.questions')}</Text>
                      </View>
                      {tpl.scoring_method && (
                        <View style={styles.scoringBadge}>
                          <Text style={styles.scoringBadgeText}>{tpl.scoring_method}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.toolActions}>
                    <TouchableOpacity onPress={() => handleEditTemplate(tpl)} style={styles.iconBtn}>
                      <Pencil size={15} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTemplate(tpl)} style={styles.iconBtn}>
                      <Trash2 size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'assigned' && (
          <>
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenAssign} activeOpacity={0.7} testID="assign-btn">
                <Plus size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>{t('assess.assign')}</Text>
              </TouchableOpacity>
            </View>

            {submissionsQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : submissions.length === 0 ? (
              <View style={styles.centered}>
                <Send size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('assess.no_assignments')}</Text>
              </View>
            ) : (
              submissions.map((sub) => {
                const isPending = sub.status === 'pending';
                return (
                  <View key={sub.id} style={styles.assignCard}>
                    <View style={styles.assignInfo}>
                      <Text style={styles.assignPatient}>{getPatientName(sub.patient_id)}</Text>
                      <Text style={styles.assignAssessment} numberOfLines={1}>
                        {sub.assessment_id ? getAssessmentName(sub.assessment_id) : getTemplateName(sub.template_id)}
                      </Text>
                      {sub.scheduled_date && (
                        <Text style={styles.assignDate}>{sub.scheduled_date}</Text>
                      )}
                      <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusCompleted]}>
                        <Text style={[styles.statusText, isPending ? styles.statusPendingText : styles.statusCompletedText]}>
                          {isPending ? t('assess.status_pending') : t('assess.status_completed')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.assignActions}>
                      {!isPending && (
                        <TouchableOpacity onPress={() => handleViewClinicalResponse(sub)} style={styles.viewBtn} activeOpacity={0.7}>
                          <Eye size={14} color={Colors.accent} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteSubmission(sub)} style={styles.iconBtn}>
                        <Trash2 size={15} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {activeTab === 'responses' && (
          <>
            {(submissionsQuery.isLoading || questionnaireResponsesQuery.isLoading) ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : completedResponses.length === 0 ? (
              <View style={styles.centered}>
                <FileText size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>{t('assess.no_responses')}</Text>
              </View>
            ) : (
              completedResponses.map((item) => (
                <View key={item.id} style={styles.responseCard}>
                  <View style={styles.responseInfo}>
                    <Text style={styles.responsePatient}>{getPatientName(item.patient_id)}</Text>
                    <Text style={styles.responseAssess} numberOfLines={1}>
                      {item.assessment_id ? getAssessmentName(item.assessment_id) : getTemplateName(item.template_id)}
                    </Text>
                    <View style={styles.responseMetaRow}>
                      <View style={[styles.responseTypeBadge, item.type === 'clinical' ? styles.responseTypeClinical : styles.responseTypeCustom]}>
                        <Text style={[styles.responseTypeBadgeText, item.type === 'clinical' ? styles.responseTypeClinicalText : styles.responseTypeCustomText]}>
                          {item.type === 'clinical' ? t('assess.clinical') : t('assess.custom')}
                        </Text>
                      </View>
                      {item.total_score != null && (
                        <Text style={styles.responseScore}>{t('assess.score')}: {item.total_score}</Text>
                      )}
                    </View>
                    <Text style={styles.responseDate}>
                      {t('assess.completed_date')}: {new Date(item.completed_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleViewResponse(item)} style={styles.viewBtn} activeOpacity={0.7}>
                    <Eye size={16} color={Colors.accent} />
                    <Text style={styles.viewBtnText}>{t('assess.view')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Clinical Tool Form Modal */}
      <Modal visible={toolFormVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setToolFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setToolFormVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingTool ? t('assess.edit_tool') : t('assess.add_tool')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.name_en')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={toolForm.name_en} onChangeText={(v) => setToolForm((p) => ({ ...p, name_en: v }))} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.name_zh')}</Text>
              <TextInput style={styles.input} value={toolForm.name_zh} onChangeText={(v) => setToolForm((p) => ({ ...p, name_zh: v }))} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.type')}</Text>
              <View style={styles.chipRow}>
                {(['clinician_rated', 'patient_self'] as AssessmentType[]).map((tp) => (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, toolForm.type === tp && styles.chipActive]}
                    onPress={() => setToolForm((p) => ({ ...p, type: tp }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, toolForm.type === tp && styles.chipTextActive]}>
                      {tp === 'clinician_rated' ? t('assess.type_clinician') : t('assess.type_patient')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.items_json')}</Text>
              <TextInput
                style={[styles.input, styles.codeArea]}
                value={toolForm.items_json}
                onChangeText={(v) => setToolForm((p) => ({ ...p, items_json: v }))}
                multiline
                textAlignVertical="top"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.scoring_config')}</Text>
              <TextInput
                style={[styles.input, styles.codeArea]}
                value={toolForm.scoring_config_json}
                onChangeText={(v) => setToolForm((p) => ({ ...p, scoring_config_json: v }))}
                multiline
                textAlignVertical="top"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.reference')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={toolForm.reference} onChangeText={(v) => setToolForm((p) => ({ ...p, reference: v }))} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.interpretation_en')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={toolForm.interpretation_en} onChangeText={(v) => setToolForm((p) => ({ ...p, interpretation_en: v }))} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.interpretation_zh')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={toolForm.interpretation_zh} onChangeText={(v) => setToolForm((p) => ({ ...p, interpretation_zh: v }))} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saveToolMutation.isPending && styles.saveBtnDisabled]} onPress={handleSaveTool} disabled={saveToolMutation.isPending} activeOpacity={0.8}>
              {saveToolMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Template Form Modal */}
      <Modal visible={templateFormVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTemplateFormVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setTemplateFormVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingTemplate ? t('assess.edit_template') : t('assess.add_template')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.template_name')} <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={templateForm.name} onChangeText={(v) => setTemplateForm((p) => ({ ...p, name: v }))} placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.desc_en')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={templateForm.description_en} onChangeText={(v) => setTemplateForm((p) => ({ ...p, description_en: v }))} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.desc_zh_hant')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={templateForm.description_zh_hant} onChangeText={(v) => setTemplateForm((p) => ({ ...p, description_zh_hant: v }))} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.desc_zh_hans')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={templateForm.description_zh_hans} onChangeText={(v) => setTemplateForm((p) => ({ ...p, description_zh_hans: v }))} multiline textAlignVertical="top" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.scoring_method')}</Text>
              <TextInput style={styles.input} value={templateForm.scoring_method} onChangeText={(v) => setTemplateForm((p) => ({ ...p, scoring_method: v }))} placeholder="sum / average" placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.questionsHeader}>
              <Text style={styles.sectionLabel}>{t('assess.questions')}</Text>
              <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion} activeOpacity={0.7}>
                <Plus size={14} color={Colors.white} />
                <Text style={styles.addQuestionText}>{t('assess.add_question')}</Text>
              </TouchableOpacity>
            </View>

            {templateForm.questions.length === 0 && (
              <Text style={styles.emptySmallText}>{t('assess.no_questions')}</Text>
            )}

            {templateForm.questions.map((q, qIdx) => (
              <View key={q.id} style={styles.questionBlock}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNum}>Q{qIdx + 1}</Text>
                  <TouchableOpacity onPress={() => removeQuestion(q.id)} style={styles.removeQuestionBtn}>
                    <X size={14} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.labelSmall}>{t('assess.question_type')}</Text>
                  <View style={styles.chipRow}>
                    {(['numeric_scale', 'single_choice'] as QuestionType[]).map((qt) => (
                      <TouchableOpacity
                        key={qt}
                        style={[styles.chipSmall, q.type === qt && styles.chipSmallActive]}
                        onPress={() => updateQuestion(q.id, 'type', qt)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipSmallText, q.type === qt && styles.chipSmallTextActive]}>
                          {qt === 'numeric_scale' ? t('assess.numeric_scale') : t('assess.single_choice')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.labelSmall}>{t('assess.question_text_en')}</Text>
                  <TextInput style={styles.inputSmall} value={q.text_en} onChangeText={(v) => updateQuestion(q.id, 'text_en', v)} placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.labelSmall}>{t('assess.question_text_zh_hant')}</Text>
                  <TextInput style={styles.inputSmall} value={q.text_zh_hant ?? ''} onChangeText={(v) => updateQuestion(q.id, 'text_zh_hant', v)} placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.labelSmall}>{t('assess.question_text_zh_hans')}</Text>
                  <TextInput style={styles.inputSmall} value={q.text_zh_hans ?? ''} onChangeText={(v) => updateQuestion(q.id, 'text_zh_hans', v)} placeholderTextColor={Colors.textTertiary} />
                </View>

                {q.type === 'numeric_scale' && (
                  <View style={styles.scaleRow}>
                    <View style={styles.scaleField}>
                      <Text style={styles.labelSmall}>{t('assess.scale_min')}</Text>
                      <TextInput style={styles.inputSmall} value={String(q.scale_min ?? 0)} onChangeText={(v) => updateQuestion(q.id, 'scale_min', parseInt(v, 10) || 0)} keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
                    </View>
                    <View style={styles.scaleField}>
                      <Text style={styles.labelSmall}>{t('assess.scale_max')}</Text>
                      <TextInput style={styles.inputSmall} value={String(q.scale_max ?? 5)} onChangeText={(v) => updateQuestion(q.id, 'scale_max', parseInt(v, 10) || 5)} keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
                    </View>
                  </View>
                )}

                {q.type === 'single_choice' && (
                  <View style={styles.choicesSection}>
                    <View style={styles.choicesHeader}>
                      <Text style={styles.labelSmall}>{t('assess.choices')}</Text>
                      <TouchableOpacity onPress={() => addChoice(q.id)} style={styles.addChoiceBtn} activeOpacity={0.7}>
                        <Plus size={12} color={Colors.accent} />
                      </TouchableOpacity>
                    </View>
                    {(q.choices ?? []).map((c, cIdx) => (
                      <View key={cIdx} style={styles.choiceRow}>
                        <TextInput style={[styles.inputSmall, styles.choiceValueInput]} value={c.value} onChangeText={(v) => updateChoice(q.id, cIdx, 'value', v)} placeholder={t('assess.choice_value')} placeholderTextColor={Colors.textTertiary} />
                        <TextInput style={[styles.inputSmall, styles.choiceLabelInput]} value={c.label_en} onChangeText={(v) => updateChoice(q.id, cIdx, 'label_en', v)} placeholder={t('assess.choice_label_en')} placeholderTextColor={Colors.textTertiary} />
                        <TouchableOpacity onPress={() => removeChoice(q.id, cIdx)} style={styles.removeChoiceBtn}>
                          <X size={12} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={[styles.saveBtn, saveTemplateMutation.isPending && styles.saveBtnDisabled]} onPress={handleSaveTemplate} disabled={saveTemplateMutation.isPending} activeOpacity={0.8}>
              {saveTemplateMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Assign Modal */}
      <Modal visible={assignModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAssignModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAssignModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{t('assess.assign_assessment')}</Text>
            <View style={styles.closeBtn} />
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.fieldGroup, { zIndex: 20 }]}>
              <Text style={styles.label}>{t('assess.select_patient')} <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => { setShowAssignPatientPicker(!showAssignPatientPicker); setShowAssignAssessmentPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !assignPatientId && styles.pickerPlaceholder]} numberOfLines={1}>
                  {assignPatientId ? getPatientName(assignPatientId) : t('assess.select_patient')}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {showAssignPatientPicker && (
                <View style={styles.pickerDropdown}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {patients.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.pickerItem, p.id === assignPatientId && styles.pickerItemActive]}
                        onPress={() => { setAssignPatientId(p.id); setShowAssignPatientPicker(false); }}
                      >
                        <Text style={[styles.pickerItemText, p.id === assignPatientId && styles.pickerItemTextActive]}>{p.patient_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={[styles.fieldGroup, { zIndex: 10 }]}>
              <Text style={styles.label}>{t('assess.select_assessment')} <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => { setShowAssignAssessmentPicker(!showAssignAssessmentPicker); setShowAssignPatientPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerBtnText, !assignAssessmentId && !assignTemplateId && styles.pickerPlaceholder]} numberOfLines={1}>
                  {assignAssessmentId
                    ? getAssessmentName(assignAssessmentId)
                    : assignTemplateId
                      ? getTemplateName(assignTemplateId)
                      : t('assess.select_assessment')}
                </Text>
                <ChevronDown size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              {showAssignAssessmentPicker && (
                <View style={styles.pickerDropdown}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {allAssessmentOptions.map((opt) => {
                      const isSelected = opt.isTool ? assignAssessmentId === opt.id : assignTemplateId === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                          onPress={() => {
                            if (opt.isTool) {
                              setAssignAssessmentId(opt.id);
                              setAssignTemplateId(null);
                            } else {
                              setAssignTemplateId(opt.id);
                              setAssignAssessmentId(null);
                            }
                            setShowAssignAssessmentPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>{opt.name}</Text>
                          <View style={[styles.miniTypeBadge, opt.isTool ? styles.miniTypeClinical : styles.miniTypeCustom]}>
                            <Text style={styles.miniTypeText}>{opt.isTool ? t('assess.clinical') : t('assess.custom')}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('assess.scheduled_date')}</Text>
              <TextInput style={styles.input} value={assignDate} onChangeText={setAssignDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
            </View>

            <TouchableOpacity style={[styles.saveBtn, assignMutation.isPending && styles.saveBtnDisabled]} onPress={handleConfirmAssign} disabled={assignMutation.isPending} activeOpacity={0.8}>
              {assignMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{t('assess.assign')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Response Detail Modal */}
      <Modal visible={responseModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setResponseModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setResponseModalVisible(false)} style={styles.closeBtn}><X size={20} color={Colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{t('assess.view_response')}</Text>
            <View style={styles.closeBtn} />
          </View>
          {renderResponseDetailModal()}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 5, backgroundColor: Colors.background },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
  tabActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  tabText: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  actionBar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' as const },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  emptySmallText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 16 },
  toolCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  toolInfo: { flex: 1 },
  toolName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  toolNameSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  toolMeta: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' },
  toolReference: { fontSize: 11, color: Colors.textTertiary, marginTop: 6, fontStyle: 'italic' as const },
  toolActions: { gap: 6, marginLeft: 8, alignItems: 'center' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeClinician: { backgroundColor: '#e0eef8' },
  typeBadgePatient: { backgroundColor: '#f0e8f5' },
  typeBadgeText: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  typeBadgeClinText: { color: '#3b7dc4' },
  typeBadgePatText: { color: '#8b5cc4' },
  itemCountBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  itemCountText: { fontSize: 10, fontWeight: '600' as const, color: Colors.textSecondary },
  scoringBadge: { backgroundColor: Colors.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoringBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.green },
  iconBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.inputBg },
  assignCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  assignInfo: { flex: 1, gap: 3 },
  assignPatient: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  assignAssessment: { fontSize: 13, color: Colors.textSecondary },
  assignDate: { fontSize: 11, color: Colors.textTertiary },
  assignActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusPending: { backgroundColor: '#fef3cd' },
  statusCompleted: { backgroundColor: Colors.greenLight },
  statusText: { fontSize: 10, fontWeight: '600' as const },
  statusPendingText: { color: '#856404' },
  statusCompletedText: { color: Colors.green },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accentLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  viewBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent },
  responseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  responseInfo: { flex: 1, gap: 3 },
  responsePatient: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  responseAssess: { fontSize: 13, color: Colors.textSecondary },
  responseMetaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  responseTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  responseTypeClinical: { backgroundColor: '#e0eef8' },
  responseTypeCustom: { backgroundColor: '#f0e8f5' },
  responseTypeBadgeText: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  responseTypeClinicalText: { color: '#3b7dc4' },
  responseTypeCustomText: { color: '#8b5cc4' },
  responseScore: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent },
  responseDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.card },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  modalBody: { flex: 1 },
  modalBodyContent: { paddingHorizontal: 20, paddingTop: 16 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 6 },
  labelSmall: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 4 },
  required: { color: Colors.danger },
  input: { backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  inputSmall: { backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  textArea: { minHeight: 70, paddingTop: 12 },
  codeArea: { minHeight: 120, paddingTop: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.borderLight },
  chipActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  chipText: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent, fontWeight: '600' as const },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.borderLight },
  chipSmallActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  chipSmallText: { fontSize: 12, fontWeight: '500' as const, color: Colors.textSecondary },
  chipSmallTextActive: { color: Colors.accent, fontWeight: '600' as const },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' as const },
  questionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  sectionLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  addQuestionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addQuestionText: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
  questionBlock: { backgroundColor: Colors.inputBg, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight },
  questionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  questionNum: { fontSize: 14, fontWeight: '700' as const, color: Colors.accent },
  removeQuestionBtn: { width: 26, height: 26, borderRadius: 6, backgroundColor: Colors.dangerLight, justifyContent: 'center', alignItems: 'center' },
  scaleRow: { flexDirection: 'row', gap: 10 },
  scaleField: { flex: 1 },
  choicesSection: { marginTop: 4 },
  choicesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  addChoiceBtn: { width: 26, height: 26, borderRadius: 6, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center' },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  choiceValueInput: { width: 50 },
  choiceLabelInput: { flex: 1 },
  removeChoiceBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.dangerLight, justifyContent: 'center', alignItems: 'center' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: Colors.borderLight },
  pickerBtnText: { fontSize: 15, color: Colors.text, flex: 1 },
  pickerPlaceholder: { color: Colors.textTertiary },
  pickerDropdown: { backgroundColor: Colors.card, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, zIndex: 20 },
  pickerScroll: { maxHeight: 220 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerItemActive: { backgroundColor: Colors.accentLight },
  pickerItemText: { fontSize: 14, fontWeight: '500' as const, color: Colors.text, flex: 1 },
  pickerItemTextActive: { color: Colors.accent, fontWeight: '600' as const },
  miniTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  miniTypeClinical: { backgroundColor: '#e0eef8' },
  miniTypeCustom: { backgroundColor: '#f0e8f5' },
  miniTypeText: { fontSize: 9, fontWeight: '700' as const, color: Colors.textSecondary, textTransform: 'uppercase' as const },
  responseHeader: { alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  responseAssessName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, textAlign: 'center', marginBottom: 12 },
  scoreCard: { backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  scoreBig: { fontSize: 40, fontWeight: '800' as const, color: Colors.accent },
  scoreLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginTop: 2 },
  severityBadge: { marginTop: 12, backgroundColor: Colors.accentLight, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  severityText: { fontSize: 14, fontWeight: '700' as const, color: Colors.accent },
  interpretBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 16 },
  interpretBoxSafe: { backgroundColor: Colors.greenLight },
  interpretBoxDanger: { backgroundColor: Colors.dangerLight },
  interpretBoxText: { fontSize: 13, fontWeight: '600' as const, flex: 1 },
  interpretSection: { marginBottom: 16 },
  interpretText: { fontSize: 14, color: Colors.text, lineHeight: 20, backgroundColor: Colors.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  subscaleSection: { marginBottom: 16 },
  subscaleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  subscaleItem: { backgroundColor: Colors.card, borderRadius: 10, padding: 12, alignItems: 'center', minWidth: 80, borderWidth: 1, borderColor: Colors.borderLight, flex: 1 },
  subscaleScore: { fontSize: 22, fontWeight: '700' as const, color: Colors.accent },
  subscaleLabel: { fontSize: 11, fontWeight: '500' as const, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  itemsSection: { marginBottom: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  itemScoreCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.card },
  itemScoreText: { fontSize: 14, fontWeight: '700' as const },
  itemTextWrap: { flex: 1 },
  itemNumber: { fontSize: 11, fontWeight: '600' as const, color: Colors.textTertiary },
  itemText: { fontSize: 13, color: Colors.text, marginTop: 2 },
  referenceSection: { backgroundColor: Colors.inputBg, borderRadius: 10, padding: 14, marginTop: 8 },
  referenceLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.textTertiary, textTransform: 'uppercase' as const, marginBottom: 4, letterSpacing: 0.5 },
  referenceText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, fontStyle: 'italic' as const },
  responsePatientLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  scoreMax: { fontSize: 14, color: Colors.textTertiary, marginTop: -4 },
  languageNote: { fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
  comparisonRow: { marginTop: 12, alignItems: 'center' as const, gap: 4 },
  comparisonLabel: { fontSize: 11, color: Colors.textTertiary },
  itemHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 2 },
  itemTextMissing: { fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic' as const, marginTop: 2 },
  choiceLabel: { fontSize: 11, color: Colors.green, marginTop: 2, fontWeight: '500' as const },
  dateInfoSection: { backgroundColor: Colors.inputBg, borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 8, gap: 4 },
  dateInfoText: { fontSize: 12, color: Colors.textSecondary },
});
