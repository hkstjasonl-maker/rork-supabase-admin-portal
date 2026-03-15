export type KnowledgeVideoCategory = 'educational' | 'condition_knowledge' | 'caregiver_guidance' | 'other';
export type KnowledgeVideoVisibility = 'public' | 'push_only';

export interface KnowledgeVideo {
  id: string;
  title_en: string;
  title_zh: string | null;
  description_en: string | null;
  description_zh: string | null;
  creator_name_en: string | null;
  creator_name_zh: string | null;
  creator_photo_url: string | null;
  category: KnowledgeVideoCategory;
  visibility: KnowledgeVideoVisibility;
  vimeo_video_id: string | null;
  youtube_video_id: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface KnowledgeVideoFormData {
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  creator_name_en: string;
  creator_name_zh: string;
  creator_photo_url: string;
  category: KnowledgeVideoCategory;
  visibility: KnowledgeVideoVisibility;
  vimeo_video_id: string;
  youtube_video_id: string;
  tags: string[];
}

export interface KnowledgeVideoAssignment {
  id: string;
  video_id: string;
  patient_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_viewed: boolean;
  created_at: string;
}
