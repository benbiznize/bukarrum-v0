export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
      add_on_services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          pricing_mode: Database["public"]["Enums"]["add_on_pricing_mode"]
          resource_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pricing_mode?: Database["public"]["Enums"]["add_on_pricing_mode"]
          resource_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pricing_mode?: Database["public"]["Enums"]["add_on_pricing_mode"]
          resource_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_on_services_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          resource_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          resource_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          resource_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      bookers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_add_ons: {
        Row: {
          add_on_service_id: string
          booking_id: string
          created_at: string
          id: string
          price: number
        }
        Insert: {
          add_on_service_id: string
          booking_id: string
          created_at?: string
          id?: string
          price: number
        }
        Update: {
          add_on_service_id?: string
          booking_id?: string
          created_at?: string
          id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_add_ons_add_on_service_id_fkey"
            columns: ["add_on_service_id"]
            isOneToOne: false
            referencedRelation: "add_on_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_add_ons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_number_counters: {
        Row: {
          last_number: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_number: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_number?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_number_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          entry_type: Database["public"]["Enums"]["payment_entry_type"]
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          entry_type?: Database["public"]["Enums"]["payment_entry_type"]
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          entry_type?: Database["public"]["Enums"]["payment_entry_type"]
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booker_id: string
          booking_number: number
          created_at: string
          duration_hours: number
          end_time: string
          has_add_ons: boolean
          id: string
          location_id: string | null
          notes: string | null
          paid_amount: number
          payment_status: Database["public"]["Enums"]["booking_payment_status"]
          resource_id: string
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          booker_id: string
          booking_number: number
          created_at?: string
          duration_hours: number
          end_time: string
          has_add_ons?: boolean
          id?: string
          location_id?: string | null
          notes?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          resource_id: string
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          booker_id?: string
          booking_number?: number
          created_at?: string
          duration_hours?: number
          end_time?: string
          has_add_ons?: boolean
          id?: string
          location_id?: string | null
          notes?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          resource_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_booker_id_fkey"
            columns: ["booker_id"]
            isOneToOne: false
            referencedRelation: "bookers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          phone: string | null
          slug: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          phone?: string | null
          slug: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          phone?: string | null
          slug?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          display_order: number
          features: Json
          id: string
          is_active: boolean
          name: string
          price_annual: number
          price_monthly: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_annual: number
          price_monthly: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_annual?: number
          price_monthly?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_locations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          description: string | null
          hourly_rate: number
          id: string
          image_url: string | null
          is_active: boolean
          max_duration_hours: number
          min_duration_hours: number
          name: string
          tenant_id: string
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hourly_rate: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_duration_hours?: number
          min_duration_hours?: number
          name: string
          tenant_id: string
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_duration_hours?: number
          min_duration_hours?: number
          name?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mercadopago_subscription_id: string | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercadopago_subscription_id?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercadopago_subscription_id?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
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
      allocate_booking_number: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      create_booking_if_available: {
        Args: {
          p_add_on_ids?: string[]
          p_booker_id: string
          p_duration_hours: number
          p_end_time: string
          p_location_id: string
          p_resource_id: string
          p_start_time: string
        }
        Returns: Json
      }
      get_bookings_for_resource: {
        Args: { p_end: string; p_resource_id: string; p_start: string }
        Returns: {
          end_time: string
          start_time: string
        }[]
      }
      get_current_tenant_id: { Args: never; Returns: string }
      search_bookings: {
        Args: {
          p_from?: string
          p_has_add_ons?: boolean
          p_location_id?: string
          p_page?: number
          p_query?: string
          p_resource_id?: string
          p_tab?: string
          p_tenant_id: string
          p_to?: string
        }
        Returns: {
          booker_id: string
          booking_number: number
          created_at: string
          duration_hours: number
          end_time: string
          has_add_ons: boolean
          id: string
          location_id: string | null
          notes: string | null
          paid_amount: number
          payment_status: Database["public"]["Enums"]["booking_payment_status"]
          resource_id: string
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_bookings_count: {
        Args: {
          p_from?: string
          p_has_add_ons?: boolean
          p_location_id?: string
          p_query?: string
          p_resource_id?: string
          p_tab?: string
          p_tenant_id: string
          p_to?: string
        }
        Returns: number
      }
      upsert_booker: {
        Args: { p_email: string; p_name: string; p_phone?: string }
        Returns: string
      }
    }
    Enums: {
      add_on_pricing_mode: "hourly" | "flat"
      booking_payment_status: "unpaid" | "partial" | "paid" | "refunded"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      payment_entry_type: "payment" | "refund"
      payment_method: "cash" | "transfer" | "card" | "mercadopago" | "other"
      resource_type: "room" | "equipment"
      subscription_status: "active" | "past_due" | "cancelled" | "trialing"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      add_on_pricing_mode: ["hourly", "flat"],
      booking_payment_status: ["unpaid", "partial", "paid", "refunded"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      payment_entry_type: ["payment", "refund"],
      payment_method: ["cash", "transfer", "card", "mercadopago", "other"],
      resource_type: ["room", "equipment"],
      subscription_status: ["active", "past_due", "cancelled", "trialing"],
    },
  },
} as const

