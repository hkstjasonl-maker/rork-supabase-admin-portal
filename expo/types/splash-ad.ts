export type TargetType = 'all' | 'specific';

export interface SplashAd {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  duration_seconds: number;
  target_type: TargetType;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_at: string;
}

export interface SplashAdFormData {
  title: string;
  image_url: string;
  link_url: string;
  duration_seconds: number;
  target_type: TargetType;
  is_active: boolean;
  start_date: string;
  end_date: string;
  sort_order: string;
  target_patient_ids: string[];
}

export interface SplashAdTarget {
  id: string;
  splash_ad_id: string;
  patient_id: string;
  created_at: string;
}
