import type { Except, Simplify } from "type-fest";

export type RequireOnly<
	BaseType,
	Keys extends keyof BaseType,
> = BaseType extends unknown // type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types). // union into a [distributive conditional // `extends unknown` is always going to be the case and is used to convert any
	? Simplify<
			// Pick just the keys that are optional from the base type.
			Partial<Except<BaseType, Keys>> &
				// Pick the keys that should be required from the base type and make them required.
				Required<Pick<BaseType, Keys>>
		>
	: never;
