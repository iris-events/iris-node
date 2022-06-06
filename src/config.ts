import { UnauthorizedException, ForbiddenException } from './index.interfaces'

export class CustomIntegration {
  private static _UnauthorizedException: UnauthorizedException
  private static _ForbiddenException: ForbiddenException

  public static set UnauthorizedException(errorClass: UnauthorizedException) {
    CustomIntegration._UnauthorizedException = errorClass
  }

  public static get UnauthorizedException(): UnauthorizedException {
    return CustomIntegration._UnauthorizedException
  }

  public static set ForbiddenException(errorClass: ForbiddenException) {
    CustomIntegration._ForbiddenException = errorClass
  }

  public static get ForbiddenException(): ForbiddenException {
    return CustomIntegration._ForbiddenException
  }
}
