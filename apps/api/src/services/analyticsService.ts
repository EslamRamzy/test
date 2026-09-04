import type { AnalyticsViewInput } from '@portfolio/shared';
import * as pageViewRepository from '../repositories/pageViewRepository.js';
import { hashIp } from '../utils/hashIp.js';

export interface AnalyticsContext {
  ip: string;
  userAgent: string | undefined;
}

/** Fire-and-forget page-view beacon (docs/architecture/03 §3, §09 §10) — no raw IP is ever stored, only its daily-rotating hash. */
export async function recordView(input: AnalyticsViewInput, ctx: AnalyticsContext): Promise<void> {
  await pageViewRepository.create({
    path: input.path,
    entityType: input.entityType,
    entityId: input.entityId,
    referrerHost: input.referrerHost,
    visitorHash: hashIp(ctx.ip, ctx.userAgent),
  });
}
