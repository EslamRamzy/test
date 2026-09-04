import type { ArticleListQuery } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../../errors/AppError.js';
import { sendPaginatedSuccess, sendSuccess } from '../../lib/httpResponse.js';
import * as articleService from '../../services/articleService.js';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ArticleListQuery;
    const { items, meta } = await articleService.listArticles(query);
    sendPaginatedSuccess(res, items, meta);
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params as { slug: string };
    const result = await articleService.getArticleBySlug(slug);
    if (!result) throw new NotFoundError('Article not found');
    sendSuccess(res, { ...result.article, related: result.related });
  } catch (error) {
    next(error);
  }
}
