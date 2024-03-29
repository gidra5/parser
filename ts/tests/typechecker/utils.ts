import { expect, it } from "vitest";
import { parseExprString, parseProgramString } from "../../src/parser/string";
import { resolve } from "../../src/typechecker/resolver";
import { inferType } from "../../src/typechecker/inferType";
import { defaultParsingContext, parseExpr } from "../../src/parser";
import { parseTokens } from "../../src/parser/tokens";
import { Scope } from "../../src/scope";
import type { AbstractSyntaxTree } from "../../src/parser/ast";

export const errorsTestCase = (src, expectedErrors, _it: any = it) =>
  _it(`finds all errors in example '${src}'`, () => {
    const [, errors] = parseExprString(src);
    expect(errors).toEqual(expectedErrors);
  });

export const exampleInferTestCase = (src, expectedType?, scope = {}) => {
  const [tree, errors] = parseProgramString(src, scope);
  const typedTree = inferType(tree);
  // console.dir(typedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedType) expect(typedTree.data.type).toEqual(expectedType);
  expect(typedTree.data.type).toMatchSnapshot();
};

export const treeInferTestCase = (src, expectedType?, scope = {}) => {
  const [tree, errors] = parseExprString(src, scope);
  const typedTree = inferType(tree);
  // console.dir(typedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedType) expect(typedTree.data.type).toEqual(expectedType);
  expect(typedTree.data.type).toMatchSnapshot();
};

export const treeInferTestCaseArgs = (src, expectedType?, scope = {}) =>
  [`produces correct tree for '${src}'`, () => treeInferTestCase(src, expectedType, scope)] as const;

export const exampleScopeTestCase = (src, expectedScope?, scope = {}) => {
  const [tree, errors] = parseProgramString(src, scope);
  const resolvedTree = resolve(tree);
  // console.dir(typedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedScope) expect(resolvedTree.data.scope).toEqual(expectedScope);
  expect(resolvedTree).toMatchSnapshot();
};

export const treeScopeTestCase = (src, expectedScope?, scope = {}) => {
  const [tokens] = parseTokens(src);
  const context = defaultParsingContext();
  context.scope = new Scope(scope);
  const [tree, errors] = parseExpr(context)(tokens).slice(1);
  const resolvedTree = resolve(tree as AbstractSyntaxTree);
  // console.dir(resolvedTree, { depth: null });
  expect(errors).toEqual([]);
  if (expectedScope) expect(resolvedTree.data.scope).toEqual(expectedScope);
  expect(resolvedTree).toMatchSnapshot();
};

export const treeScopeTestCaseArgs = (src, expectedScope?, scope = {}) =>
  [`produces correct tree for '${src}'`, () => treeInferTestCase(src, expectedScope, scope)] as const;
  