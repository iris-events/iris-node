import type * as classTransformer from 'class-transformer'
import type * as classValidator from 'class-validator'

export interface ValidationOptions {
  classTransform?: classTransformer.ClassTransformOptions
  /**
   * If false, Messages will not be validated against the
   * decorated class neither when publishing nor when received.
   */
  validate?: boolean | classValidator.ValidatorOptions
}

export class ValidationError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(tag: string, msg: string, details?: Record<string, any>) {
    super(
      `ERR_IRIS_${tag}\n${msg}${
        details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`
      }`,
    )
  }
}
