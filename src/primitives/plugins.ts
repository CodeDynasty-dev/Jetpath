import type { Context } from './classes';

export const plugins: Record<string, () => void> = {};

// Cache for plugin bindings to avoid creating new objects per request
const pluginBindingCache = new WeakMap<Context, Record<string, () => void>>();

export function abstractPluginCreator(ctx: Context) {
  // Return cached bindings if available
  const cached = pluginBindingCache.get(ctx);
  if (cached) {
    return cached;
  }

  const abstractPlugin: Record<string, () => void> = {};
  for (const key in plugins) {
    abstractPlugin[key] = plugins[key].bind(ctx);
  }

  // Cache the bindings
  pluginBindingCache.set(ctx, abstractPlugin);
  return abstractPlugin;
}
