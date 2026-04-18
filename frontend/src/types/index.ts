export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker: string;
  confidence?: number;
}

export interface AgeEstimation {
  estimated_age: number;
  confidence: number;
  frames_analyzed: number;
}

export interface LivenessResult {
  is_live: boolean;
  confidence: number;
  signals: Record<string, unknown>;
}

export interface VisionResult {
  age_estimation: AgeEstimation;
  liveness: LivenessResult;
}

/** Offer from decision API (`offer_id`) or persisted session row (`offer_ref`). */
export interface LoanOffer {
  offer_id?: string;
  offer_ref?: string;
  principal_amount: number;
  tenure_months?: number;
  interest_rate_pa?: number;
  monthly_emi?: number;
  processing_fee?: number;
  total_payable?: number;
  expires_at?: string;
}

export type DecisionOutcome = "approved" | "rejected" | "manual_review";
export type RiskBand = "low" | "medium" | "high" | "reject";

export interface DecisionResult {
  outcome: DecisionOutcome;
  risk_band: RiskBand;
  explanation: string;
  offers: LoanOffer[];
  failed_rules: string[];
}

export interface GeoInfo {
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
}

export interface ExtractedProfile {
  full_name?: string;
  declared_age?: number;
  employment_type?: string;
  employer_name?: string;
  monthly_income?: number;
  loan_amount_requested?: number;
  loan_purpose?: string;
  tenure_months_requested?: number;
  existing_emi_total?: number;
  city?: string;
  pincode?: string;
  confidence?: number;
}

export interface RiskAssessment {
  risk_score: number;
  risk_band: RiskBand;
  propensity_score: number;
  drivers: string[];
}

export interface BureauSnapshot {
  customer_ref: string;
  cibil_score?: number;
  active_loans: number;
  total_outstanding: number;
  overdue_count: number;
  inquiries_last_6m: number;
  oldest_account_months: number;
}

export interface SessionDetail {
  id: string;
  status: string;
  campaign_id: string;
  channel: string;
  customer_msisdn?: string;
  geo: GeoInfo;
  extracted_profile?: ExtractedProfile;
  bureau_snapshot?: BureauSnapshot;
  risk_assessment?: RiskAssessment;
  age_estimation?: AgeEstimation;
  liveness_result?: LivenessResult;
  decision?: DecisionResult;
  offers: LoanOffer[];
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
