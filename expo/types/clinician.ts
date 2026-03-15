export interface Clinician {
  id: string;
  full_name: string;
  email: string;
  password_hash: string | null;
  organization: string | null;
  max_patients: number;
  max_exercises: number;
  max_feeding_videos: number;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface ClinicianFormData {
  full_name: string;
  email: string;
  password: string;
  organization: string;
  max_patients: string;
  max_exercises: string;
  max_feeding_videos: string;
  is_active: boolean;
  is_approved: boolean;
}

export interface SharedExercise {
  id: string;
  exercise_id: string;
  clinician_id: string;
  exercise_title_en: string | null;
  clinician_name: string | null;
  created_at: string;
}

export interface SharedAssessment {
  id: string;
  assessment_id: string;
  clinician_id: string;
  assessment_name_en: string | null;
  clinician_name: string | null;
  created_at: string;
}
