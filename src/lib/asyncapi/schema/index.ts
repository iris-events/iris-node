import { Exclude } from "class-transformer";
import { IsOptional, IsString } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";
import { ProcessedMessageMetadataI } from "../../message.interfaces";
import { ProcessedMessageHandlerMetadataI } from "../../message_handler.interfaces";
import {
	ResourceMessage,
	SnapshotRequested,
	SubscribeInternal,
} from "../../subscription.messages";
import {
	AsyncapiClassValidator,
	AsyncapiClassValidatorI,
} from "../class_validator";
import * as interfaces from "../interfaces";
import { IrisChannels } from "./channels";
import { IrisSchemas } from "./iris";

const internallyDefinedMessages = <Function[]>[
	SubscribeInternal,
	ResourceMessage,
	SnapshotRequested,
];

export type AsyncapiSchemaI = {
	messages: ProcessedMessageMetadataI[];
	messageHandlers: ProcessedMessageHandlerMetadataI[];
	SCHEMA_POINTER_PREFIX: string;
} & Omit<AsyncapiClassValidatorI, "SCHEMA_POINTER_PREFIX">;

export class AsyncapiSchema {
	private messages: ProcessedMessageMetadataI[];
	private messageHandlers: ProcessedMessageHandlerMetadataI[];
	private irisSchemas: IrisSchemas;
	private SCHEMA_POINTER_PREFIX: string;

	constructor({
		messages,
		messageHandlers,
		SCHEMA_POINTER_PREFIX,
		...classValidatorOpts
	}: AsyncapiSchemaI) {
		this.messages = messages;
		this.messageHandlers = messageHandlers;
		this.SCHEMA_POINTER_PREFIX = SCHEMA_POINTER_PREFIX;
		const asyncapiClassValidator = new AsyncapiClassValidator({
			SCHEMA_POINTER_PREFIX,
			...classValidatorOpts,
		});
		this.irisSchemas = new IrisSchemas({
			messages: messages,
			asyncapiClassValidator,
		});

		this.additionallyDecorateMessages();
	}

	public getSchemas(): interfaces.SchemaObjects {
		return this.irisSchemas.getSchemasForMessages();
	}

	public getChannels(): interfaces.AsyncChannelsObject {
		return this.messages
			.flatMap((message) =>
				IrisChannels.generateChannels(
					message,
					this.messageHandlers,
					this.SCHEMA_POINTER_PREFIX,
				),
			)
			.reduce(
				(acc, channel) => ({
					...acc,
					...channel.asAsyncapiChannelsObject(),
				}),
				{},
			);
	}

	private additionallyDecorateMessages(): void {
		for (const message of this.messages) {
			this.assureMessageIsIncludedInSchema(<Function>message.target);
			this.decorateMessageWithIrisAdditionalProperties(
				<Function>message.target,
			);
		}
	}

	private assureMessageIsIncludedInSchema<T extends Function>(
		message: T,
	): void {
		// In case an empty class is decorated (e.g. "@Message() class Foo {}", then
		// no property is found in metadata storage of class-validator. Such classes
		// are then also not included in json schema prepared by class-validator-jsonschema
		// module.
		// One solution is this; additionally decorate "fake" property for each message class
		// so it is surely included in the metadata storage and is picked up by json schema
		// module.
		// Decorate it with with
		//  - IsOptional() to not have it inside "required" jsonschema property and
		//  - @Exclude() so that this property is also not described for this schema.
		Exclude()(<object>message.prototype, "__keep__");
		IsOptional()(<object>message.prototype, "__keep__");
		IsString()(<object>message.prototype, "__keep__");
	}

	private isIrisMessage<T extends Function>(message: T): boolean {
		if (internallyDefinedMessages.includes(message)) {
			return true;
		}

		// if this is a message without a handler, it's probably defined by "us"
		return (
			this.messageHandlers.find(
				(handler) => handler.messageClass === message,
			) === undefined
		);
	}

	private decorateMessageWithIrisAdditionalProperties<T extends Function>(
		message: T,
	): void {
		const isIrisMessage = this.isIrisMessage(message);
		JSONSchema({
			"x-iris-generated": isIrisMessage,
		})(message);
	}
}
