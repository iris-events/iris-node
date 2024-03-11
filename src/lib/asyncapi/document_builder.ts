import { cloneDeep, isUndefined, negate, pickBy } from 'lodash'
import type {
  AsyncAPIObject,
  AsyncComponentsObject,
  AsyncServerObject,
  AsyncTagObject,
  ExternalDocumentationObject,
  SecuritySchemeObject,
  TagObject,
} from './interfaces'

interface IrisAsyncAPIObject extends Omit<AsyncAPIObject, 'paths'> {
  servers: Record<string, AsyncServerObject>
  components: AsyncComponentsObject
  tags: AsyncTagObject[]
}

const buildDocumentBase = (): IrisAsyncAPIObject => ({
  asyncapi: '2.2.0',
  info: {
    title: '',
    description: '',
    version: '1.0.0',
    contact: {},
  },
  channels: {},
  tags: [],
  servers: {},
  components: {},
})

export class DocumentBuilder {
  private readonly document: IrisAsyncAPIObject = buildDocumentBase()

  public setTitle(title: string): this {
    this.document.info.title = title

    return this
  }

  public setId(id: string): this {
    this.document.id = id

    return this
  }

  public setDescription(description: string): this {
    this.document.info.description = description

    return this
  }

  public setVersion(version: string): this {
    this.document.info.version = version

    return this
  }

  public setTermsOfService(termsOfService: string): this {
    this.document.info.termsOfService = termsOfService

    return this
  }

  public setContact(name: string, url: string, email: string): this {
    this.document.info.contact = { name, url, email }

    return this
  }

  public setLicense(name: string, url: string): this {
    this.document.info.license = { name, url }

    return this
  }

  public addServer(
    key: string,
    url: string,
    protocol: string,
    serverInfo: Omit<AsyncServerObject, 'url' | 'protocol'> = {},
  ): this {
    this.document.servers[key] = { url, protocol, ...serverInfo }

    return this
  }

  public setExternalDoc(description: string, url: string): this {
    this.document.externalDocs = { description, url }

    return this
  }

  public addTag(
    name: string,
    description = '',
    externalDocs?: ExternalDocumentationObject,
  ): this {
    const tag = <TagObject>(<unknown>pickBy(
      {
        name,
        description,
        externalDocs,
      },
      negate(isUndefined),
    ))

    this.document.tags = [...this.document.tags, tag]

    return this
  }

  public addSecurity(name: string, options: SecuritySchemeObject): this {
    this.document.components.securitySchemes = {
      ...(this.document.components.securitySchemes ?? {}),
      [name]: options,
    }

    return this
  }

  public build(): Omit<AsyncAPIObject, 'paths'> {
    return cloneDeep(this.document)
  }
}
