import { program } from "commander";
import readline from "readline";
import { stdin as input, stdout as output } from "process";
import { VM } from "./vm/index.js";
import fs from "fs";
import { parseTokens } from "./parser/tokens.js";
import { parse } from "./parser/index.js";
import { Compiler } from "./compiler/index.js";
import { parseExprString } from "./parser/string.js";
import { evaluate, initialContext } from "./evaluation/index.js";

program
  .command("run <file>")
  .description("Run script from a file")
  .action((file) => {
    const context = initialContext();
    const code = fs.readFileSync(file, "utf-8");
    const [tokens, tokenErrors] = parseTokens(code);
    const [ast, astErrors] = parse()(tokens);
    evaluate(ast, context);
  });

program
  .command("repl [file]")
  .description("Run interactive environment with optional initial script/module")
  .action((file) => {
    const context = initialContext();
    if (file) {
      const code = fs.readFileSync(file, "utf-8");
      const [tokens, tokenErrors] = parseTokens(code);
      const [ast, astErrors] = parse()(tokens);
      const result = evaluate(ast, context);
      console.log(result);
    }
    const rl = readline.createInterface({ input, output, prompt: ">> " });
    rl.prompt();

    rl.on("line", (_line) => {
      const line = _line.trim();
      switch (line) {
        case "exit":
          rl.close();
          break;
        default: {
          try {
            const [tokens, tokenErrors] = parseTokens(line);
            const [ast, astErrors] = parse()(tokens);
            const result = evaluate(ast, context);
            console.log(result);
          } catch (e) {
            console.error(e);
          }
          break;
        }
      }

      rl.prompt();
    }).on("close", () => {
      console.log("Have a great day!");
      process.exit(0);
    });
  });

program
  .command("build <file> <output>")
  .description("Compile a program into an image")
  .action((file, output) => {
    const code = fs.readFileSync(file, "utf-8");
    console.log("File is read");

    // const [tokens, _errors] = parseTokens(code);
    // const [ast, __errors] = parse()(tokens);
    const [ast, _errors] = parseExprString(code);
    console.log("File is parsed");

    const compiled = Compiler.compile(ast, 0x3000);
    console.log("File is compiled");
    const buffer = Buffer.from(compiled.buffer);

    fs.writeFileSync(output, buffer.swap16(), { encoding: "binary" });
    console.log("Compiled output is written to file");
  });

program
  .command("vm <image> [osImage]")
  .description("Run an image of compiled program")
  .action((imageFile, osImageFile) => {
    const osImage = osImageFile ? fs.readFileSync(osImageFile) : undefined;
    const image = fs.readFileSync(imageFile);

    const vm = new VM(osImage);
    console.log("Os image loaded");

    input.setRawMode(true);
    readline.emitKeypressEvents(input);
    input.on("keypress", (char, key) => {
      if (key.ctrl && key.name === "c") {
        process.exit(0);
      }
      vm.emit("input", char);
    });

    vm.loadImage(image);
    console.log("Image loaded");

    vm.on("halt", () => {
      console.log("Halted");

      process.exit(0);
    });

    console.log("Starting VM...");
    vm.run();
  });

program.parse();
