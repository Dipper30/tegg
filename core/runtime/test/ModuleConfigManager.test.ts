import { strict as assert } from 'node:assert';
import mm from 'mm';
import { EggPrototypeFactory } from '@eggjs/tegg-metadata';
import { ModuleConfigs } from '@eggjs/tegg-common-util';
import { EggTestContext } from './fixtures/EggTestContext';
import TestUtil from './util';
import { EggContainerFactory } from '..';
import { ModuleConfigManager } from '../src/ModuleConfigManager';
import { ContextHandler } from '../src/model/ContextHandler';
import {
  ConfigWatcher,
  ConfigWatcherWithDecorator,
  NoConfigWatcher,
} from './fixtures/modules/module-config-change/object';

describe('test/ModuleConfigManager.test.ts', () => {
  let ctx: EggTestContext;

  beforeEach(() => {
    ctx = new EggTestContext();
    mm(ContextHandler, 'getContext', () => {
      return ctx;
    });
  });

  afterEach(async () => {
    await ctx.destroy({});
    mm.restore();
  });

  describe('writeModuleConfig', () => {
    it('should trigger onModuleConfigChange on objects implementing the hook', async () => {
      const instance = await TestUtil.createLoadUnitInstance(
        'module-config-change'
      );

      // Create objects
      const watcherProto =
        EggPrototypeFactory.instance.getPrototype('configWatcher');
      const watcherObj = await EggContainerFactory.getOrCreateEggObject(
        watcherProto,
        watcherProto.name
      );
      const watcher = watcherObj.obj as ConfigWatcher;

      assert.strictEqual(watcher.getConfigChangeCalled(), 0);

      // Build a ModuleConfigs instance with matching module name
      const moduleConfigs = new ModuleConfigs({
        moduleConfigChange: {
          name: 'moduleConfigChange',
          reference: { path: '/mock', name: 'moduleConfigChange' },
          config: { key: 'original' },
        },
      });

      // Write config — should trigger onModuleConfigChange
      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'moduleConfigChange',
        { key: 'updated' }
      );

      assert.strictEqual(watcher.getConfigChangeCalled(), 1);

      // Config should be deep merged
      assert.deepStrictEqual(moduleConfigs.get('moduleConfigChange'), {
        key: 'updated',
      });

      await TestUtil.destroyLoadUnitInstance(instance);
    });

    it('should trigger lifecycle via @LifecycleOnModuleConfigChange decorator', async () => {
      const instance = await TestUtil.createLoadUnitInstance(
        'module-config-change'
      );

      const watcherProto = EggPrototypeFactory.instance.getPrototype(
        'configWatcherWithDecorator'
      );
      const watcherObj = await EggContainerFactory.getOrCreateEggObject(
        watcherProto,
        watcherProto.name
      );
      const watcher = watcherObj.obj as ConfigWatcherWithDecorator;

      assert.strictEqual(watcher.getConfigChangeCalled(), 0);

      const moduleConfigs = new ModuleConfigs({
        moduleConfigChange: {
          name: 'moduleConfigChange',
          reference: { path: '/mock', name: 'moduleConfigChange' },
          config: {},
        },
      });

      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'moduleConfigChange',
        { foo: 'bar' }
      );

      assert.strictEqual(watcher.getConfigChangeCalled(), 1);

      await TestUtil.destroyLoadUnitInstance(instance);
    });

    it('should not trigger on objects without onModuleConfigChange', async () => {
      const instance = await TestUtil.createLoadUnitInstance(
        'module-config-change'
      );

      const noWatcherProto =
        EggPrototypeFactory.instance.getPrototype('noConfigWatcher');
      const noWatcherObj = await EggContainerFactory.getOrCreateEggObject(
        noWatcherProto,
        noWatcherProto.name
      );
      const noWatcher = noWatcherObj.obj as NoConfigWatcher;

      const moduleConfigs = new ModuleConfigs({
        moduleConfigChange: {
          name: 'moduleConfigChange',
          reference: { path: '/mock', name: 'moduleConfigChange' },
          config: {},
        },
      });

      // Should not throw
      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'moduleConfigChange',
        { some: 'config' }
      );

      // Object still works normally
      assert.strictEqual(noWatcher.hello(), 'hello');

      await TestUtil.destroyLoadUnitInstance(instance);
    });

    it('should trigger multiple times on multiple writes', async () => {
      const instance = await TestUtil.createLoadUnitInstance(
        'module-config-change'
      );

      const watcherProto =
        EggPrototypeFactory.instance.getPrototype('configWatcher');
      const watcherObj = await EggContainerFactory.getOrCreateEggObject(
        watcherProto,
        watcherProto.name
      );
      const watcher = watcherObj.obj as ConfigWatcher;

      const moduleConfigs = new ModuleConfigs({
        moduleConfigChange: {
          name: 'moduleConfigChange',
          reference: { path: '/mock', name: 'moduleConfigChange' },
          config: { count: 0 },
        },
      });

      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'moduleConfigChange',
        { count: 1 }
      );
      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'moduleConfigChange',
        { count: 2 }
      );
      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'moduleConfigChange',
        { count: 3 }
      );

      assert.strictEqual(watcher.getConfigChangeCalled(), 3);
      assert.deepStrictEqual(moduleConfigs.get('moduleConfigChange'), {
        count: 3,
      });

      await TestUtil.destroyLoadUnitInstance(instance);
    });

    it('should not trigger objects in a different module', async () => {
      const instance = await TestUtil.createLoadUnitInstance(
        'module-config-change'
      );

      const watcherProto =
        EggPrototypeFactory.instance.getPrototype('configWatcher');
      const watcherObj = await EggContainerFactory.getOrCreateEggObject(
        watcherProto,
        watcherProto.name
      );
      const watcher = watcherObj.obj as ConfigWatcher;

      const moduleConfigs = new ModuleConfigs({
        otherModule: {
          name: 'otherModule',
          reference: { path: '/mock', name: 'otherModule' },
          config: {},
        },
      });

      // Write config for a different module — should not trigger our watcher
      await ModuleConfigManager.writeModuleConfig(
        moduleConfigs,
        'otherModule',
        { key: 'value' }
      );

      assert.strictEqual(watcher.getConfigChangeCalled(), 0);

      await TestUtil.destroyLoadUnitInstance(instance);
    });
  });

  describe('notifyModuleConfigChange', () => {
    it('should only notify READY objects', async () => {
      const instance = await TestUtil.createLoadUnitInstance(
        'module-config-change'
      );

      const watcherProto =
        EggPrototypeFactory.instance.getPrototype('configWatcher');
      const watcherObj = await EggContainerFactory.getOrCreateEggObject(
        watcherProto,
        watcherProto.name
      );
      const watcher = watcherObj.obj as ConfigWatcher;

      // Destroy the instance first — objects will no longer be READY
      await TestUtil.destroyLoadUnitInstance(instance);

      // Notify should not call the hook on destroyed objects
      await ModuleConfigManager.notifyModuleConfigChange('moduleConfigChange');

      assert.strictEqual(watcher.getConfigChangeCalled(), 0);
    });
  });
});
