-- ============ 1. Roles ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nurse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'emergency_physician';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hospital_admin';
