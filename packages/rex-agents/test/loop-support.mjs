import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixture } from './support.mjs';
import { Journal } from '../src/journal.mjs';
import { serve } from '../src/transport.mjs';
import { installChild } from '../src/bridge.mjs';
export const host = process.env.PI_HOST_PACKAGE ?? '/Users/jakubhasek/.bun/install/global/node_modules/@earendil-works/pi-coding-agent';
export const available = fs.existsSync(path.join(host, 'dist/index.js'));
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(predicate, description = 'condition') { for (let i = 0; i < 250; i++) { if (await predicate()) return; await sleep(10); } throw Error(`Timed out: ${description}`); }
export const tool = (name, args, id = name) => ({ type: 'toolCall', id, name, arguments: args });
export async function loop({ responses = [], extra, initial = true, knownFreeModels = [], sendOverride, existingFixture, sessionFile, descriptorAdapter = false, childBridge = true } = {}) {
  const f = existingFixture ?? fixture(), root = f.dir;
  fs.writeFileSync(path.join(root, 'file'), 'real read evidence');
  const sdk = await import(pathToFileURL(path.join(host, 'dist/index.js')));
  const { loadExtensionFromFactory, loadExtensions } = await import(pathToFileURL(path.join(host, 'dist/core/extensions/loader.js')));
  const { createEventBus } = await import(pathToFileURL(path.join(host, 'dist/core/event-bus.js')));
  const ai = await import(pathToFileURL(path.join(host, '../pi-ai/dist/index.js')));
  const settings = sdk.SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: 'off' });
  const modelRuntime = await sdk.ModelRuntime.create({ authPath: path.join(root, 'auth.json'), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  let calls = 0;
  const streamSimple = (model, context, options) => {
    const stream = ai.createAssistantMessageEventStream();
    (async () => {
      const usage = { input: 4, output: 2, cacheRead: 3, cacheWrite: 1, totalTokens: 10, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
      let message = { role: 'assistant', api: model.api, provider: model.provider, model: model.id, content: [], usage, stopReason: 'pending', timestamp: Date.now() };
      try {
        await options.onPayload?.({ local: true }, model);
        if (options.signal?.aborted) throw Error('aborted before dispatch');
        const index = calls++;
        const response = responses[index];
        if (response === undefined) throw Error(`Unexpected offline provider call ${index}`);
        const content = typeof response === 'function' ? await response({ signal: options.signal, context, index }) : response;
        if (options.signal?.aborted) throw Error('aborted after dispatch');
        stream.push({ type: 'start', partial: structuredClone(message) });
        for (const block of content) {
          const contentIndex = message.content.length; message.content.push(block);
          if (block.type === 'toolCall') {
            stream.push({ type: 'toolcall_start', contentIndex, partial: structuredClone(message) });
            stream.push({ type: 'toolcall_delta', contentIndex, delta: JSON.stringify(block.arguments), partial: structuredClone(message) });
            stream.push({ type: 'toolcall_end', contentIndex, toolCall: block, partial: structuredClone(message) });
          } else {
            stream.push({ type: 'text_start', contentIndex, partial: structuredClone(message) });
            stream.push({ type: 'text_delta', contentIndex, delta: block.text, partial: structuredClone(message) });
            stream.push({ type: 'text_end', contentIndex, content: block.text, partial: structuredClone(message) });
          }
        }
        message.stopReason = content.some(c => c.type === 'toolCall') ? 'toolUse' : 'stop';
        stream.push({ type: 'done', reason: message.stopReason, message }); stream.end();
      } catch (error) {
        message = { ...message, stopReason: options.signal?.aborted ? 'aborted' : 'error', errorMessage: error.message };
        stream.push({ type: 'error', reason: message.stopReason, error: message }); stream.end();
      }
    })();
    return stream;
  };
  modelRuntime.registerProvider('proposal', { api: 'openai-completions', baseUrl: 'http://127.0.0.1:1/never-used', apiKey: 'offline-only', models: [{ id: 'model', name: 'Offline deterministic', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100000, maxTokens: 1000 }], streamSimple });
  const runtime = sdk.createExtensionRuntime(), journal = new Journal(path.join(root, 'child'));
  let bridge, piAPI; const failures = [], hostErrors = [];
  let extension, socketService;
  if (descriptorAdapter) {
    socketService = await serve(f.d, root);
    const descriptor = path.join(root, 'descriptor.json');
    fs.writeFileSync(descriptor, JSON.stringify({ version: 3, socket: path.join(root, 'control.sock'), stateDir: path.join(root, 'child'), group: 'g', agent: 'a', token: f.child, profile: f.d.store.state.agents.a.profile, root, knownFreeModels }), { mode: 0o600 });
    const previous = process.env.REX_AGENT_DESCRIPTOR; process.env.REX_AGENT_DESCRIPTOR = descriptor;
    try {
      const loaded = await loadExtensions([path.resolve('extensions/child.ts')], root, createEventBus(), runtime);
      if (loaded.errors.length) throw Error(JSON.stringify(loaded.errors)); extension = loaded.extensions[0];
    } finally { if (previous === undefined) delete process.env.REX_AGENT_DESCRIPTOR; else process.env.REX_AGENT_DESCRIPTOR = previous; }
  } else {
    extension = await loadExtensionFromFactory(pi => {
    piAPI = pi;
    if (childBridge) bridge = installChild(pi, { profile: f.d.store.state.agents.a.profile, root, journal, group: 'g', agent: 'a', intervalMs: 100000, knownFreeModels, send: async r => sendOverride ? sendOverride(r, f) : f.d.dispatch({ ...r, token: f.child }), fatal: reason => { failures.push(reason); throw Error(reason); } });
    extra?.(pi, { journal, root });
  }, root, createEventBus(), runtime);
  }
  const resourceLoader = { getExtensions: () => ({ extensions: [extension], errors: [], runtime }), getSkills: () => ({ skills: [], diagnostics: [] }), getPrompts: () => ({ prompts: [], diagnostics: [] }), getThemes: () => ({ themes: [], diagnostics: [] }), getAgentsFiles: () => ({ agentsFiles: [] }), getSystemPrompt: () => 'Explicit offline test', getSystemPromptSource: () => undefined, getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [], extendResources() {}, async reload() {} };
  const manager = sessionFile ? sdk.SessionManager.open(sessionFile) : sdk.SessionManager.create(root, path.join(root, 'sessions'));
  const { session } = await sdk.createAgentSession({ cwd: root, agentDir: path.join(root, 'pi'), modelRuntime, model: modelRuntime.getModel('proposal', 'model'), thinkingLevel: 'off', settingsManager: settings, sessionManager: manager, resourceLoader, tools: ['read', 'ls', 'rex_progress', 'rex_question', 'rex_result'] });
  if (initial) f.request('task', { text: 'Initial task' });
  // Use the installed production TUI's queue-clearing abort implementation,
  // not SDK's default abort path. Only rendering/editor plumbing is headless.
  const { InteractiveMode } = await import(pathToFileURL(path.join(host, 'dist/modes/interactive/interactive-mode.js')));
  let editorText = '', tuiAbortCalls = 0;
  const restored = [];
  const tui = { session, compactionQueuedMessages: [], clearAllQueues: InteractiveMode.prototype.clearAllQueues,
    editor: { getExpandedText: () => editorText, getText: () => editorText, setText: text => { editorText = text; restored.push(text); } }, updatePendingMessagesDisplay() {} };
  await session.bindExtensions({ mode: 'tui', abortHandler: () => { tuiAbortCalls++; InteractiveMode.prototype.restoreQueuedMessagesToEditor.call(tui, { abort: true }); }, onError: e => hostErrors.push(e) });
  const dispose = async () => { await session.abort(); await session.extensionRunner?.emit({ type: 'session_shutdown', reason: 'quit' }); session.dispose(); if (socketService) await socketService.close(); };
  return { ...f, journal, bridge, session, manager, modelRuntime, dispose, pi: piAPI, sdk, failures, hostErrors, restored, get tuiAbortCalls() { return tuiAbortCalls; }, get calls() { return calls; }, async close() { await dispose(); fs.rmSync(root, { recursive: true }); } };
}
