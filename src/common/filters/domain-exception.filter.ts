// LOCATION: src/common/filters/domain-exception.filter.ts
// SECTION: Update catch() method (around line 8-22)

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { DomainError, DomainErrorKind } from '../exceptions/domain-error';
import { Request, Response } from 'express';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status = this.mapKindToStatus(exception.kind);

    // ✅ FIXED: Log errors for debugging (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[DomainError] ${exception.code}: ${exception.message}`,
        exception.details,
        exception.stack,
      );
    } else {
      // In production, still log but without stack trace
      console.error(`[DomainError] ${exception.code}: ${exception.message}`);
    }

    res.status(status).json({
      status: 'error',
      message: exception.message,
      code: exception.code,
      details: exception.details ?? null,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapKindToStatus(kind: DomainErrorKind): number {
    switch (kind) {
      case 'not_found':
        return HttpStatus.NOT_FOUND; // 404
      case 'already_exists':
        return HttpStatus.CONFLICT; // 409
      case 'conflict':
        return HttpStatus.CONFLICT; // 409
      case 'validation':
        return HttpStatus.UNPROCESSABLE_ENTITY; // 422
      case 'forbidden':
        return HttpStatus.FORBIDDEN; // 403
      case 'unauthorized':
        return HttpStatus.UNAUTHORIZED; // 401
      case 'unexpected':
      default:
        return HttpStatus.BAD_REQUEST; // 400
    }
  }
}