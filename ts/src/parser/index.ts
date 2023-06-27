import path from "node:path";
import { parseStringToAST, parseTokensToASTs } from "./ast";
import {
  AbstractSyntaxTree,
  AbstractSyntaxTreeChildren,
  ParsingError,
  Scope,
  FlatSyntaxTree,
  ConsumeParsingResult,
} from "./types";
import fs from "node:fs/promises";
import { assert, omit, pick } from "../utils";

const blockScope = (inner: (outer: Scope) => Scope): Scope => ({
  sequence: {
    leadingTokens: [";", "\n"],
    separators: [{ tokens: [";", "\n"], repeats: [0, Infinity], scope: inner }],
    precedence: [1, null],
  },
});

const bindingScope: Scope = {
  define: { leadingTokens: [":="], separators: [], precedence: [Infinity, 1] },
  mutate: { leadingTokens: ["="], separators: [], precedence: [Infinity, 1] },
};

const exprScope: Scope = {
  array: {
    leadingTokens: ["["],
    separators: [{ tokens: ["]"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  index: {
    leadingTokens: ["["],
    separators: [{ tokens: ["]"], repeats: [1, 1] }],
    precedence: [Infinity, null],
  },
  arrow: { leadingTokens: ["->"], separators: [], precedence: [Infinity, Infinity] },
  generic: {
    leadingTokens: ["<"],
    separators: [{ tokens: [">"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  group: {
    leadingTokens: ["("],
    separators: [{ tokens: [")"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  block: {
    leadingTokens: ["{"],
    separators: [{ tokens: ["}"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  if: {
    leadingTokens: ["if"],
    separators: [
      { tokens: [":"], repeats: [1, 1] },
      { tokens: ["else"], repeats: [0, 1] },
    ],
    precedence: [null, Infinity],
  },
  tuple: { leadingTokens: [","], separators: [{ tokens: [","], repeats: [0, Infinity] }], precedence: [1, 2] },
  logical: { leadingTokens: ["and", "or"], separators: [], precedence: [1, 2] },
  equality: { leadingTokens: ["==", "is"], separators: [], precedence: [3, 4] },
  comparison: { leadingTokens: [">", ">=", "<", "<="], separators: [], precedence: [5, 6] },
  term: { leadingTokens: ["+", "-"], separators: [], precedence: [7, 8] },
  factor: { leadingTokens: ["*", "/"], separators: [], precedence: [9, 10] },
  exponent: { leadingTokens: ["^", "%"], separators: [], precedence: [11, 12] },
  unary: { leadingTokens: ["not", "-", "sqrt"], separators: [], precedence: [null, 13] },
  postfixNot: { leadingTokens: ["not"], separators: [], precedence: [14, null] },
};
const commentsScope: Scope = {
  comment: {
    leadingTokens: ["//"],
    separators: [{ tokens: ["\n"], repeats: [1, 1] }],
    precedence: [null, null],
  },
  multilineComment: {
    leadingTokens: ["/*"],
    separators: [{ tokens: ["*/"], repeats: [1, 1] }],
    precedence: [null, null],
  },
};
const topLevelScope: Scope = {
  import: {
    leadingTokens: ["import"],
    separators: [
      { tokens: ["with"], repeats: [0, 1] },
      { tokens: ["as"], repeats: [1, 1] },
    ],
    precedence: [null, 1],
  },
  external: {
    leadingTokens: ["external"],
    separators: [
      { tokens: [":"], repeats: [0, 1] },
      { tokens: ["="], repeats: [0, 1] },
    ],
    precedence: [null, 1],
  },
  export: {
    leadingTokens: ["export"],
    separators: [{ tokens: ["as", "="], repeats: [0, 1] }],
    precedence: [null, 1],
  },
};
const scope: Scope = {
  ...commentsScope,
  ...blockScope(() => omit(scope, ["sequence"])),
  ...topLevelScope,
  ...pick(bindingScope, ["define"]),
};

const expand = (tree: FlatSyntaxTree): [expanded: AbstractSyntaxTree, errors: ParsingError[]] => {
  const errors: ParsingError[] = [];
  const result: AbstractSyntaxTree = { item: { type: "whitespace", src: " " } };

  if (tree.lhs) {
    const [expanded, _errors] = expand(tree.lhs);
    result.lhs = expanded;
    errors.push(..._errors);
  }

  if (tree.item.type === "operator") {
    const children: AbstractSyntaxTreeChildren[] = [];

    for (const child of tree.item.children) {
      const [asts, errors] = parseTokensToASTs(child.children, 0, scope);
      const _children: AbstractSyntaxTree[] = [];
      for (const ast of asts) {
        const [expanded, _errors] = expand(ast);
        _children.push(expanded);
        errors.push(..._errors);
      }
      children.push({ ...child, children: _children });
    }

    result.item = { ...tree.item, children };
  } else {
    result.item = tree.item;
  }

  if (tree.rhs) {
    const [expanded, _errors] = expand(tree.rhs);
    result.rhs = expanded;
    errors.push(..._errors);
  }

  return [result, errors];
};

type Expression = unknown;
type ModuleExports = Record<string, Expression>;
type ModuleSyntaxTreeItem =
  | { type: "import"; from: string; with?: Expression; alias: string }
  | { type: "external"; alias: string }
  | { type: "export"; alias: string; value?: Expression };
type ModuleSyntaxTree = ModuleSyntaxTreeItem[];
type Module = {
  externals: { alias: string; type: Expression }[];
  imports: { module: string; with: Expression }[];
  exports: ModuleExports;
  source: string;
};
// export const parse = (src: string) => {
//   const [ast, errors] = parseStringToAST(src, 0, scope);
//   const moduleSyntaxTree = parseModule(ast);
//   const module: ModuleExports = {};
//   const result: AbstractSyntaxTree[] = [];

//   for (const item of ast) {
//     const [expanded, _errors] = expand(item);
//     result.push(expanded);
//     errors.push(..._errors);
//   }

//   return [result, errors];
// };

const parseModule = (src: string): ConsumeParsingResult<ModuleSyntaxTree> => {
  const [ast, errors] = parseStringToAST(src, 0, scope);
  const items: ModuleSyntaxTree = [];

  for (const astItem of ast) {
    if (astItem.item.type === "operator") {
      switch (astItem.item.id) {
        case "sequence": {
          assert(astItem.lhs, "sequence item must have lhs");
          const { item, lhs } = astItem;

          if (lhs.item.type === "operator") {
            switch (lhs.item.id) {
              case "import":
              case "export":
              case "external": {
                items.push();
              }
              case "multilineComment":
              case "comment": {
                continue;
              }
              default: {
                errors.push({ message: "Unexpected operator" });
              }
            }
          } else {
            errors.push({ message: "Unexpected token" });
          }
          item.children[0].children;
          for (const astItem of item.children[0].children) {
            if (astItem.type === "operator") {
              switch (astItem.id) {
                case "sequence": {
                  assert(astItem.lhs, "sequence item must have lhs");
                  const { item, lhs } = astItem;

                  if (lhs.item.type === "operator") {
                    switch (lhs.item.id) {
                      case "import":
                      case "export":
                      case "external": {
                        items.push();
                      }
                      case "multilineComment":
                      case "comment": {
                        continue;
                      }
                      default: {
                        errors.push({ message: "Unexpected operator" });
                      }
                    }
                  } else {
                    errors.push({ message: "Unexpected token" });
                  }
                }
                case "import":
                case "export":
                case "external": {
                  items.push();
                }
                case "multilineComment":
                case "comment": {
                  continue;
                }
                default: {
                  errors.push({ message: "Unexpected operator" });
                }
              }
            } else {
              errors.push({ message: "Unexpected token" });
            }
          }
        }
        case "import":
        case "export":
        case "external": {
          items.push();
        }
        case "multilineComment":
        case "comment": {
          continue;
        }
        default: {
          errors.push({ message: "Unexpected operator" });
        }
      }
    } else {
      errors.push({ message: "Unexpected token" });
    }
  }

  return [[], errors];
};

const modules: Record<string, Module> = {};

const loadModule = async (name: string): Promise<Module> => {
  return { exports: {}, externals: [], imports: [], source: "" };
};
const parseFile = async (_path: string, base = "."): Promise<ConsumeParsingResult<unknown>> => {
  const file = await fs.readFile(path.join(base, _path));
  const src = file.toString();
  const [moduleSyntaxTree, errors] = parseModule(src);
  const exports: ModuleExports = {};

  // for (const item of moduleSyntaxTree) {
  //   if (item.type === "export") exports[item.alias] = item.value;
  //   if (item.type === "import") {
  //     if (item.from in modules) continue;
  //     if (item.from.startsWith("/registry")) {
  //       modules[item.from] = await loadModule(item.from.substring("/registry".length));
  //     }

  //     const parsed = await parseFile(path.join(base, item.from));
  //   }
  // }
  return [[], errors];
};

/*
Parse module:

input:
1. path to the module
2. optional base of path.

output: 
1. module dictionary, where each value has:
  1. list of imports, that are keys in the module dict
  2. list of exported names (untyped)
  3. list of external names (untyped)
2. errors that occured during parsing

instructions:
1. concatenate path with base
2. check if resulting path a folder or a file
3. if it is a folder - return an error
4. read file's content as string
5. parse by calling a parseStringToAST with parameters:
  1. source to parse (file's content)
  2. index at which to start (0).
  3. scope, which defines statements and operstors like "import", "export", "external":
6. assert that result has only one top level children
7. asseet that result's child is "sequence" operator
8. extract "sequence"'s children as "statements".
9. assert that "statements" only include single "import", "export", "external" statements
10. for each statement do:
  1. if it's import:
    1. assert its first child is single string
    2. assert its second child has a single single child
    3. if there is a third child, assert it has a single child
    4. parse imported module, using path defined by first child
    5. merge module dictionaries.
    6. add import to the list of imports
  2. if it's export:
    1. assert its first child is single identifier
    2. if there is a second child, assert it is a single child
    3. add export to the list of exports
  3. if it's external:
    1. assert its first child is single identifier
    2. if there are second and third children, assert they have a single child
    3. add external to the list of externals
11. return module dictionaries and errors.
*/