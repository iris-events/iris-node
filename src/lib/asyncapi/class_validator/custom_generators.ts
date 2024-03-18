import type { ClassConstructor } from 'class-transformer'
import type { IOptions } from 'class-validator-jsonschema/build/options'
import type { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata'
import type { SchemaObject } from '../interfaces'

export type CustomSwaggerGenerator = (
  meta: ValidationMetadata,
  options: IOptions,
) => undefined | SchemaObject

const customGenerators: Map<
  ClassConstructor<unknown>,
  CustomSwaggerGenerator
> = new Map()

export function registerGenerator(
  validator: ClassConstructor<unknown>,
  generator: CustomSwaggerGenerator,
): void {
  customGenerators.set(validator, generator)
}

export function getGenerator(
  validator: ClassConstructor<unknown>,
): CustomSwaggerGenerator {
  const generator: CustomSwaggerGenerator | undefined =
    customGenerators.get(validator)

  if (!generator) {
    throw new Error()
  }

  return generator
}

// register custom:
// registerGenerator(IsNumberOrStringValidator, (_meta, _options) => ({
//   oneOf: [
//     { type: 'string' },
//     { type: 'number' }
//   ]
// }))
