import { ValidationTypes, IS_INSTANCE } from 'class-validator'
import { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata'
import { IOptions } from 'class-validator-jsonschema/build/options'
import { ClassConstructor } from 'class-transformer'
import { SchemaObject, ReferenceObject } from '../interfaces'
import { getGenerator } from './custom_generators'

export const additionalSwaggerConverters = {
  [ValidationTypes.NESTED_VALIDATION]: (): SchemaObject | void => undefined,
  [ValidationTypes.IS_DEFINED]: (): SchemaObject | void => undefined,
  [ValidationTypes.CUSTOM_VALIDATION]: (meta: ValidationMetadata, options: IOptions): SchemaObject | ReferenceObject | void => {
    try {
      return getGenerator(<ClassConstructor<unknown>>meta.constraintCls)(meta, options)
    } catch {
      if (meta.type === IS_INSTANCE) {
        return meta.constraints[0].name === 'Object' ? { type: 'object' } : { $ref: `${options.refPointerPrefix}${<string>meta.constraints[0].name}` }
      }
    }
  },
}
