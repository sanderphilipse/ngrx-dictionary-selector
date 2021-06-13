# Dealing with NgRx's selectorsWithProps deprecation

In the last major update, the NgRx team decided to [deprecate selectors with props](https://github.com/ngrx/platform/issues/2980)--those neat little selectors that allow you to pass an external variable into a selector as a prop, like so:

```
const createSelector(selector, (selectorResult, prop) => id[prop]);
```

This selector pattern worked well and was easy to combine with normal selectors, but it had one big downside: it broke selector [memoization](https://en.wikipedia.org/wiki/Memoization) without telling developers it was doing so.

Selector memoization is one of NgRx's most powerful features. It means that selectors cache their last result, and if the next call to the selector is done with the exact same arguments, it doesn't recompute the function but simply returns the cached result. This is especially useful for relatively expensive calculations, like [state normalization](https://medium.com/@timdeschryver/ngrx-normalizing-state-d3960a86a3aa).

Unfortunately, props break that memoization. That's because those props are one of the arguments to the selector, which means that if a prop changes, the selector is recomputed. So far so normal, but this happens even if that prop has no effect whatsoever on the actual computed result, which is often the case if you [build child-selectors off your selector with props](https://github.com/ngrx/platform/issues/2862). That's because if one parent selector has a prop, that prop is shared with every other selector you're using in the same function--which means all of those selectors receive a new argument, forcing them to recompute.

This behavior isn't particularly intuitive, and it's easy to accidentally create giant performance hits by misusing those props. You can get around this problem by directly using NgRx's createSelectorFactory to implement custom memoization strategies, but that's pretty cumbersome and, again, very easy to get wrong.

## Finding a replacement

Unfortunately, removing selectorsWithProps does create a functionality gap. Props are often used with dictionary-style state to select a specific element in a dictionary. Something like this:

```
const state = {
    '1': 'first element',
    '2': 'second element',
    '3': 'third element',
}

const elementSelector = createSelector(selectState, (state, elementId) => state[elementId]);

element$ = this.store.select(elementSelector, 1);
```

NgRx maintainer Tim Deschryver [suggests](https://github.com/ngrx/platform/issues/2980) using a factory pattern to get the same result, like so:

```
const elementSelector = (elementId: string) => createSelector(selectState, (state) => state[elementId]);
const firstElementSelector = elementSelector(1);
element$ = this.store.select(firstElementSelector);
```

This works well for selectors that are assigned once. The function is only evaluated once, which means it will return the same, unaltered selector including its memoization. This pattern is really useful if you can enumerate the number of values the prop can take when building your application: you just create a specific selector for each value your prop can have, and use that everywhere. 

## Variable props

Unfortunately, in most cases I've seen we cannot know ahead of time which props we'll have access to. Oftentimes, we'll retrieve a list of object IDs for a user, which we can then later use to retrieve the objects themselves, storing all of this in a dictionary state. The generic elementSelector will then be recomputed every time the prop changes, which will usually happen every time a user views a different object. 

What we need instead is a way to dynamically create these prop-based selectors that can be used across an application. Some kind of function that when we call it, checks a cache for a matching selector, and returns the cached selector if it exists, or a new one if it doesn't. That sounds a lot like a Map, and the resulting function would look something like this:

```
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
```
And usage: 
```
    const state = {
        '1': 'first element',
        '2': 'second element',
        '3': 'third element',
    }
    const elementSelector = createSelectorWithProps((id: string) =>
      createSelector(selectState, state => state[id])
    );
    element$ = this.store.select(elementSelector(1));
    element2$ = this.store.select(elementSelector(2));
```
This createSelectorWithProps behaves the way I would intuitively expect it to:
1. It caches a selector per prop value, meaning you can reuse it without worrying about breaking memoization
2. You can safely chain it with other selectors
3. The prop value does not get invisibly passed down to every other selector

This means that element$ and element2$ can exist simultaneously without breaking each other's memoization. If one of these elements changes, only the affected observable will see its selector recomputed. Perfect!
## Downside

There's one big downside: because we're relying on a function to return a selector, all of the downstream child selector will no longer have access to its props. This makes it harder to chain these selectors, but it does force you to actually think about your caching and property access in each of your selector. There's a decent chance you were accidentally getting it wrong before.

There's also a minor increase of your application's memory footprint. Unless you're storing giant objects in your state, though, that shouldn't be a massive problem. If it is, you could think of implementing [an LRU caching strategy](https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU) instead.

## Source

If you're interested in the source code, including some unit tests to validate that it actually works, you can find it [on my GitHub page](https://github.com/sanderphilipse/ngrx-dictionary-selector).
