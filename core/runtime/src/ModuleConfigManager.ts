import { LoadUnitFactory } from '@eggjs/tegg-metadata';
import { ModuleConfigs } from '@eggjs/tegg-common-util';
import type { EggObjectLifecycle, ModuleConfig } from '@eggjs/tegg-types';
import { EggObjectFactory } from './factory/EggObjectFactory';
import { EggObjectLifecycleUtil } from './model/EggObject';

/**
 * Manages module config writes and notifies affected EggObjects
 * via the onModuleConfigChange lifecycle hook.
 *
 * Usage:
 * ```ts
 * // Update config and notify all objects in the module
 * await ModuleConfigManager.writeModuleConfig(moduleConfigs, 'myModule', { key: 'newValue' });
 * ```
 */
export class ModuleConfigManager {
  /**
   * Write new config values for a module and trigger onModuleConfigChange
   * lifecycle hook on all READY EggObjects that belong to that module.
   *
   * The config is deep-merged into the existing config, so all injected
   * moduleConfig references will see the updated values.
   */
  static async writeModuleConfig(
    moduleConfigs: ModuleConfigs,
    moduleName: string,
    config: Partial<ModuleConfig>
  ): Promise<void> {
    // 1. Update config (deep merge) and call any registered listeners
    await moduleConfigs.set(moduleName, config);

    // 2. Notify affected EggObjects
    await ModuleConfigManager.notifyModuleConfigChange(moduleName);
  }

  /**
   * Notify all READY EggObjects in the given module that config has changed.
   * Calls the onModuleConfigChange lifecycle hook on each object that implements it.
   */
  static async notifyModuleConfigChange(moduleName: string): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const {
      obj: eggObject,
      ctx,
    } of EggObjectFactory.eggObjectMap.values()) {
      // Only notify objects that are READY
      if (!eggObject.isReady) {
        continue;
      }

      // Check if the object belongs to the target module
      const loadUnit = LoadUnitFactory.getLoadUnitById(
        eggObject.proto.loadUnitId
      );
      if (!loadUnit || loadUnit.name !== moduleName) {
        continue;
      }

      const objLifecycle = eggObject.obj as EggObjectLifecycle;
      const method =
        EggObjectLifecycleUtil.getLifecycleHook(
          'onModuleConfigChange',
          eggObject.proto
        ) ?? 'onModuleConfigChange';

      if (typeof objLifecycle[method] === 'function') {
        promises.push(objLifecycle[method]!(ctx, eggObject));
      }
    }

    await Promise.all(promises);
  }
}
