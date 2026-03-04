import type { Context } from './classes.js';

export const plugins: Record<string, () => void> = {};

export function abstractPluginCreator(ctx: Context) {
  // ? fast path: no plugins registered — return empty object without iteration
  const keys = Object.keys(plugins);
  if (keys.length === 0) return {};
  const abstractPlugin: Record<string, () => void> = {};
  for (let i = 0; i < keys.length; i++) {
    abstractPlugin[keys[i]] = plugins[keys[i]].bind(ctx);
  }
  return abstractPlugin;
}
