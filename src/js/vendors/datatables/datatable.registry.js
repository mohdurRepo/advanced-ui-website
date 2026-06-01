const registry = new WeakMap();

export const DataTableRegistry = {
  has(element) {
    return registry.has(element);
  },

  get(element) {
    return registry.get(element) || null;
  },

  set(element, instance) {
    registry.set(element, instance);
  },

  remove(element) {
    registry.delete(element);
  },
};
