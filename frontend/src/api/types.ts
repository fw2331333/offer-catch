export interface User {
  id: number;
  email: string;
  username: string;
}

export interface ChatSession {
  id: number;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface MatchItem {
  job_id: number;
  company: string;
  title: string;
  city: string;
  overall_score: number;
  explanation: string;
  recommendation: string;
}

export interface MatchListItem {
  job_id: number;
  company: string;
  title: string;
  city: string;
  analysis_status: "pending" | "analyzing" | "completed" | "failed";
  progress: number;
  overall_score: number | null;
  explanation: string;
  recommendation: string;
  rule_score?: number | null;
}

export interface ResumeListItem {
  id: number;
  filename: string;
  version: number;
  is_active: boolean;
  created_at: string;
  preview: string | null;
  structured?: Record<string, unknown> | null;
}

export interface ResumeListResponse {
  items: ResumeListItem[];
  active_id: number | null;
}

export interface Profile {
  user_id: number;
  target_cities: string[];
  target_roles: string[];
  industries: string[];
  salary_min?: number;
  salary_max?: number;
  job_type: string;
  bio?: string;
}

export interface JobListItem {
  id: number;
  company: string;
  title: string;
  city: string;
  job_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  industry?: string | null;
  tags?: string[] | null;
  source?: string;
  source_url?: string | null;
  is_mine?: boolean;
  is_shared?: boolean;
  shared_by_username?: string | null;
}

export interface JobDetail extends JobListItem {
  description: string;
  requirements?: {
    required_skills?: string[];
    preferred_skills?: string[];
    education?: string;
  } | null;
  created_at?: string;
  created_by_user_id?: number | null;
  can_edit?: boolean;
  can_share?: boolean;
}
