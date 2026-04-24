import { readFileSync } from "node:fs";

const contents = readFileSync("./showcase/fizzbuzz.ts", "utf8") as string;

const transformed = contents.replaceAll(
  /fizz|buzz/g,
  (word) => word == "fizz" ? "buzz" : "fizz"
);

console.log(transformed);
