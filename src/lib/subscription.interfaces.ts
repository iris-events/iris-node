import * as messageHandlerI from "./message_handler.interfaces";

export interface SubscriptionI {
	resourceType: string;
	resourceId: string;
}

export interface SubscriptionResourceUpdateI extends SubscriptionI {
	payload: object;
}

export type SubscriptionPublisherI<T> = (
	msg: T,
	resourceType: string,
	resourceId: string,
) => Promise<boolean>;

export type SnapshotMessageHandlerI = Pick<
	messageHandlerI.MessageHandlerI,
	"prefetch"
> & {
	resourceType: string;
};
