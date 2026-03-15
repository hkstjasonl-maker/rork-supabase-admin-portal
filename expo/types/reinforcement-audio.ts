export interface ReinforcementAudio {
  id: string;
  name_en: string;
  name_zh: string | null;
  youtube_id: string | null;
  description: string | null;
  is_default: boolean;
  audio_url_en: string | null;
  audio_url_zh_hant: string | null;
  audio_url_zh_hans: string | null;
  created_at: string;
}

export interface ReinforcementAudioFormData {
  name_en: string;
  name_zh: string;
  youtube_id: string;
  description: string;
  is_default: boolean;
  audio_url_en: string;
  audio_url_zh_hant: string;
  audio_url_zh_hans: string;
}

export interface PatientAudioAssignment {
  id: string;
  patient_id: string;
  audio_id: string | null;
  created_at: string;
}
