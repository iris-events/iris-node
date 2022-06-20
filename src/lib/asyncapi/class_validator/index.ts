import _ from 'lodash'
import { ValidationTypes, getMetadataStorage } from 'class-validator'
import { defaultMetadataStorage as classTransformerMetadataStorage } from 'class-transformer/cjs/storage'
import { validationMetadatasToSchemas as origValidationMetadatasToSchemas } from 'class-validator-jsonschema'
import { ValidationMetadata } from 'class-validator/types/metadata/ValidationMetadata'
import { IOptions as JsonSchemaOptionsI } from 'class-validator-jsonschema/build/options'
import { PublicMetadataStorage, SchemaObjects, SchemaObject, ReferenceObject } from '../interfaces'
import { additionalSwaggerConverters } from './converters'

export type GeneratJsonSchemaOpts = Partial<JsonSchemaOptionsI>

export interface AsyncapiClassValidatorI {
  SCHEMA_POINTER_PREFIX: string
  generateOptions?: GeneratJsonSchemaOpts
  validationMetadatas?: ValidationMetadata[]
}

export class AsyncapiClassValidator {
  private SCHEMA_POINTER_PREFIX: string
  private generateOptions: GeneratJsonSchemaOpts
  private validationMetadatas: ValidationMetadata[]

  constructor({ SCHEMA_POINTER_PREFIX, generateOptions, validationMetadatas }: AsyncapiClassValidatorI) {
    this.SCHEMA_POINTER_PREFIX = SCHEMA_POINTER_PREFIX
    this.generateOptions = generateOptions ?? {}
    this.validationMetadatas = validationMetadatas ?? (<PublicMetadataStorage>(<unknown>getMetadataStorage())).validationMetadatas
  }

  public generateJsonSchema(): SchemaObjects {
    const schemaOptions: Partial<JsonSchemaOptionsI> = {
      refPointerPrefix: this.SCHEMA_POINTER_PREFIX,
      classTransformerMetadataStorage,
      additionalConverters: additionalSwaggerConverters,
      ...this.generateOptions,
    }

    return this.validationMetadatasToSchemas(schemaOptions)
  }

  private validationMetadatasToSchemas(userOptions?: Partial<JsonSchemaOptionsI>): SchemaObjects {
    const schemas: SchemaObjects = origValidationMetadatasToSchemas(userOptions)

    this.updateRequired(schemas)
    this.fixNullableRefs(schemas)

    return schemas
  }

  public isPropertyRequired(metas: ValidationMetadata[]): boolean {
    return metas.findIndex((m: ValidationMetadata) => m.type === ValidationTypes.CONDITIONAL_VALIDATION) < 0
  }

  private updateRequired(schemas: SchemaObjects): void {
    const metadatas = this.validationMetadatas

    _(metadatas)
      .groupBy('target.name')
      .forEach((ownMetas: ValidationMetadata[], targetName: string) => {
        const schema: SchemaObject = schemas[targetName]

        const target = <Function>ownMetas[0].target
        const metas = [...ownMetas, ...this.getInheritedMetadatas(target, metadatas)]

        schema.required = _(metas)
          .groupBy('propertyName')
          .filter(meta => this.isPropertyRequired(meta))
          .map((_propMetas: ValidationMetadata[]) => _propMetas[0].propertyName)
          .value()

        if (schema.required.length === 0) {
          delete schema.required
        }
      })
  }

  private fixNullableRefs(schemas: SchemaObjects): void {
    _(schemas)
      .map('properties')
      .map(_.values.bind(null))
      .flatten()
      .forEach((prop: SchemaObject & { nullable?: boolean }) => {
        if ((<{ $ref?: unknown }>prop).$ref !== undefined && prop.nullable === true) {
          this.fixNullableReferenceObject(prop)
        }
      })
  }

  private fixNullableReferenceObject(prop: SchemaObject & { nullable?: boolean }): void {
    // nullable ref. by v3.1.0 spec
    const ref = { $ref: (<ReferenceObject>prop).$ref }
    delete prop.nullable
    prop.anyOf = [ref, { type: 'null' }]

    delete (<{ $ref?: unknown }>prop).$ref
  }

  private getInheritedMetadatas(target: Function, metadatas: ValidationMetadata[]): ValidationMetadata[] {
    return metadatas.filter(
      d =>
        d.target instanceof Function &&
        target.prototype instanceof d.target &&
        !_.find(metadatas, {
          propertyName: d.propertyName,
          target,
          type: d.type,
        })
    )
  }
}
