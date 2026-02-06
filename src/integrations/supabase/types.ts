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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      jobs: {
        Row: {
          completed_submissions: number | null
          completion_email_sent: boolean | null
          created_at: string
          file_name: string | null
          id: string
          job_id: string
          status: string
          total_submissions: number | null
          updated_at: string
          user_email: string
        }
        Insert: {
          completed_submissions?: number | null
          completion_email_sent?: boolean | null
          created_at?: string
          file_name?: string | null
          id?: string
          job_id: string
          status?: string
          total_submissions?: number | null
          updated_at?: string
          user_email: string
        }
        Update: {
          completed_submissions?: number | null
          completion_email_sent?: boolean | null
          created_at?: string
          file_name?: string | null
          id?: string
          job_id?: string
          status?: string
          total_submissions?: number | null
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          admin_course_verification: string | null
          admin_override: string | null
          admin_student_verification: string | null
          course_match_auto: string | null
          course_match_reason: string | null
          coursera_link: string | null
          coursera_link_duplicate: boolean | null
          created_at: string
          error_message: string | null
          final_decision: string | null
          id: string
          job_id: string
          linkedin_link: string | null
          linkedin_link_duplicate: boolean | null
          processing_status: string | null
          roll_number: string
          scraped_coursera_name: string | null
          scraped_coursera_project: string | null
          scraped_linkedin_name: string | null
          scraped_linkedin_text: string | null
          student_match_auto: string | null
          student_match_reason: string | null
          student_name: string
          updated_at: string
        }
        Insert: {
          admin_course_verification?: string | null
          admin_override?: string | null
          admin_student_verification?: string | null
          course_match_auto?: string | null
          course_match_reason?: string | null
          coursera_link?: string | null
          coursera_link_duplicate?: boolean | null
          created_at?: string
          error_message?: string | null
          final_decision?: string | null
          id?: string
          job_id: string
          linkedin_link?: string | null
          linkedin_link_duplicate?: boolean | null
          processing_status?: string | null
          roll_number: string
          scraped_coursera_name?: string | null
          scraped_coursera_project?: string | null
          scraped_linkedin_name?: string | null
          scraped_linkedin_text?: string | null
          student_match_auto?: string | null
          student_match_reason?: string | null
          student_name: string
          updated_at?: string
        }
        Update: {
          admin_course_verification?: string | null
          admin_override?: string | null
          admin_student_verification?: string | null
          course_match_auto?: string | null
          course_match_reason?: string | null
          coursera_link?: string | null
          coursera_link_duplicate?: boolean | null
          created_at?: string
          error_message?: string | null
          final_decision?: string | null
          id?: string
          job_id?: string
          linkedin_link?: string | null
          linkedin_link_duplicate?: boolean | null
          processing_status?: string | null
          roll_number?: string
          scraped_coursera_name?: string | null
          scraped_coursera_project?: string | null
          scraped_linkedin_name?: string | null
          scraped_linkedin_text?: string | null
          student_match_auto?: string | null
          student_match_reason?: string | null
          student_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
