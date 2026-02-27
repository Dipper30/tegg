import { AccessLevel, EggObjectLifecycle } from '@eggjs/tegg-types';
import { SingletonProto } from '@eggjs/core-decorator';
import { LifecycleOnModuleConfigChange } from '@eggjs/tegg-lifecycle';

/**
 * Fixture: implements onModuleConfigChange directly via interface
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ConfigWatcher implements EggObjectLifecycle {
  private configChangeCalled = 0;

  getConfigChangeCalled() {
    return this.configChangeCalled;
  }

  async onModuleConfigChange(): Promise<void> {
    this.configChangeCalled++;
  }
}

/**
 * Fixture: uses @LifecycleOnModuleConfigChange decorator with custom method name
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ConfigWatcherWithDecorator {
  private configChangeCalled = 0;

  getConfigChangeCalled() {
    return this.configChangeCalled;
  }

  @LifecycleOnModuleConfigChange()
  async handleConfigReload(): Promise<void> {
    this.configChangeCalled++;
  }
}

/**
 * Fixture: does NOT implement onModuleConfigChange - should not be affected
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class NoConfigWatcher {
  hello() {
    return 'hello';
  }
}
