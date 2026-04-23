<h1><img src="https://raw.githubusercontent.com/KimlikDAO/dapp/ana/components/icon.svg" align="center" height="44"> kdts</a></h1>

[![Tests](https://img.shields.io/github/actions/workflow/status/KimlikDAO/kdts/test.yml?branch=main)](https://github.com/KimlikDAO/kdts/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@kimlikdao/kdts.svg)](https://www.npmjs.com/package/@kimlikdao/kdts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`kdts` is an optimization-first TypeScript compiler. Instead of erasing types
as early as possible, it uses them throughout the compilation to direct
optimizations, achieving transformations that would not have been possible were
the types not known.

## Install

```sh
bun add -g @kimlikdao/kdts
```

Requires Bun `>= 1.3.0`.

## Usage

```sh
kdts src/main.ts
kdts run src/main.ts
kdts test
kdts bench
```

- `kdts <entry>` or `kdts compile <entry>` compiles an entry file
- `kdts run <entry>` compiles and runs an entry file
- `kdts test [target]` compiles matching test files and runs them
- `kdts bench [target]` compiles matching benchmarks and runs them

Run `kdts --help` for the full option list.
