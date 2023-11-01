import {bundle} from './bundle.ts';
import {importBundle} from './module.ts';
import compilerOptions from './tsconfig.ts';
import {encodeHash} from './utils.ts';
import type {BumbleOptions, BumbleModule} from './types.ts';

export default class Bumble<M> {
  #kvPath: string | undefined;
  #deployId: string | undefined;
  #dynamicImports: boolean;
  #compilerOptions: BumbleOptions['compilerOptions'];
  #cacheReady = false;

  constructor(options?: BumbleOptions) {
    this.#kvPath = options?.kvPath ?? undefined;
    this.#deployId = options?.deployId ?? undefined;
    this.#dynamicImports = options?.dynamicImports ?? false;
    this.#compilerOptions = {
      ...(options?.compilerOptions ?? {}),
      ...compilerOptions
    };
  }

  async bumble(abspath: string): Promise<BumbleModule<M>> {
    const options: BumbleOptions = {
      dynamicImports: this.#dynamicImports,
      compilerOptions: this.#compilerOptions
    };
    if (this.#deployId) {
      options.kvPath = this.#kvPath;
      options.deployId = await encodeHash(this.#deployId, 'SHA-1');
      if (!this.#cacheReady) {
        await this.#setupCache();
      }
    }
    const {code, external} = await bundle(abspath, options);
    const mod = await importBundle<M>(options, {code, external});
    return mod;
  }

  #setupCache = async () => {
    if (!this.#deployId) return;
    const db = await Deno.openKv(this.#kvPath);
    const entries = db.list({prefix: ['cache']});
    for await (const entry of entries) {
      if (!entry.key.includes(this.#deployId)) {
        await db.delete(entry.key);
      }
    }
    db.close();
    this.#cacheReady = true;
  };
}
