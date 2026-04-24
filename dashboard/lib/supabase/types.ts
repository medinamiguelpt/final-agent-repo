export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      agents: {
        Row: {
          active: boolean;
          business_id: string;
          calendar_config: Json | null;
          calendar_id: string | null;
          calendar_provider: string | null;
          created_at: string;
          elevenlabs_agent_id: string;
          id: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          calendar_config?: Json | null;
          calendar_id?: string | null;
          calendar_provider?: string | null;
          created_at?: string;
          elevenlabs_agent_id: string;
          id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          calendar_config?: Json | null;
          calendar_id?: string | null;
          calendar_provider?: string | null;
          created_at?: string;
          elevenlabs_agent_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          appointment_date: string | null;
          appointment_time: string | null;
          barber_name: string | null;
          business_id: string;
          calendar_event_id: string | null;
          calendar_provider: string | null;
          call_id: string | null;
          client_name: string | null;
          created_at: string;
          duration_minutes: number | null;
          id: string;
          notes: string | null;
          phone_number: string | null;
          price: number | null;
          service_type: string | null;
          services: Json | null;
          source: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          appointment_date?: string | null;
          appointment_time?: string | null;
          barber_name?: string | null;
          business_id: string;
          calendar_event_id?: string | null;
          calendar_provider?: string | null;
          call_id?: string | null;
          client_name?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          notes?: string | null;
          phone_number?: string | null;
          price?: number | null;
          service_type?: string | null;
          services?: Json | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          appointment_date?: string | null;
          appointment_time?: string | null;
          barber_name?: string | null;
          business_id?: string;
          calendar_event_id?: string | null;
          calendar_provider?: string | null;
          call_id?: string | null;
          client_name?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          notes?: string | null;
          phone_number?: string | null;
          price?: number | null;
          service_type?: string | null;
          services?: Json | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: true;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          address: string | null;
          approved: boolean;
          barbers: string | null;
          calendar_id: string | null;
          calendar_provider: string;
          city: string | null;
          country: string | null;
          created_at: string;
          description: string | null;
          email: string | null;
          google_place_id: string | null;
          hours: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          phone: string | null;
          plan: string;
          profile: Json;
          slug: string;
          timezone: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          approved?: boolean;
          barbers?: string | null;
          calendar_id?: string | null;
          calendar_provider?: string;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          email?: string | null;
          google_place_id?: string | null;
          hours?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          phone?: string | null;
          plan?: string;
          profile?: Json;
          slug: string;
          timezone?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          approved?: boolean;
          barbers?: string | null;
          calendar_id?: string | null;
          calendar_provider?: string;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          email?: string | null;
          google_place_id?: string | null;
          hours?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          phone?: string | null;
          plan?: string;
          profile?: Json;
          slug?: string;
          timezone?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      calls: {
        Row: {
          agent_id: string | null;
          appointment_date: string | null;
          appointment_status: string | null;
          appointment_time: string | null;
          barber_name: string | null;
          business_id: string;
          calendar_event_id: string | null;
          call_duration_secs: number | null;
          call_language: string | null;
          call_successful: string | null;
          call_summary_title: string | null;
          callback_requested: boolean | null;
          client_name: string | null;
          conversation_id: string;
          created_at: string;
          duration_minutes: number | null;
          id: string;
          main_language: string | null;
          message_count: number | null;
          phone_number: string | null;
          price: number | null;
          raw_data: Json | null;
          service_type: string | null;
          source: string;
          special_requests: string | null;
          status: string;
          summary: string | null;
          termination_reason: string | null;
          updated_at: string;
        };
        Insert: {
          agent_id?: string | null;
          appointment_date?: string | null;
          appointment_status?: string | null;
          appointment_time?: string | null;
          barber_name?: string | null;
          business_id: string;
          calendar_event_id?: string | null;
          call_duration_secs?: number | null;
          call_language?: string | null;
          call_successful?: string | null;
          call_summary_title?: string | null;
          callback_requested?: boolean | null;
          client_name?: string | null;
          conversation_id: string;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          main_language?: string | null;
          message_count?: number | null;
          phone_number?: string | null;
          price?: number | null;
          raw_data?: Json | null;
          service_type?: string | null;
          source?: string;
          special_requests?: string | null;
          status?: string;
          summary?: string | null;
          termination_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          agent_id?: string | null;
          appointment_date?: string | null;
          appointment_status?: string | null;
          appointment_time?: string | null;
          barber_name?: string | null;
          business_id?: string;
          calendar_event_id?: string | null;
          call_duration_secs?: number | null;
          call_language?: string | null;
          call_successful?: string | null;
          call_summary_title?: string | null;
          callback_requested?: boolean | null;
          client_name?: string | null;
          conversation_id?: string;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          main_language?: string | null;
          message_count?: number | null;
          phone_number?: string | null;
          price?: number | null;
          raw_data?: Json | null;
          service_type?: string | null;
          source?: string;
          special_requests?: string | null;
          status?: string;
          summary?: string | null;
          termination_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          approved: boolean;
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          approved?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          approved?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

// Convenience aliases used by existing code
export type Profile = Tables<"profiles">;
export type Call = Tables<"calls">;
export type Appointment = Tables<"appointments">;
export type Business = Tables<"businesses">;
export type Agent = Tables<"agents">;
export type BusinessMember = Tables<"business_members">;
