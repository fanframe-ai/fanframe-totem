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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      consent_logs: {
        Row: {
          accepted_at: string
          consent_text: string
          consent_type: string
          id: string
          ip_address: string | null
          team_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_text: string
          consent_type?: string
          id?: string
          ip_address?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_text?: string
          consent_type?: string
          id?: string
          ip_address?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          avg_processing_time_ms: number | null
          created_at: string
          date: string
          failed_generations: number
          id: string
          successful_generations: number
          team_id: string | null
          total_generations: number
          unique_users: number
        }
        Insert: {
          avg_processing_time_ms?: number | null
          created_at?: string
          date: string
          failed_generations?: number
          id?: string
          successful_generations?: number
          team_id?: string | null
          total_generations?: number
          unique_users?: number
        }
        Update: {
          avg_processing_time_ms?: number | null
          created_at?: string
          date?: string
          failed_generations?: number
          id?: string
          successful_generations?: number
          team_id?: string | null
          total_generations?: number
          unique_users?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_queue: {
        Row: {
          background_asset_url: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          replicate_prediction_id: string | null
          result_image_url: string | null
          shirt_asset_url: string
          shirt_id: string
          started_at: string | null
          status: string
          team_id: string | null
          user_id: string | null
          user_image_url: string
        }
        Insert: {
          background_asset_url: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          replicate_prediction_id?: string | null
          result_image_url?: string | null
          shirt_asset_url: string
          shirt_id: string
          started_at?: string | null
          status?: string
          team_id?: string | null
          user_id?: string | null
          user_image_url: string
        }
        Update: {
          background_asset_url?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          replicate_prediction_id?: string | null
          result_image_url?: string | null
          shirt_asset_url?: string
          shirt_id?: string
          started_at?: string | null
          status?: string
          team_id?: string | null
          user_id?: string | null
          user_image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_queue_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          external_user_id: string | null
          id: string
          processing_time_ms: number | null
          shirt_id: string
          status: Database["public"]["Enums"]["generation_status"]
          team_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          external_user_id?: string | null
          id?: string
          processing_time_ms?: number | null
          shirt_id: string
          status?: Database["public"]["Enums"]["generation_status"]
          team_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          external_user_id?: string | null
          id?: string
          processing_time_ms?: number | null
          shirt_id?: string
          status?: Database["public"]["Enums"]["generation_status"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          response_time_ms: number | null
          service_id: string
          service_name: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_id: string
          service_name: string
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_id?: string
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          created_at: string
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          team_id: string | null
          type: Database["public"]["Enums"]["alert_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          team_id?: string | null
          type: Database["public"]["Enums"]["alert_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          team_id?: string | null
          type?: Database["public"]["Enums"]["alert_type"]
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          backgrounds: Json
          created_at: string | null
          generation_prompt: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          replicate_api_token: string | null
          secondary_color: string | null
          shirts: Json
          slug: string
          subdomain: string
          text_overrides: Json | null
          tutorial_assets: Json | null
          updated_at: string | null
          watermark_url: string | null
        }
        Insert: {
          backgrounds?: Json
          created_at?: string | null
          generation_prompt?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          replicate_api_token?: string | null
          secondary_color?: string | null
          shirts?: Json
          slug: string
          subdomain: string
          text_overrides?: Json | null
          tutorial_assets?: Json | null
          updated_at?: string | null
          watermark_url?: string | null
        }
        Update: {
          backgrounds?: Json
          created_at?: string | null
          generation_prompt?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          replicate_api_token?: string | null
          secondary_color?: string | null
          shirts?: Json
          slug?: string
          subdomain?: string
          text_overrides?: Json | null
          tutorial_assets?: Json | null
          updated_at?: string | null
          watermark_url?: string | null
        }
        Relationships: []
      }
      test_links: {
        Row: {
          created_at: string
          created_by: string | null
          credits_total: number
          credits_used: number
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credits_total?: number
          credits_used?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credits_total?: number
          credits_used?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      health_check_stats: {
        Row: {
          avg_response_time: number | null
          last_check: string | null
          operational_checks: number | null
          service_id: string | null
          service_name: string | null
          total_checks: number | null
          uptime_percentage: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_health_checks: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      alert_type: "error_spike" | "slow_processing" | "high_usage" | "api_error"
      app_role: "admin" | "super_admin"
      generation_status: "pending" | "processing" | "completed" | "failed"
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
      alert_severity: ["info", "warning", "critical"],
      alert_type: ["error_spike", "slow_processing", "high_usage", "api_error"],
      app_role: ["admin", "super_admin"],
      generation_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
