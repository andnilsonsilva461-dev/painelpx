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
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_subscriptions: {
        Row: {
          auth: string
          browser: string | null
          created_at: string
          device_name: string | null
          device_type: string
          endpoint: string
          id: string
          is_pwa: boolean
          last_seen_at: string
          os: string | null
          p256dh: string
          platform: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string
          endpoint: string
          id?: string
          is_pwa?: boolean
          last_seen_at?: string
          os?: string | null
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string
          endpoint?: string
          id?: string
          is_pwa?: boolean
          last_seen_at?: string
          os?: string | null
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      history_events: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          meeting_id: string | null
          metadata: Json
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          meeting_id?: string | null
          metadata?: Json
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          meeting_id?: string | null
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "history_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "history_events_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          goal: number
          id: string
          started_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          goal?: number
          id?: string
          started_at?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          goal?: number
          id?: string
          started_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          reminder_fired: boolean
          reminder_minutes: number
          reminder_offsets: number[]
          source: Database["public"]["Enums"]["lead_source"]
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          reminder_fired?: boolean
          reminder_minutes?: number
          reminder_offsets?: number[]
          source?: Database["public"]["Enums"]["lead_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          reminder_fired?: boolean
          reminder_minutes?: number
          reminder_offsets?: number[]
          source?: Database["public"]["Enums"]["lead_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          fire_at: string
          id: string
          meeting_id: string | null
          message: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fire_at?: string
          id?: string
          meeting_id?: string | null
          message?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          fire_at?: string
          id?: string
          meeting_id?: string | null
          message?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          callback_at: string | null
          client_id: string | null
          company: string | null
          created_at: string
          id: string
          instagram: string | null
          meeting_id: string | null
          name: string
          notes: string | null
          outcome: Database["public"]["Enums"]["prospect_outcome"]
          phone: string | null
          session_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          callback_at?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          meeting_id?: string | null
          name: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["prospect_outcome"]
          phone?: string | null
          session_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          callback_at?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          meeting_id?: string | null
          name?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["prospect_outcome"]
          phone?: string | null
          session_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_log: {
        Row: {
          body: string | null
          created_at: string
          delivered: number
          device_names: string[]
          failed: number
          id: string
          kind: string
          meeting_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivered?: number
          device_names?: string[]
          failed?: number
          id?: string
          kind?: string
          meeting_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivered?: number
          device_names?: string[]
          failed?: number
          id?: string
          kind?: string
          meeting_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          id: string
          kind: string
          meeting_id: string | null
          offset_minutes: number | null
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          meeting_id?: string | null
          offset_minutes?: number | null
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          meeting_id?: string | null
          offset_minutes?: number | null
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          daily_digest: boolean
          daily_digest_hour: number
          daily_prospect_goal: number
          default_reminder_offsets: number[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_digest?: boolean
          daily_digest_hour?: number
          daily_prospect_goal?: number
          default_reminder_offsets?: number[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_digest?: boolean
          daily_digest_hour?: number
          daily_prospect_goal?: number
          default_reminder_offsets?: number[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      push_cron_status: { Args: never; Returns: Json }
    }
    Enums: {
      client_status: "aguardando" | "em_negociacao" | "cliente" | "perdido"
      lead_source:
        | "live"
        | "instagram"
        | "whatsapp"
        | "indicacao"
        | "trafego_pago"
        | "outro"
      meeting_status:
        | "agendada"
        | "confirmada"
        | "reagendada"
        | "realizada"
        | "nao_atendeu"
        | "cancelada"
      prospect_outcome:
        | "pendente"
        | "agendou"
        | "ligar_depois"
        | "nao_atendeu"
        | "sem_interesse"
        | "vai_pensar"
        | "virou_cliente"
        | "numero_errado"
        | "sem_whatsapp"
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
      client_status: ["aguardando", "em_negociacao", "cliente", "perdido"],
      lead_source: [
        "live",
        "instagram",
        "whatsapp",
        "indicacao",
        "trafego_pago",
        "outro",
      ],
      meeting_status: [
        "agendada",
        "confirmada",
        "reagendada",
        "realizada",
        "nao_atendeu",
        "cancelada",
      ],
      prospect_outcome: [
        "pendente",
        "agendou",
        "ligar_depois",
        "nao_atendeu",
        "sem_interesse",
        "vai_pensar",
        "virou_cliente",
        "numero_errado",
        "sem_whatsapp",
      ],
    },
  },
} as const
