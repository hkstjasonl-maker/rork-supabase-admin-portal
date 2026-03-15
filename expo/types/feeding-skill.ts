export type FeedingSkillCategory =
  | 'texture_modified'
  | 'thickened_fluids'
  | 'positioning'
  | 'feeding_technique'
  | 'oral_care'
  | 'safety_signs'
  | 'other';

export interface FeedingSkillVideo {
  id: string;
  title_en: string;
  title_zh: string | null;
  description_en: string | null;
  description_zh: string | null;
  creator_name_en: string | null;
  creator_name_zh: string | null;
  category: FeedingSkillCategory;
  vimeo_video_id: string | null;
  youtube_video_id: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface FeedingSkillVideoFormData {
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  creator_name_en: string;
  creator_name_zh: string;
  category: FeedingSkillCategory;
  vimeo_video_id: string;
  youtube_video_id: string;
  tags: string[];
}

export interface FeedingSkillAssignment {
  id: string;
  video_id: string;
  patient_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_viewed: boolean;
  created_at: string;
}

export interface FeedingSkillReviewRequirement {
  id: string;
  program_id: string;
  feeding_skill_title_en: string;
  max_submissions: number;
  allowed_days: string[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FeedingSkillVideoSubmission {
  id: string;
  program_id: string;
  feeding_skill_title_en: string;
  submitted_at: string;
  video_url: string;
  storage_path: string | null;
  status: 'pending' | 'reviewed' | 'redo_requested';
  rating: number | null;
  reviewer_notes: string | null;
  created_at: string;
}
