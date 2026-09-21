import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp(); const req = ctx.getRequest<Request>(); const res = ctx.getResponse<Response>();
    const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '';
    const mapped: Record<string, [number, string]> = { P2025: [404, 'Không tìm thấy dữ liệu.'], P2002: [409, 'Dữ liệu đã tồn tại. Vui lòng kiểm tra mã hoặc email.'], P2003: [400, 'Dữ liệu liên kết không tồn tại.'], P2034: [409, 'Dữ liệu vừa được cập nhật bởi thao tác khác. Vui lòng thử lại.'] };
    const status = error instanceof HttpException ? error.getStatus() : mapped[prismaCode]?.[0] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const body = error instanceof HttpException ? error.getResponse() : mapped[prismaCode]?.[1] ?? 'Internal server error';
    const message = typeof body === 'string' ? body : (body as { message?: unknown }).message ?? 'Request failed';
    res.status(status).json({ success: false, error: { code: `HTTP_${status}`, message }, requestId: req.headers['x-request-id'] });
  }
}
