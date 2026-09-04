import type { AuditLogQuery } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { sendPaginatedSuccess } from '../../lib/httpResponse.js';
import * as auditLogService from '../../services/auditLogService.js';

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items, meta } = await auditLogService.listAuditLogs(
      req.query as unknown as AuditLogQuery,
    );
    sendPaginatedSuccess(res, items, meta);
  } catch (error) {
    next(error);
  }
}

export const auditLogController = { list };
