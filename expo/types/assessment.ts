export type AssessmentType = 'clinician_rated' | 'patient_self';

export interface AssessmentItem {
  id: string;
  number: number;
  text_en: string;
  text_zh?: string;
  domain?: string;
  max_score?: number;
}

export interface ScoringConfig {
  max_total?: number;
  cutoff?: number;
  severity_levels?: { label_en: string; label_zh?: string; min: number; max: number; color?: string }[];
  domains?: { key: string; label_en: string; label_zh?: string; item_ids: string[] }[];
}

export interface AssessmentLibraryItem {
  id: string;
  name_en: string;
  name_zh: string | null;
  type: AssessmentType;
  items: AssessmentItem[];
  scoring_config: ScoringConfig | null;
  reference: string | null;
  interpretation_en: string | null;
  interpretation_zh: string | null;
  created_at: string;
}

export interface AssessmentLibraryFormData {
  name_en: string;
  name_zh: string;
  type: AssessmentType;
  items_json: string;
  scoring_config_json: string;
  reference: string;
  interpretation_en: string;
  interpretation_zh: string;
}

export type QuestionType = 'numeric_scale' | 'single_choice';

export interface TemplateQuestion {
  id: string;
  type: QuestionType;
  text_en: string;
  text_zh_hant?: string;
  text_zh_hans?: string;
  scale_min?: number;
  scale_max?: number;
  choices?: { value: string; label_en: string; label_zh_hant?: string; label_zh_hans?: string }[];
}

export interface QuestionnaireTemplate {
  id: string;
  name: string;
  description_en: string | null;
  description_zh_hant: string | null;
  description_zh_hans: string | null;
  scoring_method: string | null;
  questions: TemplateQuestion[];
  created_at: string;
}

export interface QuestionnaireTemplateFormData {
  name: string;
  description_en: string;
  description_zh_hant: string;
  description_zh_hans: string;
  scoring_method: string;
  questions: TemplateQuestion[];
}

export type SubmissionStatus = 'pending' | 'completed';

export interface AssessmentSubmission {
  id: string;
  patient_id: string;
  assessment_id: string | null;
  template_id: string | null;
  status: SubmissionStatus;
  scheduled_date: string | null;
  total_score: number | null;
  severity_rating: string | null;
  responses: Record<string, number | string> | null;
  subscale_scores: Record<string, number> | null;
  completed_at: string | null;
  created_at: string;
}

export interface QuestionnaireResponse {
  id: string;
  patient_id: string;
  template_id: string;
  responses: Record<string, number | string>;
  total_score: number | null;
  completed_at: string;
  created_at: string;
}
