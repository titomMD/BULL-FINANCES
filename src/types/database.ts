export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      budget_expenses: {
        Row: {
          budget_id: string
          created_at: string
          expense_id: string
          household_id: string
          user_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          expense_id: string
          household_id: string
          user_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          expense_id?: string
          household_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_expenses_budget_id_household_id_user_id_fkey'
            columns: ['budget_id', 'household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'budgets'
            referencedColumns: ['id', 'household_id', 'user_id']
          },
          {
            foreignKeyName: 'budget_expenses_expense_id_household_id_fkey'
            columns: ['expense_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id', 'household_id']
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          household_id: string
          id: string
          kind: string
          name: string
          period: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          kind: string
          name: string
          period: string
          user_id?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          name?: string
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budgets_category_id_household_id_fkey'
            columns: ['category_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'budgets_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'budgets_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
        ]
      }
      card_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          date: string
          household_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          household_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          household_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'card_payments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_payments_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_payments_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'card_payments_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_payments_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          household_id: string
          icon: string | null
          id: string
          kind: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          household_id: string
          icon?: string | null
          id?: string
          kind?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'categories_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      expense_categories: {
        Row: {
          category_id: string
          created_at: string
          expense_id: string
          household_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          expense_id: string
          household_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          expense_id?: string
          household_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expense_categories_category_id_household_id_fkey'
            columns: ['category_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'expense_categories_expense_id_household_id_fkey'
            columns: ['expense_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id', 'household_id']
          },
        ]
      }
      expense_splits: {
        Row: {
          amount: number
          expense_id: string
          household_id: string
          id: string
          share_bp: number
          user_id: string
        }
        Insert: {
          amount: number
          expense_id: string
          household_id: string
          id?: string
          share_bp: number
          user_id: string
        }
        Update: {
          amount?: number
          expense_id?: string
          household_id?: string
          id?: string
          share_bp?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expense_splits_expense_id_household_id_fkey'
            columns: ['expense_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'expense_splits_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string | null
          currency: string
          date: string
          description: string
          household_id: string
          id: string
          notes: string | null
          paid_by: string
          paid_with_card: boolean
          recurring_due_date: string | null
          recurring_expense_id: string | null
          split_type: string
          status: string
          updated_at: string
          updated_by: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description: string
          household_id: string
          id?: string
          notes?: string | null
          paid_by: string
          paid_with_card?: boolean
          recurring_due_date?: string | null
          recurring_expense_id?: string | null
          split_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description?: string
          household_id?: string
          id?: string
          notes?: string | null
          paid_by?: string
          paid_with_card?: boolean
          recurring_due_date?: string | null
          recurring_expense_id?: string | null
          split_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_category_id_household_id_fkey'
            columns: ['category_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_household_id_paid_by_fkey'
            columns: ['household_id', 'paid_by']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'expenses_recurring_fkey'
            columns: ['recurring_expense_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'recurring_expenses'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'expenses_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'household_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'households_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'households_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      income_splits: {
        Row: {
          amount: number
          household_id: string
          id: string
          income_id: string
          share_bp: number
          user_id: string
        }
        Insert: {
          amount: number
          household_id: string
          id?: string
          income_id: string
          share_bp: number
          user_id: string
        }
        Update: {
          amount?: number
          household_id?: string
          id?: string
          income_id?: string
          share_bp?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'income_splits_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'income_splits_income_id_household_id_fkey'
            columns: ['income_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'incomes'
            referencedColumns: ['id', 'household_id']
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          date: string
          household_id: string
          id: string
          notes: string | null
          source: string
          split_type: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          household_id: string
          id?: string
          notes?: string | null
          source: string
          split_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          household_id?: string
          id?: string
          notes?: string | null
          source?: string
          split_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'incomes_category_id_household_id_fkey'
            columns: ['category_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'incomes_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'incomes_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'incomes_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'incomes_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'incomes_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          household_id: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          household_id: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_used_by_fkey'
            columns: ['used_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      personal_movements: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          date: string
          description: string
          household_id: string
          id: string
          kind: string
          notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description: string
          household_id: string
          id?: string
          kind: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description?: string
          household_id?: string
          id?: string
          kind?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'personal_movements_category_id_household_id_fkey'
            columns: ['category_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'personal_movements_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'personal_movements_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
        ]
      }
      profiles: {
        Row: {
          accent: string
          corners: string
          created_at: string
          density: string
          display_name: string
          font: string
          id: string
          mode: string
          motion: string
          person_color: string | null
          private_mode: boolean
          report_chart: string
          spend_alert_threshold: number
          spend_alerts: boolean
          text_size: string
          theme: string
          updated_at: string
        }
        Insert: {
          accent?: string
          corners?: string
          created_at?: string
          density?: string
          display_name: string
          font?: string
          id: string
          mode?: string
          motion?: string
          person_color?: string | null
          private_mode?: boolean
          report_chart?: string
          spend_alert_threshold?: number
          spend_alerts?: boolean
          text_size?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          corners?: string
          created_at?: string
          density?: string
          display_name?: string
          font?: string
          id?: string
          mode?: string
          motion?: string
          person_color?: string | null
          private_mode?: boolean
          report_chart?: string
          spend_alert_threshold?: number
          spend_alerts?: boolean
          text_size?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expense_splits: {
        Row: {
          household_id: string
          id: string
          recurring_expense_id: string
          share_bp: number
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          recurring_expense_id: string
          share_bp: number
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          recurring_expense_id?: string
          share_bp?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recurring_expense_splits_household_id_user_id_fkey'
            columns: ['household_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'recurring_expense_splits_recurring_expense_id_household_id_fkey'
            columns: ['recurring_expense_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'recurring_expenses'
            referencedColumns: ['id', 'household_id']
          },
        ]
      }
      recurring_expenses: {
        Row: {
          active: boolean
          amount: number
          anchor_day: number
          category_id: string
          created_at: string
          created_by: string | null
          currency: string
          frequency: string
          household_id: string
          id: string
          name: string
          next_due_date: string
          notes: string | null
          paid_by: string
          paid_with_card: boolean
          split_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          anchor_day?: number
          category_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          frequency: string
          household_id: string
          id?: string
          name: string
          next_due_date: string
          notes?: string | null
          paid_by: string
          paid_with_card?: boolean
          split_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          anchor_day?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          frequency?: string
          household_id?: string
          id?: string
          name?: string
          next_due_date?: string
          notes?: string | null
          paid_by?: string
          paid_with_card?: boolean
          split_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recurring_expenses_category_id_household_id_fkey'
            columns: ['category_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'recurring_expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recurring_expenses_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recurring_expenses_household_id_paid_by_fkey'
            columns: ['household_id', 'paid_by']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'recurring_expenses_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          date: string
          from_user: string
          household_id: string
          id: string
          notes: string | null
          status: string
          to_user: string
          updated_at: string
          updated_by: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          from_user: string
          household_id: string
          id?: string
          notes?: string | null
          status?: string
          to_user: string
          updated_at?: string
          updated_by?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          from_user?: string
          household_id?: string
          id?: string
          notes?: string | null
          status?: string
          to_user?: string
          updated_at?: string
          updated_by?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'transfers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transfers_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transfers_household_id_from_user_fkey'
            columns: ['household_id', 'from_user']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'transfers_household_id_to_user_fkey'
            columns: ['household_id', 'to_user']
            isOneToOne: false
            referencedRelation: 'household_members'
            referencedColumns: ['household_id', 'user_id']
          },
          {
            foreignKeyName: 'transfers_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transfers_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_code: string }; Returns: string }
      create_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_date?: string
          p_description: string
          p_extra_category_ids?: Json
          p_household_id: string
          p_notes?: string
          p_paid_by: string
          p_paid_with_card?: boolean
          p_participants?: Json
          p_split_type?: string
        }
        Returns: string
      }
      create_household: { Args: { p_name: string }; Returns: string }
      create_income: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_date?: string
          p_household_id: string
          p_notes?: string
          p_participants?: Json
          p_source: string
          p_split_type?: string
          p_user_id: string
        }
        Returns: string
      }
      create_invitation: {
        Args: { p_household_id: string }
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      create_recurring_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_frequency: string
          p_household_id: string
          p_name: string
          p_next_due_date: string
          p_notes?: string
          p_paid_by: string
          p_paid_with_card?: boolean
          p_participants?: Json
          p_split_type?: string
        }
        Returns: string
      }
      generate_recurring_expense: {
        Args: {
          p_amount?: number
          p_date?: string
          p_recurring_expense_id: string
        }
        Returns: string
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      leave_household: { Args: { p_household_id: string }; Returns: undefined }
      set_expense_budgets: {
        Args: { p_budget_ids: Json; p_expense_id: string }
        Returns: undefined
      }
      skip_recurring_expense: {
        Args: { p_recurring_expense_id: string }
        Returns: undefined
      }
      update_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_date?: string
          p_description: string
          p_expense_id: string
          p_extra_category_ids?: Json
          p_notes?: string
          p_paid_by: string
          p_paid_with_card?: boolean
          p_participants?: Json
          p_split_type?: string
        }
        Returns: undefined
      }
      update_income: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_date?: string
          p_income_id: string
          p_notes?: string
          p_participants?: Json
          p_source: string
          p_split_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_recurring_expense: {
        Args: {
          p_active?: boolean
          p_amount: number
          p_category_id: string
          p_frequency: string
          p_name: string
          p_next_due_date: string
          p_notes?: string
          p_paid_by: string
          p_paid_with_card?: boolean
          p_participants?: Json
          p_recurring_expense_id: string
          p_split_type?: string
        }
        Returns: undefined
      }
      void_expense: { Args: { p_expense_id: string }; Returns: undefined }
      void_income: { Args: { p_income_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
