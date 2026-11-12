import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { connect } = await import(pathToFileURL(path.join(root, 'src/client.mjs')));
let host = process.env.PI_HOST_PACKAGE;
if (!host) {
  host = path.dirname(fs.realpathSync(execFileSync('which', ['pi'], { encoding: 'utf8' }).trim()));
  while (!fs.existsSync(path.join(host, 'package.json'))) {
    const parent = path.dirname(host);
    if (parent === host) throw Error('Set PI_HOST_PACKAGE to the installed Pi SDK package directory');
    host = parent;
  }
}
assert.ok(fs.existsSync(path.join(host, 'dist/cli.js')), 'PI_HOST_PACKAGE must contain dist/cli.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rex-normal-smoke-'));
const run = (bin, args, cwd) => execFileSync(bin, args, { cwd, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'], env: bin === 'rex' ? { PATH: process.env.PATH, HOME: process.env.HOME } : process.env });
const rex = args => { const at = args.indexOf('--'); return JSON.parse(run('rex', at < 0 ? [...args, '--json'] : [...args.slice(0, at), '--json', ...args.slice(at)])); };
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let session, daemon;
try {
  const repo = path.join(dir, 'repo'), pi = path.join(dir, 'pi'), stateDir = path.join(dir, 'state'), worktreeRoot = path.join(dir, 'worktrees');
  for (const p of [repo, pi, stateDir, worktreeRoot]) fs.mkdirSync(p, { mode: 0o700 });
  run('git', ['init', '-q'], repo); fs.writeFileSync(path.join(repo, 'README.md'), 'Disposable offline Rex exercise.\n');
  run('git', ['add', 'README.md'], repo); run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], repo);
  const base = run('git', ['rev-parse', 'HEAD'], repo).trim();
  const provider = path.join(dir, 'provider.ts');
  fs.writeFileSync(provider, `import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
export default function(pi) {
  let count = 0;
  pi.registerProvider('rex-fixture', { api: 'openai-completions', baseUrl: 'http://127.0.0.1:1/never-used', apiKey: 'synthetic-offline', models: [{ id: 'model', name: 'Offline Rex fixture', reasoning: false, input: ['text'], cost: {input:1,output:2,cacheRead:0,cacheWrite:0}, contextWindow:100000,maxTokens:1000 }], streamSimple(model) {
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      const n = ++count;
      const tool = n === 1 ? {name:'rex_question',arguments:{question:'fixture-question',kind:'question',scope:'fixture',text:'Proceed?'}} : {name:'rex_result',arguments:{status:'success',text:n===2?'Reply accepted':'Follow-up complete'}};
      const m={role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[],usage:{input:10,output:5,cacheRead:0,cacheWrite:0,totalTokens:15,cost:{input:0.00001,output:0.00001,cacheRead:0,cacheWrite:0,total:0.00002}},stopReason:'toolUse',timestamp:Date.now()};
      stream.push({type:'start',partial:structuredClone(m)});
      const block={type:'toolCall',id:'fixture-'+n,...tool};m.content.push(block);
      stream.push({type:'toolcall_start',contentIndex:0,partial:structuredClone(m)});
      stream.push({type:'toolcall_delta',contentIndex:0,delta:JSON.stringify(block.arguments),partial:structuredClone(m)});
      stream.push({type:'toolcall_end',contentIndex:0,toolCall:block,partial:structuredClone(m)});
      stream.push({type:'done',reason:'toolUse',message:m});stream.end();
    });return stream;
  }});
}
`, { mode: 0o600 });
  fs.writeFileSync(path.join(pi, 'settings.json'), JSON.stringify({ extensions: [provider], cacheWarming: 'off', enableAnalytics: false, enableInstallTelemetry: false, quietStartup: true, retry: {enabled:false}, compaction:{enabled:false} }), { mode: 0o600 });
  const executable = path.join(dir, 'pi-fixture');
  fs.writeFileSync(executable, `#!/bin/sh\nexec /usr/bin/env -i PATH=${quote(process.env.PATH)} HOME=${quote(dir)} TERM=xterm-256color PI_CODING_AGENT_DIR=${quote(pi)} PI_OFFLINE=1 REX_AGENT_DESCRIPTOR="$REX_AGENT_DESCRIPTOR" ${quote(process.execPath)} ${quote(path.join(host, 'dist/cli.js'))} "$@"\n`, { mode: 0o700 });
  const created = rex(['new', 'rex-normal-offline-exercise', '-c', repo, '--shell=none', '--', '/bin/sleep', '300']);
  session = created.session_id;
  const parentBlock = created.initial_windows[0].block_ids[0];
  const beforeFocus = rex(['session', 'inspect', session]).active_window_id;
  const configFile = path.join(dir, 'operator.json');
  fs.writeFileSync(configFile, JSON.stringify({version:3,stateDir,worktreeRoot,repo,group:'exercise',rexSession:session,parentBlock,piExecutable:executable,panesPerTab:2,profiles:{fixture:{model:'rex-fixture/model',instructions:'Use structured Rex reports. Offline fixture only.'}}}), { mode:0o600 });
  let client = await connect(configFile);
  daemon = Number(fs.readFileSync(path.join(stateDir,'coordinator.lock'),'utf8'));
  const inspect = async () => (await client.request('inspect',{offset:0})).items[0];
  const until = async (predicate,label) => { for(let i=0;i<150;i++){const a=await inspect();if(await predicate(a))return a;await sleep(100);}throw Error('Timed out: '+label); };
  await client.request('launch',{requestId:'launch-fixture',agent:'child',task:'first',text:'Exercise a question and explicit result',profileName:'fixture',workspace:'shared',base,parentBlock});
  const asked=await until(a=>a?.blocked,'question');
  assert.equal(asked.panePresent,true);
  await client.request('answer',{requestId:'reply-fixture',agent:'child',question:'fixture-question',text:'Proceed'});
  await until(a=>a?.result?.status==='success'&&a.lifecycle==='idle'&&!a.pendingCommandCount,'reply result');
  client=await connect(configFile);assert.equal(Number(fs.readFileSync(path.join(stateDir,'coordinator.lock'),'utf8')),daemon);
  await client.request('followup',{requestId:'follow-fixture',agent:'child',task:'second',text:'Report follow-up complete'});
  const finished=await until(a=>a?.result?.report==='Follow-up complete'&&a.lifecycle==='idle'&&!a.pendingCommandCount&&a.usage?.messages===3,'followup');
  assert.equal(finished.launch.block,asked.launch.block);
  assert.equal(rex(['session','inspect',session]).active_window_id,beforeFocus);
  const overview=await client.request('overview');
  assert.equal(overview.children.messages,3); assert.equal(overview.children.unknownPrices,0);
  assert.equal(finished.usage.tokens.input,30); assert.equal(finished.usage.tokens.output,15);
  assert.ok(Math.abs(overview.children.knownEstimate-0.00006)<1e-10);
  await client.request('stop',{requestId:'stop-fixture',agent:'child'});
  await until(a=>a?.stopConfirmed&&!a.pendingCommandCount,'stop');
  const persisted=fs.readFileSync(path.join(stateDir,'state.json'),'utf8');
  for(let i=0;i<5;i++)await inspect();
  assert.equal(fs.readFileSync(path.join(stateDir,'state.json'),'utf8'),persisted);
  run('rex',['block','close','-s',session,finished.launch.block]);
  await assert.rejects(client.request('followup',{requestId:'closed-fixture',agent:'child',task:'third',text:'Must not queue'}),/PANE_MISSING/);
  console.log(JSON.stringify({result:'PASS',questionReply:true,reconnect:true,reusedPane:true,focusPreserved:true,stopAcknowledged:true,readOnlyInspection:true,closedPaneRejected:true,overview,childUsage:finished.usage??finished.metrics??null,paidProviderRequests:0}));
} finally {
  if(session){try{run('rex',['kill',session]);}catch{}}
  if(daemon){try{process.kill(daemon,'SIGTERM');}catch{}for(let i=0;i<50&&fs.existsSync(path.join(dir,'state/coordinator.lock'));i++)await sleep(50);}
  fs.rmSync(dir,{recursive:true,force:true});
}
