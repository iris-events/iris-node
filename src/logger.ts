export class Logger {
  console: Console
  context: string

  constructor(componentName: string) {
    this.console = console
    this.context = componentName
  }

  setContext(ctx: string): void {
    this.context = ctx
  }

  error(message: string, errStack?: string | Error, details?: unknown): void {
    this.console.error(message, { errStack, details })
  }

  errorDetails(message: string, details?: unknown): void {
    this.console.error(message, { details })
  }

  log(message: string, details?: unknown): void {
    this.console.info(message, { details })
  }

  warn(message: string, details?: unknown): void {
    this.console.warn(message, { details })
  }

  debug(message: string, details?: unknown): void {
    this.console.debug(message, { details })
  }

  verbose(message: string, details?: unknown): void {
    this.console.debug(message, { details })
  }
}
