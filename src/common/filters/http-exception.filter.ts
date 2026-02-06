import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception.getStatus()
    const exceptionResponse = exception.getResponse()

    const message = this.extractMessage(exceptionResponse, exception.message)

    this.logger.warn(
      `${request.method} ${request.url} ${status} - ${Array.isArray(message) ? message.join(', ') : message}`,
    )

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: message,
    })
  }

  private extractMessage(exceptionResponse: string | object, fallback: string): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse
    }

    const responseObj = exceptionResponse as Record<string, unknown>

    if (Array.isArray(responseObj.message)) {
      return responseObj.message
    }

    if (typeof responseObj.message === 'string') {
      return responseObj.message
    }

    return fallback
  }
}
