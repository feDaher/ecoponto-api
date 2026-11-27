export type PointCategoryApprovalStatus = "PENDING" | "APPROVED";

export class PointCategory {
  constructor(
    public readonly pointId: string,
    public readonly categoryId: string,
    public readonly categoryName: string,
    public readonly approvalStatus: PointCategoryApprovalStatus,
    // Material settings (BE-19): a paused link stays in the portfolio but receives nothing.
    public readonly isAccepting: boolean = true,
    public readonly capacityKg: number | null = null,
  ) {}

  get isApproved(): boolean {
    return this.approvalStatus === "APPROVED";
  }
}
