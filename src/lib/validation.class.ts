import _ from 'lodash'
import * as validationI from 'class-transformer'
import * as classValidator from 'class-validator'
import * as amqplib from 'amqplib'
import * as interfaces from './validation.interfaces'
import * as messageI from './message.interfaces'
import * as errors from './errors'

let DEFALT_VALIDATION_OPTIONS: interfaces.ValidationOptions | undefined

export function setDefaultValidationOptions(options?: interfaces.ValidationOptions): void {
  DEFALT_VALIDATION_OPTIONS = options
}

export async function convertBufferToTargetClass<T>(msg: amqplib.ConsumeMessage, msgMeta: messageI.MessageMetadataI, disableValidation: boolean): Promise<T> {
  const parsed = parseToObject(msg.content.toString())

  return convertToTargetClass<T>(parsed, <validationI.ClassConstructor<T>>msgMeta.target, msgMeta.validation, disableValidation)
}

export async function convertToTargetClass<T>(
  obj: Object,
  targetClass: validationI.ClassConstructor<T>,
  validation: interfaces.ValidationOptions | undefined,
  disableValidation: boolean
): Promise<T> {
  const cValidation: boolean | classValidator.ValidationOptions | undefined = validation?.validate ?? DEFALT_VALIDATION_OPTIONS?.validate

  const cTransform: validationI.TransformOptions | undefined = validation?.classTransform ?? DEFALT_VALIDATION_OPTIONS?.classTransform

  const converted = validationI.plainToClass<T, Object>(targetClass, obj, cTransform)

  const doValidate = !disableValidation && cValidation !== false

  if (doValidate) {
    const validationOpts = typeof cValidation === 'object' ? cValidation : undefined

    const validationErrors = await classValidator.validate(<Record<string, string>>(<unknown>converted), validationOpts)

    if (validationErrors.length > 0) {
      throw new errors.InvalidObjectConverionError(validationErrors)
    }
  }

  return converted
}

function parseToObject(val: string): typeof Object {
  try {
    const parsed = <unknown>JSON.parse(val)
    if (_.isPlainObject(parsed)) {
      return <typeof Object>parsed
    }
    throw new errors.RejectMsgError('Parsed value is not an object')
  } catch (e) {
    throw new errors.RejectMsgError((<Error>e).message)
  }
}
