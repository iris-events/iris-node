import { ClassConstructor } from "class-transformer";
import { getLogger } from "../logger";
import * as message from "./message";
import { AmqpMessage } from "./message_handler";
import * as publish from "./publish";
import * as interfaces from "./subscription.interfaces";
import { ResourceMessage, SubscribeInternal } from "./subscription.messages";

export * from "./subscription.interfaces";

const logger = getLogger("Iris:Subscription");
const RESOURCE_ROUTING_POSTFIX = ".resource";
const subscriptionPublisher = publish.getPublisher(ResourceMessage);

/**
 * Subscribe client (user) to a specific resource from back-end.
 * @param sourceEvent - received event from client (holding client's id needed for subscription)
 * @param resourceType
 * @param resourceId
 */
export async function internallySubscribe(
	sourceEvent: AmqpMessage,
	resourceType: string,
	resourceId: string,
): Promise<void> {
	await publish.publishReply(sourceEvent, SubscribeInternal, {
		resourceId,
		resourceType,
	});
}

/**
 * Retuns a method which can be used to publish Snapshot events
 */
export function getSnapshotPublisher<T extends object>(
	messageClass: ClassConstructor<T>,
): interfaces.SubscriptionPublisherI<T> {
	return async (
		msg: T,
		resourceType: string,
		resourceId: string,
	): Promise<boolean> => {
		return sendToSubscription(messageClass, msg, resourceType, resourceId);
	};
}

export async function sendToSubscription<T extends object>(
	messageClass: ClassConstructor<T>,
	msg: T,
	resourceType: string,
	resourceId: string,
): Promise<boolean> {
	const msgMeta = getMessageMetaFromClass(
		messageClass,
		"sendToSubscription() passed argument should be class decorated with @Message()",
	);
	const { exchangeName } = msgMeta.processedConfig;
	const routingKey = `${exchangeName}${RESOURCE_ROUTING_POSTFIX}`;

	return subscriptionPublisher(
		{ resourceId, resourceType, payload: msg },
		{ routingKey },
	);
}

function getMessageMetaFromClass<T>(
	messageClass: ClassConstructor<T>,
	onErrMsg: string,
): message.ProcessedMessageMetadataI {
	try {
		return message.getProcessedMessageDecoratedClass(messageClass);
	} catch (error) {
		logger.error(onErrMsg, <Error>error, { messageClass });
		throw new Error("ERR_IRIS_SUBSCRIPTION_INVALID_MESSAGE_CLASS");
	}
}
