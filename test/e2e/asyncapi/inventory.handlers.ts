import {
  MessageHandler,
  SnapshotMessageHandler,
  SnapshotRequested,
} from '../../../src'
import * as msg from './inventory.messages'

export class HandlerInquiry {
  @MessageHandler({}, msg.InventoryStock)
  public inquiry(_inquiry: msg.InventoryStockInquiry): msg.InventoryStock {
    return <msg.InventoryStock>(<unknown>{})
  }

  @MessageHandler({}, msg.InventoryStock)
  public inquiry2(
    _inquiry: msg.ClientExceptionalInventoryStockInquiry,
  ): msg.InventoryStock {
    return <msg.InventoryStock>(<unknown>{})
  }

  @MessageHandler({}, msg.InventoryStock)
  public inquiry3(
    _inquiry: msg.ServerExceptionalInventoryStockInquiry,
  ): msg.InventoryStock {
    return <msg.InventoryStock>(<unknown>{})
  }

  @MessageHandler({}, msg.InventoryStock)
  public inquiry4(
    _inquiry: msg.SilentServerExceptionalInventoryStockInquiry,
  ): msg.InventoryStock {
    return <msg.InventoryStock>(<unknown>{})
  }

  @MessageHandler({}, msg.InventoryStock)
  public inquiry5(
    _inquiry: msg.AuthenticatedInventoryStockInquiry,
  ): msg.InventoryStock {
    return <msg.InventoryStock>(<unknown>{})
  }
}

export class HandlerOrder {
  @MessageHandler()
  public restock(_restockInventory: msg.RestockInventory): void {}

  @MessageHandler({}, msg.OrderInventoryConfirmation)
  public lookupOrderInventory(
    _orderInventory: msg.OrderInventoryLookup,
  ): msg.OrderInventoryConfirmation {
    return <msg.OrderInventoryConfirmation>(<unknown>{})
  }
  // test handler to restock inventory without shipping service
  @MessageHandler()
  public restockFe(_restockInventory: msg.RestockInventoryFe): void {}

  // RPC POC message handler for inventory lookup
  @MessageHandler({}, msg.OrderInventoryConfirmationRpc)
  public lookupOrderInventoryRpc(
    _orderInventory: msg.OrderInventoryLookupRpc,
  ): msg.OrderInventoryConfirmationRpc {
    return <msg.OrderInventoryConfirmationRpc>(<unknown>{})
  }

  @MessageHandler({}, msg.OrderFinalizeResponse)
  public finalizeOrder(
    _evt: msg.OrderFinalizeRequest,
  ): msg.OrderFinalizeResponse {
    return { ack: true }
  }
}

export class HandlerOrderSytem {
  @MessageHandler()
  public systemStatus(_status: msg.OrderSystemStatus): void {}

  @SnapshotMessageHandler({ resourceType: 'inventory' })
  public snapshotRequested(_snapshotRequested: SnapshotRequested): void {}
}
