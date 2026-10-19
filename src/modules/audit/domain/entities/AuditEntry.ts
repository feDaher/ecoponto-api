export const AuditAction = {
  ACCESS_DENIED: "ACCESS_DENIED",
  RESOURCE_CHANGED: "RESOURCE_CHANGED",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  method: string;
  route: string | null;
  resourceId: string | null;
  statusCode: number;
}
