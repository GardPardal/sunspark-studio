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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      conversion_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          lead_id: string | null
          platform: string
          response: Json | null
          status: string
          value: number | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          lead_id?: string | null
          platform: string
          response?: Json | null
          status: string
          value?: number | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          lead_id?: string | null
          platform?: string
          response?: Json | null
          status?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          created_at: string
          id: string
          items_imported: number
          items_updated: number
          message: string | null
          provider: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items_imported?: number
          items_updated?: number
          message?: string | null
          provider: string
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items_imported?: number
          items_updated?: number
          message?: string | null
          provider?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          cidade: string | null
          created_at: string
          email: string | null
          estado: string | null
          external_id: string | null
          external_source: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          id: string
          last_synced_at: string | null
          mensagem: string | null
          nome: string
          origem: string | null
          page_url: string | null
          pipeline_id: number | null
          pipeline_stage_id: number | null
          referrer: string | null
          sale_notes: string | null
          sale_value: number | null
          stage: Database["public"]["Enums"]["lead_stage"]
          stage_updated_at: string | null
          telefone: string
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_conta: string | null
        }
        Insert: {
          assigned_to?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          external_id?: string | null
          external_source?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          last_synced_at?: string | null
          mensagem?: string | null
          nome: string
          origem?: string | null
          page_url?: string | null
          pipeline_id?: number | null
          pipeline_stage_id?: number | null
          referrer?: string | null
          sale_notes?: string | null
          sale_value?: number | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stage_updated_at?: string | null
          telefone: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_conta?: string | null
        }
        Update: {
          assigned_to?: string | null
          cidade?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          external_id?: string | null
          external_source?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          last_synced_at?: string | null
          mensagem?: string | null
          nome?: string
          origem?: string | null
          page_url?: string | null
          pipeline_id?: number | null
          pipeline_stage_id?: number | null
          referrer?: string | null
          sale_notes?: string | null
          sale_value?: number | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stage_updated_at?: string | null
          telefone?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_conta?: string | null
        }
        Relationships: []
      }
      ploomes_pipelines: {
        Row: {
          id: number
          name: string
          stages: Json
          synced_at: string
        }
        Insert: {
          id: number
          name: string
          stages?: Json
          synced_at?: string
        }
        Update: {
          id?: number
          name?: string
          stages?: Json
          synced_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          roles: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "consultor"
      lead_stage:
        | "novo"
        | "atendimento"
        | "nao_atendido"
        | "venda"
        | "faturado"
        | "perdido"
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
      app_role: ["admin", "user", "consultor"],
      lead_stage: [
        "novo",
        "atendimento",
        "nao_atendido",
        "venda",
        "faturado",
        "perdido",
      ],
    },
  },
} as const
