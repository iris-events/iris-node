import { UnauthorizedException, ForbiddenException, CreateParamDecorator, GetAmqpMessage } from './index.interfaces'

export class CustomIntegration {
  private static _UnauthorizedException: UnauthorizedException
  private static _ForbiddenException: ForbiddenException

  private static _createParamDecorator: CreateParamDecorator
  private static _getAmqpMessage: GetAmqpMessage

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

  public static set createParamDecorator(customDecorator: CreateParamDecorator) {
    CustomIntegration._createParamDecorator = customDecorator
  }

  public static get createParamDecorator(): CreateParamDecorator {
    return CustomIntegration._createParamDecorator
  }

  public static set getAmqpMessage(customFunction: GetAmqpMessage) {
    CustomIntegration._getAmqpMessage = customFunction
  }

  public static get getAmqpMessage(): GetAmqpMessage {
    return CustomIntegration._getAmqpMessage
  }
}
