export interface ExerciseProgram {
  id: string;
  patient_id: string;
  issue_date: string | null;
  expiry_date: string | null;
  remarks: string | null;
  created_at: string;
}

export interface ProgramExercise {
  id: string;
  program_id: string;
  title_en: string;
  title_zh_hant: string | null;
  title_zh_hans: string | null;
  vimeo_video_id: string | null;
  youtube_video_id: string | null;
  audio_instruction_url_en: string | null;
  audio_instruction_url_zh_hant: string | null;
  audio_instruction_url_zh_hans: string | null;
  audio_transcript_en: string | null;
  audio_transcript_zh_hant: string | null;
  audio_transcript_zh_hans: string | null;
  narrative_audio_youtube_id: string | null;
  narrative_audio_youtube_id_zh_hant: string | null;
  narrative_audio_youtube_id_zh_hans: string | null;
  duration_minutes: number | null;
  dosage: string | null;
  dosage_zh_hant: string | null;
  dosage_zh_hans: string | null;
  dosage_per_day: number | null;
  dosage_days_per_week: number | null;
  category: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProgramObjective {
  id: string;
  program_id: string;
  objective_en: string;
  objective_zh_hant: string | null;
  objective_zh_hans: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ReviewRequirement {
  id: string;
  program_id: string;
  exercise_title_en: string;
  max_submissions: number;
  allowed_days: string[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VideoSubmission {
  id: string;
  program_id: string;
  exercise_title_en: string;
  submitted_at: string;
  video_url: string;
  storage_path: string | null;
  status: 'pending' | 'reviewed' | 'redo_requested';
  rating: number | null;
  reviewer_notes: string | null;
  created_at: string;
}

export interface ProgramBuilderExercise {
  temp_id: string;
  title_en: string;
  title_zh_hant: string;
  title_zh_hans: string;
  vimeo_video_id: string;
  youtube_video_id: string;
  audio_instruction_url_en: string;
  audio_instruction_url_zh_hant: string;
  audio_instruction_url_zh_hans: string;
  audio_transcript_en: string;
  audio_transcript_zh_hant: string;
  audio_transcript_zh_hans: string;
  narrative_audio_youtube_id: string;
  narrative_audio_youtube_id_zh_hant: string;
  narrative_audio_youtube_id_zh_hans: string;
  duration_minutes: number | null;
  dosage: string;
  dosage_zh_hant: string;
  dosage_zh_hans: string;
  dosage_per_day: number | null;
  dosage_days_per_week: number | null;
  category: string;
  sort_order: number;
}
