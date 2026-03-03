import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        const isHttp = exception instanceof HttpException;
        const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

        console.error(`[HttpErrorFilter] ${request.method} ${request.url} - Status: ${status} - Error:`, exception);

        const base = {
            success: false,
            error: {
                status,
                message: 'Unexpected error',
            },
            meta: {
                path: request?.url,
                requestId: request?.requestId,
                timestamp: new Date().toISOString(),
            },
        };

        if (isHttp) {
            const res = exception.getResponse() as any;
            base.error.message = res?.message || exception.message;
            (base.error as any).code = res?.error || undefined;
            (base.error as any).details = res;
        } else {
            base.error.message = exception?.message || base.error.message;
        }

        response.status(status).json(base);
    }
}
