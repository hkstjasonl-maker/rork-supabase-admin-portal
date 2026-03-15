export interface Exercise {
  id: string;
  title_en: string;
  title_zh_hant: string | null;
  title_zh_hans: string | null;
  vimeo_video_id: string | null;
  youtube_video_id: string | null;
  category: string | null;
  tags: string[] | null;
  default_duration_minutes: number | null;
  default_dosage: string | null;
  default_dosage_per_day: number | null;
  default_dosage_days_per_week: number | null;
  audio_instruction_url_en: string | null;
  audio_instruction_url_zh_hant: string | null;
  audio_instruction_url_zh_hans: string | null;
  narrative_audio_youtube_id: string | null;
  narrative_audio_youtube_id_zh_hant: string | null;
  narrative_audio_youtube_id_zh_hans: string | null;
  created_at: string;
}

export interface ExerciseFormData {
  title_en: string;
  title_zh_hant: string;
  title_zh_hans: string;
  vimeo_video_id: string;
  youtube_video_id: string;
  category: string;
  tags: string[];
  default_duration_minutes: number | null;
  default_dosage: string;
  default_dosage_per_day: number | null;
  default_dosage_days_per_week: number | null;
  audio_instruction_url_en: string;
  audio_instruction_url_zh_hant: string;
  audio_instruction_url_zh_hans: string;
  narrative_audio_youtube_id: string;
  narrative_audio_youtube_id_zh_hant: string;
  narrative_audio_youtube_id_zh_hans: string;
}

export function extractVimeoId(input: string): string {
  if (/^\d+$/.test(input.trim())) return input.trim();
  const match = input.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : input.trim();
}

export function extractYouTubeId(input: string): string {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : input.trim();
}
