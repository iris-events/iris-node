import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInstance,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'
import { Message, Scope } from '../../../src'

enum LookupType {
  foo = 'foo',
  bar = 'bar',
}

@Message({ name: 'inventory-stock-inquiry', scope: Scope.FRONTEND })
export class InventoryStockInquiry {}

@Message({ name: 'inventory-stock-inquiry-auth', scope: Scope.FRONTEND })
export class AuthenticatedInventoryStockInquiry {}

@Message({
  name: 'inventory-stock-inquiry-client-exception',
  scope: Scope.FRONTEND,
})
export class ClientExceptionalInventoryStockInquiry {}

@Message({
  name: 'inventory-stock-inquiry-server-exception',
  scope: Scope.FRONTEND,
})
export class ServerExceptionalInventoryStockInquiry {}

export class SilentServerExceptionalInventoryStockInquiryBase {
  @IsString() name!: string
}

@Message({
  name: 'inventory-stock-inquiry-silent-server-exception',
  scope: Scope.FRONTEND,
})
export class SilentServerExceptionalInventoryStockInquiry extends SilentServerExceptionalInventoryStockInquiryBase {}

@Message({ name: 'subscription-accepted', scope: Scope.SESSION })
export class SubscriptionAccepted {
  @IsString({ each: true }) items!: Set<string>
}

@Message({ name: 'restock-inventory' })
export class RestockInventory {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  restockedInventory!: Map<string, number>
}

@Message({ name: 'order-inventory-lookup' })
export class OrderInventoryLookup {
  @IsString() orderId!: string
  @IsEnum(LookupType) type!: LookupType
}

@Message({ name: 'order-inventory-confirmation' })
export class OrderInventoryConfirmation {
  @IsOptional() @IsNumber() count?: number
  @IsDate() ts!: Date
  @IsString() orderId!: string
  @IsBoolean() confirmed!: string
  @Type(() => OrderInventoryLookup)
  @IsInstance(OrderInventoryLookup)
  lookup!: OrderInventoryLookup
}

@Message({ name: 'inventory-stock', scope: Scope.SESSION })
export class InventoryStock {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  inventoryStock!: Map<string, number>
}

@Message({ name: 'inventory-stock-update', scope: Scope.USER })
export class InventoryStockUpdate {
  @IsString() message!: string
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  inventoryStock!: Map<string, number>
}

@Message({ name: 'system-status-inventory' })
export class InventorySystemStatus {
  @IsString({ each: true }) orders!: Set<string>
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  inventory!: Map<string, number>
}

@Message({ name: 'system-status-order' })
export class OrderSystemStatus {
  @IsString({ each: true }) orders!: Set<string>
}

// test event for restocking the inventory from client
@Message({ name: 'restock-inventory-frontend', scope: Scope.FRONTEND })
export class RestockInventoryFe {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  restockedInventory!: Map<string, number>
}

// sample events for resting RPC proof of concept
@Message({ name: 'order-inventory-lookup-rpc' })
export class OrderInventoryLookupRpc {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  items!: Map<string, number>
  @IsString() orderId!: string
}

@Message({ name: 'order-inventory-confirmation-rpc' })
export class OrderInventoryConfirmationRpc {
  @IsString() orderId!: string
  @IsBoolean() confirmed!: string
}

@Message({ name: 'order-finalize-request' })
export class OrderFinalizeRequest {
  @IsBoolean() finalize!: boolean
}

@Message({ name: 'order-response' })
export class OrderFinalizeResponse {
  @IsBoolean() ack!: boolean
}
