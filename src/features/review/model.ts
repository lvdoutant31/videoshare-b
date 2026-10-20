export type ReviewTaskStatus = 'PENDING' | 'CLAIMED' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';
export type ReviewRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ReviewDecision = 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';

export interface ReviewQuery { page: number; pageSize: number; keyword?: string; authorId?: string; riskLevel?: ReviewRiskLevel; }
export interface ReviewFinding { level: ReviewRiskLevel; source: string; description: string; score: number; }
export interface ReviewHistory { action: 'SUBMITTED' | 'CLAIMED' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'; operator: string; createdAt: string; reason?: string; }
export interface ReviewTask {
  id: string; videoId: string; title: string; author: string; category: string; tags: string[]; description: string; durationSeconds: number; videoUrl: string | null; submittedAt: string; status: ReviewTaskStatus; riskLevel: ReviewRiskLevel; findings: ReviewFinding[]; claimedBy: string | null; claimToken: string | null; version: number; history: ReviewHistory[];
}
export interface ReviewPage { items: ReviewTask[]; page: number; pageSize: number; total: number; }
export interface ReviewDecisionInput { decision: ReviewDecision; reason?: string; currentVersion: number; }
export interface ReviewRepository { list(query: ReviewQuery): Promise<ReviewPage>; get(videoId: string): Promise<ReviewTask>; claim(videoId: string, version: number): Promise<ReviewTask>; decide(videoId: string, input: ReviewDecisionInput): Promise<ReviewTask>; }
export const reviewStatusLabel: Record<ReviewTaskStatus, string> = { PENDING: '待领取', CLAIMED: '审核中', APPROVED: '已通过', REJECTED: '已驳回', REVISION_REQUIRED: '要求修改' };
export const riskLabel: Record<ReviewRiskLevel, string> = { LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险' };
