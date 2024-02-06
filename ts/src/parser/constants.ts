import { Iterator } from "iterator-js";
import { matchSeparators } from "./utils";
import { placeholder } from "./ast";
import { Scope, TokenGroupDefinition } from ".";

export const infixArithmeticOps = Iterator.iterEntries({
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  modulo: "%",
  power: "^",
});

export const prefixArithmeticOps = Iterator.iterEntries({
  negate: "-",
  decrement: "--",
  increment: "++",
});

export const comparisonOps = Iterator.iter(["<", "<=", ">=", ">"]);

export const scope: Scope = {
  "+": { separators: matchSeparators(["+"]), precedence: [4, 5] },
  "-": { separators: matchSeparators(["-"]), precedence: [4, 5] },
  "*": { separators: matchSeparators(["*"]), precedence: [6, 7] },
  "/": { separators: matchSeparators(["/"]), precedence: [6, 7] },
  "%": { separators: matchSeparators(["%"]), precedence: [6, 7] },
  "^": { separators: matchSeparators(["^"]), precedence: [8, 9] },
  ",": { separators: matchSeparators([","]), precedence: [3, 4] },
  in: { separators: matchSeparators(["in"]), precedence: [1, 1] },
  is: { separators: matchSeparators(["is"]), precedence: [1, Infinity] },
  and: { separators: matchSeparators(["and"]), precedence: [1, 1] },
  or: { separators: matchSeparators(["or"]), precedence: [1, 1] },
  "==": { separators: matchSeparators(["=="]), precedence: [1, 1] },
  "!=": { separators: matchSeparators(["!="]), precedence: [1, 1] },
  "===": { separators: matchSeparators(["==="]), precedence: [1, 1] },
  "!==": { separators: matchSeparators(["!=="]), precedence: [1, 1] },
  "!": { separators: matchSeparators(["!"]), precedence: [null, 4] },
  as: { separators: matchSeparators(["as"]), precedence: [1, 1] },
  mut: { separators: matchSeparators(["mut"]), precedence: [null, 3] },
  ...comparisonOps
    .map((op) => {
      const definition = {
        separators: matchSeparators([op]),
        precedence: [1, 1],
      };
      return [op, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),
  ...comparisonOps
    .power(2)
    .map<[string, TokenGroupDefinition]>(([op1, op2]) => {
      const definition = {
        separators: matchSeparators([op1], [op2]),
        precedence: [1, 1],
      };
      return [`inRange_${op1}_${op2}`, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),
  "->": { separators: matchSeparators(["->"]), precedence: [Infinity, 2] },
  fn: { separators: matchSeparators(["fn"], ["->"]), precedence: [null, 2] },
  ";": { separators: matchSeparators([";", "\n"]), precedence: [1, 1] },
  "#": { separators: matchSeparators(["#"]), precedence: [null, 4] },
  pin: { separators: matchSeparators(["^"]), precedence: [null, 4] },
  "...": { separators: matchSeparators(["..."]), precedence: [null, 4] },
  match: {
    separators: matchSeparators(["match"], ["{"], ["}"]),
    precedence: [null, null],
  },
  matchColon: {
    separators: matchSeparators(["match"], [":", "\n"]),
    precedence: [null, 2],
  },
  if: {
    separators: matchSeparators(["if"], [":", "\n"]),
    precedence: [null, 2],
  },
  ifElse: {
    separators: matchSeparators(["if"], [":", "\n"], ["else"]),
    precedence: [null, 2],
  },
  for: {
    separators: matchSeparators(["for"], ["in"], [":", "\n"]),
    precedence: [null, 2],
  },
  while: {
    separators: matchSeparators(["while"], [":", "\n"]),
    precedence: [null, 2],
  },
  break: { separators: matchSeparators(["break"]), precedence: [null, 2] },
  continue: {
    separators: matchSeparators(["continue"]),
    precedence: [null, 2],
  },
  return: { separators: matchSeparators(["return"]), precedence: [null, 2] },
  "=": { separators: matchSeparators(["="]), precedence: [2, 2] },
  ":=": { separators: matchSeparators([":="]), precedence: [2, 2] },
  symbol: { separators: matchSeparators(["symbol"]), precedence: [null, 1] },
  record: {
    separators: matchSeparators(["record"], ["{"], ["}"]),
    precedence: [null, null],
  },
  set: {
    separators: matchSeparators(["set"], ["{"], ["}"]),
    precedence: [null, null],
  },
  map: {
    separators: matchSeparators(["map"], ["{"], ["}"]),
    precedence: [null, null],
  },
  access: {
    separators: matchSeparators(["."]),
    precedence: [Infinity, Infinity],
  },
  accessDynamic: {
    separators: matchSeparators(["["], ["]"]),
    precedence: [Infinity, null],
  },
  import: {
    separators: matchSeparators(["import"], ["as"]),
    precedence: [null, 1],
  },
  importWith: {
    separators: matchSeparators(["import"], ["as"], ["with"]),
    precedence: [null, 1],
  },
  use: { separators: matchSeparators(["use"], ["as"]), precedence: [null, 1] },
  useWith: {
    separators: matchSeparators(["use"], ["as"], ["with"]),
    precedence: [null, 1],
  },
  export: { separators: matchSeparators(["export"]), precedence: [null, 1] },
  exportAs: {
    separators: matchSeparators(["export"], ["as"]),
    precedence: [null, 1],
  },
  external: {
    separators: matchSeparators(["external"]),
    precedence: [null, 2],
  },
  label: { separators: matchSeparators([":"]), precedence: [2, 2] },
  operator: {
    separators: matchSeparators(["operator"]),
    precedence: [null, 3],
  },
  operatorPrecedence: {
    separators: matchSeparators(["operator"], ["precedence"]),
    precedence: [null, 3],
  },
  negate: {
    separators: matchSeparators(["-"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  prefixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  prefixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [null, Number.MAX_SAFE_INTEGER],
  },
  postfixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [3, null],
  },
  postfixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [3, null],
  },
  parens: {
    separators: matchSeparators(["("], [")"]),
    precedence: [null, null],
  },
  brackets: {
    separators: matchSeparators(["["], ["]"]),
    precedence: [null, null],
  },
  braces: {
    separators: matchSeparators(["{"], ["}"]),
    precedence: [null, null],
  },
  comment: {
    separators: matchSeparators(["//"], ["\n"]),
    precedence: [null, null],
    parse:
      () =>
      (src, i = 0) => {
        let index = i;
        while (src[index] && src[index].type !== "newline") index++;
        return [index, placeholder(), []];
      },
    drop: true,
  },
  commentBlock: {
    separators: matchSeparators(["/*"], ["*/"]),
    precedence: [null, null],
    parse:
      () =>
      (src, i = 0) => {
        let index = i;
        while (src[index] && src[index].src !== "*/") index++;
        return [index, placeholder(), []];
      },
    drop: true,
  },
  application: {
    separators: matchSeparators(),
    precedence: [Infinity, Infinity],
  },
};

export const symbols = Iterator.iter([
  "->",
  "--",
  "++",
  "//",
  "/*",
  "*/",
  "!=",
  "==",
  ">=",
  "<=",
  ":=",
  "===",
  "!==",
  "...",
]);