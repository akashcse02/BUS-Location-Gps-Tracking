import Bus from "../models/Bus.js";

// Converts our [ [column, op, value], ... ] filter list into a Mongo filter object.
function buildMongoFilter(filters = []) {
  const mongoFilter = {};
  for (const [column, op, value] of filters) {
    if (op === "eq") mongoFilter[column] = value;
    else if (op === "neq") mongoFilter[column] = { $ne: value };
    else if (op === "in") mongoFilter[column] = { $in: value };
    else if (op === "gt") mongoFilter[column] = { $gt: value };
    else if (op === "gte") mongoFilter[column] = { $gte: value };
    else if (op === "lt") mongoFilter[column] = { $lt: value };
    else if (op === "lte") mongoFilter[column] = { $lte: value };
  }
  return mongoFilter;
}

function buildSort(order = []) {
  if (!order.length) return {};
  const sort = {};
  for (const { column, ascending } of order) sort[column] = ascending === false ? -1 : 1;
  return sort;
}

// Handles the one embedded-relation select this app actually uses:
// trips.select("... , buses(bus_number)") -> attach { buses: { bus_number } }.
async function attachEmbeddedBuses(table, docs, select) {
  if (table !== "trips" || !select || !select.includes("buses(")) return docs;
  const busIds = [...new Set(docs.map((d) => d.bus_id).filter(Boolean))];
  if (!busIds.length) return docs;
  const buses = await Bus.find({ id: { $in: busIds } }).lean();
  const byId = Object.fromEntries(buses.map((b) => [b.id, b]));
  return docs.map((d) => ({ ...d, buses: byId[d.bus_id] ? { bus_number: byId[d.bus_id].bus_number } : null }));
}

// Executes one query spec (the same shape the frontend's backend client sends)
// against a Mongoose model, and returns a Postgrest-shaped { data, error, count }.
export async function runQuery(Model, table, spec) {
  const { action, filters = [], order = [], limit, countOnly, values, onConflict, returning, select } = spec;
  const mongoFilter = buildMongoFilter(filters);

  try {
    if (action === "select") {
      if (countOnly) {
        const count = await Model.countDocuments(mongoFilter);
        return { data: null, error: null, count };
      }
      let query = Model.find(mongoFilter).sort(buildSort(order));
      if (limit) query = query.limit(limit);
      let docs = await query.lean();
      docs = docs.map((d) => { delete d._id; delete d.__v; return d; });
      docs = await attachEmbeddedBuses(table, docs, select);

      if (returning === "single") {
        if (!docs.length) return { data: null, error: { message: "No rows found" } };
        return { data: docs[0], error: null };
      }
      if (returning === "maybeSingle") {
        return { data: docs[0] ?? null, error: null };
      }
      return { data: docs, error: null, count: docs.length };
    }

    if (action === "insert") {
      const rows = Array.isArray(values) ? values : [values];
      const created = await Model.insertMany(rows);
      const plain = created.map((d) => d.toJSON());
      if (returning === "single") return { data: plain[0], error: null };
      return { data: plain, error: null };
    }

    if (action === "update") {
      await Model.updateMany(mongoFilter, { $set: values });
      const docs = await Model.find(mongoFilter).lean();
      return { data: docs.map((d) => { delete d._id; delete d.__v; return d; }), error: null };
    }

    if (action === "upsert") {
      const row = Array.isArray(values) ? values[0] : values;
      const key = onConflict ? onConflict.split(",")[0].trim() : "id";
      await Model.updateOne({ [key]: row[key] }, { $set: row }, { upsert: true });
      return { data: row, error: null };
    }

    if (action === "delete") {
      await Model.deleteMany(mongoFilter);
      return { data: null, error: null };
    }

    return { data: null, error: { message: `Unsupported action: ${action}` } };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}
