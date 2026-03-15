export interface Patient {
  id: string;
  patient_name: string;
  access_code: string;
  diagnosis: string | null;
  is_active: boolean;
  is_frozen: boolean;
  created_at: string;
}

export interface PatientFormData {
  patient_name: string;
  access_code: string;
  diagnosis: string;
  is_active: boolean;
  is_frozen: boolean;
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
