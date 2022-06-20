import { MetadataStorage } from 'class-transformer/types/MetadataStorage'

declare module 'class-transformer/cjs/storage' {
  export const defaultMetadataStorage: MetadataStorage
}
