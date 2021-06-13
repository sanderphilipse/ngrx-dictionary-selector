import {
  createFeatureSelector,
  createSelector,
} from "@ngrx/store";
import { createSelectorWithProps } from "./create-selector-with-props";
describe("createDictionarySelector", () => {
  it("should return a memoized selector", () => {
    const featureSelector = createFeatureSelector<string>("feature");
    const state = {
      feature: "feature",
    };
    let selectorCalled = 0;
    const dictSelector = createSelectorWithProps((id: string) =>
      createSelector(featureSelector, (feature) => {
        selectorCalled += 1;
        return `${feature}-${id}`;
      })
    );
    const resultSelector = dictSelector("id2");
    expect(resultSelector(state)).toBe("feature-id2");
    expect(selectorCalled).toBe(1);
    resultSelector(state);
    resultSelector(state);
    expect(selectorCalled).toBe(1);
  });
  it("should memoize selectors per distinct prop", () => {
    const featureSelector = createFeatureSelector<string>("feature");
    const state = {
      feature: "feature",
    };
    let selectorsCalled: Record<string, number | undefined> = {};
    const dictSelector = createSelectorWithProps((id: string | number) =>
      createSelector(featureSelector, (feature) => {
        selectorsCalled[id] = selectorsCalled[id]
          ? (selectorsCalled[id] as number) + 1
          : 1;
        return `${feature}-${id}`;
      })
    );
    const resultSelector = dictSelector("id2");
    const secondResultSelector = dictSelector(555);
    expect(resultSelector(state)).toBe("feature-id2");
    expect(selectorsCalled["id2"]).toBe(1);
    expect(selectorsCalled[555]).toBe(undefined);
    expect(secondResultSelector(state)).toBe("feature-555");
    expect(selectorsCalled["id2"]).toBe(1);
    expect(selectorsCalled[555]).toBe(1);
    resultSelector(state);
    resultSelector(state);
    secondResultSelector(state);
    expect(selectorsCalled["id2"]).toBe(1);
    expect(selectorsCalled[555]).toBe(1);
  });
  it("should recompute if input changes", () => {
    const featureSelector = createFeatureSelector<string>("feature");
    const state = {
      feature: 'feature',
    };
    let selectorCalled = 0;
    const dictSelector = createSelectorWithProps((id: string) =>
      createSelector(featureSelector, (feature) => {
        selectorCalled += 1;
        return `${feature}-${id}`;
      })
    );
    const resultSelector = dictSelector("id2");
    expect(resultSelector(state)).toBe('feature-id2');
    expect(selectorCalled).toBe(1);
    expect(resultSelector({feature: 'feature2'})).toBe('feature2-id2');
    expect(selectorCalled).toBe(2);
  });
  it("should combine with other selectors", () => {
    const featureSelector = createFeatureSelector<Record<string, Record<string, string>>>("feature");
    const state = {
      feature: {
        'id2': {
          a: 'a',
          b: 'b'
        }
      },
    };
    let selectorCalled = 0;
    const dictSelector = createSelectorWithProps((id: string) =>
      createSelector(featureSelector, (feature) => {
        selectorCalled += 1;
        return feature[id];
      })
    );
    const resultSelector = createSelector(dictSelector("id2"), state => state.a);
    expect(resultSelector(state)).toBe('a');
    expect(selectorCalled).toBe(1);
  });
});
