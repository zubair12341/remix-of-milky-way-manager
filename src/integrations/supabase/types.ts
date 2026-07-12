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
      branches: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          branch_id: string | null
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          id: string
          language: string
          name: string
          owner_user_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          language?: string
          name: string
          owner_user_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          language?: string
          name?: string
          owner_user_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cash_sales: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          operator_name: string | null
          sale_at: string
          slip_number: number | null
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          operator_name?: string | null
          sale_at?: string
          slip_number?: number | null
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          operator_name?: string | null
          sale_at?: string
          slip_number?: number | null
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pauses: {
        Row: {
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_date: string
          id: string
          monthly_client_id: string
          reason: string | null
          sync_version: number
          to_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_date: string
          id?: string
          monthly_client_id: string
          reason?: string | null
          sync_version?: number
          to_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_date?: string
          id?: string
          monthly_client_id?: string
          reason?: string | null
          sync_version?: number
          to_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pauses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pauses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pauses_monthly_client_id_fkey"
            columns: ["monthly_client_id"]
            isOneToOne: false
            referencedRelation: "monthly_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_clients: {
        Row: {
          active: boolean
          address: string | null
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          daily_quantity: number
          deleted_at: string | null
          id: string
          milk_type: string | null
          mobile: string | null
          name: string
          rate_per_liter: number
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          daily_quantity?: number
          deleted_at?: string | null
          id?: string
          milk_type?: string | null
          mobile?: string | null
          name: string
          rate_per_liter?: number
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          daily_quantity?: number
          deleted_at?: string | null
          id?: string
          milk_type?: string | null
          mobile?: string | null
          name?: string
          rate_per_liter?: number
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_clients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_deliveries: {
        Row: {
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_date: string
          id: string
          monthly_client_id: string
          quantity: number
          rate: number
          status: string
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date: string
          id?: string
          monthly_client_id: string
          quantity?: number
          rate?: number
          status?: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string
          id?: string
          monthly_client_id?: string
          quantity?: number
          rate?: number
          status?: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_deliveries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_deliveries_monthly_client_id_fkey"
            columns: ["monthly_client_id"]
            isOneToOne: false
            referencedRelation: "monthly_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_payments: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          monthly_client_id: string
          note: string | null
          payment_date: string
          period: string | null
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          monthly_client_id: string
          note?: string | null
          payment_date: string
          period?: string | null
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          monthly_client_id?: string
          note?: string | null
          payment_date?: string
          period?: string | null
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_payments_monthly_client_id_fkey"
            columns: ["monthly_client_id"]
            isOneToOne: false
            referencedRelation: "monthly_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_categories: {
        Row: {
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: string
          name: string
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: string
          name: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: string
          name?: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          category_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          invoice_no: string | null
          notes: string | null
          payment_mode: string
          purchase_date: string
          qty: number
          rate: number
          supplier_id: string | null
          sync_version: number
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          business_id: string
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          payment_mode?: string
          purchase_date: string
          qty?: number
          rate?: number
          supplier_id?: string | null
          sync_version?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          payment_mode?: string
          purchase_date?: string
          qty?: number
          rate?: number
          supplier_id?: string | null
          sync_version?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "purchase_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          mode: string
          notes: string | null
          payment_date: string
          reference_no: string | null
          supplier_id: string
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mode?: string
          notes?: string | null
          payment_date: string
          reference_no?: string | null
          supplier_id: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference_no?: string | null
          supplier_id?: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          mobile: string | null
          name: string
          notes: string | null
          opening_balance: number
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          opening_balance?: number
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          opening_balance?: number
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      udhar_customers: {
        Row: {
          address: string | null
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          mobile: string | null
          name: string
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mobile?: string | null
          name: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mobile?: string | null
          name?: string
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "udhar_customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "udhar_customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      udhar_entries: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          entry_date: string
          entry_type: string
          id: string
          notes: string | null
          sync_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          business_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          notes?: string | null
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          notes?: string | null
          sync_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "udhar_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "udhar_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "udhar_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "udhar_customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_changes: {
        Args: { p_business_id: string; p_changes: Json; p_device_id: string }
        Returns: Json
      }
      business_role_of: {
        Args: { _business_id: string }
        Returns: Database["public"]["Enums"]["business_role"]
      }
      get_changes: {
        Args: { p_business_id: string; p_limit?: number; p_since?: string }
        Returns: Json
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
    }
    Enums: {
      business_role: "owner" | "manager" | "staff"
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
      business_role: ["owner", "manager", "staff"],
    },
  },
} as const
