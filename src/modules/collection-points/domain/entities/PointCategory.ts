export type PointCategoryApprovalStatus = "PENDING" | "APPROVED";

export class PointCategory {
  constructor(
    public readonly pointId: string,
    public readonly categoryId: string,
    public readonly categoryName: string,
    public readonly approvalStatus: PointCategoryApprovalStatus,
  ) {}

  get isApproved(): boolean {
    return this.approvalStatus === "APPROVED";
  }
}
