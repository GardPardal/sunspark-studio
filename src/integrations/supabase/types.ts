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
      cadence_steps: {
        Row: {
          active: boolean
          channel: string
          created_at: string
          day_offset: number
          description: string | null
          id: string
          ordem: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel?: string
          created_at?: string
          day_offset?: number
          description?: string | null
          id?: string
          ordem?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: string
          created_at?: string
          day_offset?: number
          description?: string | null
          id?: string
          ordem?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      lead_cadence_tasks: {
        Row: {
          channel: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_at: string
          id: string
          lead_id: string
          notes: string | null
          step_id: string | null
          title: string
        }
        Insert: {
          channel?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_at: string
          id?: string
          lead_id: string
          notes?: string | null
          step_id?: string | null
          title: string
        }
        Update: {
          channel?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          step_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_cadence_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadence_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "cadence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_transfers: {
        Row: {
          created_at: string
          from_user: string | null
          id: string
          lead_id: string
          performed_by: string | null
          reason: string | null
          to_user: string | null
        }
        Insert: {
          created_at?: string
          from_user?: string | null
          id?: string
          lead_id: string
          performed_by?: string | null
          reason?: string | null
          to_user?: string | null
        }
        Update: {
          created_at?: string
          from_user?: string | null
          id?: string
          lead_id?: string
          performed_by?: string | null
          reason?: string | null
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_transfers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          captacao_metodo: string | null
          cidade: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estado: string | null
          external_id: string | null
          external_source: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          id: string
          is_offline: boolean
          last_synced_at: string | null
          mensagem: string | null
          nome: string
          origem: string | null
          page_url: string | null
          pipeline_id: number | null
          pipeline_stage_id: number | null
          produto_interesse: string | null
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
          captacao_metodo?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estado?: string | null
          external_id?: string | null
          external_source?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          is_offline?: boolean
          last_synced_at?: string | null
          mensagem?: string | null
          nome: string
          origem?: string | null
          page_url?: string | null
          pipeline_id?: number | null
          pipeline_stage_id?: number | null
          produto_interesse?: string | null
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
          captacao_metodo?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estado?: string | null
          external_id?: string | null
          external_source?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          is_offline?: boolean
          last_synced_at?: string | null
          mensagem?: string | null
          nome?: string
          origem?: string | null
          page_url?: string | null
          pipeline_id?: number | null
          pipeline_stage_id?: number | null
          produto_interesse?: string | null
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
      meta_ad_accounts: {
        Row: {
          connected_at: string
          currency: string | null
          id: string
          last_synced_at: string | null
          name: string
          status: string | null
          timezone: string | null
        }
        Insert: {
          connected_at?: string
          currency?: string | null
          id: string
          last_synced_at?: string | null
          name?: string
          status?: string | null
          timezone?: string | null
        }
        Update: {
          connected_at?: string
          currency?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          status?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      meta_ads: {
        Row: {
          account_id: string
          adset_id: string
          campaign_id: string
          creative_id: string | null
          effective_status: string | null
          id: string
          name: string
          preview_url: string | null
          raw: Json | null
          status: string | null
          synced_at: string
        }
        Insert: {
          account_id: string
          adset_id: string
          campaign_id: string
          creative_id?: string | null
          effective_status?: string | null
          id: string
          name?: string
          preview_url?: string | null
          raw?: Json | null
          status?: string | null
          synced_at?: string
        }
        Update: {
          account_id?: string
          adset_id?: string
          campaign_id?: string
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          name?: string
          preview_url?: string | null
          raw?: Json | null
          status?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "meta_adsets"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_adsets: {
        Row: {
          account_id: string
          bid_strategy: string | null
          billing_event: string | null
          campaign_id: string
          daily_budget: number | null
          effective_status: string | null
          end_time: string | null
          id: string
          lifetime_budget: number | null
          name: string
          optimization_goal: string | null
          raw: Json | null
          start_time: string | null
          status: string | null
          synced_at: string
          targeting: Json | null
        }
        Insert: {
          account_id: string
          bid_strategy?: string | null
          billing_event?: string | null
          campaign_id: string
          daily_budget?: number | null
          effective_status?: string | null
          end_time?: string | null
          id: string
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          synced_at?: string
          targeting?: Json | null
        }
        Update: {
          account_id?: string
          bid_strategy?: string | null
          billing_event?: string | null
          campaign_id?: string
          daily_budget?: number | null
          effective_status?: string | null
          end_time?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          synced_at?: string
          targeting?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          account_id: string
          buying_type: string | null
          daily_budget: number | null
          effective_status: string | null
          id: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          raw: Json | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          synced_at: string
        }
        Insert: {
          account_id: string
          buying_type?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          id: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          synced_at?: string
        }
        Update: {
          account_id?: string
          buying_type?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_creatives: {
        Row: {
          account_id: string
          body: string | null
          call_to_action_type: string | null
          id: string
          image_url: string | null
          name: string | null
          object_story_spec: Json | null
          raw: Json | null
          synced_at: string
          thumbnail_url: string | null
          title: string | null
          video_id: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          call_to_action_type?: string | null
          id: string
          image_url?: string | null
          name?: string | null
          object_story_spec?: Json | null
          raw?: Json | null
          synced_at?: string
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          call_to_action_type?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          object_story_spec?: Json | null
          raw?: Json | null
          synced_at?: string
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      meta_insights_daily: {
        Row: {
          account_id: string
          action_values: Json | null
          actions: Json | null
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          clicks: number
          cpc: number
          cpm: number
          ctr: number
          date: string
          frequency: number
          id: string
          impressions: number
          leads: number
          purchase_value: number
          purchases: number
          reach: number
          spend: number
          synced_at: string
        }
        Insert: {
          account_id: string
          action_values?: Json | null
          actions?: Json | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          clicks?: number
          cpc?: number
          cpm?: number
          ctr?: number
          date: string
          frequency?: number
          id?: string
          impressions?: number
          leads?: number
          purchase_value?: number
          purchases?: number
          reach?: number
          spend?: number
          synced_at?: string
        }
        Update: {
          account_id?: string
          action_values?: Json | null
          actions?: Json | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          clicks?: number
          cpc?: number
          cpm?: number
          ctr?: number
          date?: string
          frequency?: number
          id?: string
          impressions?: number
          leads?: number
          purchase_value?: number
          purchases?: number
          reach?: number
          spend?: number
          synced_at?: string
        }
        Relationships: []
      }
      meta_sync_state: {
        Row: {
          entity: string
          items_processed: number | null
          last_message: string | null
          last_run_at: string | null
          last_status: string | null
        }
        Insert: {
          entity: string
          items_processed?: number | null
          last_message?: string | null
          last_run_at?: string | null
          last_status?: string | null
        }
        Update: {
          entity?: string
          items_processed?: number | null
          last_message?: string | null
          last_run_at?: string | null
          last_status?: string | null
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
      traffic_spend: {
        Row: {
          amount: number
          campaign: string | null
          channel: string
          clicks: number
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          impressions: number
          leads_count: number
          notes: string | null
          objective: string | null
          platform_url: string | null
          spend_date: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          campaign?: string | null
          channel: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          impressions?: number
          leads_count?: number
          notes?: string | null
          objective?: string | null
          platform_url?: string | null
          spend_date: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          campaign?: string | null
          channel?: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          impressions?: number
          leads_count?: number
          notes?: string | null
          objective?: string | null
          platform_url?: string | null
          spend_date?: string
          start_date?: string | null
          status?: string
          updated_at?: string
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
      current_user_roles: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_coord: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "consultor" | "coordenador"
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
      app_role: ["admin", "user", "consultor", "coordenador"],
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
