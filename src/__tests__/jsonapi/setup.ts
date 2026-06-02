// vitest setup — load reflect-metadata once so decorator metadata is
// available for every test file. Mirrors what consumers do in their
// own bootstrap (the lib only side-effect-imports it via src/index.ts).
import 'reflect-metadata';
