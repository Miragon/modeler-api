# @miragon/wardley-schema-model

[![npm](https://img.shields.io/npm/v/@miragon/wardley-schema-model)](https://www.npmjs.com/package/@miragon/wardley-schema-model)
[![License: MIT](https://img.shields.io/github/license/Miragon/modeler-suite)](https://github.com/Miragon/modeler-suite/blob/main/modelers/wardley/LICENSE)

DOM-free Wardley metamodel: types, Zod validation, stage derivation, and deterministic JSON
serialization.

## Install

```bash
npm install @miragon/wardley-schema-model
```

## Usage

```ts
import { createEmptyMap, serializeMap, parseMapJSON } from "@miragon/wardley-schema-model";

const map = createEmptyMap("Tea Shop");

const json = serializeMap(map); // deterministic: stable key order, rounded coordinates
const restored = parseMapJSON(json); // validated + migrated to the current schema
```

Part of the [Wardley Maps Modeler](https://github.com/Miragon/modeler-suite/tree/main/modelers/wardley) in the [Miragon modeler suite](https://github.com/Miragon/modeler-suite).

## License

MIT
