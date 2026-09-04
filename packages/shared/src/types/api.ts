import type { ErrorCode } from '../constants/api.js';

/** Field-level validation detail. Only ever echoes the caller's own field names. */
export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiPaginatedSuccess<T> extends ApiSuccess<T[]> {
  meta: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    /** Present only for VALIDATION_ERROR. */
    details?: ApiFieldError[];
    /** Present on INTERNAL_ERROR so a masked response is still traceable in the logs. */
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success;
}
