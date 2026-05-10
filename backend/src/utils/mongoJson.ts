/** Map Mongo _id to string `id` for admin JSON; keeps `_id` for backward compatibility with existing clients. */
export function withId<T extends { _id: unknown }>(doc: T): T & { id: string } {
  const o = doc as Record<string, unknown>;
  const _id = o._id;
  return { ...(doc as object), id: String(_id), _id } as T & { id: string };
}

export function mapWithId<T extends { _id: unknown }>(docs: T[]): (T & { id: string })[] {
  return docs.map(withId);
}
