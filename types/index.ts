export type District =
  | '豐原區' | '后里區' | '神岡區' | '大雅區' | '潭子區'
  | '外埔區' | '石岡區' | '新社區' | '和平區' | '東勢區'

export interface School {
  id: number
  code: number           // 編號 1-90
  district: District
  name: string
  approved_total: number // 核定金額
  sem1_amount: number    // 第1學期
  sem2_amount: number    // 第2學期（本局扣減/補回後可更新）
}

export interface UserProfile {
  id: string
  email: string
  school_id: number | null
  is_admin: boolean
  created_at: string
}

export interface BankAccount {
  id: string
  school_id: number
  bank_name: string       // 銀行名稱
  branch_name: string     // 分行名稱
  bank_code: string       // 金融機構代碼（7碼）
  account_name: string    // 帳戶戶名
  account_number: string  // 帳號
  contact_name: string    // 聯絡人
  contact_phone: string   // 聯絡電話
  confirmed_at: string | null
  confirmed_by: string | null
  is_modified: boolean    // 是否與預載資料不同
  semester: 1 | 2
}

export interface Settlement {
  id: string
  school_id: number
  semester: 1 | 2
  personnel_expense: number   // 人事費(D)
  business_expense: number    // 業務費(D)
  equipment_expense: number   // 設備及投資(D)
  total_expense: number       // 實支總額(D) = 三項合計
  surplus: number             // 結餘款(E = A-D)
  repay_amount: number        // 應繳回(F = E×C，無條件進位)
  scan_file_path: string | null  // 掃描檔路徑
  scan_uploaded_at: string | null
  remittance_file_path: string | null  // 送款憑單（第2學期）
  remittance_date: string | null
  status: 'draft' | 'downloaded' | 'uploaded'
  created_at: string
  updated_at: string
}

export type SemesterStatus = {
  school_id: number
  school_name: string
  district: string
  semester: 1 | 2
  bank_confirmed: boolean
  bank_modified: boolean
  settlement_status: Settlement['status'] | null
  scan_uploaded: boolean
  remittance_uploaded: boolean  // 第2學期
  has_surplus: boolean
}
