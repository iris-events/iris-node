import _ from 'lodash'
import * as interfaces from '../interfaces'
import { AsyncapiClassValidator } from '../class_validator'
import { ProcessedMessageMetadataI } from '../../message.interfaces'

export interface IrisSchemasI {
  messages: ProcessedMessageMetadataI[]
  asyncapiClassValidator: AsyncapiClassValidator
}

export class IrisSchemas {
  private messages: ProcessedMessageMetadataI[]
  private asyncapiClassValidator: AsyncapiClassValidator

  constructor({ messages, asyncapiClassValidator }: IrisSchemasI) {
    this.messages = messages
    this.asyncapiClassValidator = asyncapiClassValidator
  }

  public getSchemasForMessages(): interfaces.SchemaObjects {
    const schemas = this.pickRelevantSchemas()

    return this.fixDateTimeProperties(schemas)
  }

  private pickRelevantSchemas(): interfaces.SchemaObjects {
    const schemas = this.asyncapiClassValidator.generateJsonSchema()
    const eventSchemas = this.getBaseEventSchemasFromMessages(schemas)

    function searchObjForRefs(obj?: interfaces.SchemaObject | unknown[] | null): void {
      if (obj !== null && (Array.isArray(obj) || typeof obj === 'object')) {
        Object.values(obj)
          .flat()
          .forEach(prop => {
            if (Array.isArray(prop)) {
              searchObjForRefs(prop)
            } else if (typeof prop === 'object') {
              if ((<{ $ref?: string }>prop).$ref !== undefined) {
                const sname = <string>(<string>(<{ $ref?: string }>prop).$ref).split('/').pop()
                if (eventSchemas[sname] === undefined) {
                  eventSchemas[sname] = sname
                }
                searchObjForRefs(schemas[sname])
              } else {
                searchObjForRefs(<Record<string, unknown>>prop)
              }
            }
          })
      }
    }

    Object.keys(schemas)
      .filter(sname => eventSchemas[sname] !== undefined)
      .map(sname => (<{ properties?: Record<string, unknown> }>schemas[<string>eventSchemas[sname]]).properties)
      .filter(obj => obj !== undefined)
      .forEach(searchObjForRefs)

    return _.reduce(
      eventSchemas,
      (sc, targetClassName, lookup) => ({
        ...sc,
        [lookup]: schemas[<string>targetClassName],
      }),
      {}
    )
  }

  private getBaseEventSchemasFromMessages(schemas: interfaces.SchemaObjects): Record<string, string | undefined> {
    return this.messages.reduce((acc, msgMeta) => {
      const { targetClassName: cName } = msgMeta
      const hasSchema = <interfaces.SchemaObject | undefined>schemas[cName] !== undefined

      if (!hasSchema) {
        throw new Error(`ERR_IRIS_ASYNCAPI_MESSAGE_SCHEMA_NOT_FOUND_FOR: ${cName}`)
      }

      return { ...acc, [cName]: cName }
    }, {})
  }

  private fixDateTimeProperties(schemas: interfaces.SchemaObjects): interfaces.SchemaObjects {
    // Date becomes
    // oneOf: [{ format: 'date-time', type: string }, { format: 'date', format: string }]
    // Java implementation prefers first one and does not handle second one.

    const fixedSchemas = _.merge({}, schemas)

    _(fixedSchemas)
      .map(schema => schema.properties)
      .each((props?: Record<string, interfaces.SchemaObject | interfaces.ReferenceObject>) => {
        if (props === undefined) {
          return
        }

        _(props)
          .values()
          .each((prop: interfaces.SchemaObject | interfaces.ReferenceObject) => {
            if ((<interfaces.SchemaObject>prop).oneOf === undefined) {
              return
            }

            const soProp = <interfaces.SchemaObject>prop
            const oneOf = <interfaces.SchemaObject[]>soProp.oneOf

            const datesOnly = oneOf.map(oo => oo.format).filter(fmt => fmt === 'date' || fmt === 'date-time').length === 2

            if (datesOnly) {
              soProp.format = 'date-time'
              soProp.type = 'string'
              delete soProp.oneOf
            }
          })
      })

    return fixedSchemas
  }
}
