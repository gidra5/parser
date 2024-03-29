import { AbstractSyntaxTree, group, int, operator, placeholder, string } from "../parser/ast";
import { comparisonOps } from "../parser/constants";
import { templateString } from "../parser/string";
import { traverse } from "../tree";

export const transform = (ast: AbstractSyntaxTree): AbstractSyntaxTree => {
  // expressions
  // tuple literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === ",",
    (node) => {
      return node.children.reduce((acc, child) => {
        if (child.name === "placeholder") return acc;
        if (child.value === "label" && child.name === "operator") {
          const [name, value] = child.children;
          const nameNode = name.name === "name" ? string(name.value) : name;
          return operator("set", acc, nameNode, value);
        }
        if (child.value === "...") {
          const [value] = child.children;
          return operator("join", acc, value);
        }
        return operator("push", acc, child);
      }, group("unit"));
    }
  );

  // any other dangling labels outside of tuple literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "label",
    (node) => {
      const [name, value] = node.children;
      return operator("set", group("unit"), name, value);
    }
  );

  // unit
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "parens" && node.children.length === 0,
    (node) => {
      node.value = "unit";
    }
  );

  // pipe operator to function application
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "|>",
    (node) => {
      const [arg, fn] = node.children;
      return operator("application", fn, arg);
    }
  );

  // eliminate parentheses
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "parens",
    (node) => {
      return node.children[0];
    }
  );

  // comparison sequence to and of comparisons
  traverse(
    ast,
    (node) => node.name === "operator" && comparisonOps.some((x) => x === node.value),
    (node) => {
      const comparisons: AbstractSyntaxTree[] = [];
      let prev = node.children[0];
      let prevOp = node.value;
      const traverse = (node) => {
        if (!(node.name === "operator" && comparisonOps.some((x) => x === node.value))) {
          comparisons.push(operator(prevOp, prev, node));
          return;
        }
        const [left, right] = node.children;
        comparisons.push(operator(prevOp, prev, left));
        prev = left;
        prevOp = node.value;
        traverse(right);
      };
      traverse(node.children[1]);
      if (comparisons.length === 1) return comparisons[0];
      return operator("and", ...comparisons);
    }
  );

  // comparisons to single direction
  traverse(
    ast,
    (node) => node.name === "operator" && comparisonOps.some((x) => x === node.value),
    (node) => {
      const [left, right] = node.children;
      if (node.value === ">") return operator("<", right, left);
      if (node.value === ">=") return templateString("!(_ < _)", [left, right]);
      if (node.value === "<=") return templateString("!(_ < _)", [right, left]);
      return node;
    }
  );

  // not equal to equal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "!=",
    (node) => {
      const [left, right] = node.children;
      return templateString("!(_ == _)", [left, right]);
    }
  );

  // not deep equal to deep equal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "!==",
    (node) => {
      const [left, right] = node.children;
      return templateString("!(_ === _)", [left, right]);
    }
  );

  // ; to fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === ";",
    (node) => {
      return node.children.reduce(
        (acc, child) =>
          acc.name === "placeholder"
            ? child
            : child.name === "placeholder"
            ? acc
            : templateString("(fn -> _) _", [child, acc]),
        placeholder()
      );
    }
  );

  // postfix increment
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "postfixIncrement",
    (node) => {
      const [expr] = node.children;
      return templateString("{ value := _; _ = value + 1; value }", [expr, expr]);
    }
  );

  // postfix decrement
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "postfixDecrement",
    (node) => {
      const [expr] = node.children;
      return templateString("{ value := _; _ = value - 1; value }", [expr, expr]);
    }
  );

  // prefix increment
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "prefixIncrement",
    (node) => {
      const [expr] = node.children;
      return templateString("_ = _ + 1", [expr, expr]);
    }
  );

  // prefix decrement
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "prefixDecrement",
    (node) => {
      const [expr] = node.children;
      return templateString("_ = _ - 1", [expr, expr]);
    }
  );

  // statements

  // forBlock to for
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "forBlock",
    (node) => {
      node.value = "for";
    }
  );

  // whileBlock to while
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "whileBlock",
    (node) => {
      node.value = "while";
    }
  );

  // for to while
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "for",
    (node) => {
      const [pattern, expr, body] = node.children;
      const template = "{ iterator := _; while iterator.has_next { _, rest := iterator.next; iterator = rest; _ } }";
      return templateString(template, [expr, pattern, body]);
    }
  );

  // while to loop
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "while",
    (node) => {
      const [condition, body] = node.children;
      return templateString("loop ({ cond := _; if !cond: break() }; _)", [condition, body]);
    }
  );

  // if and ifBlock to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && (node.value === "if" || node.value === "ifBlock"),
    (node) => {
      const condition = node.children[0];
      const ifTrue = node.children[1];

      return operator("ifElse", condition, ifTrue, placeholder());
    },
    true
  );

  // ifBlockElse to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "ifBlockElse",
    (node) => {
      node.value = "ifElse";
    }
  );

  // match to ifElse
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "match",
    (node) => {
      const [value, { children: branches }] = node.children;
      if (branches.length === 0) return group("braces");
      const branchTemplate = (branch, elseBranch) =>
        templateString("if _ is _: label _ else _", [value, branch.children[0], branch.children[1], elseBranch]);
      return templateString("label::_", [
        branches.reduceRight((acc, branch) => branchTemplate(branch, acc), placeholder()),
      ]);
    }
  );

  // ifElse to and-or
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "ifElse",
    (node) => {
      const [condition, ifTrue, ifFalse] = node.children;
      return templateString("label::((_ and label _) or label _)", [condition, ifTrue, ifFalse]);
    }
  );

  // loop to block
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "loop",
    (node) => {
      const [body] = node.children;
      return templateString("{ _; continue() }", [body]);
    }
  );

  // block to fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "block",
    (node) => {
      const [expr] = node.children;
      return templateString(
        "(fn x -> x x) (fn self -> fn -> label::(continue := fn -> label (self self ()); break := label; _)) ()",
        [expr]
      );
    }
  );

  // functions

  // -> operator to function literal
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "->",
    (node) => {
      node.value = "fn";
    }
  );

  // fnBlock to fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fnBlock",
    (node) => {
      node.value = "fn";
    }
  );

  // fn to typed fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      node.children = [node.children[0], placeholder(), node.children[1]];
    }
  );

  // fnArrowBlock to fn
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fnArrowBlock",
    (node) => {
      node.value = "fn";
    }
  );

  // function argument list to curried function
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      const [params, returnType, body] = node.children;
      if (params.value !== ",") return node;
      const param = params.children.pop()!;
      const fn = operator("fn", param, returnType, body);
      return params.children.reduceRight((acc, param) => operator("fn", param, placeholder(), acc), fn);
    }
  );

  // fn arg to nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "fn",
    (node) => {
      const [param, returnType, body] = node.children;
      if (param.name === "placeholder") return operator("fn", returnType, body);
      return operator("fn", returnType, templateString("{ _ := #0; _ }", [param, body]));
    }
  );

  // macroBlock to macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macroBlock",
    (node) => {
      node.value = "macro";
    }
  );

  // macro to typed macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macro",
    (node) => {
      node.children = [node.children[0], placeholder(), node.children[1]];
    }
  );

  // macroArrowBlock to macro
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macroArrowBlock",
    (node) => {
      node.value = "macro";
    }
  );

  // macro arg to nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "macro",
    (node) => {
      const [param, returnType, body] = node.children;
      if (param.name === "placeholder") return operator("macro", returnType, body);
      return operator("macro", returnType, templateString("{ _ := #0; _ }", [param, body]));
    }
  );

  // nameless binding and shadowing

  // nameless binding
  traverse(
    ast,
    (node) => node.name === "operator" && node.value === "#" && node.children[0].name === "int",
    (node) => {
      node.value = node.children[0].value;
      node.children = [];
    }
  );

  // shadowing
  traverse(
    ast,
    (node) =>
      node.name === "operator" &&
      node.value === "#" &&
      (node.children[0].name === "name" || node.children[0].value === "#"),
    (node) => {
      let value = node.children[0].value;
      if (typeof value === "string") value = { level: 0, name: value };
      node.value = { level: value.level + 1, name: value.name };
      node.children = [];
    },
    true
  );

  return ast;
};
