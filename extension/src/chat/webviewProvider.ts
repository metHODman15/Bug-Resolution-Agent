/**
 * Build Agent — WebviewView provider (white-label, repo-driven).
 *
 * UI rules:
 *  - "Build with Agent" empty state with disclaimer
 *  - Agent selector loaded from .github/AGENTS.md
 *  - 2 past conversation previews (not clickable, not resumable)
 *  - No user-facing settings or prompt leakage
 *  - Ephemeral current session (fresh on reload)
 */
import * as vscode from 'vscode';
import { detectProvider } from '../services/llmClient';
import { ConversationMemory } from '../agent/memory/conversationMemory';
import { runAgentLoop, StoredMessage } from '../agent/tools/toolEngine';
import { ConfigWatcher } from '../agent/configWatcher';
import { HistoryManager } from '../agent/historyManager';

function uid(): string {
    return 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

export class AgentWebviewProvider implements vscode.WebviewViewProvider {
    static readonly viewType = 'buildAgent.chatView';

    private view?: vscode.WebviewView;
    private busy  = false;
    private memory: ConversationMemory;
    private firstUserMsg = '';
    private firstAssistantMsg = '';

    constructor(
        private readonly extUri:  vscode.Uri,
        private readonly extCtx:  vscode.ExtensionContext,
        private readonly configWatcher: ConfigWatcher,
        private readonly historyManager: HistoryManager,
    ) {
        this.memory = new ConversationMemory(extCtx);

        // React to config changes
        configWatcher.onConfigChanged(() => {
            this.sendAgentList();
        });
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _ctx: vscode.WebviewViewResolveContext,
        _tok: vscode.CancellationToken,
    ): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
            try   { await this.handleMessage(msg); }
            catch (e) {
                this.busy = false;
                this.post({ type: 'error', text: e instanceof Error ? e.message : String(e) });
            }
        });
        webviewView.webview.html = this.buildHtml();
    }

    /** Trigger a new chat session from a command. */
    startNewChat(): void {
        this.archiveCurrentSession();
        this.memory.clear();
        this.firstUserMsg = '';
        this.firstAssistantMsg = '';
        this.post({ type: 'reset' });
        this.sendPreviews();
    }

    /* ── private ─────────────────────────────────────────────────────────────── */

    private async getKey(): Promise<string | undefined> {
        return await this.extCtx.secrets.get('llm-api-key')
            ?? await this.extCtx.secrets.get('anthropic-api-key');
    }

    private post(msg: object): void {
        this.view?.webview.postMessage(msg);
    }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        switch (msg.type) {
            case 'init':   return this.sendInit();
            case 'setKey': return this.setKey(String(msg.key ?? ''));
            case 'send':   return this.chat(
                String(msg.text ?? '').trim(),
                msg.images as string[] | undefined,
            );
            case 'newChat':
                this.startNewChat();
                return;
            case 'generateTemplates':
                await vscode.commands.executeCommand('buildAgent.generateTemplates');
                this.sendInit();
                return;
        }
    }

    private async sendInit(): Promise<void> {
        const key = await this.getKey();
        const previews = this.historyManager.getPreviews();
        const { agentsExists, instructionsExists } = this.configWatcher.filesExist();
        const agents = this.configWatcher.getConfig().agents.map(a => a.name);
        this.post({
            type: 'init',
            hasKey: !!key,
            previews,
            agents,
            filesExist: agentsExists && instructionsExists,
        });
    }

    private sendPreviews(): void {
        const previews = this.historyManager.getPreviews();
        this.post({ type: 'previews', previews });
    }

    private sendAgentList(): void {
        const agents = this.configWatcher.getConfig().agents.map(a => a.name);
        this.post({ type: 'agents', agents });
    }

    private async setKey(key: string): Promise<void> {
        if (!key || (!key.startsWith('sk-ant-') && !key.startsWith('xai-'))) {
            this.post({ type: 'keyError', text: 'Invalid key — must start with sk-ant- (Anthropic) or xai- (Grok)' });
            return;
        }
        await this.extCtx.secrets.store('llm-api-key', key);
        this.post({ type: 'keySet', provider: detectProvider(key) });
    }

    private async archiveCurrentSession(): Promise<void> {
        if (this.firstUserMsg && this.firstAssistantMsg) {
            await this.historyManager.archiveSession(this.firstUserMsg, this.firstAssistantMsg);
        }
    }

    private async chat(text: string, images?: string[]): Promise<void> {
        if ((!text && !images?.length) || this.busy) { return; }

        // Workspace trust gate
        if (!vscode.workspace.isTrusted) {
            this.post({ type: 'error', text: 'Workspace is not trusted. Agent actions are restricted.' });
            return;
        }

        const key = await this.getKey();
        if (!key) { this.post({ type: 'noKey' }); return; }

        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot) {
            this.post({ type: 'error', text: 'No workspace folder is open.' });
            return;
        }

        const config = this.configWatcher.getConfig();
        const systemPrompt = config.systemPrompt +
            '\n\n**Workspace root:** `' + wsRoot + '`';
        const history = this.memory.load() as StoredMessage[];
        const msgId = uid();

        // Track first user message for archive
        if (!this.firstUserMsg) {
            this.firstUserMsg = text;
        }

        this.post({ type: 'streamStart', id: msgId });
        this.busy = true;

        let assistantAccum = '';
        try {
            const { updatedHistory } = await runAgentLoop(
                key,
                systemPrompt,
                history,
                text,
                images ?? [],
                wsRoot,
                (chunk) => {
                    this.post({ type: 'streamChunk', id: msgId, text: chunk });
                    assistantAccum += chunk;
                },
                (name, input) => {
                    const label = name === 'write_file'
                        ? 'Writing: ' + String(input.path ?? '')
                        : name === 'read_file'
                        ? 'Reading: ' + String(input.path ?? '')
                        : 'Tool: ' + name;
                    this.post({ type: 'toolCall', text: label });
                },
                (_name, result) => {
                    this.post({ type: 'toolResult', text: result.slice(0, 120).replace(/\n/g, ' ') });
                },
            );
            await this.memory.save(updatedHistory);
            // Store first full assistant response for archive preview
            if (!this.firstAssistantMsg && assistantAccum) {
                this.firstAssistantMsg = assistantAccum;
            }
            this.post({ type: 'streamEnd', id: msgId });
        } catch (e) {
            this.post({ type: 'streamEnd', id: msgId });
            throw e;
        } finally {
            this.busy = false;
        }
    }

    // ── HTML ──────────────────────────────────────────────────────────────────

    private buildHtml(): string {
        const css = `*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--vscode-sideBar-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family);font-size:var(--vscode-font-size,13px);height:100vh;display:flex;flex-direction:column;overflow:hidden}
#top-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,rgba(128,128,128,.2));flex-shrink:0}
#top-bar .title{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
#top-bar .actions{display:flex;gap:6px}
#top-bar .actions button{background:none;border:none;color:var(--vscode-foreground);cursor:pointer;font-size:14px;padding:2px 4px;opacity:.6}
#top-bar .actions button:hover{opacity:1}
#previews{padding:6px 12px;flex-shrink:0}
.preview-item{padding:5px 8px;margin-bottom:4px;border-radius:4px;background:var(--vscode-list-hoverBackground,rgba(128,128,128,.06));cursor:default;pointer-events:none;user-select:none}
.preview-item .p-title{font-size:11px;font-weight:600;opacity:.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.preview-item .p-time{font-size:9px;opacity:.35}
.preview-item .p-snippet{font-size:10px;opacity:.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center}
#empty-state .icon{font-size:48px;margin-bottom:12px;opacity:.3}
#empty-state .headline{font-size:16px;font-weight:700;margin-bottom:6px}
#empty-state .disclaimer{font-size:11px;opacity:.45;margin-bottom:16px}
#empty-state .action-link{color:var(--vscode-textLink-foreground);font-size:12px;cursor:pointer;text-decoration:underline}
#key-banner{background:var(--vscode-editorInfo-background,rgba(0,122,204,.12));border-bottom:1px solid var(--vscode-editorInfo-border,rgba(0,122,204,.4));padding:14px;flex-shrink:0}
#key-banner .bhead{font-weight:600;font-size:12px;margin-bottom:5px}
#key-banner .bdesc{font-size:11px;opacity:.75;margin-bottom:10px;line-height:1.5}
.key-row{display:flex;gap:6px}
#key-input{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;padding:5px 9px;font-size:12px;outline:none}
#key-input:focus{border-color:var(--vscode-focusBorder)}
#key-save{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;padding:5px 14px;cursor:pointer;font-size:12px;white-space:nowrap}
#key-save:hover{background:var(--vscode-button-hoverBackground)}
#key-err{color:var(--vscode-errorForeground);font-size:11px;margin-top:5px;min-height:16px}
#msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:14px}
.msg{display:flex;flex-direction:column;gap:3px}
.lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;opacity:.55;padding:0 2px}
.body{padding:9px 12px;border-radius:6px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere}
.msg.user .body{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-radius:6px 6px 2px 6px;align-self:flex-end;max-width:90%}
.msg.agent .body{background:var(--vscode-editorWidget-background,var(--vscode-editor-background));border:1px solid var(--vscode-widget-border,var(--vscode-panel-border,rgba(128,128,128,.2)));border-radius:2px 6px 6px 6px}
.msg.sys{align-items:center}
.msg.sys .body{background:transparent;padding:3px 6px;font-size:11px;opacity:.65;font-style:italic}
.msg.tool-call .body{background:var(--vscode-textCodeBlock-background,var(--vscode-editor-background));border:1px dashed var(--vscode-panel-border,rgba(128,128,128,.3));border-radius:4px;font-size:11px;opacity:.8;font-family:var(--vscode-editor-font-family,monospace)}
.cursor::after{content:"\\25ae";animation:blink .8s step-end infinite}
@keyframes blink{50%{opacity:0}}
pre{background:var(--vscode-textCodeBlock-background,var(--vscode-editor-background));border:1px solid var(--vscode-panel-border,transparent);border-radius:4px;padding:8px 12px;margin:7px 0;overflow-x:auto;font-family:var(--vscode-editor-font-family,monospace);font-size:11.5px;line-height:1.5}
code{font-family:var(--vscode-editor-font-family,monospace);font-size:.9em}
:not(pre)>code{background:var(--vscode-textPreformat-background,rgba(128,128,128,.15));border-radius:3px;padding:1px 4px}
blockquote{border-left:3px solid var(--vscode-focusBorder,#007fd4);padding-left:10px;margin:4px 0;opacity:.8}
h2{font-size:13px;margin:10px 0 5px;font-weight:600}h3,h4{font-size:12px;margin:8px 0 4px;font-weight:600}
table{border-collapse:collapse;width:100%;margin:6px 0;font-size:12px}
th,td{border:1px solid var(--vscode-panel-border,rgba(128,128,128,.3));padding:5px 8px;text-align:left}
th{background:var(--vscode-list-hoverBackground)}
strong{font-weight:600}em{font-style:italic}li{margin-left:16px;margin-bottom:2px}
#img-strip{display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px 0;flex-shrink:0}
.img-thumb{position:relative;width:52px;height:52px;border-radius:4px;overflow:hidden;border:1px solid var(--vscode-panel-border,rgba(128,128,128,.3));flex-shrink:0}
.img-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.img-rm{position:absolute;top:0;right:0;background:rgba(0,0,0,.7);color:#fff;border:none;border-radius:0 4px 0 4px;width:16px;height:16px;font-size:11px;line-height:16px;cursor:pointer;padding:0}
.msg.user .img-row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px}
.msg.user .img-row img{height:52px;border-radius:3px;object-fit:cover}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--vscode-scrollbarSlider-background,rgba(100,100,100,.4));border-radius:2px}::-webkit-scrollbar-track{background:transparent}
.hidden{display:none!important}
#input-area{border-top:1px solid var(--vscode-panel-border,rgba(128,128,128,.2));padding:10px 12px;flex-shrink:0}
.input-row{display:flex;gap:6px;align-items:flex-end}
#agent-selector{background:var(--vscode-dropdown-background,var(--vscode-input-background));color:var(--vscode-dropdown-foreground,var(--vscode-input-foreground));border:1px solid var(--vscode-dropdown-border,var(--vscode-input-border,transparent));border-radius:3px;padding:4px 6px;font-size:11px;margin-bottom:6px;width:100%;outline:none}
#inp{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:4px;padding:7px 10px;font-family:inherit;font-size:inherit;resize:none;min-height:35px;max-height:110px;overflow-y:auto;outline:none;line-height:1.4}
#inp:focus{border-color:var(--vscode-focusBorder)}#inp::placeholder{opacity:.5}#inp:disabled{opacity:.5}
#sbtn{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:4px;width:35px;height:35px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
#sbtn:hover{background:var(--vscode-button-hoverBackground)}#sbtn:disabled{opacity:.4;cursor:default}`;

        const js = `(function(){
var vscode=acquireVsCodeApi();
var msgsEl=document.getElementById("msgs");
var keyBnr=document.getElementById("key-banner");
var keyInp=document.getElementById("key-input");
var keySave=document.getElementById("key-save");
var keyErr=document.getElementById("key-err");
var inpEl=document.getElementById("inp");
var sBtn=document.getElementById("sbtn");
var imgStrip=document.getElementById("img-strip");
var emptyState=document.getElementById("empty-state");
var previewsEl=document.getElementById("previews");
var agentSel=document.getElementById("agent-selector");
var actionLink=document.getElementById("action-link");
var newChatBtn=document.getElementById("new-chat-btn");
var busy=false,pendingImages=[],toolCallEl=null,chatStarted=false;

window.addEventListener("message",function(ev){
  var m=ev.data;
  if(m.type==="init"){
    if(m.hasKey){keyBnr.classList.add("hidden");}
    else{keyBnr.classList.remove("hidden");}
    renderPreviews(m.previews||[]);
    renderAgents(m.agents||[]);
    if(m.filesExist){
      actionLink.textContent="Managed by your organization";
      actionLink.style.cursor="default";
      actionLink.style.textDecoration="none";
    }else{
      actionLink.textContent="Generate Agent Instructions\\u2026";
      actionLink.style.cursor="pointer";
      actionLink.style.textDecoration="underline";
    }
    if(!chatStarted)showEmpty();
  }else if(m.type==="keySet"){
    keyBnr.classList.add("hidden");keyErr.textContent="";
    addSys("API key saved. Describe what to build next.");
  }else if(m.type==="keyError"){
    keyErr.textContent=m.text;
  }else if(m.type==="noKey"){
    keyBnr.classList.remove("hidden");
  }else if(m.type==="streamStart"){
    busy=true;chatStarted=true;hideEmpty();lock(true);addAgent("",m.id,true);
  }else if(m.type==="streamChunk"){
    appendChunk(m.id,m.text);
  }else if(m.type==="streamEnd"){
    finalise(m.id);busy=false;lock(false);
  }else if(m.type==="toolCall"){
    addToolCall(m.text);
  }else if(m.type==="toolResult"){
    dismissToolCall();
  }else if(m.type==="previews"){
    renderPreviews(m.previews||[]);
  }else if(m.type==="agents"){
    renderAgents(m.agents||[]);
  }else if(m.type==="error"){
    busy=false;lock(false);dismissToolCall();addErr(m.text);
  }else if(m.type==="reset"){
    msgsEl.innerHTML="";busy=false;lock(false);chatStarted=false;showEmpty();
  }
});

setTimeout(function(){vscode.postMessage({type:"init"});},80);

function send(){
  var t=inpEl.value.trim();
  if((!t&&pendingImages.length===0)||busy)return;
  var imgs=pendingImages.map(function(p){return p.dataUrl;});
  chatStarted=true;hideEmpty();
  addUser(t,imgs);
  vscode.postMessage({type:"send",text:t,images:imgs});
  inpEl.value="";pendingImages=[];clearImageStrip();resize();
}
sBtn.addEventListener("click",send);
inpEl.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
inpEl.addEventListener("input",resize);

inpEl.addEventListener("paste",function(e){
  var items=e.clipboardData&&e.clipboardData.items;if(!items)return;
  for(var i=0;i<items.length;i++){
    if(items[i].type.indexOf("image/")===0){
      e.preventDefault();var file=items[i].getAsFile();if(!file)continue;
      (function(f){
        var reader=new FileReader();
        reader.onload=function(ev2){
          var dataUrl=ev2.target.result;
          var imgId="img-"+Date.now()+"-"+Math.random().toString(36).slice(2,5);
          pendingImages.push({id:imgId,dataUrl:dataUrl});
          addImageThumb(imgId,dataUrl);
        };
        reader.readAsDataURL(f);
      })(file);
    }
  }
});

function addImageThumb(imgId,dataUrl){
  imgStrip.classList.remove("hidden");
  var wrap=document.createElement("div");wrap.className="img-thumb";wrap.id="thumb-"+imgId;
  var img=document.createElement("img");img.src=dataUrl;img.alt="";
  var rm=document.createElement("button");rm.className="img-rm";rm.textContent="\\u00d7";
  rm.addEventListener("click",function(){
    pendingImages=pendingImages.filter(function(p){return p.id!==imgId;});
    wrap.remove();if(pendingImages.length===0)imgStrip.classList.add("hidden");
  });
  wrap.appendChild(img);wrap.appendChild(rm);imgStrip.appendChild(wrap);
}
function clearImageStrip(){imgStrip.innerHTML="";imgStrip.classList.add("hidden");}

keySave.addEventListener("click",function(){keyErr.textContent="";vscode.postMessage({type:"setKey",key:keyInp.value.trim()});});
keyInp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();keySave.click();}});

newChatBtn.addEventListener("click",function(){vscode.postMessage({type:"newChat"});});
actionLink.addEventListener("click",function(){vscode.postMessage({type:"generateTemplates"});});

function renderPreviews(list){
  previewsEl.innerHTML="";
  if(!list||list.length===0){previewsEl.classList.add("hidden");return;}
  previewsEl.classList.remove("hidden");
  list.forEach(function(p){
    var el=document.createElement("div");el.className="preview-item";
    var t=document.createElement("div");t.className="p-title";t.textContent=p.title;
    var ts=document.createElement("div");ts.className="p-time";ts.textContent=new Date(p.timestamp).toLocaleString();
    var sn=document.createElement("div");sn.className="p-snippet";sn.textContent=p.snippet;
    el.appendChild(t);el.appendChild(ts);el.appendChild(sn);previewsEl.appendChild(el);
  });
}

function renderAgents(list){
  agentSel.innerHTML="";
  if(!list||list.length===0){
    var op=document.createElement("option");op.value="default";op.textContent="Agent";
    agentSel.appendChild(op);return;
  }
  list.forEach(function(name){
    var op=document.createElement("option");op.value=name;op.textContent=name;
    agentSel.appendChild(op);
  });
}

function showEmpty(){emptyState.classList.remove("hidden");msgsEl.classList.add("hidden");}
function hideEmpty(){emptyState.classList.add("hidden");msgsEl.classList.remove("hidden");}

function resize(){inpEl.style.height="auto";inpEl.style.height=Math.min(inpEl.scrollHeight,110)+"px";}
function lock(on){sBtn.disabled=on;inpEl.disabled=on;if(!on)inpEl.focus();}
function scroll(){msgsEl.scrollTop=msgsEl.scrollHeight;}
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function md(raw){
  var s=esc(raw);
  s=s.replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g,function(_,l,c){return '<pre><code>'+c+'</code></pre>';});
  s=s.replace(/\`([^\`\\n]+)\`/g,'<code>$1</code>');
  s=s.replace(/\\*\\*([^*\\n]+)\\*\\*/g,'<strong>$1</strong>');
  s=s.replace(/\\*([^*\\n]+)\\*/g,'<em>$1</em>');
  s=s.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  s=s.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  s=s.replace(/^#### (.+)$/gm,'<h4>$1</h4>');
  s=s.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  s=s.replace(/^[-*] (.+)$/gm,'<li>$1</li>');
  s=s.replace(/^\\d+\\. (.+)$/gm,'<li>$1</li>');
  s=s.replace(/^\\|(.+)\\|$/gm,function(_,inner){
    var cells=inner.split('|').map(function(c){return c.trim();});
    return '<tr>'+cells.map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>';
  });
  s=s.replace(/(<tr>.*<\\/tr>\\n?)+/g,function(t){return '<table>'+t+'</table>';});
  s=s.replace(/\\n/g,'<br>');
  return s;
}

function addUser(text,imgs){
  var el=document.createElement("div");el.className="msg user";
  var lbl=document.createElement("div");lbl.className="lbl";lbl.textContent="You";
  var body=document.createElement("div");body.className="body";
  if(imgs&&imgs.length){
    var row=document.createElement("div");row.className="img-row";
    imgs.forEach(function(src){var im=document.createElement("img");im.src=src;im.alt="";row.appendChild(im);});
    body.appendChild(row);
  }
  if(text){var sp=document.createElement("span");sp.innerHTML=esc(text).replace(/\\n/g,"<br>");body.appendChild(sp);}
  el.appendChild(lbl);el.appendChild(body);msgsEl.appendChild(el);scroll();
}
function addAgent(text,id,streaming){
  var el=document.createElement("div");el.className="msg agent";el.id=id;
  var lbl=document.createElement("div");lbl.className="lbl";lbl.textContent="Agent";
  var body=document.createElement("div");
  body.className="body"+(streaming?" cursor":"");
  body.setAttribute("data-raw",text);body.innerHTML=text?md(text):"";
  el.appendChild(lbl);el.appendChild(body);msgsEl.appendChild(el);scroll();
}
function addSys(text){
  var el=document.createElement("div");el.className="msg sys";
  var body=document.createElement("div");body.className="body";body.innerHTML=md(text);
  el.appendChild(body);msgsEl.appendChild(el);scroll();
}
function addErr(text){
  var el=document.createElement("div");el.className="msg sys";
  var body=document.createElement("div");body.className="body";
  body.style.color="var(--vscode-errorForeground)";
  body.innerHTML="&#9888; "+esc(text);
  el.appendChild(body);msgsEl.appendChild(el);scroll();
}
function addToolCall(label){
  if(toolCallEl){toolCallEl.remove();toolCallEl=null;}
  var el=document.createElement("div");el.className="msg tool-call";
  var body=document.createElement("div");body.className="body";
  body.innerHTML="&#9881; "+esc(label);
  el.appendChild(body);msgsEl.appendChild(el);toolCallEl=el;scroll();
}
function dismissToolCall(){if(toolCallEl){toolCallEl.remove();toolCallEl=null;}}
function appendChunk(id,text){
  var el=document.getElementById(id);if(!el)return;
  var body=el.querySelector(".body");
  var raw=(body.getAttribute("data-raw")||"")+text;
  body.setAttribute("data-raw",raw);
  body.innerHTML=esc(raw).replace(/\\n/g,"<br>");scroll();
}
function finalise(id){
  var el=document.getElementById(id);if(!el)return;
  dismissToolCall();
  var body=el.querySelector(".body");
  body.classList.remove("cursor");
  body.innerHTML=md(body.getAttribute("data-raw")||"");scroll();
}
})();`;

        return '<!DOCTYPE html>' +
            '<html lang="en">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data: blob:;">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<style>' + css + '</style>' +
            '</head><body>' +

            // Top bar
            '<div id="top-bar">' +
            '  <span class="title">CHAT</span>' +
            '  <div class="actions">' +
            '    <button id="new-chat-btn" title="New Chat">+</button>' +
            '  </div>' +
            '</div>' +

            // Past conversation previews (max 2, non-clickable)
            '<div id="previews" class="hidden"></div>' +

            // Key banner (hidden by default)
            '<div id="key-banner" class="hidden">' +
            '  <div class="bhead">&#128273; Configure API Key</div>' +
            '  <div class="bdesc"><strong>Anthropic</strong>: console.anthropic.com &nbsp;|&nbsp; <strong>Grok</strong>: console.x.ai</div>' +
            '  <div class="key-row">' +
            '    <input id="key-input" type="password" placeholder="sk-ant-... or xai-..." autocomplete="off" spellcheck="false">' +
            '    <button id="key-save">Save Key</button>' +
            '  </div>' +
            '  <div id="key-err"></div>' +
            '</div>' +

            // Empty state
            '<div id="empty-state">' +
            '  <div class="icon">&#129302;</div>' +
            '  <div class="headline">Build with Agent</div>' +
            '  <div class="disclaimer">AI-generated content may be incorrect.</div>' +
            '  <div id="action-link" class="action-link">Generate Agent Instructions\u2026</div>' +
            '</div>' +

            // Messages area
            '<div id="msgs" class="hidden"></div>' +
            '<div id="img-strip" class="hidden"></div>' +

            // Input area
            '<div id="input-area">' +
            '  <select id="agent-selector"><option value="default">Agent</option></select>' +
            '  <div class="input-row">' +
            '    <textarea id="inp" rows="1" placeholder="Describe what to build next" spellcheck="true"></textarea>' +
            '    <button id="sbtn" title="Send (Enter)"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 14.5l13-6.5-13-6.5v5l9 1.5-9 1.5z"/></svg></button>' +
            '  </div>' +
            '</div>' +
            '<script>' + js + '</script>' +
            '</body></html>';
    }
}
