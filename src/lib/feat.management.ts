import * as amqpHelper from "./amqp.helper";
/**
 * Setup exhanges managed and owned by dedicated services.
 * Only use for tests.
 */
import {
	MANAGED_EXCHANGES,
	ManagedExchangeI,
	ManagedExchangesE,
} from "./constants";

// Subscription Message classes are already defined elsewhere
type ReservedManagedExchangesE = Exclude<
	ManagedExchangesE,
	| ManagedExchangesE.SUBSCRIPTION
	| ManagedExchangesE.SNAPSHOT_REQUESTED
	| ManagedExchangesE.SUBSCRIBE_INTERNAL
	| ManagedExchangesE.FRONTEND
>;

const reservedExchangesToRegister: Record<
	ReservedManagedExchangesE,
	ManagedExchangeI
> = {
	[ManagedExchangesE.DEAD_LETTER]: MANAGED_EXCHANGES.DEAD_LETTER,
	[ManagedExchangesE.ERROR]: MANAGED_EXCHANGES.ERROR,
	[ManagedExchangesE.RETRY]: MANAGED_EXCHANGES.RETRY,
	[ManagedExchangesE.BROADCAST]: MANAGED_EXCHANGES.BROADCAST,
	[ManagedExchangesE.SESSION]: MANAGED_EXCHANGES.SESSION,
	[ManagedExchangesE.USER]: MANAGED_EXCHANGES.USER,
};

export async function registerFrontendExchange(): Promise<void> {
	const { EXCHANGE, EXCHANGE_TYPE, EXCHANGE_OPTIONS } =
		MANAGED_EXCHANGES.FRONTEND;
	await amqpHelper.assertExchange(EXCHANGE, EXCHANGE_TYPE, EXCHANGE_OPTIONS);
}

export async function registerReservedManagedMessages(): Promise<void> {
	await Promise.all(
		Object.values(reservedExchangesToRegister).map(
			async ({ EXCHANGE, EXCHANGE_TYPE, EXCHANGE_OPTIONS }) =>
				amqpHelper.assertExchange(EXCHANGE, EXCHANGE_TYPE, EXCHANGE_OPTIONS),
		),
	);
}

export function getReservedManagedExchangeNames(): string[] {
	return Object.values(reservedExchangesToRegister).map(
		({ EXCHANGE }) => EXCHANGE,
	);
}
