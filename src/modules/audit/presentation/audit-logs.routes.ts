import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { auditRead } from "../../../middlewares/audit-trail.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { AuditAction } from "../domain/entities/AuditEntry";
import { listAuditLogs } from "./audit-logs.controller";
import { listAuditLogsQuerySchema } from "./audit-logs.validators";

export const auditLogRoutes = Router();

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     summary: List audit logs (Administrator only)
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of audit logs per page
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *           maxLength: 512
 *         description: Cursor returned by the previous page
 *       - in: query
 *         name: action
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACCESS_DENIED, RESOURCE_CHANGED, AUDIT_LOG_VIEWED]
 *         description: Filter audit logs by action type
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter logs by user ID
 *       - in: query
 *         name: route
 *         required: false
 *         schema:
 *           type: string
 *           maxLength: 191
 *         description: Filter logs by route pattern (e.g. /collection-points/:id)
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of the date range in ISO 8601 (must be sent together with `to`)
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of the date range in ISO 8601 (must be sent together with `from`; maximum 90 days)
 *     responses:
 *       200:
 *         description: Paginated audit logs with items and nextCursor
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */

auditLogRoutes.get(
  "/admin/audit-logs",
  authenticate,
  authorize(Role.ADMIN),
  auditRead(AuditAction.AUDIT_LOG_VIEWED),
  validate(listAuditLogsQuerySchema, "query"),
  listAuditLogs,
);
