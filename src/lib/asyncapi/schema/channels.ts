import { ProcessedMessageMetadataI } from "../../message.interfaces";
import { ProcessedMessageHandlerMetadataI } from "../../message_handler.interfaces";
import * as interfaces from "../interfaces";

type MessageHeadersWithPropsI = Omit<interfaces.SchemaObject, "properties"> & {
	properties: Record<
		string,
		interfaces.SchemaObject | interfaces.ReferenceObject
	>;
};

export type CustomChannelClassesI = {
	subscriptionChannelClass?: typeof SubscriptionChannel;
	publishChannelClass?: typeof PublishChannel;
};

abstract class Channel {
	protected message: ProcessedMessageMetadataI;
	protected schemaPointerPrefix: string;
	abstract readonly operation: interfaces.Operation;
	protected readonly vhost: string = "/";

	constructor(schemaPointerPrefix: string, message: ProcessedMessageMetadataI) {
		this.message = message;
		this.schemaPointerPrefix = schemaPointerPrefix;
	}

	public getChannelKey(): string {
		const { exchangeName, routingKey } = this.message.processedConfig;
		const channelKey = `${exchangeName}/${routingKey}`;

		return channelKey;
	}

	public asAsyncapiChannelsObject(): interfaces.AsyncChannelsObject {
		return { [this.getChannelKey()]: this.asAsyncapiChannelObject() };
	}

	public asAsyncapiChannelObject(): interfaces.AsyncChannelObject {
		return {
			[this.operation]: {
				message: this.message2Spec(),
			},
			bindings: {
				amqp: this.message2AmqpBindings(),
			},
		};
	}

	protected message2Spec():
		| interfaces.AsyncMessageObject
		| interfaces.ReferenceObject {
		const { targetClassName } = this.message;

		return this.additionalMessageProperties({
			name: targetClassName,
			title: targetClassName,
			payload: {
				$ref: `${this.schemaPointerPrefix}${targetClassName}`,
			},
		});
	}

	protected message2AmqpBindings():
		| interfaces.AmqpChannelBindingExchange
		| interfaces.AmqpChannelBindingQueue {
		const { exchangeOptions, exchangeName, exchangeType } =
			this.message.processedConfig;

		return {
			is: interfaces.ChannelIs.routingKey,
			exchange: {
				...exchangeOptions,
				vhost: this.vhost,
				name: exchangeName,
				type: exchangeType,
			},
		};
	}

	protected additionalMessageProperties(
		intermediate: interfaces.AsyncMessageObject,
	): interfaces.AsyncMessageObject {
		return {
			headers: this.getMessageHeaders(),
			...intermediate,
			...this.getAdditionalMessageSchemaProperties(),
		};
	}

	protected getMessageHeaders(): MessageHeadersWithPropsI {
		const headerProps: Record<string, interfaces.SchemaObject> = {
			"x-scope": {
				description: "Message scope. Default is INTERNAL",
				type: "string",
				...this.getEnumIfNotEmpty(this.getCustomScopeHeaderValue()),
			},
			"x-ttl": {
				description:
					"TTL of the message. If set to -1 (default) will use brokers default.",
				type: "number",
				...this.getEnumIfNotEmpty(this.getCustomTTLHeaderValue()),
			},
			"x-roles-allowed": {
				description: "Allowed roles for this message. Default is empty",
				type: "array",
				...this.getEnumIfNotEmpty(this.getCustomRolesHeaderValue()),
			},
			"x-dead-letter": {
				description: "Dead letter queue definition. Default is dead-letter",
				type: "string",
				...this.getEnumIfNotEmpty(this.getCustomDeadLetterHeaderValue()),
			},
		};

		const headers: MessageHeadersWithPropsI = {
			properties: headerProps,
			type: "object",
		};

		return headers;
	}

	protected getEnumIfNotEmpty<T>(values: T[]): { enum?: T[] } {
		if (values.length > 0) {
			return { enum: values };
		}

		return {};
	}

	protected getCustomTTLHeaderValue(): number[] {
		const { ttl } = this.message.processedConfig;

		return [ttl ?? -1];
	}
	protected getCustomScopeHeaderValue(): string[] {
		return [this.message.processedConfig.scope];
	}

	protected getCustomRolesHeaderValue(): string[] {
		return [];
	}
	protected getCustomDeadLetterHeaderValue(): string[] {
		const { deadLetter } = this.message.processedConfig;

		return deadLetter.length === 0 ? [] : [deadLetter];
	}

	protected getAdditionalMessageSchemaProperties(): Record<
		string,
		interfaces.SchemaObject | interfaces.ReferenceObject
	> {
		return {};
	}
}

export class SubscriptionChannel extends Channel {
	readonly operation: interfaces.Operation = interfaces.Operation.subscribe;
}

export class PublishChannel extends Channel {
	readonly operation: interfaces.Operation = interfaces.Operation.publish;

	protected handler: ProcessedMessageHandlerMetadataI;

	constructor(
		schemaPointerPrefix: string,
		message: ProcessedMessageMetadataI,
		handler: ProcessedMessageHandlerMetadataI,
	) {
		super(schemaPointerPrefix, message);
		this.handler = handler;
	}

	public getChannelKey(): string {
		const { exchangeName } = this.message.processedConfig;
		const { queueName } = this.handler.processedConfig;
		const channelKey = `${exchangeName}/${queueName}`;

		return channelKey;
	}

	protected message2AmqpBindings():
		| interfaces.AmqpChannelBindingExchange
		| interfaces.AmqpChannelBindingQueue {
		return {
			...super.message2AmqpBindings(),
			queue: this.getQueueBinding(),
		};
	}

	private getQueueBinding(): interfaces.AmqpQueue {
		const { queueName, queueOptions } = this.handler.processedConfig;

		return {
			...queueOptions,
			name: queueName,
			vhost: this.vhost,
		};
	}

	protected getAdditionalMessageSchemaProperties(): Record<
		string,
		interfaces.SchemaObject | interfaces.ReferenceObject
	> {
		const { kind } = this.handler;

		if (kind === "WITH_REPLY") {
			return {
				"x-response": {
					$ref: `${this.schemaPointerPrefix}${this.handler.replyMessageClassName}`,
				},
			};
		}

		return {};
	}
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class IrisChannels {
	private static subscriptionChannelClass: typeof SubscriptionChannel =
		SubscriptionChannel;
	private static publishChannelClass: typeof PublishChannel = PublishChannel;

	public static generateChannels(
		message: ProcessedMessageMetadataI,
		messageHandlers: ProcessedMessageHandlerMetadataI[],
		schemaPointerPrefix: string,
	): Channel | Channel[] {
		const handlers = messageHandlers.filter(
			(mh) => mh.messageClass === message.target,
		);
		if (handlers.length === 0) {
			return new IrisChannels.subscriptionChannelClass(
				schemaPointerPrefix,
				message,
			);
		}

		return handlers.map(
			(handler) =>
				new IrisChannels.publishChannelClass(
					schemaPointerPrefix,
					message,
					handler,
				),
		);
	}

	public static setCustomChannelClasses({
		publishChannelClass,
		subscriptionChannelClass,
	}: CustomChannelClassesI): IrisChannels {
		if (publishChannelClass !== undefined) {
			IrisChannels.publishChannelClass = publishChannelClass;
		}
		if (subscriptionChannelClass !== undefined) {
			IrisChannels.subscriptionChannelClass = subscriptionChannelClass;
		}

		return IrisChannels;
	}
}
