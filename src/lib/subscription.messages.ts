import { Message } from './message.decorator'
import { IsString, IsObject } from 'class-validator'
import * as interfaces from './subscription.interfaces'
import { MANAGED_EXCHANGES } from './constants'

const { SUBSCRIPTION, SNAPSHOT_REQUESTED, SUBSCRIBE_INTERNAL } = MANAGED_EXCHANGES

class Subscription implements interfaces.SubscriptionI {
  @IsString() resourceType!: string
  @IsString() resourceId!: string
}

@Message({ name: SNAPSHOT_REQUESTED.EXCHANGE })
export class SnapshotRequested extends Subscription {}

@Message({ name: SUBSCRIBE_INTERNAL.EXCHANGE })
export class SubscribeInternal extends Subscription {}

@Message({ name: SUBSCRIPTION.EXCHANGE, exchangeType: SUBSCRIPTION.EXCHANGE_TYPE })
export class SnapshotMessage extends Subscription implements interfaces.SubscriptionResourceUpdateI {
  @IsObject() payload!: object
}
