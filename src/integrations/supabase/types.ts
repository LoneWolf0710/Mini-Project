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
      alert_rules: {
        Row: {
          comparator: string
          consecutive_required: number
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          metric: string
          name: string
          severity: string
          threshold: number
        }
        Insert: {
          comparator?: string
          consecutive_required?: number
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          metric: string
          name: string
          severity?: string
          threshold: number
        }
        Update: {
          comparator?: string
          consecutive_required?: number
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          metric?: string
          name?: string
          severity?: string
          threshold?: number
        }
        Relationships: []
      }
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          vehicle_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          vehicle_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      driver_scores: {
        Row: {
          driver_id: string
          harsh_accel: number
          idle_minutes: number
          over_speed: number
          score: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          harsh_accel?: number
          idle_minutes?: number
          over_speed?: number
          score?: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          harsh_accel?: number
          idle_minutes?: number
          over_speed?: number
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          license_number: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fuel_logs: {
        Row: {
          created_at: string
          id: string
          liters: number
          logged_at: string
          logged_by: string | null
          notes: string | null
          odometer: number | null
          price_per_liter: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liters: number
          logged_at?: string
          logged_by?: string | null
          notes?: string | null
          odometer?: number | null
          price_per_liter?: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liters?: number
          logged_at?: string
          logged_by?: string | null
          notes?: string | null
          odometer?: number | null
          price_per_liter?: number
          vehicle_id?: string
        }
        Relationships: []
      }
      geofences: {
        Row: {
          alert_on_enter: boolean
          alert_on_exit: boolean
          center_lat: number
          center_lng: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          radius_m: number
        }
        Insert: {
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          center_lat: number
          center_lng: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          radius_m?: number
        }
        Update: {
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          center_lat?: number
          center_lng?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          radius_m?: number
        }
        Relationships: []
      }
      maintenance_predictions: {
        Row: {
          confidence: number
          health_score: number
          id: string
          predicted_at: string
          reasons: Json
          recommended_action: string | null
          risk: Database["public"]["Enums"]["risk_level"]
          sensor_contributions: Json
          vehicle_id: string
        }
        Insert: {
          confidence?: number
          health_score?: number
          id?: string
          predicted_at?: string
          reasons?: Json
          recommended_action?: string | null
          risk: Database["public"]["Enums"]["risk_level"]
          sensor_contributions?: Json
          vehicle_id: string
        }
        Update: {
          confidence?: number
          health_score?: number
          id?: string
          predicted_at?: string
          reasons?: Json
          recommended_action?: string | null
          risk?: Database["public"]["Enums"]["risk_level"]
          sensor_contributions?: Json
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_predictions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          id: string
          maintenance_type: string
          notes: string | null
          performed_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_type: string
          notes?: string | null
          performed_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          performed_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          maintenance_type: string
          notes: string | null
          scheduled_for: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_type: string
          notes?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      planned_routes: {
        Row: {
          created_at: string
          created_by: string | null
          geometry: Json | null
          id: string
          name: string
          status: string
          stops: Json
          total_distance_m: number | null
          total_duration_s: number | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          geometry?: Json | null
          id?: string
          name: string
          status?: string
          stops?: Json
          total_distance_m?: number | null
          total_duration_s?: number | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          geometry?: Json | null
          id?: string
          name?: string
          status?: string
          stops?: Json
          total_distance_m?: number | null
          total_duration_s?: number | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telemetry_readings: {
        Row: {
          battery_voltage: number | null
          engine_temp: number | null
          fuel_level: number | null
          id: number
          lat: number | null
          lng: number | null
          rpm: number | null
          speed: number | null
          ts: string
          vehicle_id: string
          vibration: number | null
        }
        Insert: {
          battery_voltage?: number | null
          engine_temp?: number | null
          fuel_level?: number | null
          id?: number
          lat?: number | null
          lng?: number | null
          rpm?: number | null
          speed?: number | null
          ts?: string
          vehicle_id: string
          vibration?: number | null
        }
        Update: {
          battery_voltage?: number | null
          engine_temp?: number | null
          fuel_level?: number | null
          id?: number
          lat?: number | null
          lng?: number | null
          rpm?: number | null
          speed?: number | null
          ts?: string
          vehicle_id?: string
          vibration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_readings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          layout: Json
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          layout?: Json
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          layout?: Json
          updated_at?: string
          user_id?: string
          widgets?: Json
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
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          created_at: string
          id: string
          ingest_api_key_hash: string | null
          last_lat: number | null
          last_lng: number | null
          name: string
          odometer: number
          plate: string
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          assigned_driver_id?: string | null
          created_at?: string
          id?: string
          ingest_api_key_hash?: string | null
          last_lat?: number | null
          last_lng?: number | null
          name: string
          odometer?: number
          plate: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          assigned_driver_id?: string | null
          created_at?: string
          id?: string
          ingest_api_key_hash?: string | null
          last_lat?: number | null
          last_lng?: number | null
          name?: string
          odometer?: number
          plate?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string
          error: string | null
          event: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          delivered_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          delivered_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          events: string[]
          id: string
          name: string
          secret: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          name: string
          secret: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          id?: string
          name?: string
          secret?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_admin: { Args: never; Returns: boolean }
      current_user_is_staff: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role: "admin" | "fleet_manager" | "driver"
      risk_level: "low" | "medium" | "high"
      vehicle_status: "active" | "idle" | "maintenance"
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
      app_role: ["admin", "fleet_manager", "driver"],
      risk_level: ["low", "medium", "high"],
      vehicle_status: ["active", "idle", "maintenance"],
    },
  },
} as const
