import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { tryMapCognitoError } from '../../cognito/cognito-errors';

/**
 * Safety net: Cognito/AWS SDK errors that escape services become proper HTTP
 * responses instead of Nest's generic 500.
 */
@Catch()
export class AwsCognitoExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly log = new Logger(AwsCognitoExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    const mapped = tryMapCognitoError(exception);
    if (mapped) {
      this.log.warn(
        `Mapped Cognito/AWS error → HTTP ${mapped.getStatus()}: ${mapped.message}`,
      );
      super.catch(mapped, host);
      return;
    }

    this.log.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    // Only if response API looks Express-like; else fall back to BaseExceptionFilter
    if (typeof res?.status === 'function') {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
      return;
    }
    super.catch(exception as Error, host);
  }
}
