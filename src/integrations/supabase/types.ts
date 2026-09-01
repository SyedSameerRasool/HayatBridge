export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          at: string
          created_at: string
          device: string | null
          fields_viewed: string[]
          id: string
          patient_id: string
          role: string
          token_id: string | null
          viewer: string
        }
        Insert: {
          at?: string
          created_at?: string
          device?: string | null
          fields_viewed?: string[]
          id?: string
          patient_id: string
          role: string
          token_id?: string | null
          viewer: string
        }
        Update: {
          at?: string
          created_at?: string
          device?: string | null
          fields_viewed?: string[]
          id?: string
          patient_id?: string
          role?: string
          token_id?: string | null
          viewer?: string
        }
        Relationships: []
      }
      access_requests: {
        Row: {
          clinician_id: string
          clinician_name: string
          clinician_role: string
          created_at: string
          decided_at: string | null
          department: string
          expires_at: string | null
          hospital: string
          id: string
          license_no: string
          patient_id: string
          requested_at: string
          status: string
          token_id: string
          updated_at: string
        }
        Insert: {
          clinician_id: string
          clinician_name: string
          clinician_role: string
          created_at?: string
          decided_at?: string | null
          department?: string
          expires_at?: string | null
          hospital?: string
          id?: string
          license_no?: string
          patient_id: string
          requested_at?: string
          status?: string
          token_id: string
          updated_at?: string
        }
        Update: {
          clinician_id?: string
          clinician_name?: string
          clinician_role?: string
          created_at?: string
          decided_at?: string | null
          department?: string
          expires_at?: string | null
          hospital?: string
          id?: string
          license_no?: string
          patient_id?: string
          requested_at?: string
          status?: string
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "share_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_logs: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string
          created_at: string
          details: string | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_preferences: {
        Row: {
          email_notifications: boolean
          two_factor: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_notifications?: boolean
          two_factor?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_notifications?: boolean
          two_factor?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      allergies: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          reaction: string | null
          severity: string
          substance: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          reaction?: string | null
          severity?: string
          substance: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          reaction?: string | null
          severity?: string
          substance?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          created_at: string
          name: string
          value: string
        }
        Insert: {
          created_at?: string
          name: string
          value: string
        }
        Update: {
          created_at?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          location: string | null
          notes: string | null
          patient_id: string
          provider_name: string
          scheduled_at: string
          specialty: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          patient_id: string
          provider_name: string
          scheduled_at: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          patient_id?: string
          provider_name?: string
          scheduled_at?: string
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          patient_id: string | null
          record_id: string | null
          session_ref: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          record_id?: string | null
          session_ref?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          record_id?: string | null
          session_ref?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string
        }
        Relationships: []
      }
      billing_preferences: {
        Row: {
          delivery_email: string | null
          paperless: boolean
          patient_id: string
          updated_at: string
        }
        Insert: {
          delivery_email?: string | null
          paperless?: boolean
          patient_id: string
          updated_at?: string
        }
        Update: {
          delivery_email?: string | null
          paperless?: boolean
          patient_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_statements: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          due_date: string | null
          id: string
          issued_at: string
          paid_at: string | null
          patient_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          issued_at?: string
          paid_at?: string | null
          patient_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          issued_at?: string
          paid_at?: string | null
          patient_id?: string
          status?: string
        }
        Relationships: []
      }
      clinical_notes: {
        Row: {
          author_id: string | null
          author_name: string
          author_role: string
          created_at: string
          encounter_date: string
          id: string
          note: string
          note_type: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          author_role?: string
          created_at?: string
          encounter_date?: string
          id?: string
          note: string
          note_type?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          author_role?: string
          created_at?: string
          encounter_date?: string
          id?: string
          note?: string
          note_type?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinicians: {
        Row: {
          created_at: string
          department: string
          full_name: string
          hospital: string
          license_no: string
          professional_role: string
          updated_at: string
          user_id: string
          verification_status: string
          verified: boolean
          verified_at: string | null
          work_email: string | null
        }
        Insert: {
          created_at?: string
          department?: string
          full_name: string
          hospital?: string
          license_no?: string
          professional_role?: string
          updated_at?: string
          user_id: string
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          work_email?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          full_name?: string
          hospital?: string
          license_no?: string
          professional_role?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
          verified?: boolean
          verified_at?: string | null
          work_email?: string | null
        }
        Relationships: []
      }
      diagnoses: {
        Row: {
          condition: string
          created_at: string
          diagnosed_date: string | null
          icd10_code: string | null
          id: string
          notes: string | null
          onset_date: string | null
          patient_id: string
          provider: string | null
          resolved_date: string | null
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          condition: string
          created_at?: string
          diagnosed_date?: string | null
          icd10_code?: string | null
          id?: string
          notes?: string | null
          onset_date?: string | null
          patient_id: string
          provider?: string | null
          resolved_date?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          diagnosed_date?: string | null
          icd10_code?: string | null
          id?: string
          notes?: string | null
          onset_date?: string | null
          patient_id?: string
          provider?: string | null
          resolved_date?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          patient_id: string
          phone: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          patient_id: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          patient_id?: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          id: string
          message: string
          patient_id: string
          replied_at: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          patient_id: string
          replied_at?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          patient_id?: string
          replied_at?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      fhir_resource_map: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          local_id: string
          local_table: string
          patient_id: string | null
          resource_id: string | null
          resource_type: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          local_id: string
          local_table: string
          patient_id?: string | null
          resource_id?: string | null
          resource_type: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          local_id?: string
          local_table?: string
          patient_id?: string | null
          resource_id?: string | null
          resource_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      imaging_reports: {
        Row: {
          body_part: string | null
          created_at: string
          facility: string | null
          findings: string | null
          id: string
          impression: string | null
          modality: string
          ordering_provider: string | null
          patient_id: string
          performed_on: string | null
          report_url: string | null
          updated_at: string
        }
        Insert: {
          body_part?: string | null
          created_at?: string
          facility?: string | null
          findings?: string | null
          id?: string
          impression?: string | null
          modality: string
          ordering_provider?: string | null
          patient_id: string
          performed_on?: string | null
          report_url?: string | null
          updated_at?: string
        }
        Update: {
          body_part?: string | null
          created_at?: string
          facility?: string | null
          findings?: string | null
          id?: string
          impression?: string | null
          modality?: string
          ordering_provider?: string | null
          patient_id?: string
          performed_on?: string | null
          report_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      interop_endpoints: {
        Row: {
          base_url: string | null
          config: Json
          created_at: string
          id: string
          kind: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json
          created_at?: string
          id?: string
          kind?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json
          created_at?: string
          id?: string
          kind?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      interop_identifiers: {
        Row: {
          assigner: string | null
          created_at: string
          id: string
          patient_id: string
          system: string
          updated_at: string
          use: string
          value: string
        }
        Insert: {
          assigner?: string | null
          created_at?: string
          id?: string
          patient_id: string
          system: string
          updated_at?: string
          use?: string
          value: string
        }
        Update: {
          assigner?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          system?: string
          updated_at?: string
          use?: string
          value?: string
        }
        Relationships: []
      }
      interop_messages: {
        Row: {
          created_at: string
          direction: string
          endpoint_id: string | null
          error: string | null
          id: string
          message_type: string
          patient_id: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          direction?: string
          endpoint_id?: string | null
          error?: string | null
          id?: string
          message_type: string
          patient_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          endpoint_id?: string | null
          error?: string | null
          id?: string
          message_type?: string
          patient_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "interop_messages_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "interop_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_history: {
        Row: {
          category: string
          created_at: string
          details: string | null
          id: string
          item: string
          occurred_on: string | null
          patient_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          details?: string | null
          id?: string
          item: string
          occurred_on?: string | null
          patient_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string | null
          id?: string
          item?: string
          occurred_on?: string | null
          patient_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_history: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_name: string
          changed_by_role: string
          created_at: string
          details: string | null
          id: string
          medication_id: string | null
          medication_name: string
          occurred_at: string
          patient_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_name?: string
          changed_by_role?: string
          created_at?: string
          details?: string | null
          id?: string
          medication_id?: string | null
          medication_name: string
          occurred_at?: string
          patient_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_name?: string
          changed_by_role?: string
          created_at?: string
          details?: string | null
          id?: string
          medication_id?: string | null
          medication_name?: string
          occurred_at?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_history_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          created_at: string
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          name: string
          notes: string | null
          patient_id: string
          prescriber: string | null
          reason: string | null
          route: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          patient_id: string
          prescriber?: string | null
          reason?: string | null
          route?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          patient_id?: string
          prescriber?: string | null
          reason?: string | null
          route?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          patient_id: string
          provider_name: string | null
          read_at: string | null
          sender: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          patient_id: string
          provider_name?: string | null
          read_at?: string | null
          sender: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          patient_id?: string
          provider_name?: string | null
          read_at?: string | null
          sender?: string
          subject?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          created_at: string
          facility: string | null
          id: string
          name: string
          notes: string | null
          outcome: string | null
          patient_id: string
          performed_on: string | null
          provider: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          facility?: string | null
          id?: string
          name: string
          notes?: string | null
          outcome?: string | null
          patient_id: string
          performed_on?: string | null
          provider?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          facility?: string | null
          id?: string
          name?: string
          notes?: string | null
          outcome?: string | null
          patient_id?: string
          performed_on?: string | null
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          allergies: string | null
          blood_type: string | null
          cnic: string | null
          cnic_enc: string | null
          cnic_hash: string | null
          consent_expires_at: string | null
          consent_fields: string[]
          consent_revoked: boolean
          consent_updated_at: string
          created_at: string
          date_of_birth: string | null
          diagnoses: string | null
          email: string
          emergency_contact: string | null
          full_name: string
          id: string
          initial_setup_completed: boolean
          initial_setup_completed_at: string | null
          last_login_at: string | null
          medications: string | null
          notes: string | null
          phone: string | null
          recent_reports: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          allergies?: string | null
          blood_type?: string | null
          cnic?: string | null
          cnic_enc?: string | null
          cnic_hash?: string | null
          consent_expires_at?: string | null
          consent_fields?: string[]
          consent_revoked?: boolean
          consent_updated_at?: string
          created_at?: string
          date_of_birth?: string | null
          diagnoses?: string | null
          email: string
          emergency_contact?: string | null
          full_name?: string
          id: string
          initial_setup_completed?: boolean
          initial_setup_completed_at?: string | null
          last_login_at?: string | null
          medications?: string | null
          notes?: string | null
          phone?: string | null
          recent_reports?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          allergies?: string | null
          blood_type?: string | null
          cnic?: string | null
          cnic_enc?: string | null
          cnic_hash?: string | null
          consent_expires_at?: string | null
          consent_fields?: string[]
          consent_revoked?: boolean
          consent_updated_at?: string
          created_at?: string
          date_of_birth?: string | null
          diagnoses?: string | null
          email?: string
          emergency_contact?: string | null
          full_name?: string
          id?: string
          initial_setup_completed?: boolean
          initial_setup_completed_at?: string | null
          last_login_at?: string | null
          medications?: string | null
          notes?: string | null
          phone?: string | null
          recent_reports?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questionnaire_responses: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          patient_id: string
          responses: Json
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          patient_id: string
          responses: Json
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          patient_id?: string
          responses?: Json
        }
        Relationships: []
      }
      share_tokens: {
        Row: {
          created_at: string
          expires_at: string
          fields: string[]
          id: string
          patient_id: string
          revoked: boolean
          role: string
          token_value: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          fields?: string[]
          id?: string
          patient_id: string
          revoked?: boolean
          role: string
          token_value: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          fields?: string[]
          id?: string
          patient_id?: string
          revoked?: boolean
          role?: string
          token_value?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      test_results: {
        Row: {
          category: string | null
          created_at: string
          flag: string | null
          id: string
          ordering_provider: string | null
          patient_id: string
          patient_notes: string | null
          reference_range: string | null
          report_url: string | null
          resulted_at: string
          source: string
          test_name: string
          unit: string | null
          value: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          ordering_provider?: string | null
          patient_id: string
          patient_notes?: string | null
          reference_range?: string | null
          report_url?: string | null
          resulted_at?: string
          source?: string
          test_name: string
          unit?: string | null
          value: string
        }
        Update: {
          category?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          ordering_provider?: string | null
          patient_id?: string
          patient_notes?: string | null
          reference_range?: string | null
          report_url?: string | null
          resulted_at?: string
          source?: string
          test_name?: string
          unit?: string | null
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vaccinations: {
        Row: {
          administered_on: string | null
          created_at: string
          dose_number: number | null
          id: string
          lot_number: string | null
          notes: string | null
          patient_id: string
          provider: string | null
          updated_at: string
          vaccine_name: string
        }
        Insert: {
          administered_on?: string | null
          created_at?: string
          dose_number?: number | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          patient_id: string
          provider?: string | null
          updated_at?: string
          vaccine_name: string
        }
        Update: {
          administered_on?: string | null
          created_at?: string
          dose_number?: number | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          patient_id?: string
          provider?: string | null
          updated_at?: string
          vaccine_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_clinical: { Args: { _patient_id: string }; Returns: boolean }
      can_write_medication_notes: {
        Args: { _patient_id: string }
        Returns: boolean
      }
      current_actor_role: { Args: never; Returns: string }
      has_active_access: { Args: { _patient_id: string }; Returns: boolean }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_prescriber: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _patient_id?: string
          _record_id?: string
          _table_name?: string
        }
        Returns: undefined
      }
      my_clinician_role: { Args: never; Returns: string }
      phi_decrypt: { Args: { _v: string }; Returns: string }
      phi_encrypt: { Args: { _v: string }; Returns: string }
      phi_hash: { Args: { _v: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "patient"
        | "doctor"
        | "admin"
        | "pharmacist"
        | "nurse"
        | "emergency_physician"
        | "hospital_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "patient",
        "doctor",
        "admin",
        "pharmacist",
        "nurse",
        "emergency_physician",
        "hospital_admin",
      ],
    },
  },
} as const
