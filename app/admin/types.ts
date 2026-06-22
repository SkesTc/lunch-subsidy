export interface School {
  id: number; code: number; district: string; name: string
}
export interface AmountRow {
  school_id: number; school_year: string; sem1_amount: number; sem2_amount: number; approved_total: number
}
export interface BankRow {
  school_id: number; semester: number; confirmed_at: string | null; is_modified: boolean
  bank_name: string | null; branch_name: string | null; bank_code: string | null
  account_name: string | null; account_number: string | null
}
export interface SettleRow {
  id: number; school_id: number; semester: number; status: string
  scan_file_path: string | null; remittance_file_path: string | null; remittance_date: string | null
  repay_amount: number; surplus: number; total_expense: number
}
export interface ProfileRow { email: string; school_id: number | null; is_admin: boolean }
export interface ContactInfo { contact_name: string; contact_title: string; contact_phone: string }
