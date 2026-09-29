import crypto from "crypto";

// Gives every model a Postgrest-style string `id` (instead of Mongo's `_id`),
// and a toJSON transform so API responses stay consistent with the original
// rows the frontend already expects (snake_case columns, plain `id`).
export function idPlugin(schema) {
  schema.add({ id: { type: String, default: () => crypto.randomUUID(), unique: true, index: true } });
  schema.set("toJSON", {
    virtuals: false,
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
  schema.set("toObject", {
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
}
