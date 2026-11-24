import { type TUnsafe, Type } from "typebox";

/**
 * Stand-in for pi-ai's `StringEnum`, emitting the same schema. Since Pi 1.5 the
 * published pi-ai `StringEnum` returns a pi-schema `Schema`, so `params` types
 * as `{}` inside `Type.Object` under `tsc`, although Pi's runtime copy returns a
 * TypeBox schema. Delete this once pi-ai's published types infer again.
 *
 * Not `Type.Enum` or `Type.Union`: providers such as Google reject enums without
 * `type: "string"` or built from `anyOf`/`const`.
 */
export function stringEnumSchema<const T extends readonly string[]>(
  values: T,
  options?: { description?: string },
): TUnsafe<T[number]> {
  return Type.Unsafe<T[number]>({ type: "string", enum: values, ...options });
}
