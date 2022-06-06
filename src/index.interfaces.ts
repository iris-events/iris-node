export interface UnauthorizedExceptionI extends Error {
  name: string
  message: string
}

export interface UnauthorizedException {
  new (message?: string | undefined): ForbiddenExceptionI
}

export interface ForbiddenExceptionI extends Error {
  name: string
  message: string
}

export interface ForbiddenException {
  new (message?: string | undefined): ForbiddenExceptionI
}

export interface OptionsI {
  unauthorizedException: UnauthorizedException
  forbiddenException: ForbiddenException
}
