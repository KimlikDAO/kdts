import { readFile } from "node:fs/promises";

readFile("./showcase/fsPromises.ts", "utf8")
  .then((contents) => console.log(contents));
