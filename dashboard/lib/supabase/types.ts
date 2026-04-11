/**
 * Minimal hand-written types matching the database schema.
 * Run `npx supabase gen types typescript` to regenerate from live schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      businesses:       { Row: Business;       Insert: Omit<Business,       "id" | "created_at" | "updated_at">; Update: Partial<Business>;       Relationships: [] };
      agents:           { Row: Agent;           Insert: Omit<Agent,           "id" | "created_at">;                Update: Partial<Agent>;           Relationships: [] };
      calls:            { Row: Call;            Insert: Omit<Call,            "id" | "created_at" | "updated_at">; Update: Partial<Call>;            Relationships: [] };
      appointments:     { Row: Appointment;     Insert: Omit<Appointment,     "id" | "created_at" | "updated_at">; Update: Partial<Appointment>;     Relationships: [] };
      profiles:         { Row: Profile;         Insert: Omit<Profile,         "created_at">;                       Update: Partial<Profile>;         Relationships: [] };
      business_members: { Row: BusinessMember;  Insert: Omit<BusinessMember,  "created_at">;                       Update: Partial<BusinessMember>;  Relationships: [] };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
  };
}

export interface Business {
  id:                string;
  name:              string;
  slug:              string;
  phone:             string | null;
  email:             string | null;
  address:           string | null;
  city:              string | null;
  country:           string | null;
  description:       string | null;
  hours:             string | null;   // JSON: { mon: { open, close, closed? }, … }
  barbers:           string | null;
  website:           string | null;
  owner_id:          string | null;
  approved:          boolean;
  plan:              string | null;   // "demo" | "starter" | "professional" | "enterprise"
  logo_url:          string | null;
  timezone:          string | null;
  created_at:        string;
  updated_at:        string;
}

export interface Agent {
  id:                   string;
  business_id:          string;
  elevenlabs_agent_id:  string;
  name:                 string;
  active:               boolean;
  calendar_config:      Json;
  created_at:           string;
}

export interface Call {
  id:                   string;
  business_id:          string;
  agent_id:             string | null;
  conversation_id:      string;
  status:               string;
  client_name:          string | null;
  phone_number:         string | null;
  service_type:         string | null;
  barber_name:          string | null;
  appointment_date:     string | null;  // ISO date YYYY-MM-DD
  appointment_time:     string | null;  // HH:MM:SS
  price:                number | null;
  duration_minutes:     number | null;
  special_requests:     string | null;
  call_language:        string | null;
  callback_requested:   boolean | null;
  appointment_status:   string | null;
  summary:              string | null;
  call_duration_secs:   number | null;
  message_count:        number | null;
  main_language:        string | null;
  call_successful:      string | null;
  termination_reason:   string | null;
  call_summary_title:   string | null;
  raw_data:             Json;
  source:               string;
  created_at:           string;
  updated_at:           string;
}

export interface Appointment {
  id:                string;
  business_id:       string;
  call_id:           string | null;
  source:            string;
  client_name:       string | null;
  phone_number:      string | null;
  service_type:      string | null;
  barber_name:       string | null;
  appointment_date:  string | null;
  appointment_time:  string | null;
  duration_minutes:  number | null;
  price:             number | null;
  status:            string;
  notes:             string | null;
  services:          Json | null;
  created_at:        string;
  updated_at:        string;
}

export interface Profile {
  id:         string;
  full_name:  string | null;
  email:      string | null;
  role:       string | null;
  approved:   boolean;
  created_at: string;
}

export interface BusinessMember {
  business_id: string;
  user_id:     string;
  role:        string;
  created_at:  string;
  businesses?: { id: string; name: string } | null;
}
