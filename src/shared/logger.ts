import { ConsoleLogger, Injectable, LoggerService, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger extends ConsoleLogger implements LoggerService {
  constructor(context?: string) {
    super(context || '');
  }

  logWithContext(message: any, context?: string) {
    super.log(message, context);
  }

  errorWithContext(message: any, trace?: string, context?: string) {
    super.error(message, trace, context);
  }

  warnWithContext(message: any, context?: string) {
    super.warn(message, context);
  }

  debugWithContext(message: any, context?: string) {
    super.debug(message, context);
  }

  verboseWithContext(message: any, context?: string) {
    super.verbose(message, context);
  }
} 