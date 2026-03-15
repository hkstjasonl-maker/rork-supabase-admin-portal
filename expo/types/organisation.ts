export type OrganisationType = 'partner' | 'supporter';

export interface Organisation {
  id: string;
  name_en: string;
  name_zh: string | null;
  type: OrganisationType;
  logo_url: string | null;
  website: string | null;
  description_en: string | null;
  description_zh: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface OrganisationFormData {
  name_en: string;
  name_zh: string;
  type: OrganisationType;
  logo_url: string;
  website: string;
  description_en: string;
  description_zh: string;
  is_active: boolean;
  sort_order: string;
}
