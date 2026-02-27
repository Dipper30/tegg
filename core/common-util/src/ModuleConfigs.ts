import extend from 'extend2';
import type { ModuleConfig, ModuleConfigHolder } from '@eggjs/tegg-types';

export type ModuleConfigChangeListener = (
  moduleName: string,
  config: ModuleConfig
) => void | Promise<void>;

export class ModuleConfigs {
  private changeListeners: Set<ModuleConfigChangeListener> = new Set();

  constructor(readonly inner: Record<string, ModuleConfigHolder>) {}

  get(moduleName: string): ModuleConfig | undefined {
    return this.inner[moduleName]?.config;
  }

  /**
   * Update module config and notify listeners.
   * Deep merges the new config into the existing one so all references
   * (e.g. injected moduleConfig) see the updated values.
   */
  async set(moduleName: string, config: Partial<ModuleConfig>): Promise<void> {
    const holder = this.inner[moduleName];
    if (!holder) {
      throw new Error(`Module "${moduleName}" not found in ModuleConfigs`);
    }
    extend(true, holder.config, config);
    for (const listener of this.changeListeners) {
      await listener(moduleName, holder.config);
    }
  }

  /**
   * Register a listener that will be called when module config changes via set().
   * Returns a dispose function to unregister the listener.
   */
  onModuleConfigChange(listener: ModuleConfigChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  *[Symbol.iterator](): Iterator<[string, ModuleConfigHolder]> {
    yield* Object.entries(this.inner);
  }
}
