import { Selector } from "@ngrx/store";

type SelectorFn<T, V, PropType> = {
  (props: PropType): Selector<T, V>;
};

export function createSelectorWithProps<T, V, PropType>(
  selectorFn: SelectorFn<T, V, PropType>
): SelectorFn<T, V, PropType> {
  let cache = new Map<PropType, Selector<T,V>>();

  return function (prop: PropType) {
    if (!cache.has(prop)) {
      cache.set(prop, selectorFn(prop));
    }
    return cache.get(prop) ?? selectorFn(prop);
  };
}
