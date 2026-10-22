import Module from 'module';
import path from 'path';

/**
 * Tiny dependency free test helpers: replace third party packages (mongoose, kaspa-wasm, ...)
 * with fakes while a module under test is loaded, so tests need no database or network.
 */
const M: any = Module;

export interface Mock {
  match: (request: string) => boolean;
  value: any;
}

/** Mock an npm package by its exact name. Set __esModule: true on the value for default imports. */
export function pkg(name: string, value: any): Mock {
  return { match: (request) => request === name, value };
}

/** Mock a local module by the end of its import path, for example "/utils/price". */
export function local(suffix: string, value: any): Mock {
  return { match: (request) => request.endsWith(suffix), value };
}

export function installMocks(mocks: Mock[]): () => void {
  const original = M._load;
  M._load = function (request: string, parent: any, isMain: boolean) {
    for (const mock of mocks) {
      if (mock.match(request)) return mock.value;
    }
    return original.call(this, request, parent, isMain);
  };
  return () => {
    M._load = original;
  };
}

/** Loads a compiled module from the source tree fresh, so module level constants are re-read. */
export function freshRequire(relativeToSrc: string): any {
  const srcRoot = path.resolve(__dirname, '..', '..');
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcRoot) && !key.includes(path.sep + '__tests__' + path.sep)) {
      delete require.cache[key];
    }
  }
  return require(path.join(srcRoot, relativeToSrc));
}
