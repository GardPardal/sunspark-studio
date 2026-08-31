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
      account_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          requested_unit: Database["public"]["Enums"]["unit_enum"] | null
          status: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          requested_unit?: Database["public"]["Enums"]["unit_enum"] | null
          status?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          requested_unit?: Database["public"]["Enums"]["unit_enum"] | null
          status?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      agenda_appointments: {
        Row: {
          consultor_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          reminder_sent_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["agenda_appointment_status"]
          title: string
          type: Database["public"]["Enums"]["agenda_appointment_type"]
          updated_at: string
        }
        Insert: {
          consultor_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["agenda_appointment_status"]
          title: string
          type?: Database["public"]["Enums"]["agenda_appointment_type"]
          updated_at?: string
        }
        Update: {
          consultor_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["agenda_appointment_status"]
          title?: string
          type?: Database["public"]["Enums"]["agenda_appointment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          evidence: Json
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          linked_workflow_id: string | null
          narrative: string | null
          recommendation: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          linked_workflow_id?: string | null
          narrative?: string | null
          recommendation?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          linked_workflow_id?: string | null
          narrative?: string | null
          recommendation?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_linked_workflow_id_fkey"
            columns: ["linked_workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
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
      city_unit_map: {
        Row: {
          cidade_label: string
          cidade_norm: string
          created_at: string
          unit: Database["public"]["Enums"]["unit_enum"]
        }
        Insert: {
          cidade_label: string
          cidade_norm: string
          created_at?: string
          unit: Database["public"]["Enums"]["unit_enum"]
        }
        Update: {
          cidade_label?: string
          cidade_norm?: string
          created_at?: string
          unit?: Database["public"]["Enums"]["unit_enum"]
        }
        Relationships: []
      }
      client_tickets: {
        Row: {
          assigned_to: string | null
          client_email: string | null
          client_name: string
          client_ref: string
          created_at: string
          description: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_email?: string | null
          client_name: string
          client_ref: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_email?: string | null
          client_name?: string
          client_ref?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          extra: Json
          id: string
          internal_notes: string | null
          message: string | null
          name: string
          origin: Json
          phone: string
          routed_to: string | null
          status: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          extra?: Json
          id?: string
          internal_notes?: string | null
          message?: string | null
          name: string
          origin?: Json
          phone: string
          routed_to?: string | null
          status?: string
          subject_type?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          extra?: Json
          id?: string
          internal_notes?: string | null
          message?: string | null
          name?: string
          origin?: Json
          phone?: string
          routed_to?: string | null
          status?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversion_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_name: string
          fbtrace_id: string | null
          http_status: number | null
          id: string
          lead_id: string | null
          match_quality: number | null
          platform: string
          request_payload: Json | null
          response: Json | null
          retry_of: string | null
          status: string
          status_detail: string | null
          test_mode: boolean
          validation_errors: Json | null
          value: number | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_name: string
          fbtrace_id?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          match_quality?: number | null
          platform: string
          request_payload?: Json | null
          response?: Json | null
          retry_of?: string | null
          status: string
          status_detail?: string | null
          test_mode?: boolean
          validation_errors?: Json | null
          value?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_name?: string
          fbtrace_id?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          match_quality?: number | null
          platform?: string
          request_payload?: Json | null
          response?: Json | null
          retry_of?: string | null
          status?: string
          status_detail?: string | null
          test_mode?: boolean
          validation_errors?: Json | null
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
          {
            foreignKeyName: "conversion_events_retry_of_fkey"
            columns: ["retry_of"]
            isOneToOne: false
            referencedRelation: "conversion_events"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_facts: {
        Row: {
          confianca: number
          confirmado_por: number
          created_at: string
          data_fato: string | null
          fonte_nome: string | null
          fonte_url: string | null
          id: string
          informacao: string
          topic_id: string
        }
        Insert: {
          confianca?: number
          confirmado_por?: number
          created_at?: string
          data_fato?: string | null
          fonte_nome?: string | null
          fonte_url?: string | null
          id?: string
          informacao: string
          topic_id: string
        }
        Update: {
          confianca?: number
          confirmado_por?: number
          created_at?: string
          data_fato?: string | null
          fonte_nome?: string | null
          fonte_url?: string | null
          id?: string
          informacao?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_facts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "editorial_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_items: {
        Row: {
          autor: string | null
          created_at: string
          id: string
          idioma: string | null
          keywords: string[]
          processado: boolean
          publicado_em: string | null
          relevancia: number
          resumo: string | null
          source_id: string | null
          titulo: string
          topic_id: string | null
          updated_at: string
          url: string
          url_hash: string
        }
        Insert: {
          autor?: string | null
          created_at?: string
          id?: string
          idioma?: string | null
          keywords?: string[]
          processado?: boolean
          publicado_em?: string | null
          relevancia?: number
          resumo?: string | null
          source_id?: string | null
          titulo: string
          topic_id?: string | null
          updated_at?: string
          url: string
          url_hash: string
        }
        Update: {
          autor?: string | null
          created_at?: string
          id?: string
          idioma?: string | null
          keywords?: string[]
          processado?: boolean
          publicado_em?: string | null
          relevancia?: number
          resumo?: string | null
          source_id?: string | null
          titulo?: string
          topic_id?: string | null
          updated_at?: string
          url?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "editorial_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "editorial_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_jobs: {
        Row: {
          concluido_em: string | null
          created_at: string
          erro: string | null
          id: string
          iniciado_em: string | null
          max_tentativas: number
          payload: Json
          status: string
          tentativas: number
          tipo: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          iniciado_em?: string | null
          max_tentativas?: number
          payload?: Json
          status?: string
          tentativas?: number
          tipo?: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          iniciado_em?: string | null
          max_tentativas?: number
          payload?: Json
          status?: string
          tentativas?: number
          tipo?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_jobs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "editorial_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          id: string
          nivel: string
          resultado: string | null
          source_id: string | null
          topic_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          id?: string
          nivel?: string
          resultado?: string | null
          source_id?: string | null
          topic_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          id?: string
          nivel?: string
          resultado?: string | null
          source_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "editorial_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_logs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "editorial_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_runs: {
        Row: {
          artigos_gerados: number
          artigos_publicados: number
          created_at: string
          custo_estimado: number
          detalhes: Json
          duracao_ms: number | null
          erros: number
          id: string
          itens_encontrados: number
          pautas_novas: number
          pautas_relevantes: number
          tipo: string
        }
        Insert: {
          artigos_gerados?: number
          artigos_publicados?: number
          created_at?: string
          custo_estimado?: number
          detalhes?: Json
          duracao_ms?: number | null
          erros?: number
          id?: string
          itens_encontrados?: number
          pautas_novas?: number
          pautas_relevantes?: number
          tipo?: string
        }
        Update: {
          artigos_gerados?: number
          artigos_publicados?: number
          created_at?: string
          custo_estimado?: number
          detalhes?: Json
          duracao_ms?: number | null
          erros?: number
          id?: string
          itens_encontrados?: number
          pautas_novas?: number
          pautas_relevantes?: number
          tipo?: string
        }
        Relationships: []
      }
      editorial_settings: {
        Row: {
          id: boolean
          max_artigos_dia: number
          max_similaridade: number
          min_confidence: number
          min_relevancia: number
          modelo_texto: string
          modo_publicacao: string
          pausar_descoberta: boolean
          pausar_publicacao: boolean
          regras_categoria: Json
          updated_at: string
        }
        Insert: {
          id?: boolean
          max_artigos_dia?: number
          max_similaridade?: number
          min_confidence?: number
          min_relevancia?: number
          modelo_texto?: string
          modo_publicacao?: string
          pausar_descoberta?: boolean
          pausar_publicacao?: boolean
          regras_categoria?: Json
          updated_at?: string
        }
        Update: {
          id?: boolean
          max_artigos_dia?: number
          max_similaridade?: number
          min_confidence?: number
          min_relevancia?: number
          modelo_texto?: string
          modo_publicacao?: string
          pausar_descoberta?: boolean
          pausar_publicacao?: boolean
          regras_categoria?: Json
          updated_at?: string
        }
        Relationships: []
      }
      editorial_sources: {
        Row: {
          adapter: string
          ativo: boolean
          autoridade: number
          categorias: string[]
          created_at: string
          dominio: string
          erros_consecutivos: number
          feed_url: string | null
          frequencia_minutos: number
          id: string
          metodo: string
          nome: string
          observacoes: string | null
          permite_conteudo_integral: boolean
          permite_imagem: boolean
          politica_uso: string | null
          prioridade: number
          requer_credito: boolean
          status: string
          tipo: string
          ultima_publicacao_encontrada: string | null
          ultima_verificacao: string | null
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          adapter?: string
          ativo?: boolean
          autoridade?: number
          categorias?: string[]
          created_at?: string
          dominio: string
          erros_consecutivos?: number
          feed_url?: string | null
          frequencia_minutos?: number
          id?: string
          metodo?: string
          nome: string
          observacoes?: string | null
          permite_conteudo_integral?: boolean
          permite_imagem?: boolean
          politica_uso?: string | null
          prioridade?: number
          requer_credito?: boolean
          status?: string
          tipo?: string
          ultima_publicacao_encontrada?: string | null
          ultima_verificacao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          adapter?: string
          ativo?: boolean
          autoridade?: number
          categorias?: string[]
          created_at?: string
          dominio?: string
          erros_consecutivos?: number
          feed_url?: string | null
          frequencia_minutos?: number
          id?: string
          metodo?: string
          nome?: string
          observacoes?: string | null
          permite_conteudo_integral?: boolean
          permite_imagem?: boolean
          politica_uso?: string | null
          prioridade?: number
          requer_credito?: boolean
          status?: string
          tipo?: string
          ultima_publicacao_encontrada?: string | null
          ultima_verificacao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      editorial_topic_sources: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          papel: string
          peso: number
          source_id: string | null
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          papel?: string
          peso?: number
          source_id?: string | null
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          papel?: string
          peso?: number
          source_id?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_topic_sources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "editorial_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_topic_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "editorial_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_topic_sources_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "editorial_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_topics: {
        Row: {
          assunto: string
          breaking_news: boolean
          categoria: string | null
          confidence_score: number
          created_at: string
          evergreen: boolean
          fingerprint: string | null
          fonte_primaria_id: string | null
          id: string
          lz7_score: number
          motivo_bloqueio: string | null
          post_id: string | null
          primeira_detectada_em: string
          quantidade_fontes: number
          relevancia: number
          resumo_factual: string | null
          score: number
          status: string
          titulo_interno: string | null
          ultima_atualizacao: string
          updated_at: string
        }
        Insert: {
          assunto: string
          breaking_news?: boolean
          categoria?: string | null
          confidence_score?: number
          created_at?: string
          evergreen?: boolean
          fingerprint?: string | null
          fonte_primaria_id?: string | null
          id?: string
          lz7_score?: number
          motivo_bloqueio?: string | null
          post_id?: string | null
          primeira_detectada_em?: string
          quantidade_fontes?: number
          relevancia?: number
          resumo_factual?: string | null
          score?: number
          status?: string
          titulo_interno?: string | null
          ultima_atualizacao?: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          breaking_news?: boolean
          categoria?: string | null
          confidence_score?: number
          created_at?: string
          evergreen?: boolean
          fingerprint?: string | null
          fonte_primaria_id?: string | null
          id?: string
          lz7_score?: number
          motivo_bloqueio?: string | null
          post_id?: string | null
          primeira_detectada_em?: string
          quantidade_fontes?: number
          relevancia?: number
          resumo_factual?: string | null
          score?: number
          status?: string
          titulo_interno?: string | null
          ultima_atualizacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_topics_fonte_primaria_id_fkey"
            columns: ["fonte_primaria_id"]
            isOneToOne: false
            referencedRelation: "editorial_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_topics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "site_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      finance_sales: {
        Row: {
          a_receber: number
          cidade: string | null
          created_at: string
          created_by: string | null
          faturado: boolean
          faturado_em: string | null
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          previsto: string | null
          projeto: string
          recebido: number
          updated_at: string
          valor: number
          vendedor: string
        }
        Insert: {
          a_receber?: number
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          faturado?: boolean
          faturado_em?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          previsto?: string | null
          projeto: string
          recebido?: number
          updated_at?: string
          valor?: number
          vendedor: string
        }
        Update: {
          a_receber?: number
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          faturado?: boolean
          faturado_em?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          previsto?: string | null
          projeto?: string
          recebido?: number
          updated_at?: string
          valor?: number
          vendedor?: string
        }
        Relationships: []
      }
      forum_liz_log: {
        Row: {
          created_at: string
          erro: string | null
          id: number
          perguntas_encontradas: number
          perguntas_respondidas: number
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: never
          perguntas_encontradas?: number
          perguntas_respondidas?: number
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: never
          perguntas_encontradas?: number
          perguntas_respondidas?: number
        }
        Relationships: []
      }
      hub_dados: {
        Row: {
          atualizado_em: string
          dados: Json
          id: number
          origem: string | null
        }
        Insert: {
          atualizado_em?: string
          dados?: Json
          id?: number
          origem?: string | null
        }
        Update: {
          atualizado_em?: string
          dados?: Json
          id?: number
          origem?: string | null
        }
        Relationships: []
      }
      hub_dados_hist: {
        Row: {
          criado_em: string
          dados: Json
          id: number
          origem: string | null
        }
        Insert: {
          criado_em?: string
          dados: Json
          id?: never
          origem?: string | null
        }
        Update: {
          criado_em?: string
          dados?: Json
          id?: never
          origem?: string | null
        }
        Relationships: []
      }
      hub_estado: {
        Row: {
          atualizado_em: string
          estado: Json
          id: number
        }
        Insert: {
          atualizado_em?: string
          estado?: Json
          id: number
        }
        Update: {
          atualizado_em?: string
          estado?: Json
          id?: number
        }
        Relationships: []
      }
      hub_estado_hist: {
        Row: {
          em: string
          estado: Json
          id: number
          n: number
        }
        Insert: {
          em?: string
          estado: Json
          id: number
          n?: number
        }
        Update: {
          em?: string
          estado?: Json
          id?: number
          n?: number
        }
        Relationships: []
      }
      integration_sync_log: {
        Row: {
          action: string | null
          created_at: string
          id: string
          items_imported: number
          items_updated: number
          message: string | null
          payload: Json | null
          provider: string | null
          source: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          items_imported?: number
          items_updated?: number
          message?: string | null
          payload?: Json | null
          provider?: string | null
          source?: string | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          items_imported?: number
          items_updated?: number
          message?: string | null
          payload?: Json | null
          provider?: string | null
          source?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      internal_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token?: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          codigo: string
          created_at: string
          descricao: string
          id: string
          ordem: number
          prateleira: string | null
          preco_compra: number
          preco_compra_convertido: number
          preco_venda: number
          saldo_fisico: number
          saldo_inventario: number | null
          unidade: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          prateleira?: string | null
          preco_compra?: number
          preco_compra_convertido?: number
          preco_venda?: number
          saldo_fisico?: number
          saldo_inventario?: number | null
          unidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          prateleira?: string | null
          preco_compra?: number
          preco_compra_convertido?: number
          preco_venda?: number
          saldo_fisico?: number
          saldo_inventario?: number | null
          unidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          answers: Json
          availability: string | null
          city: string | null
          created_at: string
          email: string
          experience: string | null
          full_name: string
          has_cnh: boolean | null
          id: string
          interest_area: string | null
          internal_notes: string | null
          job_id: string | null
          job_title: string | null
          kind: string
          linkedin: string | null
          message: string | null
          origin: Json
          phone: string
          resume_name: string | null
          resume_path: string | null
          salary_expectation: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          availability?: string | null
          city?: string | null
          created_at?: string
          email: string
          experience?: string | null
          full_name: string
          has_cnh?: boolean | null
          id?: string
          interest_area?: string | null
          internal_notes?: string | null
          job_id?: string | null
          job_title?: string | null
          kind?: string
          linkedin?: string | null
          message?: string | null
          origin?: Json
          phone: string
          resume_name?: string | null
          resume_path?: string | null
          salary_expectation?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          availability?: string | null
          city?: string | null
          created_at?: string
          email?: string
          experience?: string | null
          full_name?: string
          has_cnh?: boolean | null
          id?: string
          interest_area?: string | null
          internal_notes?: string | null
          job_id?: string | null
          job_title?: string | null
          kind?: string
          linkedin?: string | null
          message?: string | null
          origin?: Json
          phone?: string
          resume_name?: string | null
          resume_path?: string | null
          salary_expectation?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "site_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          model_version: string
          org_id: string
          token_estimate: number
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          model_version?: string
          org_id: string
          token_estimate?: number
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          model_version?: string
          org_id?: string
          token_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          chunk_count: number
          content: string
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          org_id: string
          source_ref: string | null
          source_type: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          chunk_count?: number
          content?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          org_id: string
          source_ref?: string | null
          source_type?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          chunk_count?: number
          content?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          org_id?: string
          source_ref?: string | null
          source_type?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_ingest_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          detail: Json
          document_id: string | null
          error: string | null
          failed: number
          id: string
          kind: string
          org_id: string
          processed: number
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: Json
          document_id?: string | null
          error?: string | null
          failed?: number
          id?: string
          kind?: string
          org_id: string
          processed?: number
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: Json
          document_id?: string | null
          error?: string | null
          failed?: number
          id?: string
          kind?: string
          org_id?: string
          processed?: number
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_ingest_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_ingest_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          atendimento_confirmado_at: string | null
          atendimento_deadline: string | null
          captacao_metodo: string | null
          cidade: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estado: string | null
          external_id: string | null
          external_source: string | null
          fatura_url: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          id: string
          is_offline: boolean
          is_prioridade_emergencia: boolean
          last_synced_at: string | null
          lead_quality: string
          lead_quality_at: string | null
          lead_quality_reason: string | null
          mensagem: string | null
          nome: string
          objetivo: string | null
          origem: string | null
          padrao_eletrico: string | null
          page_url: string | null
          pipeline_id: number | null
          pipeline_stage_id: number | null
          ploomes_deal_id: number | null
          produto_interesse: string | null
          referrer: string | null
          sale_notes: string | null
          sale_value: number | null
          stage: Database["public"]["Enums"]["lead_stage"]
          stage_updated_at: string | null
          telefone: string
          tipo_encaminhamento: string | null
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
          atendimento_confirmado_at?: string | null
          atendimento_deadline?: string | null
          captacao_metodo?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estado?: string | null
          external_id?: string | null
          external_source?: string | null
          fatura_url?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          is_offline?: boolean
          is_prioridade_emergencia?: boolean
          last_synced_at?: string | null
          lead_quality?: string
          lead_quality_at?: string | null
          lead_quality_reason?: string | null
          mensagem?: string | null
          nome: string
          objetivo?: string | null
          origem?: string | null
          padrao_eletrico?: string | null
          page_url?: string | null
          pipeline_id?: number | null
          pipeline_stage_id?: number | null
          ploomes_deal_id?: number | null
          produto_interesse?: string | null
          referrer?: string | null
          sale_notes?: string | null
          sale_value?: number | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stage_updated_at?: string | null
          telefone: string
          tipo_encaminhamento?: string | null
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
          atendimento_confirmado_at?: string | null
          atendimento_deadline?: string | null
          captacao_metodo?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estado?: string | null
          external_id?: string | null
          external_source?: string | null
          fatura_url?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          is_offline?: boolean
          is_prioridade_emergencia?: boolean
          last_synced_at?: string | null
          lead_quality?: string
          lead_quality_at?: string | null
          lead_quality_reason?: string | null
          mensagem?: string | null
          nome?: string
          objetivo?: string | null
          origem?: string | null
          padrao_eletrico?: string | null
          page_url?: string | null
          pipeline_id?: number | null
          pipeline_stage_id?: number | null
          ploomes_deal_id?: number | null
          produto_interesse?: string | null
          referrer?: string | null
          sale_notes?: string | null
          sale_value?: number | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stage_updated_at?: string | null
          telefone?: string
          tipo_encaminhamento?: string | null
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
      liz_aprendizados: {
        Row: {
          categoria: string
          conteudo: string
          contexto: string | null
          created_at: string
          criado_por: string | null
          id: string
          origem: string | null
          tags: string[]
          titulo: string
          ultima_utilizacao: string | null
          updated_at: string
          usos: number
        }
        Insert: {
          categoria: string
          conteudo: string
          contexto?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          origem?: string | null
          tags?: string[]
          titulo: string
          ultima_utilizacao?: string | null
          updated_at?: string
          usos?: number
        }
        Update: {
          categoria?: string
          conteudo?: string
          contexto?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          origem?: string | null
          tags?: string[]
          titulo?: string
          ultima_utilizacao?: string | null
          updated_at?: string
          usos?: number
        }
        Relationships: []
      }
      liz_conversations: {
        Row: {
          first_at: string
          id: string
          is_admin_or_dev: boolean
          last_emailed_at: string | null
          message_count: number
          messages: Json
          mode: string
          page_url: string | null
          session_id: string
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          first_at?: string
          id?: string
          is_admin_or_dev?: boolean
          last_emailed_at?: string | null
          message_count?: number
          messages?: Json
          mode: string
          page_url?: string | null
          session_id: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          first_at?: string
          id?: string
          is_admin_or_dev?: boolean
          last_emailed_at?: string | null
          message_count?: number
          messages?: Json
          mode?: string
          page_url?: string | null
          session_id?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      manual_sales: {
        Row: {
          amount: number
          branch: string | null
          campaign_ref: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          invoiced_date: string | null
          lead_origin: string | null
          notes: string | null
          ploomes_creator_id: number | null
          ploomes_creator_name: string | null
          ploomes_deal_id: number | null
          ploomes_invoice_deal_id: number | null
          ploomes_owner_name: string | null
          sale_date: string
          seller_id: string | null
          traffic_spend_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          branch?: string | null
          campaign_ref?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoiced_date?: string | null
          lead_origin?: string | null
          notes?: string | null
          ploomes_creator_id?: number | null
          ploomes_creator_name?: string | null
          ploomes_deal_id?: number | null
          ploomes_invoice_deal_id?: number | null
          ploomes_owner_name?: string | null
          sale_date?: string
          seller_id?: string | null
          traffic_spend_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          branch?: string | null
          campaign_ref?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoiced_date?: string | null
          lead_origin?: string | null
          notes?: string | null
          ploomes_creator_id?: number | null
          ploomes_creator_name?: string | null
          ploomes_deal_id?: number | null
          ploomes_invoice_deal_id?: number | null
          ploomes_owner_name?: string | null
          sale_date?: string
          seller_id?: string | null
          traffic_spend_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sales_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_sales_traffic_spend_id_fkey"
            columns: ["traffic_spend_id"]
            isOneToOne: false
            referencedRelation: "traffic_spend"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_admin_audit: {
        Row: {
          created_at: string
          id: string
          kind: string
          statement: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          statement: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          statement?: string
          user_id?: string
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
      newsletter_subscribers: {
        Row: {
          consent: boolean
          created_at: string
          email: string
          id: string
          name: string | null
          origin: Json
          status: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          consent?: boolean
          created_at?: string
          email: string
          id?: string
          name?: string | null
          origin?: Json
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          origin?: Json
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          opt_out_keywords: string[]
          retention_days: number
          retention_media_days: number
          retention_message_months: number
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          opt_out_keywords?: string[]
          retention_days?: number
          retention_media_days?: number
          retention_message_months?: number
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          opt_out_keywords?: string[]
          retention_days?: number
          retention_media_days?: number
          retention_message_months?: number
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_requests: {
        Row: {
          city: string | null
          cnpj: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          internal_notes: string | null
          name: string
          origin: Json
          partnership_type: string | null
          phone: string
          proposal: string | null
          state: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          name: string
          origin?: Json
          partnership_type?: string | null
          phone: string
          proposal?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          name?: string
          origin?: Json
          partnership_type?: string | null
          phone?: string
          proposal?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
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
      ploomes_users: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          last_seen_at: string
          name: string
          ploomes_id: number
          profile_id: string | null
          seller_id: string | null
          source: string
          unit: Database["public"]["Enums"]["unit_enum"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          last_seen_at?: string
          name: string
          ploomes_id: number
          profile_id?: string | null
          seller_id?: string | null
          source?: string
          unit?: Database["public"]["Enums"]["unit_enum"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          last_seen_at?: string
          name?: string
          ploomes_id?: number
          profile_id?: string | null
          seller_id?: string | null
          source?: string
          unit?: Database["public"]["Enums"]["unit_enum"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ploomes_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ploomes_users_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sales_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          queue_frozen: boolean
          queue_frozen_at: string | null
          queue_frozen_reason: string | null
          queue_pos_orcamento: number
          queue_pos_visita: number
          roulette_priority: number
          status: Database["public"]["Enums"]["user_status"]
          unit: Database["public"]["Enums"]["unit_enum"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          queue_frozen?: boolean
          queue_frozen_at?: string | null
          queue_frozen_reason?: string | null
          queue_pos_orcamento?: number
          queue_pos_visita?: number
          roulette_priority?: number
          status?: Database["public"]["Enums"]["user_status"]
          unit?: Database["public"]["Enums"]["unit_enum"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          queue_frozen?: boolean
          queue_frozen_at?: string | null
          queue_frozen_reason?: string | null
          queue_pos_orcamento?: number
          queue_pos_visita?: number
          roulette_priority?: number
          status?: Database["public"]["Enums"]["user_status"]
          unit?: Database["public"]["Enums"]["unit_enum"] | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_sellers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          profile_id: string | null
          unit: Database["public"]["Enums"]["unit_enum"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          profile_id?: string | null
          unit?: Database["public"]["Enums"]["unit_enum"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          profile_id?: string | null
          unit?: Database["public"]["Enums"]["unit_enum"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_sellers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_jobs: {
        Row: {
          ask_cnh: boolean
          ask_salary: boolean
          benefits: string | null
          city: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          differentials: string | null
          id: string
          published_at: string | null
          require_resume: boolean
          requirements: string | null
          responsibilities: string | null
          schedule: string | null
          seo: Json
          slug: string
          state: string | null
          status: string
          title: string
          updated_at: string
          work_model: string | null
        }
        Insert: {
          ask_cnh?: boolean
          ask_salary?: boolean
          benefits?: string | null
          city?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          differentials?: string | null
          id?: string
          published_at?: string | null
          require_resume?: boolean
          requirements?: string | null
          responsibilities?: string | null
          schedule?: string | null
          seo?: Json
          slug: string
          state?: string | null
          status?: string
          title: string
          updated_at?: string
          work_model?: string | null
        }
        Update: {
          ask_cnh?: boolean
          ask_salary?: boolean
          benefits?: string | null
          city?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          differentials?: string | null
          id?: string
          published_at?: string | null
          require_resume?: boolean
          requirements?: string | null
          responsibilities?: string | null
          schedule?: string | null
          seo?: Json
          slug?: string
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
          work_model?: string | null
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          published: boolean
          seo: Json
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          seo?: Json
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          seo?: Json
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "site_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "site_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      site_posts: {
        Row: {
          author_id: string | null
          breaking_news: boolean
          category_id: string | null
          content: string
          content_type: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          cta: Json
          excerpt: string | null
          faqs: Json
          id: string
          origin: string
          published_at: string | null
          quality_score: number | null
          reading_minutes: number | null
          seo: Json
          slug: string
          sources: Json
          status: string
          subtitle: string | null
          title: string
          tldr: string | null
          topic_id: string | null
          updated_at: string
          updated_note: string | null
          views: number
        }
        Insert: {
          author_id?: string | null
          breaking_news?: boolean
          category_id?: string | null
          content?: string
          content_type?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta?: Json
          excerpt?: string | null
          faqs?: Json
          id?: string
          origin?: string
          published_at?: string | null
          quality_score?: number | null
          reading_minutes?: number | null
          seo?: Json
          slug: string
          sources?: Json
          status?: string
          subtitle?: string | null
          title: string
          tldr?: string | null
          topic_id?: string | null
          updated_at?: string
          updated_note?: string | null
          views?: number
        }
        Update: {
          author_id?: string | null
          breaking_news?: boolean
          category_id?: string | null
          content?: string
          content_type?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta?: Json
          excerpt?: string | null
          faqs?: Json
          id?: string
          origin?: string
          published_at?: string | null
          quality_score?: number | null
          reading_minutes?: number | null
          seo?: Json
          slug?: string
          sources?: Json
          status?: string
          subtitle?: string | null
          title?: string
          tldr?: string | null
          topic_id?: string | null
          updated_at?: string
          updated_note?: string | null
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "site_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "site_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      site_projects: {
        Row: {
          category: string
          challenge: string | null
          city: string | null
          client_name: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          equipment: string | null
          estimated_savings: string | null
          featured: boolean
          gallery: Json
          id: string
          modules_count: number | null
          power_kwp: number | null
          project_date: string | null
          published: boolean
          result: string | null
          seo: Json
          slug: string
          solution: string | null
          state: string | null
          summary: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string
          challenge?: string | null
          city?: string | null
          client_name?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment?: string | null
          estimated_savings?: string | null
          featured?: boolean
          gallery?: Json
          id?: string
          modules_count?: number | null
          power_kwp?: number | null
          project_date?: string | null
          published?: boolean
          result?: string | null
          seo?: Json
          slug: string
          solution?: string | null
          state?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string
          challenge?: string | null
          city?: string | null
          client_name?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment?: string | null
          estimated_savings?: string | null
          featured?: boolean
          gallery?: Json
          id?: string
          modules_count?: number | null
          power_kwp?: number | null
          project_date?: string | null
          published?: boolean
          result?: string | null
          seo?: Json
          slug?: string
          solution?: string | null
          state?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      site_rh_questions: {
        Row: {
          active: boolean
          created_at: string
          field_type: string
          help: string | null
          id: string
          label: string
          options: Json
          ordem: number
          required: boolean
          scope: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          field_type?: string
          help?: string | null
          id?: string
          label: string
          options?: Json
          ordem?: number
          required?: boolean
          scope?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          field_type?: string
          help?: string | null
          id?: string
          label?: string
          options?: Json
          ordem?: number
          required?: boolean
          scope?: string
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
      site_solutions: {
        Row: {
          benefits: Json
          created_at: string
          cta_primary: string | null
          cta_secondary: string | null
          faqs: Json
          form_config: Json
          headline: string
          hero_image_url: string | null
          id: string
          intro: string | null
          name: string
          ordem: number
          published: boolean
          sections: Json
          seo: Json
          slug: string
          subheadline: string | null
          testimonials: Json
          updated_at: string
          video_url: string | null
          whatsapp_message: string | null
        }
        Insert: {
          benefits?: Json
          created_at?: string
          cta_primary?: string | null
          cta_secondary?: string | null
          faqs?: Json
          form_config?: Json
          headline: string
          hero_image_url?: string | null
          id?: string
          intro?: string | null
          name: string
          ordem?: number
          published?: boolean
          sections?: Json
          seo?: Json
          slug: string
          subheadline?: string | null
          testimonials?: Json
          updated_at?: string
          video_url?: string | null
          whatsapp_message?: string | null
        }
        Update: {
          benefits?: Json
          created_at?: string
          cta_primary?: string | null
          cta_secondary?: string | null
          faqs?: Json
          form_config?: Json
          headline?: string
          hero_image_url?: string | null
          id?: string
          intro?: string | null
          name?: string
          ordem?: number
          published?: boolean
          sections?: Json
          seo?: Json
          slug?: string
          subheadline?: string | null
          testimonials?: Json
          updated_at?: string
          video_url?: string | null
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      site_stats: {
        Row: {
          created_at: string
          id: string
          label: string
          ordem: number
          published: boolean
          suffix: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          ordem?: number
          published?: boolean
          suffix?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          ordem?: number
          published?: boolean
          suffix?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      site_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      site_timeline: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ordem: number
          published: boolean
          title: string
          updated_at: string
          year: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ordem?: number
          published?: boolean
          title: string
          updated_at?: string
          year: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ordem?: number
          published?: boolean
          title?: string
          updated_at?: string
          year?: string
        }
        Relationships: []
      }
      site_units: {
        Row: {
          address: string | null
          city: string
          created_at: string
          email: string | null
          hours: string | null
          id: string
          image_url: string | null
          maps_url: string | null
          name: string
          ordem: number
          phone: string | null
          published: boolean
          slug: string
          state: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          email?: string | null
          hours?: string | null
          id?: string
          image_url?: string | null
          maps_url?: string | null
          name: string
          ordem?: number
          phone?: string | null
          published?: boolean
          slug: string
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          email?: string | null
          hours?: string | null
          id?: string
          image_url?: string | null
          maps_url?: string | null
          name?: string
          ordem?: number
          phone?: string | null
          published?: boolean
          slug?: string
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_diagnostics: {
        Row: {
          code: string
          created_at: string
          id: string
          message: string
          metadata: Json
          resolved_at: string | null
          severity: string
          source: string
          status: string
          suggestion: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          resolved_at?: string | null
          severity: string
          source: string
          status?: string
          suggestion?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          suggestion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_health: {
        Row: {
          id: string
          last_checked_at: string
          latency_ms: number | null
          message: string | null
          meta: Json
          service: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_checked_at?: string
          latency_ms?: number | null
          message?: string | null
          meta?: Json
          service: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_checked_at?: string
          latency_ms?: number | null
          message?: string | null
          meta?: Json
          service?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          kind: string
          payload: Json
          source: string
          summary: string | null
          title: string
          ts: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          kind: string
          payload?: Json
          source?: string
          summary?: string | null
          title: string
          ts?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          kind?: string
          payload?: Json
          source?: string
          summary?: string | null
          title?: string
          ts?: string
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
      wa_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          org_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campaign_targets: {
        Row: {
          blocked_reason: string | null
          campaign_id: string
          contact_id: string
          created_at: string
          eligible: boolean
          error: string | null
          id: string
          org_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          blocked_reason?: string | null
          campaign_id: string
          contact_id: string
          created_at?: string
          eligible?: boolean
          error?: string | null
          id?: string
          org_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          blocked_reason?: string | null
          campaign_id?: string
          contact_id?: string
          created_at?: string
          eligible?: boolean
          error?: string | null
          id?: string
          org_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_campaign_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "wa_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaign_targets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaign_targets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campaigns: {
        Row: {
          blocked_count: number
          channel_id: string | null
          created_at: string
          created_by: string | null
          dry_run_result: Json
          id: string
          language_code: string
          name: string
          org_id: string
          sent_count: number
          status: string
          template_name: string
          updated_at: string
          variables: Json
        }
        Insert: {
          blocked_count?: number
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          dry_run_result?: Json
          id?: string
          language_code?: string
          name: string
          org_id: string
          sent_count?: number
          status?: string
          template_name: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          blocked_count?: number
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          dry_run_result?: Json
          id?: string
          language_code?: string
          name?: string
          org_id?: string
          sent_count?: number
          status?: string
          template_name?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "wa_campaigns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "wa_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_channels: {
        Row: {
          bot_enabled: boolean
          business_account_id: string | null
          business_hours: Json
          created_at: string
          display_phone: string | null
          id: string
          label: string
          org_id: string
          persona: string | null
          phone_number_id: string
          shadow_mode: boolean
          test_allowlist: string[]
          updated_at: string
        }
        Insert: {
          bot_enabled?: boolean
          business_account_id?: string | null
          business_hours?: Json
          created_at?: string
          display_phone?: string | null
          id?: string
          label: string
          org_id: string
          persona?: string | null
          phone_number_id: string
          shadow_mode?: boolean
          test_allowlist?: string[]
          updated_at?: string
        }
        Update: {
          bot_enabled?: boolean
          business_account_id?: string | null
          business_hours?: Json
          created_at?: string
          display_phone?: string | null
          id?: string
          label?: string
          org_id?: string
          persona?: string | null
          phone_number_id?: string
          shadow_mode?: boolean
          test_allowlist?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_consents: {
        Row: {
          action: string
          actor_id: string | null
          contact_id: string
          created_at: string
          evidence: Json
          id: string
          org_id: string
          source: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          contact_id: string
          created_at?: string
          evidence?: Json
          id?: string
          org_id: string
          source: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          contact_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          org_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_consents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_consents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_contacts: {
        Row: {
          consent_status: string
          created_at: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          lead_id: string | null
          opt_in_at: string | null
          opt_out_at: string | null
          org_id: string
          phone_e164: string
          profile_name: string | null
          tags: string[]
          updated_at: string
          wa_id: string | null
        }
        Insert: {
          consent_status?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          opt_in_at?: string | null
          opt_out_at?: string | null
          org_id: string
          phone_e164: string
          profile_name?: string | null
          tags?: string[]
          updated_at?: string
          wa_id?: string | null
        }
        Update: {
          consent_status?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          opt_in_at?: string | null
          opt_out_at?: string | null
          org_id?: string
          phone_e164?: string
          profile_name?: string | null
          tags?: string[]
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          assigned_to: string | null
          channel_id: string | null
          contact_id: string
          created_at: string
          handoff_at: string | null
          handoff_reason: string | null
          id: string
          last_message_at: string | null
          org_id: string
          status: string
          summary: string | null
          summary_updated_at: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel_id?: string | null
          contact_id: string
          created_at?: string
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_message_at?: string | null
          org_id: string
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string | null
          contact_id?: string
          created_at?: string
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_message_at?: string | null
          org_id?: string
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "wa_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_events: {
        Row: {
          attempts: number
          channel_id: string | null
          error: string | null
          event_kind: string
          id: string
          org_id: string | null
          payload: Json
          process_status: string
          processed_at: string | null
          provider_event_id: string
          received_at: string
        }
        Insert: {
          attempts?: number
          channel_id?: string | null
          error?: string | null
          event_kind: string
          id?: string
          org_id?: string | null
          payload: Json
          process_status?: string
          processed_at?: string | null
          provider_event_id: string
          received_at?: string
        }
        Update: {
          attempts?: number
          channel_id?: string | null
          error?: string | null
          event_kind?: string
          id?: string
          org_id?: string | null
          payload?: Json
          process_status?: string
          processed_at?: string | null
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "wa_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_imports: {
        Row: {
          created_at: string
          created_by: string | null
          declaration: string
          errors: Json
          id: string
          imported_count: number
          org_id: string
          skipped_count: number
          source: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          declaration: string
          errors?: Json
          id?: string
          imported_count?: number
          org_id: string
          skipped_count?: number
          source: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          declaration?: string
          errors?: Json
          id?: string
          imported_count?: number
          org_id?: string
          skipped_count?: number
          source?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_media: {
        Row: {
          created_at: string
          download_status: string
          error: string | null
          id: string
          mime_type: string | null
          org_id: string
          provider_media_id: string | null
          sha256: string | null
          size_bytes: number | null
          storage_path: string | null
          transcript: string | null
          transcript_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_status?: string
          error?: string | null
          id?: string
          mime_type?: string | null
          org_id: string
          provider_media_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          transcript?: string | null
          transcript_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_status?: string
          error?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          provider_media_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          transcript?: string | null
          transcript_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          ai_generated: boolean
          ai_meta: Json | null
          body: string | null
          contact_id: string
          content_hash: string | null
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          id: string
          imported: boolean
          media_id: string | null
          msg_type: string
          occurred_at: string
          org_id: string
          provider_message_id: string | null
          reply_to: string | null
          sent_by: string | null
          source: string
          status: string
        }
        Insert: {
          ai_generated?: boolean
          ai_meta?: Json | null
          body?: string | null
          contact_id: string
          content_hash?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          imported?: boolean
          media_id?: string | null
          msg_type?: string
          occurred_at?: string
          org_id: string
          provider_message_id?: string | null
          reply_to?: string | null
          sent_by?: string | null
          source?: string
          status?: string
        }
        Update: {
          ai_generated?: boolean
          ai_meta?: Json | null
          body?: string | null
          contact_id?: string
          content_hash?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          imported?: boolean
          media_id?: string | null
          msg_type?: string
          occurred_at?: string
          org_id?: string
          provider_message_id?: string | null
          reply_to?: string | null
          sent_by?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "wa_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          lead_id: string | null
          messages: Json
          qualified: boolean
          updated_at: string
          wa_name: string | null
          wa_phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          lead_id?: string | null
          messages?: Json
          qualified?: boolean
          updated_at?: string
          wa_name?: string | null
          wa_phone: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          lead_id?: string | null
          messages?: Json
          qualified?: boolean
          updated_at?: string
          wa_name?: string | null
          wa_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          entity_id: string | null
          entity_type: string | null
          error: string | null
          finished_at: string | null
          id: string
          logs: Json
          started_at: string
          status: string
          workflow_id: string
        }
        Insert: {
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          started_at?: string
          status?: string
          workflow_id: string
        }
        Update: {
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          started_at?: string
          status?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          steps: Json
          trigger: Json
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          steps: Json
          trigger: Json
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          steps?: Json
          trigger?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      search_index: {
        Row: {
          badge: string | null
          document: unknown
          entity_id: string | null
          entity_type: string | null
          subtitle: string | null
          title: string | null
          ts: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_business_hours: {
        Args: { _from: string; _hours: number }
        Returns: string
      }
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
      book_appointment: {
        Args: {
          _consultor_id: string
          _ends_at: string
          _lead_id: string
          _notes: string
          _starts_at: string
          _title: string
          _type: Database["public"]["Enums"]["agenda_appointment_type"]
        }
        Returns: string
      }
      check_atendimento_deadlines: { Args: never; Returns: number }
      confirmar_atendimento: { Args: { _lead_id: string }; Returns: undefined }
      current_user_roles: { Args: never; Returns: string[] }
      default_org_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dispatch_agenda_reminders: { Args: never; Returns: number }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_agenda_free_slots: {
        Args: {
          _from: string
          _slot_minutes?: number
          _to: string
          _user_id: string
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      get_user_unit: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["unit_enum"]
      }
      global_search: {
        Args: { _limit?: number; _q: string }
        Returns: {
          badge: string
          entity_id: string
          entity_type: string
          rank: number
          subtitle: string
          title: string
          ts: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      infer_unit_from_city: {
        Args: { _cidade: string }
        Returns: Database["public"]["Enums"]["unit_enum"]
      }
      is_admin_or_coord: { Args: never; Returns: boolean }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_sdr_or_above: { Args: never; Returns: boolean }
      match_kb_chunks: {
        Args: {
          _match_count?: number
          _org_id: string
          _query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      mcp_admin_execute: { Args: { _sql: string }; Returns: Json }
      mcp_admin_query: { Args: { _sql: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      norm_city: { Args: { _c: string }; Returns: string }
      notify_appointment_created: {
        Args: { _appt_id: string }
        Returns: undefined
      }
      notify_consultor_novo_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: undefined
      }
      only_digits: { Args: { _s: string }; Returns: string }
      ploomes_captacao_id: {
        Args: { _origem: string; _utm_source: string }
        Returns: number
      }
      ploomes_filial_id: {
        Args: { _unit: Database["public"]["Enums"]["unit_enum"] }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reassign_lead: {
        Args: { _lead_id: string; _reason?: string; _to_user: string }
        Returns: undefined
      }
      record_event: {
        Args: {
          _actor_id?: string
          _actor_name?: string
          _entity_id: string
          _entity_type: string
          _kind: string
          _payload?: Json
          _source?: string
          _summary?: string
          _title: string
        }
        Returns: string
      }
      set_roulette_priority: {
        Args: { _priority: number; _user_id: string }
        Returns: undefined
      }
      spin_roulette: {
        Args: {
          _count: number
          _unit: Database["public"]["Enums"]["unit_enum"]
        }
        Returns: {
          assigned_to: string
          lead_id: string
        }[]
      }
      spin_visita_tecnica: {
        Args: {
          _count: number
          _unit: Database["public"]["Enums"]["unit_enum"]
        }
        Returns: {
          assigned_to: string
          lead_id: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      unfreeze_consultant: { Args: { _user_id: string }; Returns: undefined }
      upsert_health: {
        Args: {
          _latency_ms?: number
          _message?: string
          _meta?: Json
          _service: string
          _status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      agenda_appointment_status: "agendado" | "concluido" | "cancelado"
      agenda_appointment_type:
        | "ligacao"
        | "visita_tecnica"
        | "reuniao"
        | "outro"
      app_role: "admin" | "user" | "consultor" | "coordenador" | "sdr"
      lead_stage:
        | "novo"
        | "atendimento"
        | "nao_atendido"
        | "venda"
        | "faturado"
        | "perdido"
      unit_enum: "londrina" | "ponta_grossa" | "wenceslau_braz"
      user_status: "pending" | "active" | "rejected"
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
      agenda_appointment_status: ["agendado", "concluido", "cancelado"],
      agenda_appointment_type: [
        "ligacao",
        "visita_tecnica",
        "reuniao",
        "outro",
      ],
      app_role: ["admin", "user", "consultor", "coordenador", "sdr"],
      lead_stage: [
        "novo",
        "atendimento",
        "nao_atendido",
        "venda",
        "faturado",
        "perdido",
      ],
      unit_enum: ["londrina", "ponta_grossa", "wenceslau_braz"],
      user_status: ["pending", "active", "rejected"],
    },
  },
} as const
