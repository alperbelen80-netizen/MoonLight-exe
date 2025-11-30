import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let userMessage = 'Bir hata oluştu. Lütfen tekrar deneyin.';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        userMessage = this.getUserFriendlyMessage(exceptionResponse, status);
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        userMessage = this.getUserFriendlyMessage(message, status);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      userMessage = this.getUserFriendlyMessage(message, status);
    }

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      statusCode: status,
      message: userMessage,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getUserFriendlyMessage(technicalMessage: string, status: number): string {
    if (status === HttpStatus.NOT_FOUND) {
      if (technicalMessage.includes('Backtest')) return 'Backtest run bulunamadı.';
      if (technicalMessage.includes('Account')) return 'Hesap bulunamadı.';
      if (technicalMessage.includes('Alert')) return 'Uyarı bulunamadı.';
      return 'İstenen kayıt bulunamadı.';
    }

    if (status === HttpStatus.BAD_REQUEST) {
      if (technicalMessage.includes('validation')) return 'Geçersiz parametre. Lütfen girişleri kontrol edin.';
      if (technicalMessage.includes('minWinRate')) return 'Minimum Win Rate, maksimum değerden büyük olamaz.';
      if (technicalMessage.includes('date')) return 'Geçersiz tarih aralığı.';
      return 'Geçersiz istek parametreleri.';
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      if (technicalMessage.includes('Redis')) return 'Bağlantı hatası. Redis servisini kontrol edin.';
      if (technicalMessage.includes('Database')) return 'Veritabanı hatası. Lütfen tekrar deneyin.';
      if (technicalMessage.includes('Queue')) return 'İşlem kuyruğu hatası. Lütfen tekrar deneyin.';
      return 'Sistem hatası. Lütfen tekrar deneyin veya desteğe başvurun.';
    }

    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
