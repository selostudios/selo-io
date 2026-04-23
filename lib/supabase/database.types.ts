export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_visibility_configs: {
        Row: {
          budget_alert_threshold: number
          competitors: Json
          created_at: string
          id: string
          is_active: boolean
          last_alert_sent_at: string | null
          last_alert_type: string | null
          last_sync_at: string | null
          monthly_budget_cents: number
          organization_id: string
          platforms: string[]
          sync_frequency: string
          updated_at: string
        }
        Insert: {
          budget_alert_threshold?: number
          competitors?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_alert_sent_at?: string | null
          last_alert_type?: string | null
          last_sync_at?: string | null
          monthly_budget_cents?: number
          organization_id: string
          platforms?: string[]
          sync_frequency?: string
          updated_at?: string
        }
        Update: {
          budget_alert_threshold?: number
          competitors?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_alert_sent_at?: string | null
          last_alert_type?: string | null
          last_sync_at?: string | null
          monthly_budget_cents?: number
          organization_id?: string
          platforms?: string[]
          sync_frequency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_visibility_configs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ai_visibility_prompts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          prompt_text: string
          source: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          prompt_text: string
          source?: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          prompt_text?: string
          source?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_visibility_prompts_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_visibility_prompts_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'ai_visibility_topics'
            referencedColumns: ['id']
          },
        ]
      }
      ai_visibility_results: {
        Row: {
          brand_mentioned: boolean
          brand_position: number | null
          brand_sentiment: string
          cited_urls: string[] | null
          competitor_mentions: Json | null
          cost_cents: number | null
          created_at: string
          domain_cited: boolean
          id: string
          insight: string | null
          organization_id: string
          platform: string
          prompt_id: string | null
          queried_at: string
          raw_response: Json | null
          research_id: string | null
          response_text: string
          source: string
          tokens_used: number | null
        }
        Insert: {
          brand_mentioned?: boolean
          brand_position?: number | null
          brand_sentiment?: string
          cited_urls?: string[] | null
          competitor_mentions?: Json | null
          cost_cents?: number | null
          created_at?: string
          domain_cited?: boolean
          id?: string
          insight?: string | null
          organization_id: string
          platform: string
          prompt_id?: string | null
          queried_at?: string
          raw_response?: Json | null
          research_id?: string | null
          response_text: string
          source?: string
          tokens_used?: number | null
        }
        Update: {
          brand_mentioned?: boolean
          brand_position?: number | null
          brand_sentiment?: string
          cited_urls?: string[] | null
          competitor_mentions?: Json | null
          cost_cents?: number | null
          created_at?: string
          domain_cited?: boolean
          id?: string
          insight?: string | null
          organization_id?: string
          platform?: string
          prompt_id?: string | null
          queried_at?: string
          raw_response?: Json | null
          research_id?: string | null
          response_text?: string
          source?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_visibility_results_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_visibility_results_prompt_id_fkey'
            columns: ['prompt_id']
            isOneToOne: false
            referencedRelation: 'ai_visibility_prompts'
            referencedColumns: ['id']
          },
        ]
      }
      ai_visibility_scores: {
        Row: {
          citations_count: number
          cited_pages_count: number
          created_at: string
          id: string
          mentions_count: number
          organization_id: string
          period_end: string
          period_start: string
          platform_breakdown: Json | null
          score: number
        }
        Insert: {
          citations_count?: number
          cited_pages_count?: number
          created_at?: string
          id?: string
          mentions_count?: number
          organization_id: string
          period_end: string
          period_start: string
          platform_breakdown?: Json | null
          score: number
        }
        Update: {
          citations_count?: number
          cited_pages_count?: number
          created_at?: string
          id?: string
          mentions_count?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          platform_breakdown?: Json | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: 'ai_visibility_scores_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ai_visibility_topics: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          organization_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          organization_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          organization_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_visibility_topics_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          credentials: Json
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_ai_analyses: {
        Row: {
          audit_id: string
          citability_passages: Json | null
          cost: number
          created_at: string
          execution_time_ms: number | null
          findings: Json | null
          id: string
          importance_reasons: string[]
          importance_score: number
          input_tokens: number
          output_tokens: number
          page_url: string
          platform_readiness: Json | null
          recommendations: Json | null
          score_authority: number | null
          score_citability: number | null
          score_comprehensiveness: number | null
          score_data_quality: number | null
          score_expert_credibility: number | null
          score_overall: number | null
        }
        Insert: {
          audit_id: string
          citability_passages?: Json | null
          cost?: number
          created_at?: string
          execution_time_ms?: number | null
          findings?: Json | null
          id?: string
          importance_reasons?: string[]
          importance_score?: number
          input_tokens?: number
          output_tokens?: number
          page_url: string
          platform_readiness?: Json | null
          recommendations?: Json | null
          score_authority?: number | null
          score_citability?: number | null
          score_comprehensiveness?: number | null
          score_data_quality?: number | null
          score_expert_credibility?: number | null
          score_overall?: number | null
        }
        Update: {
          audit_id?: string
          citability_passages?: Json | null
          cost?: number
          created_at?: string
          execution_time_ms?: number | null
          findings?: Json | null
          id?: string
          importance_reasons?: string[]
          importance_score?: number
          input_tokens?: number
          output_tokens?: number
          page_url?: string
          platform_readiness?: Json | null
          recommendations?: Json | null
          score_authority?: number | null
          score_citability?: number | null
          score_comprehensiveness?: number | null
          score_data_quality?: number | null
          score_expert_credibility?: number | null
          score_overall?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_ai_analyses_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'audits'
            referencedColumns: ['id']
          },
        ]
      }
      audit_checks: {
        Row: {
          audit_id: string
          category: string
          check_name: string
          created_at: string
          description: string
          details: Json | null
          display_name: string
          display_name_passed: string
          feeds_scores: string[]
          fix_guidance: string | null
          id: string
          learn_more_url: string | null
          page_url: string | null
          priority: string
          status: string
        }
        Insert: {
          audit_id: string
          category: string
          check_name: string
          created_at?: string
          description: string
          details?: Json | null
          display_name: string
          display_name_passed: string
          feeds_scores?: string[]
          fix_guidance?: string | null
          id?: string
          learn_more_url?: string | null
          page_url?: string | null
          priority: string
          status: string
        }
        Update: {
          audit_id?: string
          category?: string
          check_name?: string
          created_at?: string
          description?: string
          details?: Json | null
          display_name?: string
          display_name_passed?: string
          feeds_scores?: string[]
          fix_guidance?: string | null
          id?: string
          learn_more_url?: string | null
          page_url?: string | null
          priority?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_checks_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'audits'
            referencedColumns: ['id']
          },
        ]
      }
      audit_crawl_queue: {
        Row: {
          audit_id: string
          created_at: string
          depth: number
          id: string
          status: string
          url: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          depth?: number
          id?: string
          status?: string
          url: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          depth?: number
          id?: string
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_crawl_queue_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'audits'
            referencedColumns: ['id']
          },
        ]
      }
      audit_pages: {
        Row: {
          audit_id: string
          created_at: string
          depth: number
          id: string
          is_resource: boolean
          last_modified: string | null
          meta_description: string | null
          resource_type: string | null
          status_code: number | null
          title: string | null
          url: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          depth?: number
          id?: string
          is_resource?: boolean
          last_modified?: string | null
          meta_description?: string | null
          resource_type?: string | null
          status_code?: number | null
          title?: string | null
          url: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          depth?: number
          id?: string
          is_resource?: boolean
          last_modified?: string | null
          meta_description?: string | null
          resource_type?: string | null
          status_code?: number | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_pages_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'audits'
            referencedColumns: ['id']
          },
        ]
      }
      audits: {
        Row: {
          ai_analysis_enabled: boolean
          ai_readiness_score: number | null
          completed_at: string | null
          crawl_mode: string
          created_at: string
          created_by: string | null
          current_batch: number
          domain: string
          error_message: string | null
          executive_summary: string | null
          failed_count: number
          id: string
          max_pages: number
          module_errors: Json
          module_statuses: Json
          module_timings: Json
          organization_id: string | null
          overall_score: number | null
          pages_crawled: number
          passed_count: number
          performance_score: number | null
          progress: Json | null
          robots_txt_rules: Json | null
          sample_size: number
          seo_score: number | null
          soft_cap_reached: boolean
          started_at: string | null
          status: Database['public']['Enums']['unified_audit_status']
          total_cost: number
          total_input_tokens: number
          total_output_tokens: number
          updated_at: string
          url: string
          urls_discovered: number
          use_relaxed_ssl: boolean
          warning_count: number
        }
        Insert: {
          ai_analysis_enabled?: boolean
          ai_readiness_score?: number | null
          completed_at?: string | null
          crawl_mode?: string
          created_at?: string
          created_by?: string | null
          current_batch?: number
          domain: string
          error_message?: string | null
          executive_summary?: string | null
          failed_count?: number
          id?: string
          max_pages?: number
          module_errors?: Json
          module_statuses?: Json
          module_timings?: Json
          organization_id?: string | null
          overall_score?: number | null
          pages_crawled?: number
          passed_count?: number
          performance_score?: number | null
          progress?: Json | null
          robots_txt_rules?: Json | null
          sample_size?: number
          seo_score?: number | null
          soft_cap_reached?: boolean
          started_at?: string | null
          status?: Database['public']['Enums']['unified_audit_status']
          total_cost?: number
          total_input_tokens?: number
          total_output_tokens?: number
          updated_at?: string
          url: string
          urls_discovered?: number
          use_relaxed_ssl?: boolean
          warning_count?: number
        }
        Update: {
          ai_analysis_enabled?: boolean
          ai_readiness_score?: number | null
          completed_at?: string | null
          crawl_mode?: string
          created_at?: string
          created_by?: string | null
          current_batch?: number
          domain?: string
          error_message?: string | null
          executive_summary?: string | null
          failed_count?: number
          id?: string
          max_pages?: number
          module_errors?: Json
          module_statuses?: Json
          module_timings?: Json
          organization_id?: string | null
          overall_score?: number | null
          pages_crawled?: number
          passed_count?: number
          performance_score?: number | null
          progress?: Json | null
          robots_txt_rules?: Json | null
          sample_size?: number
          seo_score?: number | null
          soft_cap_reached?: boolean
          started_at?: string | null
          status?: Database['public']['Enums']['unified_audit_status']
          total_cost?: number
          total_input_tokens?: number
          total_output_tokens?: number
          updated_at?: string
          url?: string
          urls_discovered?: number
          use_relaxed_ssl?: boolean
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'audits_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      campaign_metrics: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          date: string
          id: string
          metric_type: string
          organization_id: string | null
          platform_type: Database['public']['Enums']['platform_type']
          value: number | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          metric_type: string
          organization_id?: string | null
          platform_type: Database['public']['Enums']['platform_type']
          value?: number | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          metric_type?: string
          organization_id?: string | null
          platform_type?: Database['public']['Enums']['platform_type']
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'campaign_metrics_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'campaign_metrics_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          start_date: string | null
          status: Database['public']['Enums']['campaign_status'] | null
          type: Database['public']['Enums']['campaign_type'] | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          weekly_report_recipients: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          start_date?: string | null
          status?: Database['public']['Enums']['campaign_status'] | null
          type?: Database['public']['Enums']['campaign_type'] | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          weekly_report_recipients?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          start_date?: string | null
          status?: Database['public']['Enums']['campaign_status'] | null
          type?: Database['public']['Enums']['campaign_type'] | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          weekly_report_recipients?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'campaigns_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      dismissed_checks: {
        Row: {
          check_name: string
          created_at: string
          dismissed_by: string | null
          id: string
          organization_id: string
          url: string
        }
        Insert: {
          check_name: string
          created_at?: string
          dismissed_by?: string | null
          id?: string
          organization_id: string
          url: string
        }
        Update: {
          check_name?: string
          created_at?: string
          dismissed_by?: string | null
          id?: string
          organization_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dismissed_checks_dismissed_by_fkey'
            columns: ['dismissed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dismissed_checks_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          source: string | null
          source_event_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason: string
          source?: string | null
          source_event_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          source?: string | null
          source_event_id?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: Database['public']['Enums']['feedback_category']
          created_at: string
          description: string
          id: string
          organization_id: string | null
          page_url: string | null
          priority: Database['public']['Enums']['feedback_priority'] | null
          screenshot_url: string | null
          status: Database['public']['Enums']['feedback_status']
          status_note: string | null
          submitted_by: string
          title: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          category: Database['public']['Enums']['feedback_category']
          created_at?: string
          description: string
          id?: string
          organization_id?: string | null
          page_url?: string | null
          priority?: Database['public']['Enums']['feedback_priority'] | null
          screenshot_url?: string | null
          status?: Database['public']['Enums']['feedback_status']
          status_note?: string | null
          submitted_by: string
          title: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          category?: Database['public']['Enums']['feedback_category']
          created_at?: string
          description?: string
          id?: string
          organization_id?: string | null
          page_url?: string | null
          priority?: Database['public']['Enums']['feedback_priority'] | null
          screenshot_url?: string | null
          status?: Database['public']['Enums']['feedback_status']
          status_note?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'feedback_submitted_by_fkey'
            columns: ['submitted_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      generated_reports: {
        Row: {
          aio_audit_id: string | null
          audit_id: string | null
          combined_score: number | null
          created_at: string | null
          created_by: string | null
          custom_company_name: string | null
          custom_logo_url: string | null
          domain: string
          executive_summary: string | null
          id: string
          organization_id: string | null
          original_executive_summary: string | null
          performance_audit_id: string | null
          site_audit_id: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          aio_audit_id?: string | null
          audit_id?: string | null
          combined_score?: number | null
          created_at?: string | null
          created_by?: string | null
          custom_company_name?: string | null
          custom_logo_url?: string | null
          domain: string
          executive_summary?: string | null
          id?: string
          organization_id?: string | null
          original_executive_summary?: string | null
          performance_audit_id?: string | null
          site_audit_id?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          aio_audit_id?: string | null
          audit_id?: string | null
          combined_score?: number | null
          created_at?: string | null
          created_by?: string | null
          custom_company_name?: string | null
          custom_logo_url?: string | null
          domain?: string
          executive_summary?: string | null
          id?: string
          organization_id?: string | null
          original_executive_summary?: string | null
          performance_audit_id?: string | null
          site_audit_id?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'generated_reports_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'audits'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_reports_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_reports_performance_audit_id_fkey'
            columns: ['performance_audit_id']
            isOneToOne: false
            referencedRelation: 'performance_audits'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_reports_site_audit_id_fkey'
            columns: ['site_audit_id']
            isOneToOne: false
            referencedRelation: 'site_audits'
            referencedColumns: ['id']
          },
        ]
      }
      industries: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      internal_employees: {
        Row: {
          added_by: string | null
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_internal_employees_public_user'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          organization_id: string | null
          role: Database['public']['Enums']['user_role']
          status: Database['public']['Enums']['invite_status'] | null
          type: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          organization_id?: string | null
          role: Database['public']['Enums']['user_role']
          status?: Database['public']['Enums']['invite_status'] | null
          type?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          organization_id?: string | null
          role?: Database['public']['Enums']['user_role']
          status?: Database['public']['Enums']['invite_status'] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invites_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invites_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      marketing_review_drafts: {
        Row: {
          ai_originals: Json
          author_notes: string | null
          data: Json
          id: string
          narrative: Json
          review_id: string
          updated_at: string
        }
        Insert: {
          ai_originals?: Json
          author_notes?: string | null
          data?: Json
          id?: string
          narrative?: Json
          review_id: string
          updated_at?: string
        }
        Update: {
          ai_originals?: Json
          author_notes?: string | null
          data?: Json
          id?: string
          narrative?: Json
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'marketing_review_drafts_review_id_fkey'
            columns: ['review_id']
            isOneToOne: true
            referencedRelation: 'marketing_reviews'
            referencedColumns: ['id']
          },
        ]
      }
      marketing_review_prompt_overrides: {
        Row: {
          organization_id: string
          prompts: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          organization_id: string
          prompts?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          organization_id?: string
          prompts?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'marketing_review_prompt_overrides_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      marketing_review_snapshots: {
        Row: {
          ai_originals: Json | null
          author_notes: string | null
          compare_qoq_end: string
          compare_qoq_start: string
          compare_yoy_end: string
          compare_yoy_start: string
          data: Json
          id: string
          narrative: Json
          period_end: string
          period_start: string
          published_at: string
          published_by: string
          review_id: string
          share_token: string
          version: number
        }
        Insert: {
          ai_originals?: Json | null
          author_notes?: string | null
          compare_qoq_end: string
          compare_qoq_start: string
          compare_yoy_end: string
          compare_yoy_start: string
          data: Json
          id?: string
          narrative: Json
          period_end: string
          period_start: string
          published_at?: string
          published_by: string
          review_id: string
          share_token: string
          version: number
        }
        Update: {
          ai_originals?: Json | null
          author_notes?: string | null
          compare_qoq_end?: string
          compare_qoq_start?: string
          compare_yoy_end?: string
          compare_yoy_start?: string
          data?: Json
          id?: string
          narrative?: Json
          period_end?: string
          period_start?: string
          published_at?: string
          published_by?: string
          review_id?: string
          share_token?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'marketing_review_snapshots_review_id_fkey'
            columns: ['review_id']
            isOneToOne: false
            referencedRelation: 'marketing_reviews'
            referencedColumns: ['id']
          },
        ]
      }
      marketing_review_style_memo_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          memo: string
          organization_id: string
          rationale: string | null
          snapshot_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          memo: string
          organization_id: string
          rationale?: string | null
          snapshot_id?: string | null
          source: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string
          organization_id?: string
          rationale?: string | null
          snapshot_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'marketing_review_style_memo_versions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'marketing_review_style_memo_versions_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'marketing_review_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      marketing_review_style_memos: {
        Row: {
          memo: string
          organization_id: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          memo?: string
          organization_id: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          memo?: string
          organization_id?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'marketing_review_style_memos_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      marketing_reviews: {
        Row: {
          created_at: string
          created_by: string
          id: string
          latest_snapshot_id: string | null
          organization_id: string
          quarter: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          latest_snapshot_id?: string | null
          organization_id: string
          quarter: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          latest_snapshot_id?: string | null
          organization_id?: string
          quarter?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'marketing_reviews_latest_snapshot_fk'
            columns: ['latest_snapshot_id']
            isOneToOne: false
            referencedRelation: 'marketing_review_snapshots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'marketing_reviews_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      monitored_pages: {
        Row: {
          added_by: string | null
          created_at: string | null
          id: string
          organization_id: string
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monitored_pages_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      monitored_sites: {
        Row: {
          created_at: string | null
          id: string
          last_performance_audit_at: string | null
          last_site_audit_at: string | null
          organization_id: string
          run_performance_audit: boolean | null
          run_site_audit: boolean | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_performance_audit_at?: string | null
          last_site_audit_at?: string | null
          organization_id: string
          run_performance_audit?: boolean | null
          run_site_audit?: boolean | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_performance_audit_at?: string | null
          last_site_audit_at?: string | null
          organization_id?: string
          run_performance_audit?: boolean | null
          run_site_audit?: boolean | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monitored_sites_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          ai_api_key: string | null
          ai_billing_model: Database['public']['Enums']['ai_billing_model'] | null
          ai_features_enabled: Json | null
          ai_provider: Database['public']['Enums']['ai_provider'] | null
          brand_preferences: Json | null
          city: string | null
          contact_email: string | null
          contact_info: Json | null
          country: string | null
          created_at: string | null
          data_export_history: Json | null
          default_weekly_report_recipients: string[] | null
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          social_links: Json | null
          status: Database['public']['Enums']['organization_status'] | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          ai_api_key?: string | null
          ai_billing_model?: Database['public']['Enums']['ai_billing_model'] | null
          ai_features_enabled?: Json | null
          ai_provider?: Database['public']['Enums']['ai_provider'] | null
          brand_preferences?: Json | null
          city?: string | null
          contact_email?: string | null
          contact_info?: Json | null
          country?: string | null
          created_at?: string | null
          data_export_history?: Json | null
          default_weekly_report_recipients?: string[] | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          status?: Database['public']['Enums']['organization_status'] | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          ai_api_key?: string | null
          ai_billing_model?: Database['public']['Enums']['ai_billing_model'] | null
          ai_features_enabled?: Json | null
          ai_provider?: Database['public']['Enums']['ai_provider'] | null
          brand_preferences?: Json | null
          city?: string | null
          contact_email?: string | null
          contact_info?: Json | null
          country?: string | null
          created_at?: string | null
          data_export_history?: Json | null
          default_weekly_report_recipients?: string[] | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          status?: Database['public']['Enums']['organization_status'] | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_organizations_industry'
            columns: ['industry']
            isOneToOne: false
            referencedRelation: 'industries'
            referencedColumns: ['id']
          },
        ]
      }
      performance_audit_results: {
        Row: {
          accessibility_score: number | null
          audit_id: string
          best_practices_score: number | null
          cls_rating: string | null
          cls_score: number | null
          created_at: string | null
          device: string
          id: string
          inp_ms: number | null
          inp_rating: string | null
          lcp_ms: number | null
          lcp_rating: string | null
          performance_score: number | null
          raw_response: Json | null
          seo_score: number | null
          url: string
        }
        Insert: {
          accessibility_score?: number | null
          audit_id: string
          best_practices_score?: number | null
          cls_rating?: string | null
          cls_score?: number | null
          created_at?: string | null
          device: string
          id?: string
          inp_ms?: number | null
          inp_rating?: string | null
          lcp_ms?: number | null
          lcp_rating?: string | null
          performance_score?: number | null
          raw_response?: Json | null
          seo_score?: number | null
          url: string
        }
        Update: {
          accessibility_score?: number | null
          audit_id?: string
          best_practices_score?: number | null
          cls_rating?: string | null
          cls_score?: number | null
          created_at?: string | null
          device?: string
          id?: string
          inp_ms?: number | null
          inp_rating?: string | null
          lcp_ms?: number | null
          lcp_rating?: string | null
          performance_score?: number | null
          raw_response?: Json | null
          seo_score?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'performance_audit_results_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'performance_audits'
            referencedColumns: ['id']
          },
        ]
      }
      performance_audits: {
        Row: {
          completed_at: string | null
          completed_count: number | null
          created_at: string | null
          created_by: string | null
          current_device: string | null
          current_url: string | null
          error_message: string | null
          id: string
          organization_id: string | null
          started_at: string | null
          status: string
          total_urls: number | null
        }
        Insert: {
          completed_at?: string | null
          completed_count?: number | null
          created_at?: string | null
          created_by?: string | null
          current_device?: string | null
          current_url?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          started_at?: string | null
          status?: string
          total_urls?: number | null
        }
        Update: {
          completed_at?: string | null
          completed_count?: number | null
          created_at?: string | null
          created_by?: string | null
          current_device?: string | null
          current_url?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          started_at?: string | null
          status?: string
          total_urls?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'performance_audits_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      platform_connections: {
        Row: {
          account_name: string | null
          created_at: string | null
          credentials: Json
          display_name: string | null
          id: string
          last_sync_at: string | null
          organization_id: string
          platform_type: Database['public']['Enums']['platform_type']
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          created_at?: string | null
          credentials: Json
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id: string
          platform_type: Database['public']['Enums']['platform_type']
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          created_at?: string | null
          credentials?: Json
          display_name?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          platform_type?: Database['public']['Enums']['platform_type']
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'platform_connections_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      report_shares: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          last_viewed_at: string | null
          max_views: number | null
          password_hash: string | null
          report_id: string
          token: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          last_viewed_at?: string | null
          max_views?: number | null
          password_hash?: string | null
          report_id: string
          token: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          max_views?: number | null
          password_hash?: string | null
          report_id?: string
          token?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'report_shares_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'generated_reports'
            referencedColumns: ['id']
          },
        ]
      }
      shared_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          last_viewed_at: string | null
          max_views: number | null
          organization_id: string | null
          password_hash: string | null
          resource_id: string
          resource_type: string
          token: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          last_viewed_at?: string | null
          max_views?: number | null
          organization_id?: string | null
          password_hash?: string | null
          resource_id: string
          resource_type: string
          token: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          max_views?: number | null
          organization_id?: string | null
          password_hash?: string | null
          resource_id?: string
          resource_type?: string
          token?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'shared_links_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      site_audit_checks: {
        Row: {
          audit_id: string
          check_name: string
          check_type: string
          created_at: string | null
          description: string | null
          details: Json | null
          display_name: string | null
          display_name_passed: string | null
          fix_guidance: string | null
          id: string
          is_site_wide: boolean | null
          learn_more_url: string | null
          page_id: string | null
          priority: string
          status: string
        }
        Insert: {
          audit_id: string
          check_name: string
          check_type: string
          created_at?: string | null
          description?: string | null
          details?: Json | null
          display_name?: string | null
          display_name_passed?: string | null
          fix_guidance?: string | null
          id?: string
          is_site_wide?: boolean | null
          learn_more_url?: string | null
          page_id?: string | null
          priority: string
          status: string
        }
        Update: {
          audit_id?: string
          check_name?: string
          check_type?: string
          created_at?: string | null
          description?: string | null
          details?: Json | null
          display_name?: string | null
          display_name_passed?: string | null
          fix_guidance?: string | null
          id?: string
          is_site_wide?: boolean | null
          learn_more_url?: string | null
          page_id?: string | null
          priority?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'site_audit_checks_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'site_audits'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'site_audit_checks_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'site_audit_pages'
            referencedColumns: ['id']
          },
        ]
      }
      site_audit_crawl_queue: {
        Row: {
          audit_id: string
          crawled_at: string | null
          depth: number | null
          discovered_at: string | null
          id: string
          url: string
        }
        Insert: {
          audit_id: string
          crawled_at?: string | null
          depth?: number | null
          discovered_at?: string | null
          id?: string
          url: string
        }
        Update: {
          audit_id?: string
          crawled_at?: string | null
          depth?: number | null
          discovered_at?: string | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'site_audit_crawl_queue_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'site_audits'
            referencedColumns: ['id']
          },
        ]
      }
      site_audit_pages: {
        Row: {
          audit_id: string
          crawled_at: string | null
          id: string
          is_resource: boolean | null
          last_modified: string | null
          meta_description: string | null
          resource_type: string | null
          status_code: number | null
          title: string | null
          url: string
        }
        Insert: {
          audit_id: string
          crawled_at?: string | null
          id?: string
          is_resource?: boolean | null
          last_modified?: string | null
          meta_description?: string | null
          resource_type?: string | null
          status_code?: number | null
          title?: string | null
          url: string
        }
        Update: {
          audit_id?: string
          crawled_at?: string | null
          id?: string
          is_resource?: boolean | null
          last_modified?: string | null
          meta_description?: string | null
          resource_type?: string | null
          status_code?: number | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'site_audit_pages_audit_id_fkey'
            columns: ['audit_id']
            isOneToOne: false
            referencedRelation: 'site_audits'
            referencedColumns: ['id']
          },
        ]
      }
      site_audits: {
        Row: {
          ai_readiness_score: number | null
          archived_at: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          current_batch: number | null
          error_message: string | null
          executive_summary: string | null
          failed_count: number
          id: string
          organization_id: string | null
          overall_score: number | null
          pages_crawled: number | null
          passed_count: number
          seo_score: number | null
          started_at: string | null
          status: string
          technical_score: number | null
          updated_at: string | null
          url: string
          urls_discovered: number | null
          use_relaxed_ssl: boolean | null
          warning_count: number
        }
        Insert: {
          ai_readiness_score?: number | null
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_batch?: number | null
          error_message?: string | null
          executive_summary?: string | null
          failed_count?: number
          id?: string
          organization_id?: string | null
          overall_score?: number | null
          pages_crawled?: number | null
          passed_count?: number
          seo_score?: number | null
          started_at?: string | null
          status?: string
          technical_score?: number | null
          updated_at?: string | null
          url: string
          urls_discovered?: number | null
          use_relaxed_ssl?: boolean | null
          warning_count?: number
        }
        Update: {
          ai_readiness_score?: number | null
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_batch?: number | null
          error_message?: string | null
          executive_summary?: string | null
          failed_count?: number
          id?: string
          organization_id?: string | null
          overall_score?: number | null
          pages_crawled?: number | null
          passed_count?: number
          seo_score?: number | null
          started_at?: string | null
          status?: string
          technical_score?: number | null
          updated_at?: string | null
          url?: string
          urls_discovered?: number | null
          use_relaxed_ssl?: boolean | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'site_audits_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database['public']['Enums']['user_role']
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database['public']['Enums']['user_role']
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database['public']['Enums']['user_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_team_members_public_user'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      usage_logs: {
        Row: {
          cost: number | null
          created_at: string | null
          event_type: string
          feature: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          service: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          event_type: string
          feature?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          service: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          event_type?: string
          feature?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          service?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'usage_logs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          first_name: string | null
          id: string
          is_internal: boolean | null
          last_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          id: string
          is_internal?: boolean | null
          last_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_internal?: boolean | null
          last_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      weekly_summaries: {
        Row: {
          created_at: string | null
          email_sent_at: string | null
          generated_at: string | null
          id: string
          organization_id: string
          recipients: string[]
          summary_data: Json
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          email_sent_at?: string | null
          generated_at?: string | null
          id?: string
          organization_id: string
          recipients: string[]
          summary_data: Json
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          email_sent_at?: string | null
          generated_at?: string | null
          id?: string
          organization_id?: string
          recipients?: string[]
          summary_data?: Json
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'weekly_summaries_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      access_shared_link: {
        Args: { provided_password?: string; share_token: string }
        Returns: {
          error_code: string
          resource_id: string
          resource_type: string
        }[]
      }
      access_shared_report: {
        Args: { provided_password?: string; share_token: string }
        Returns: {
          error_code: string
          report_data: Json
        }[]
      }
      cleanup_old_audit_data: {
        Args: never
        Returns: {
          deleted_audits: number
          deleted_checks: number
          deleted_pages: number
          deleted_queue_entries: number
        }[]
      }
      count_reports_using_audit: {
        Args: { audit_id: string; audit_type: string }
        Returns: number
      }
      get_app_credential: { Args: { setting_key: string }; Returns: Json }
      get_organization_user_emails: {
        Args: { org_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_organization_ids: { Args: never; Returns: string[] }
      get_user_role: { Args: never; Returns: string }
      is_developer: { Args: never; Returns: boolean }
      is_internal_admin: { Args: never; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      set_share_password: {
        Args: { password: string; share_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: string[] }
      update_oauth_tokens: {
        Args: {
          p_access_token: string
          p_connection_id: string
          p_expires_at: string
          p_refresh_token: string
        }
        Returns: undefined
      }
      user_in_aio_audit_org: {
        Args: { audit_created_by: string; audit_org_id: string }
        Returns: boolean
      }
      validate_share_token: {
        Args: { share_token: string }
        Returns: {
          error_code: string
          is_valid: boolean
          report_id: string
          requires_password: boolean
        }[]
      }
      validate_shared_link: {
        Args: { share_token: string }
        Returns: {
          error_code: string
          is_valid: boolean
          requires_password: boolean
          resource_id: string
          resource_type: string
        }[]
      }
    }
    Enums: {
      ai_billing_model: 'bring_own_key' | 'platform_billed' | 'disabled'
      ai_provider: 'anthropic' | 'openai' | 'none'
      campaign_status: 'draft' | 'active' | 'completed'
      campaign_type:
        | 'thought_leadership'
        | 'product_launch'
        | 'brand_awareness'
        | 'lead_generation'
        | 'event_promotion'
        | 'seasonal'
        | 'other'
      feedback_category: 'bug' | 'feature_request' | 'performance' | 'usability' | 'other'
      feedback_priority: 'critical' | 'high' | 'medium' | 'low'
      feedback_status: 'new' | 'under_review' | 'in_progress' | 'resolved' | 'closed'
      invite_status: 'pending' | 'accepted' | 'expired'
      organization_status: 'prospect' | 'customer' | 'inactive'
      platform_type: 'hubspot' | 'google_analytics' | 'linkedin' | 'meta' | 'instagram'
      unified_audit_status:
        | 'pending'
        | 'crawling'
        | 'awaiting_confirmation'
        | 'checking'
        | 'analyzing'
        | 'completed'
        | 'completed_with_errors'
        | 'failed'
        | 'stopped'
        | 'batch_complete'
      user_role: 'admin' | 'team_member' | 'client_viewer' | 'developer' | 'external_developer'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_billing_model: ['bring_own_key', 'platform_billed', 'disabled'],
      ai_provider: ['anthropic', 'openai', 'none'],
      campaign_status: ['draft', 'active', 'completed'],
      campaign_type: [
        'thought_leadership',
        'product_launch',
        'brand_awareness',
        'lead_generation',
        'event_promotion',
        'seasonal',
        'other',
      ],
      feedback_category: ['bug', 'feature_request', 'performance', 'usability', 'other'],
      feedback_priority: ['critical', 'high', 'medium', 'low'],
      feedback_status: ['new', 'under_review', 'in_progress', 'resolved', 'closed'],
      invite_status: ['pending', 'accepted', 'expired'],
      organization_status: ['prospect', 'customer', 'inactive'],
      platform_type: ['hubspot', 'google_analytics', 'linkedin', 'meta', 'instagram'],
      unified_audit_status: [
        'pending',
        'crawling',
        'awaiting_confirmation',
        'checking',
        'analyzing',
        'completed',
        'completed_with_errors',
        'failed',
        'stopped',
        'batch_complete',
      ],
      user_role: ['admin', 'team_member', 'client_viewer', 'developer', 'external_developer'],
    },
  },
} as const
