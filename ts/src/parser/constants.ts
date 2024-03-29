import { Iterator } from "iterator-js";
import { associative, leftAssociative, matchSeparators, rightAssociative } from "./utils.js";
import { placeholder } from "./ast.js";
import { TokenGroupDefinition } from "./index.js";
import { Scope } from "../scope.js";

export const infixArithmeticOps = Iterator.iterEntries({
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  modulo: "%",
  power: "^",
});

export const infixBooleanOps = Iterator.iterEntries({
  and: "and",
  or: "or",
  in: "in",
  is: "is",
  equal: "==",
  "not equal": "!=",
  "deep equal": "===",
  "deep not equal": "!==",
});

export const prefixArithmeticOps = Iterator.iterEntries({
  negate: "-",
  decrement: "--",
  increment: "++",
});

export const comparisonOps = Iterator.iter(["<", "<=", ">=", ">"]);

const semicolonPrecedence = 1;
const assignmentPrecedence = semicolonPrecedence + 1;
const booleanPrecedence = assignmentPrecedence + 2;
const tuplePrecedence = booleanPrecedence + 4;
const arithmeticPrecedence = tuplePrecedence + 3;
const maxPrecedence = Number.MAX_SAFE_INTEGER;

export const scopeDictionary: Record<string, TokenGroupDefinition> = {
  false: { separators: matchSeparators(["false"]), precedence: [null, null] },
  true: { separators: matchSeparators(["true"]), precedence: [null, null] },
  print: { separators: matchSeparators(["print"]), precedence: [null, semicolonPrecedence + 1] },
  allocate: { separators: matchSeparators(["allocate"]), precedence: [null, semicolonPrecedence + 1] },
  free: { separators: matchSeparators(["free"]), precedence: [null, semicolonPrecedence + 1] },
  ref: { separators: matchSeparators(["&"]), precedence: [null, 3] },
  deref: { separators: matchSeparators(["*"]), precedence: [null, 3] },
  "@": { separators: matchSeparators(["@"]), precedence: leftAssociative(tuplePrecedence + 2) },

  "+": { separators: matchSeparators(["+"]), precedence: associative(arithmeticPrecedence) },
  "-": { separators: matchSeparators(["-"]), precedence: leftAssociative(arithmeticPrecedence + 1) },
  "*": { separators: matchSeparators(["*"]), precedence: associative(arithmeticPrecedence + 3) },
  "/": { separators: matchSeparators(["/"]), precedence: leftAssociative(arithmeticPrecedence + 4) },
  "%": { separators: matchSeparators(["%"]), precedence: leftAssociative(arithmeticPrecedence + 4) },
  "^": { separators: matchSeparators(["^"]), precedence: leftAssociative(arithmeticPrecedence + 6) },

  ",": { separators: matchSeparators([","]), precedence: associative(tuplePrecedence) },

  in: { separators: matchSeparators(["in"]), precedence: rightAssociative(booleanPrecedence) },
  is: { separators: matchSeparators(["is"]), precedence: [booleanPrecedence, Infinity] },
  and: { separators: matchSeparators(["and"]), precedence: associative(booleanPrecedence + 1) },
  or: { separators: matchSeparators(["or"]), precedence: associative(booleanPrecedence) },
  "==": { separators: matchSeparators(["=="]), precedence: rightAssociative(booleanPrecedence + 2) },
  "!=": { separators: matchSeparators(["!="]), precedence: rightAssociative(booleanPrecedence + 2) },
  "===": { separators: matchSeparators(["==="]), precedence: rightAssociative(booleanPrecedence + 2) },
  "!==": { separators: matchSeparators(["!=="]), precedence: rightAssociative(booleanPrecedence + 2) },
  "!": { separators: matchSeparators(["!"]), precedence: [null, 4] },
  ...comparisonOps
    .map((op) => {
      const definition = {
        separators: matchSeparators([op]),
        precedence: rightAssociative(booleanPrecedence + 4),
      };
      return [op, definition] as [string, TokenGroupDefinition];
    })
    .toObject(),

  as: { separators: matchSeparators(["as"]), precedence: [1, 1] },
  mut: { separators: matchSeparators(["mut"]), precedence: [null, assignmentPrecedence + 1] },
  "->": { separators: matchSeparators(["->"]), precedence: rightAssociative(semicolonPrecedence + 1) },
  fn: { separators: matchSeparators(["fn"], ["->"]), precedence: [null, 2] },
  fnBlock: { separators: matchSeparators(["fn"], ["{"], ["}"]), precedence: [null, null] },
  fnArrowBlock: { separators: matchSeparators(["fn"], ["->"], ["{"], ["}"]), precedence: [null, null] },
  macro: { separators: matchSeparators(["macro"], ["->"]), precedence: [null, 2] },
  macroBlock: { separators: matchSeparators(["macro"], ["{"], ["}"]), precedence: [null, null] },
  macroArrowBlock: { separators: matchSeparators(["macro"], ["->"], ["{"], ["}"]), precedence: [null, null] },
  ";": { separators: matchSeparators([";", "\n"]), precedence: associative(semicolonPrecedence) },
  "#": { separators: matchSeparators(["#"]), precedence: [null, maxPrecedence] },
  pin: { separators: matchSeparators(["^"]), precedence: [null, tuplePrecedence + 1] },
  "...": { separators: matchSeparators(["..."]), precedence: [null, tuplePrecedence + 1] },
  match: {
    separators: matchSeparators(["match"], ["{"], ["}"]),
    precedence: [null, null],
  },
  if: {
    separators: matchSeparators(["if"], [":", "\n"]),
    precedence: [null, semicolonPrecedence + 1],
  },
  ifElse: {
    separators: matchSeparators(["if"], [":", "\n"], ["else"]),
    precedence: [null, semicolonPrecedence + 1],
  },
  ifBlock: {
    separators: matchSeparators(["if"], ["{"], ["}"]),
    precedence: [null, null],
  },
  ifBlockElse: {
    separators: matchSeparators(["if"], ["{"], ["}"], ["else"]),
    precedence: [null, semicolonPrecedence + 1],
  },
  for: {
    separators: matchSeparators(["for"], ["in"], [":", "\n"]),
    precedence: [null, semicolonPrecedence + 1],
  },
  forBlock: {
    separators: matchSeparators(["for"], ["in"], ["{"], ["}"]),
    precedence: [null, null],
  },
  while: {
    separators: matchSeparators(["while"], [":", "\n"]),
    precedence: [null, semicolonPrecedence + 1],
  },
  whileBlock: {
    separators: matchSeparators(["while"], ["{"], ["}"]),
    precedence: [null, null],
  },
  loop: {
    separators: matchSeparators(["loop"]),
    precedence: [null, semicolonPrecedence + 1],
  },
  yield: { separators: matchSeparators(["yield"]), precedence: [null, semicolonPrecedence + 1] },
  async: { separators: matchSeparators(["async"]), precedence: [null, maxPrecedence] },
  await: { separators: matchSeparators(["await"]), precedence: [null, maxPrecedence - 1] },
  parallel: { separators: matchSeparators(["|"]), precedence: associative(semicolonPrecedence + 1) },
  pipe: { separators: matchSeparators(["|>"]), precedence: leftAssociative(2) },
  send: { separators: matchSeparators(["<-"]), precedence: rightAssociative(2) },
  receive: { separators: matchSeparators(["<-"]), precedence: [null, 2] },
  peekReceive: { separators: matchSeparators(["<-?"]), precedence: [null, 2] },
  peekSend: { separators: matchSeparators(["?<-"]), precedence: rightAssociative(2) },

  "=": { separators: matchSeparators(["="]), precedence: rightAssociative(semicolonPrecedence + 1) },
  ":=": { separators: matchSeparators([":="]), precedence: rightAssociative(semicolonPrecedence + 1) },

  symbol: { separators: matchSeparators(["symbol"]), precedence: [null, null] },
  atom: { separators: matchSeparators([":"]), precedence: [null, maxPrecedence] },
  channel: { separators: matchSeparators(["channel"]), precedence: [null, null] },
  access: {
    separators: matchSeparators(["."]),
    precedence: leftAssociative(maxPrecedence),
  },
  accessDynamic: {
    separators: matchSeparators(["["], ["]"]),
    precedence: [maxPrecedence, null],
  },
  import: {
    separators: matchSeparators(["import"], ["as"]),
    precedence: [null, 1],
  },
  importWith: {
    separators: matchSeparators(["import"], ["as"], ["with"]),
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
  label: { separators: matchSeparators([":"]), precedence: rightAssociative(tuplePrecedence + 2) },
  codeLabel: { separators: matchSeparators(["::"]), precedence: leftAssociative(semicolonPrecedence + 1) },
  operator: {
    separators: matchSeparators(["operator"]),
    precedence: [null, assignmentPrecedence + 1],
  },
  operatorPrecedence: {
    separators: matchSeparators(["operator"], ["precedence"]),
    precedence: [null, assignmentPrecedence + 1],
  },
  negate: {
    separators: matchSeparators(["-"]),
    precedence: [null, maxPrecedence],
  },
  prefixDecrement: {
    separators: matchSeparators(["--"]),
    precedence: [null, maxPrecedence],
  },
  prefixIncrement: {
    separators: matchSeparators(["++"]),
    precedence: [null, maxPrecedence],
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
    precedence: leftAssociative(maxPrecedence),
  },
};

export const scope = new Scope(scopeDictionary);

export const symbols = Iterator.iter([
  "::",
  "<-",
  "?<-",
  "<-?",
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
