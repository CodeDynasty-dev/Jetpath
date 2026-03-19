import type { Context } from './classes.js';

class PluginBoxClass {
  plugins: Record<string, () => void> = {};
  abstractPluginCreator(ctx: Context) {
    // ? fast path: no plugins registered — return empty object without iteration
    const keys = Object.keys(this.plugins);
    if (keys.length === 0) return {};
    const abstractPlugin: Record<string, () => void> = {};
    for (let i = 0; i < keys.length; i++) {
      abstractPlugin[keys[i]] = this.plugins[keys[i]].bind(ctx);
    }
    return abstractPlugin;
  }
}

export const PluginBox = new PluginBoxClass();