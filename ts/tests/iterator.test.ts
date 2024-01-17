import { describe, expect, vi } from "vitest";
import { it, fc, test } from "@fast-check/vitest";
import Iterator from "../src/iterator.js";
import { identity } from "../src/utils.js";

describe.concurrent("iterator", () => {
  const smallNat = fc.nat({ max: 20_000 });

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.iter", (array) => {
    const iterator = Iterator.iter(array);
    expect(iterator.toArray()).toEqual(array);
  });

  it.concurrent.prop([fc.array(fc.nat())])("Iterator is Iterable", (array) => {
    const iterator = Iterator.iter(array);
    let sum = 0;
    for (const value of iterator) {
      sum += value;
    }

    expect(sum).toEqual(array.reduce((a, b) => a + b, 0));
  });

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.count", (array) => {
    expect(Iterator.iter(array).count()).toEqual(array.length);
  });

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.count on consumed iterator",
    (array) => {
      expect(Iterator.iter(array).skip(array.length).count()).toEqual(0);
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.reduce", (array) => {
    const reducer = (acc: number, current: number) => acc + current;
    expect(Iterator.iter(array).reduce(reducer, 0)).toEqual(
      array.reduce(reducer, 0)
    );
  });

  it.concurrent.prop([fc.array(fc.nat())])(
    "Iterator.reduce with no initialValue",
    (array) => {
      const reducer = (acc: number | undefined, current: number) =>
        (acc ?? 0) + current;
      expect(Iterator.iter(array).reduce(reducer)).toEqual(
        array.reduce(reducer, undefined)
      );
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.map", (array) => {
    const mapper = (value: number) => value * 2;
    expect(Iterator.iter(array).map(mapper).toArray()).toEqual(
      array.map(mapper)
    );
  });

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.filter", (array) => {
    const predicate = (value: number) => value % 2 === 0;
    expect(Iterator.iter(array).filter(predicate).toArray()).toEqual(
      array.filter(predicate)
    );
  });

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.filterMap", (array) => {
    const filterMapped = Iterator.iter(array)
      .filterMap((value) => (value > 2 ? value * 2 : undefined))
      .toArray();
    expect(filterMapped).toEqual(
      array.filter((value) => value > 2).map((value) => value * 2)
    );
  });

  it.concurrent.prop([
    fc.array(fc.array(fc.array(fc.array(fc.anything())))),
    fc.nat(),
  ])("Iterator.flat", (array, depth) => {
    const flatArray = array.flat(depth);
    expect(Iterator.iter(array).flat(depth).toArray()).toEqual(flatArray);
  });

  it.concurrent.prop([fc.array(fc.array(fc.array(fc.array(fc.anything()))))])(
    "Iterator.flat with no depth",
    (array) => {
      const flatArray = array.flat();
      expect(Iterator.iter(array).flat().toArray()).toEqual(flatArray);
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.flatMap", (array) => {
    const mapper = (value: number) => [value, value];
    expect(Iterator.iter(array).flatMap(mapper).toArray()).toEqual(
      array.flatMap(mapper)
    );
  });

  it.concurrent.prop([smallNat])("Iterator.natural", (count) => {
    const iterator = Iterator.natural(count);
    expect(iterator.toArray()).toEqual([...Array(count).keys()]);
  });

  it.concurrent.prop([fc.array(fc.anything()), fc.array(fc.anything())])(
    "Iterator.zip",
    (array1, array2) => {
      const zipped = Iterator.iter(array1).zip(array2).toArray();
      const length = Math.min(array1.length, array2.length);
      expect(zipped.length).toEqual(length);
      for (const i of Iterator.natural(length)) {
        expect(zipped[i]).toEqual([array1[i], array2[i]]);
      }
    }
  );

  it.concurrent.prop([fc.array(fc.array(fc.anything()), { minLength: 3 })])(
    "Iterator.zip with multiple iterators",
    (arrays) => {
      const [head, ...rest] = arrays;
      const zipped = Iterator.iter(head)
        .zip(...rest)
        .toArray();
      const length = Math.min(...arrays.map((arr) => arr.length));
      expect(zipped.length).toEqual(length);
      for (const i of Iterator.natural(length)) {
        expect(zipped[i]).toEqual(arrays.map((arr) => arr[i]));
      }
    }
  );

  it.concurrent.prop([fc.array(fc.array(fc.anything()), { minLength: 2 })])(
    "Iterator.chain",
    (arrays) => {
      const chained = Iterator.chain(...arrays).toArray();
      expect(chained).toEqual(arrays.flat());
    }
  );

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.enumerate",
    (array) => {
      const enumerated = Iterator.iter(array).enumerate().toArray();
      expect(enumerated).toEqual(array.map((value, index) => [value, index]));
    }
  );

  it.concurrent.prop([fc.array(fc.anything()), fc.nat()])(
    "Iterator.take",
    (array, size) => {
      const fn = vi.fn();
      const taken = Iterator.iter(array).inspect(fn).take(size).toArray();
      expect(taken).toEqual(array.slice(0, size));
      expect(fn).toHaveBeenCalledTimes(Math.min(array.length, size));
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.takeWhile", (array) => {
    const pred = (value: number) => value < 3;
    const predicate = vi.fn(pred);
    const taken = Iterator.iter(array).takeWhile(predicate).toArray();
    const index = array.findIndex((value) => !pred(value));
    const expected = index !== -1 ? array.slice(0, index) : array;
    expect(taken).toEqual(expected);
    expect(predicate).toHaveBeenCalledTimes(
      index !== -1 ? index + 1 : array.length
    );
  });

  it.concurrent.prop([fc.array(fc.anything()), fc.nat()])(
    "Iterator.skip",
    (array, size) => {
      const skipped = Iterator.iter(array).skip(size).toArray();
      expect(skipped).toEqual(array.slice(size));
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.skipWhile", (array) => {
    const pred = (value: number) => value < 3;
    const predicate = vi.fn(pred);
    const skipped = Iterator.iter(array).skipWhile(predicate).toArray();
    const index = array.findIndex((value) => !pred(value));
    const expected = index !== -1 ? array.slice(index) : [];
    expect(skipped).toEqual(expected);
    expect(predicate).toHaveBeenCalledTimes(
      index !== -1 ? index + 1 : array.length
    );
  });

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.head", (array) => {
    expect(Iterator.iter(array).head()).toEqual(array[0]);
  });

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.last", (array) => {
    expect(Iterator.iter(array).last()).toEqual(array[array.length - 1]);
  });

  it.concurrent.prop([fc.array(fc.boolean())])("Iterator.every", (array) => {
    expect(Iterator.iter(array).every()).toEqual(array.every(identity));
  });

  it.concurrent.prop([fc.array(fc.record({ val: fc.boolean() }))])(
    "Iterator.every accessor",
    (array) => {
      expect(Iterator.iter(array).every((v) => v.val)).toEqual(
        array.every((v) => v.val)
      );
    }
  );

  it.concurrent.prop([fc.tuple(smallNat, fc.nat()).filter(([n, m]) => m < n)])(
    "Iterator.natural.every",
    ([count, n]) => {
      expect(Iterator.natural(count).every((x) => x >= 0)).toEqual(true);
      expect(Iterator.natural(count).every((x) => x < n)).toEqual(false);
      expect(Iterator.natural(count).every((x) => x < count)).toEqual(true);
    }
  );

  it.concurrent.prop([fc.array(fc.boolean())])(
    "Iterator.every short-circuit",
    (array) => {
      const fn = vi.fn();
      const iterator = Iterator.iter(array).inspect(fn);
      const index = array.findIndex((element) => !element);
      if (iterator.every()) {
        expect(index).toEqual(-1);
      } else {
        expect(index).toBeGreaterThan(-1);
        expect(fn).toHaveBeenCalledTimes(index + 1);
      }
    }
  );

  it.concurrent.prop([fc.array(fc.boolean())])("Iterator.some", (array) => {
    expect(Iterator.iter(array).some()).toEqual(array.some(identity));
  });

  it.concurrent.prop([fc.array(fc.record({ val: fc.boolean() }))])(
    "Iterator.some accessor",
    (array) => {
      expect(Iterator.iter(array).some((v) => v.val)).toEqual(
        array.some((v) => v.val)
      );
    }
  );

  it.concurrent.prop([
    fc.tuple(smallNat, fc.nat()).filter(([n, m]) => m >= 0 && m < n),
  ])("Iterator.natural.some", ([count, n]) => {
    expect(Iterator.natural(count).some((x) => x === n)).toEqual(true);
    expect(Iterator.natural(count).some((x) => x < 0)).toEqual(false);
  });

  it.concurrent.prop([fc.array(fc.boolean())])(
    "Iterator.some short-circuit",
    (array) => {
      const fn = vi.fn();
      const iterator = Iterator.iter(array).inspect(fn);
      const index = array.findIndex(identity);
      if (iterator.some()) {
        expect(index).toBeGreaterThan(-1);
        expect(fn).toHaveBeenCalledTimes(index + 1);
      } else {
        expect(index).toEqual(-1);
      }
    }
  );

  it.concurrent.prop([
    fc.array(fc.string()),
    fc.option(fc.string(), { nil: undefined }),
  ])("Iterator.join", (array, sep) => {
    const actual = Iterator.iter(array).join(sep);
    expect(actual).toEqual(array.join(sep));
  });

  it.concurrent.prop([fc.array(fc.tuple(fc.string(), fc.anything()))])(
    "Iterator.toObject",
    (array) => {
      const actual = Iterator.iter(array).toObject();
      expect(actual).toEqual(Object.fromEntries(array));
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.max", (array) => {
    const actual = Iterator.iter(array).max();
    expect(actual).toEqual(array.length > 0 ? Math.max(...array) : undefined);
  });

  it.concurrent.prop([fc.array(fc.record({ val: fc.nat() }))])(
    "Iterator.max accessor",
    (array) => {
      const actual = Iterator.iter(array).max((v) => v.val);
      const expected =
        array.length > 0 ? Math.max(...array.map((v) => v.val)) : undefined;
      expect(actual).toEqual(expected);
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.min", (array) => {
    const actual = Iterator.iter(array).min();
    expect(actual).toEqual(array.length > 0 ? Math.min(...array) : undefined);
  });

  it.concurrent.prop([fc.array(fc.record({ val: fc.nat() }))])(
    "Iterator.min accessor",
    (array) => {
      const actual = Iterator.iter(array).min((v) => v.val);
      const expected =
        array.length > 0 ? Math.min(...array.map((v) => v.val)) : undefined;
      expect(actual).toEqual(expected);
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.sum", (array) => {
    const actual = Iterator.iter(array).sum();
    expect(actual).toEqual(array.reduce((a, b) => a + b, 0));
  });

  it.concurrent.prop([fc.array(fc.record({ val: fc.nat() }))])(
    "Iterator.sum accessor",
    (array) => {
      const actual = Iterator.iter(array).sum((v) => v.val);
      expect(actual).toEqual(array.reduce((a, b) => a + b.val, 0));
    }
  );

  it.concurrent.prop([fc.array(fc.nat())])("Iterator.mult", (array) => {
    const actual = Iterator.iter(array).mult();
    expect(actual).toEqual(array.reduce((a, b) => a * b, 1));
  });

  it.concurrent.prop([fc.array(fc.record({ val: fc.nat() }))])(
    "Iterator.mult accessor",
    (array) => {
      const actual = Iterator.iter(array).mult((v) => v.val);
      expect(actual).toEqual(array.reduce((a, b) => a * b.val, 1));
    }
  );

  it.concurrent.prop([
    fc.tuple(fc.anything(), fc.anything()).filter(([x, y]) => x !== y),
  ])("Iterator.groupBy keys", ([even, odd]) => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).groupBy((v) =>
      v % 2 === 0 ? even : odd
    );
    expect(actual).toEqual(
      new Map([
        [odd, [1, 3, 5]],
        [even, [2, 4]],
      ])
    );
  });

  it.concurrent.prop([fc.object()])("Iterator.iterEntries", (object) => {
    const entries = Iterator.iterEntries(object).toArray();
    expect(entries).toEqual(Object.entries(object));
  });

  it.concurrent.prop([fc.object()])("Iterator.iterKeys", (object) => {
    const keys = Iterator.iterKeys(object).toArray();
    expect(keys).toEqual(Object.keys(object));
  });

  it.concurrent.prop([fc.object()])("Iterator.iterValues", (object) => {
    const values = Iterator.iterValues(object).toArray();
    expect(values).toEqual(Object.values(object));
  });

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.inspect", (array) => {
    const fn = vi.fn();
    const iterator = Iterator.iter(array).inspect(fn);
    expect(iterator.toArray()).toEqual(array);
    expect(fn).toHaveBeenCalledTimes(array.length);
    expect(fn.mock.calls).toEqual(array.map((value) => [value]));

    expect(iterator.toArray()).toEqual(array);
    expect(fn).toHaveBeenCalledTimes(array.length * 2);
    expect(fn.mock.calls).toEqual([...array, ...array].map((value) => [value]));
  });

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.cached", (array) => {
    const fn = vi.fn();
    const fn2 = vi.fn();
    const iterator = Iterator.iter(array).inspect(fn).cached().inspect(fn2);
    expect(iterator.toArray()).toEqual(array);
    expect(iterator.toArray()).toEqual(array);
    expect(fn).toHaveBeenCalledTimes(array.length);
    expect(fn2).toHaveBeenCalledTimes(array.length * 2);
  });

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.consumable",
    (array) => {
      const fn = vi.fn();
      const fn2 = vi.fn();
      const iterator = Iterator.iter(array)
        .inspect(fn)
        .consumable()
        .inspect(fn2);
      expect(iterator.toArray()).toEqual(array);
      expect(iterator.toArray()).toEqual([]);
      expect(fn).toHaveBeenCalledTimes(array.length);
      expect(fn2).toHaveBeenCalledTimes(array.length);
    }
  );

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.cached undoes Iterator.consumable",
    (array) => {
      const fn = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();
      const iterator = Iterator.iter(array)
        .inspect(fn)
        .consumable()
        .inspect(fn2)
        .cached()
        .inspect(fn3);
      expect(iterator.toArray()).toEqual(array);
      expect(iterator.toArray()).toEqual(array);
      expect(fn).toHaveBeenCalledTimes(array.length);
      expect(fn2).toHaveBeenCalledTimes(array.length);
      expect(fn3).toHaveBeenCalledTimes(array.length * 2);
    }
  );

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.consumable undoes Iterator.cached",
    (array) => {
      const fn = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();
      const iterator = Iterator.iter(array)
        .inspect(fn)
        .cached()
        .inspect(fn2)
        .consumable()
        .inspect(fn3);
      expect(iterator.toArray()).toEqual(array);
      expect(iterator.toArray()).toEqual([]);
      expect(fn).toHaveBeenCalledTimes(array.length);
      expect(fn2).toHaveBeenCalledTimes(array.length);
      expect(fn3).toHaveBeenCalledTimes(array.length);
    }
  );

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.cycle", (array) => {
    const iterator = Iterator.iter(array).cycle();
    expect(iterator.take(array.length * 2).toArray()).toEqual([
      ...array,
      ...array,
    ]);
  });

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.cycle caches",
    (array) => {
      const fn = vi.fn();
      const iterator = Iterator.iter(array).inspect(fn).cycle();
      iterator.take(array.length * 2).consume();
      expect(fn).toHaveBeenCalledTimes(array.length);
    }
  );

  it.concurrent.prop([fc.array(fc.anything())])("Iterator.consume", (array) => {
    const fn = vi.fn();
    const iterator = Iterator.iter(array).inspect(fn);
    iterator.consume();
    expect(fn).toHaveBeenCalledTimes(array.length);
  });

  it.concurrent.prop([fc.array(fc.anything())])(
    "Iterator.consume fn",
    (array) => {
      const fn = vi.fn();
      Iterator.iter(array).consume(fn);
      expect(fn).toHaveBeenCalledTimes(array.length);
      expect(fn.mock.calls).toEqual(array.map((value) => [value]));
    }
  );

  it.concurrent.prop([
    fc
      .tuple(fc.array(fc.anything()), fc.nat())
      .filter(([arr, i]) => i < arr.length && i >= 0),
  ])("Iterator.nth", ([array, index]) => {
    const fn = vi.fn();
    expect(Iterator.iter(array).inspect(fn).nth(index)).toEqual(array[index]);
    expect(fn).toHaveBeenCalledTimes(index + 1);
  });

  test.concurrent("Iterator.range with start and stop", () => {
    const actual = Iterator.range(1, 5).toArray();
    expect(actual).toEqual([1, 2, 3, 4]);
  });

  test.concurrent("Iterator.range with start, stop and step", () => {
    const actual = Iterator.range(1, 6, 2).toArray();
    expect(actual).toEqual([1, 3, 5]);
  });

  test.concurrent("Iterator.range reverse", () => {
    const actual = Iterator.range(4, -1, -1).toArray();
    expect(actual).toEqual([4, 3, 2, 1, 0]);
  });

  test.concurrent("Iterator.range empty range", () => {
    const actual = Iterator.range(0, 0).toArray();
    expect(actual).toEqual([]);
  });

  test.concurrent("Iterator.range empty range with start > stop", () => {
    const actual = Iterator.range(1, 0).toArray();
    expect(actual).toEqual([]);
  });

  test.concurrent("Iterator.groupBy empty", () => {
    const actual = Iterator.iter([]).groupBy((v) => v % 2);
    expect(actual).toEqual(new Map());
  });

  test.concurrent("Iterator.groupBy numbers", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).groupBy((v) => v % 2);
    expect(actual).toEqual(
      new Map([
        [1, [1, 3, 5]],
        [0, [2, 4]],
      ])
    );
  });

  test.concurrent("Iterator.groupBy strings", () => {
    const actual = Iterator.iter([1, 2, 3, 4, 5]).groupBy((v) =>
      (v % 2).toString()
    );
    expect(actual).toEqual(
      new Map([
        ["1", [1, 3, 5]],
        ["0", [2, 4]],
      ])
    );
  });
});
