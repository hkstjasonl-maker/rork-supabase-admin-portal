export type NotificationType = 'announcement' | 'festive' | 'poster' | 'video' | 'link';
export type TargetType = 'all' | 'specific';

export interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: NotificationType;
  image_url: string | null;
  link_url: string | null;
  target_type: TargetType;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NotificationFormData {
  title: string;
  message: string;
  type: NotificationType;
  image_url: string;
  link_url: string;
  target_type: TargetType;
  start_date: string;
  end_date: string;
  is_active: boolean;
  target_patient_ids: string[];
}

export interface NotificationTarget {
  id: string;
  notification_id: string;
  patient_id: string;
  created_at: string;
}
