// ==========================================
// REFERENCIAS AL DOM
// ==========================================
const modelSelect = document.getElementById('modelSelect');
const modeSelect = document.getElementById('modeSelect');

// Base de la API de Ollama (127.0.0.1 evita rarezas de resolución IPv6 de 'localhost')

const OLLAMA_BASE = 'http://127.0.0.1:11434';

// ==========================================
// PROVEEDORES / AGENTES DE IA (local y nube)
// Catálogo, configuración persistente y transporte de chat
// ==========================================
const PROVIDER_STORE_KEY = 'facilProviders';

const PROVIDER_CATALOG = [
    { id: 'ollama',     name: 'Ollama',        icon: '🦙', type: 'ollama',    baseUrl: 'http://127.0.0.1:11434',  needsKey: false, hint: 'Modelos locales. Debe estar en marcha ("ollama serve") y con OLLAMA_ORIGINS=*.' },
    { id: 'lmstudio',   name: 'LM Studio',     icon: '🎛️', type: 'openai',    baseUrl: 'http://127.0.0.1:1234/v1', needsKey: false, hint: 'En LM Studio: pestaña Local Server → Start Server.' },
    { id: 'openai',     name: 'OpenAI',        icon: '🤖', type: 'openai',    baseUrl: 'https://api.openai.com/v1', needsKey: true,  docs: 'https://platform.openai.com/api-keys' },
    { id: 'anthropic',  name: 'Anthropic',     icon: '🧠', type: 'anthropic', baseUrl: 'https://api.anthropic.com', needsKey: true,  docs: 'https://console.anthropic.com/settings/keys' },
    { id: 'gemini',     name: 'Google Gemini', icon: '🔵', type: 'gemini',    baseUrl: 'https://generativelanguage.googleapis.com', needsKey: true, docs: 'https://aistudio.google.com/apikey' },
    { id: 'openrouter', name: 'OpenRouter',    icon: '🔀', type: 'openai',    baseUrl: 'https://openrouter.ai/api/v1', needsKey: true, docs: 'https://openrouter.ai/settings/keys' },
    { id: '9router',    name: '9Router',       icon: '9️⃣', type: 'openai',    baseUrl: 'http://localhost:20128/v1', needsKey: true,  hint: 'Gateway local (npm i -g 9router). Copia la API Key desde su dashboard.' },
    { id: 'freellmapi', name: 'FreeLLMAPI',    icon: '🆓', type: 'openai',    baseUrl: 'https://api.freellmapi.ai/v1', needsKey: true, docs: 'https://freellmapi.ai' },
    { id: 'omniroute',  name: 'OmniRoute',     icon: '🛣️', type: 'openai',    baseUrl: 'http://localhost:20128/v1', needsKey: true,  hint: 'Gateway local (npm i -g omniroute). Clave desde su dashboard.' },
    { id: 'custom',     name: 'Otro',          icon: '🧩', type: 'openai',    baseUrl: '', needsKey: true, hint: 'Cualquier endpoint compatible con OpenAI: DeepSeek, Groq, Mistral, Together, Azure, vLLM, llama.cpp, proxies...' }
];

function loadProviderConfig() {
    try {
        const raw = localStorage.getItem(PROVIDER_STORE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (!parsed.providers || typeof parsed.providers !== 'object') parsed.providers = {};
                if (!PROVIDER_CATALOG.some(p => p.id === parsed.activeId)) parsed.activeId = 'ollama';
                return parsed;
            }
        }
    } catch (err) {
        console.warn('No se pudo leer la configuración de proveedores:', err);
    }
    return { activeId: 'ollama', providers: {} };
}

let providerConfig = loadProviderConfig();

function saveProviderConfig() {
    try { localStorage.setItem(PROVIDER_STORE_KEY, JSON.stringify(providerConfig)); } catch (err) { console.warn(err); }
}

function getProviderCfg(id) {
    return providerConfig.providers[id] || {};
}

function resolveProvider(id) {
    const def = PROVIDER_CATALOG.find(p => p.id === id) || PROVIDER_CATALOG[0];
    const saved = getProviderCfg(def.id);
    return Object.assign({}, def, {
        baseUrl: (saved.baseUrl !== undefined && saved.baseUrl !== null && String(saved.baseUrl).trim() !== '') ? String(saved.baseUrl).trim() : def.baseUrl,
        apiKey: saved.apiKey || '',
        models: Array.isArray(saved.models) ? saved.models : []
    });
}

function getActiveProvider() {
    return resolveProvider(providerConfig.activeId);
}

function setActiveProvider(id) {
    if (!PROVIDER_CATALOG.some(p => p.id === id)) return;
    providerConfig.activeId = id;
    saveProviderConfig();
}

function cleanBase(url) {
    return (url || '').trim().replace(/\/+$/, '');
}

// Normaliza la base según el tipo de API usada
function openAiBase(p) {
    let b = cleanBase(p.baseUrl);
    if (b && !/\/v\d+$/i.test(b)) b += '/v1';
    return b;
}

function anthropicBase(p) {
    return cleanBase(p.baseUrl).replace(/\/v1$/i, '');
}

function geminiBase(p) {
    return cleanBase(p.baseUrl).replace(/\/v1beta$/i, '');
}

function stripDataUrl(b64) {
    const s = String(b64 || '');
    const m = s.match(/^data:[^;]+;base64,(.*)$/s);
    return m ? m[1] : s;
}

function sniffImageMime(b64) {
    const s = stripDataUrl(b64);
    if (s.startsWith('/9j/')) return 'image/jpeg';
    if (s.startsWith('R0lGOD')) return 'image/gif';
    if (s.startsWith('UklGR')) return 'image/webp';
    if (s.startsWith('iVBORw0KGgo')) return 'image/png';
    return 'image/png';
}

function authHeaders(p) {
    const headers = {};
    if (p.type === 'anthropic') {
        if (p.apiKey) headers['x-api-key'] = p.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (p.apiKey) {
        headers['Authorization'] = 'Bearer ' + p.apiKey;
    }
    return headers;
}

async function httpErrorFrom(response) {
    let bodyText = '';
    try { bodyText = await response.text(); } catch (_) {}
    let msg = '';
    try {
        const j = JSON.parse(bodyText);
        const err = j.error || j;
        msg = (err && (err.message || err.msg || err.type)) || (typeof err === 'string' ? err : '') || bodyText;
    } catch (_) {
        msg = bodyText.slice(0, 300);
    }
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
    return new Error('HTTP ' + response.status + (msg ? (': ' + msg) : ''));
}

// Lee una respuesta SSE (Server-Sent Events) y entrega cada payload JSON
async function readSse(response, onData) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const handleLine = (line) => {
        const trimmed = line.replace(/\r$/, '').trim();
        if (!trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        let json;
        try { json = JSON.parse(payload); } catch (_) { return; }
        onData(json);
    };
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(handleLine);
    }
    if (buffer) buffer.split('\n').forEach(handleLine);
}

function splitSystemMessages(messages) {
    const systemParts = [];
    const rest = [];
    (messages || []).forEach(m => {
        if (m.role === 'system') systemParts.push(m.content || '');
        else rest.push(m);
    });
    return { system: systemParts.join('\n\n').trim(), rest: rest };
}

function toOpenAiMessages(messages) {
    return (messages || []).map(m => {
        const imgs = Array.isArray(m.images) ? m.images : [];
        if (imgs.length > 0) {
            const parts = [{ type: 'text', text: m.content || '' }];
            imgs.forEach(b64 => parts.push({
                type: 'image_url',
                image_url: { url: 'data:' + sniffImageMime(b64) + ';base64,' + stripDataUrl(b64) }
            }));
            return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content || '' };
    });
}

// Anthropic y Gemini exigen turnos alternados: fusiona roles consecutivos
function mergeConsecutiveRoles(list) {
    const out = [];
    list.forEach(item => {
        const last = out[out.length - 1];
        if (last && last.role === item.role) {
            if (typeof last.content === 'string' && typeof item.content === 'string') {
                last.content = last.content + '\n\n' + item.content;
            } else {
                const a = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content;
                const b = typeof item.content === 'string' ? [{ type: 'text', text: item.content }] : item.content;
                last.content = a.concat(b);
            }
        } else {
            out.push({ role: item.role, content: item.content });
        }
    });
    return out;
}

function toAnthropicMessages(messages) {
    const mapped = (messages || []).map(m => {
        const imgs = Array.isArray(m.images) ? m.images : [];
        if (imgs.length > 0) {
            const parts = [{ type: 'text', text: m.content || '' }];
            imgs.forEach(b64 => parts.push({
                type: 'image',
                source: { type: 'base64', media_type: sniffImageMime(b64), data: stripDataUrl(b64) }
            }));
            return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content || '' };
    });
    return mergeConsecutiveRoles(mapped);
}

function toGeminiContents(messages) {
    const mapped = (messages || []).map(m => {
        const parts = [];
        if (m.content) parts.push({ text: m.content });
        (Array.isArray(m.images) ? m.images : []).forEach(b64 => parts.push({
            inline_data: { mime_type: sniffImageMime(b64), data: stripDataUrl(b64) }
        }));
        if (parts.length === 0) parts.push({ text: '' });
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts };
    });

    const out = [];
    mapped.forEach(item => {
        const last = out[out.length - 1];
        if (last && last.role === item.role) {
            last.parts = last.parts.concat(item.parts);
        } else {
            out.push({ role: item.role, parts: item.parts.slice() });
        }
    });
    return out;
}

// Lista de modelos según el proveedor activo
async function listModelsForProvider(p) {
    if (p.type === 'ollama') {
        const r = await fetch(cleanBase(p.baseUrl) + '/api/tags', { mode: 'cors' });
        if (!r.ok) throw await httpErrorFrom(r);
        const d = await r.json();
        return (d.models || []).map(m => m.name);
    }
    if (p.type === 'anthropic') {
        const r = await fetch(anthropicBase(p) + '/v1/models', { mode: 'cors', headers: authHeaders(p) });
        if (!r.ok) throw await httpErrorFrom(r);
        const d = await r.json();
        return (d.data || []).map(m => m.id).filter(Boolean);
    }
    if (p.type === 'gemini') {
        const url = geminiBase(p) + '/v1beta/models' + (p.apiKey ? ('?key=' + encodeURIComponent(p.apiKey)) : '');
        const r = await fetch(url, { mode: 'cors' });
        if (!r.ok) throw await httpErrorFrom(r);
        const d = await r.json();
        return (d.models || []).map(m => (m.name || '').replace(/^models\//, '')).filter(Boolean);
    }
    const r = await fetch(openAiBase(p) + '/models', { mode: 'cors', headers: authHeaders(p) });
    if (!r.ok) throw await httpErrorFrom(r);
    const d = await r.json();
    return (d.data || []).map(m => m.id).filter(Boolean);
}

function updateProviderBadge() {
    const badge = document.getElementById('providerBadge');
    if (!badge) return;
    const p = getActiveProvider();
    badge.textContent = p.icon + ' ' + p.name;
    badge.title = 'Proveedor activo: ' + p.name + ' — clic para cambiar';
}

function fillModelSelect(models, emptyMessage) {
    const previous = modelSelect.value;
    modelSelect.innerHTML = '';
    if (models && models.length > 0) {
        models.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            modelSelect.appendChild(option);
        });
        if (previous && models.indexOf(previous) !== -1) modelSelect.value = previous;
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = emptyMessage || 'Sin modelos disponibles';
        modelSelect.appendChild(option);
    }
}

function setProviderStatus(message, color) {
    if (!installerStatus) return;
    installerStatus.textContent = message || '';
    installerStatus.style.color = color || 'var(--text-secondary)';
}

// Limpia solo avisos/errores de proveedor (no pisa mensajes del instalador de Ollama)
function clearProviderStatusIfStale() {
    if (!installerStatus) return;
    const current = installerStatus.textContent || '';
    if (/^(❌|⚠️|⏳|El proveedor|No hay modelos|La instalación)/.test(current)) {
        installerStatus.textContent = '';
    }
}

function providerErrorHint(p, error) {
    const cfg = getProviderCfg(p.id);
    if (p.needsKey && !p.apiKey && !cfg.keySkipped) return 'Falta la API Key: pulsa 🌐 para configurarla.';
    if (p.type === 'ollama') return 'Usa el .bat opción 1 o 3 (HTTP + CORS) y revisa http://127.0.0.1:11434';
    return 'Comprueba la URL base, la clave y tu conexión. Detalle: ' + ((error && error.message) || error || '');
}

function modelLikelySupportsVisionCloud(modelName) {
    if (!modelName) return false;
    const n = modelName.toLowerCase();
    return /vision|vl|llava|multimodal|internvl|smolvlm|pixtral|gpt-4|gpt-5|gpt-?o|\bo[1-9](-|$)|claude|gemini|gemma|qwen|glm-4v|glm-5v|4o|deepseek-vl|qwen-vl|\.vl|vlm/.test(n);
}

function shouldStripImages(provider, modelName) {
    if (!modelName) return false;
    if (!provider || provider.type === 'ollama') return !modelLikelySupportsVision(modelName);
    return !modelLikelySupportsVisionCloud(modelName);
}

// ==========================================
// TRANSPORTE DE CHAT UNIFICADO (según proveedor)
// ==========================================
async function streamChat(provider, model, messages, signal, onDelta) {
    const type = provider.type;
    if (type === 'ollama') return streamOllamaChat(provider, model, messages, signal, onDelta);
    if (type === 'anthropic') return streamAnthropicChat(provider, model, messages, signal, onDelta);
    if (type === 'gemini') return streamGeminiChat(provider, model, messages, signal, onDelta);
    return streamOpenAiChat(provider, model, messages, signal, onDelta);
}

async function streamOllamaChat(provider, model, messages, signal, onDelta) {
    const response = await fetch(cleanBase(provider.baseUrl) + '/api/chat', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, messages: messages, stream: true }),
        signal: signal
    });
    if (!response.ok) throw await httpErrorFrom(response);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    const handleLine = (line) => {
        const t = line.trim();
        if (!t) return;
        let chunk;
        try { chunk = JSON.parse(t); } catch (_) { return; }
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.message && chunk.message.content) {
            text += chunk.message.content;
            onDelta(chunk.message.content);
        }
    };
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(handleLine);
    }
    if (buffer) buffer.split('\n').forEach(handleLine);
    return text;
}

async function streamOpenAiChat(provider, model, messages, signal, onDelta) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders(provider));
    if (provider.id === 'openrouter') {
        headers['HTTP-Referer'] = location.origin;
        headers['X-Title'] = 'Facil con AI Agent';
    }
    const response = await fetch(openAiBase(provider) + '/chat/completions', {
        method: 'POST',
        mode: 'cors',
        headers: headers,
        body: JSON.stringify({ model: model, messages: toOpenAiMessages(messages), stream: true }),
        signal: signal
    });
    if (!response.ok) throw await httpErrorFrom(response);

    let text = '';
    await readSse(response, (data) => {
        if (data.error) {
            const e = data.error;
            throw new Error(typeof e === 'string' ? e : (e.message || JSON.stringify(e)));
        }
        const delta = data.choices && data.choices[0] && data.choices[0].delta;
        if (delta && typeof delta.content === 'string' && delta.content) {
            text += delta.content;
            onDelta(delta.content);
        }
    });
    return text;
}

async function streamAnthropicChat(provider, model, messages, signal, onDelta) {
    const { system, rest } = splitSystemMessages(messages);
    const headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders(provider));
    const body = { model: model, max_tokens: 8192, stream: true, messages: toAnthropicMessages(rest) };
    if (system) body.system = system;

    const response = await fetch(anthropicBase(provider) + '/v1/messages', {
        method: 'POST',
        mode: 'cors',
        headers: headers,
        body: JSON.stringify(body),
        signal: signal
    });
    if (!response.ok) throw await httpErrorFrom(response);

    let text = '';
    await readSse(response, (data) => {
        if (data.type === 'content_block_delta' && data.delta && typeof data.delta.text === 'string') {
            text += data.delta.text;
            onDelta(data.delta.text);
        } else if (data.type === 'error') {
            const e = data.error || {};
            throw new Error(e.message || e.type || 'Error de Anthropic');
        }
    });
    return text;
}

async function streamGeminiChat(provider, model, messages, signal, onDelta) {
    const { system, rest } = splitSystemMessages(messages);
    const body = { contents: toGeminiContents(rest) };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const url = geminiBase(provider) + '/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse'
        + (provider.apiKey ? ('&key=' + encodeURIComponent(provider.apiKey)) : '');

    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal
    });
    if (!response.ok) throw await httpErrorFrom(response);

    let text = '';
    await readSse(response, (data) => {
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            throw new Error('Respuesta bloqueada: ' + data.promptFeedback.blockReason);
        }
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        const cand = data.candidates && data.candidates[0];
        if (cand && cand.content && Array.isArray(cand.content.parts)) {
            cand.content.parts.forEach(part => {
                if (part.text) {
                    text += part.text;
                    onDelta(part.text);
                }
            });
        }
    });
    return text;
}

/**
 * Prepara mensajes para /api/chat.
 * Solo incluye "images" si hay base64 real. stripImages=true elimina visión.
 */
function buildApiMessages(sessionMessages, systemPromptMessage, stripImages = false) {
    const cleaned = sessionMessages.map(m => {
        const msgObj = {
            role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
            content: m.content || m.text || ''
        };
        if (!stripImages && m.images && Array.isArray(m.images) && m.images.length > 0) {
            msgObj.images = m.images;
        }
        return msgObj;
    });
    return [systemPromptMessage, ...cleaned];
}

function modelLikelySupportsVision(modelName) {
    if (!modelName) return false;
    const n = modelName.toLowerCase();
    return /llava|bakllava|vision|moondream|minicpm-v|qwen2-vl|qwen2\.5-vl|llama3\.2-vision|gemma3.*vision|pixtral/.test(n);
}

const chatHistory = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const sandboxIframe = document.getElementById('sandboxIframe');
const downloadCodeBtn = document.getElementById('downloadCodeBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const openNewTabBtn = document.getElementById('openNewTabBtn');

// Referencias Adjuntos
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachmentPreview = document.getElementById('attachmentPreview');
let currentAttachment = null; // Guardará el objeto de estado del archivo

// Referencias del Sidebar / Historial
const menuToggleBtn = document.getElementById('menuToggleBtn');
const sidebar = document.getElementById('sidebar');
const newChatBtn = document.getElementById('newChatBtn');
const sessionList = document.getElementById('sessionList');

// Referencias del Instalador
const installBtn = document.getElementById('installBtn');
const modelInstallInput = document.getElementById('modelInstallInput');
const installerStatus = document.getElementById('installerStatus');

// Referencias para el panel redimensionable (Split Screen)
const resizer = document.getElementById('dragMe');
const leftSide = document.getElementById('leftPanel');
const rightSide = document.getElementById('rightPanel');

// Referencias Gestor de Modelos
const openModelManagerBtn = document.getElementById('openModelManagerBtn');
const closeModelManagerBtn = document.getElementById('closeModelManagerBtn');
const modelManagerModal = document.getElementById('model-manager-modal');
const modelList = document.getElementById('model-list');
const exportMdBtn = document.getElementById('exportMdBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const codeOutput = document.getElementById('code-output');

// Variable global para guardar el código actual renderizado en el iframe
let currentRenderedCode = "";
const pythonOutput = document.getElementById('python-output');
let pyodideInstance = null; // Instancia global de Pyodide

// Variable para guardar la última respuesta completa de la IA (para empaquetar en ZIP)
let lastAiResponse = "";

// Último prompt del usuario (para reenviar al cambiar de modelo)
let lastUserPrompt = null;   // { text, images, attachmentMeta }
let lastFailedPrompt = null; // copia si falló la petición

// Para controlar la cancelación de peticiones
let currentAbortController = null;
let isProcessingResponse = false;

// ==========================================
// LÓGICA DE SPLIT SCREEN (División Deslizable)
// ==========================================
let x = 0; // Posición X del ratón al presionar clic
let leftWidth = 0; // Ancho inicial del panel izquierdo

const mouseDownHandler = function(e) {
    // Obtener la posición inicial del puntero
    x = e.clientX;
    // Obtener el ancho actual del elemento izquierdo
    leftWidth = leftSide.getBoundingClientRect().width;
    
    // Adjuntar los eventos correspondientes a todo el documento
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
};

const mouseMoveHandler = function(e) {
    // Calculamos qué tanto se movió el puntero (delta x)
    const dx = e.clientX - x;
    
    // Obtenemos el ancho total del contenedor (padre de los paneles)
    const containerWidth = resizer.parentNode.getBoundingClientRect().width;
    
    // Calculamos el nuevo porcentaje base en el nuevo ancho del panel izquierdo
    const newLeftWidthPercent = ((leftWidth + dx) * 100) / containerWidth;
    
    // Ponemos límites estéticos: que los paneles no sean menores al 10%
    if (newLeftWidthPercent > 10 && newLeftWidthPercent < 90) {
        leftSide.style.flex = `1 1 ${newLeftWidthPercent}%`;
        rightSide.style.flex = `1 1 ${100 - newLeftWidthPercent}%`;
    }
    
    // IMPORTANTE: Evitamos que el IFrame interfiera con los eventos del ratón bloqueando los clicks temporalmente
    sandboxIframe.style.pointerEvents = 'none';
};

const mouseUpHandler = function() {
    // Limpiamos los eventos al soltar el botón
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    
    // Devolvemos la interactividad estándar al iframe
    sandboxIframe.style.pointerEvents = 'auto';
};

// Adjuntamos el evento de inicio al redimensionador
resizer.addEventListener('mousedown', mouseDownHandler);

// ==========================================
// AUTO-DETECCIÓN DE MODELOS DEL PROVEEDOR ACTIVO
// (Ollama /api/tags, OpenAI /v1/models, Anthropic, Gemini...)
// ==========================================
let fetchModelsToken = 0;

async function fetchModels() {
    const token = ++fetchModelsToken;
    const provider = getActiveProvider();
    updateProviderBadge();
    const cached = provider.models || [];

    try {
        const models = await listModelsForProvider(provider);
        if (token !== fetchModelsToken) return; // otra petición más reciente ya mandó

        if (models && models.length > 0) {
            providerConfig.providers[provider.id] = Object.assign({}, getProviderCfg(provider.id), { models: models });
            saveProviderConfig();
            fillModelSelect(models);
            clearProviderStatusIfStale();
            return;
        }

        if (cached.length > 0) {
            fillModelSelect(cached);
            setProviderStatus('⚠️ ' + provider.name + ' no devolvió modelos; se usa la lista guardada.', '#d29922');
            return;
        }

        fillModelSelect([], provider.type === 'ollama'
            ? 'No hay modelos en Ollama. Descarga uno.'
            : 'Sin modelos: configura URL/clave o añade uno 🌐');
        setProviderStatus('El proveedor ' + provider.name + ' no devolvió modelos.', '#d29922');
    } catch (error) {
        if (token !== fetchModelsToken) return;
        console.warn('Error al detectar modelos de ' + provider.name + ':', error);
        if (cached.length > 0) {
            fillModelSelect(cached);
            setProviderStatus('⚠️ ' + provider.name + ' no responde; se usa la lista guardada.', '#d29922');
        } else {
            fillModelSelect([], 'Sin modelos de ' + provider.name + ' (revisa 🌐)');
            setProviderStatus('❌ No hay modelos de ' + provider.name + '. ' + providerErrorHint(provider, error), '#ff7b72');
        }
    }
}

// Inicializamos la búsqueda de modelos cuando carga el script
fetchModels();

// ==========================================
// FUNCIONES AUXILIARES PARA EL CHAT, SIDEBAR E HISTORIAL
// ==========================================

// Variable global estado sesión
let currentSessionId = localStorage.getItem('currentSessionId');

// Abrir/Cerrar la barra lateral
menuToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

function getChatSessions() {
    return JSON.parse(localStorage.getItem('chatSessions')) || [];
}

function saveChatSessions(sessions) {
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
}

function createNewSession() {
    const d = new Date();
    const newSession = {
        id: Date.now().toString(),
        title: `Sesión local ${d.getHours()}:${d.getMinutes()}`,
        messages: [],
        renderedCode: ""
    };
    
    let sessions = getChatSessions();
    sessions.push(newSession);
    saveChatSessions(sessions);
    
    loadSession(newSession.id);
    return newSession.id;
}

newChatBtn.addEventListener('click', () => {
    createNewSession();
});

function loadSession(id) {
    currentSessionId = id;
    localStorage.setItem('currentSessionId', id);
    
    const sessions = getChatSessions();
    const session = sessions.find(s => s.id === id);
    
    // Limpiar UI visual
    chatHistory.innerHTML = '';
    
    // Remontar el chat
    if (session && session.messages) {
        session.messages.forEach(m => {
            const content = m.content || m.text;
            const role = m.role || (m.sender === 'user' ? 'user' : 'assistant');
            addMessageToChatVisual(content, role === 'user' ? 'user' : 'ai');
        });
        currentRenderedCode = session.renderedCode || "";
        sandboxIframe.removeAttribute('srcdoc');
        sandboxIframe.srcdoc = currentRenderedCode;
    } else {
        currentRenderedCode = "";
        sandboxIframe.removeAttribute('srcdoc');
        sandboxIframe.srcdoc = "";
    }
    
    renderSessionList();
}

function renderSessionList() {
    // Ordenar para mostrar lo más reciente arriba
    const sessions = getChatSessions().slice().reverse(); 
    sessionList.innerHTML = '';
    
    sessions.forEach(s => {
        const div = document.createElement('div');
        div.classList.add('session-item');
        if (s.id === currentSessionId) {
            div.classList.add('active');
        }
        
        const spanTitle = document.createElement('span');
        spanTitle.textContent = s.title;
        spanTitle.title = s.title; // hover visual
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.classList.add('delete-session-btn');
        deleteBtn.title = 'Eliminar sesión';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el clic abra la sesión
            if (confirm('¿Seguro que deseas eliminar esta sesión localmente?')) {
                deleteSession(s.id);
            }
        });
        
        div.addEventListener('click', () => loadSession(s.id));
        
        div.appendChild(spanTitle);
        div.appendChild(deleteBtn);
        sessionList.appendChild(div);
    });
}

function deleteSession(id) {
    let sessions = getChatSessions();
    sessions = sessions.filter(s => s.id !== id);
    saveChatSessions(sessions);
    
    // Si borramos la que estamos viendo
    if (currentSessionId === id) {
        if (sessions.length > 0) {
            loadSession(sessions[0].id); // Mover a la primera disponible temporalmente
        } else {
            createNewSession();
        }
    } else {
        renderSessionList(); // Solo actualizar UI visual
    }
}

function saveMessage(content, role, images = null) {
    const sessions = getChatSessions();
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
        if (!session.messages) session.messages = [];
        
        const msgObj = { role, content };
        if (images && images.length > 0) msgObj.images = images;
        
        session.messages.push(msgObj);
        
        // Actualizar el título dinámico con el primer prompt del usuario
        if (session.messages.length >= 1 && role === 'user' && session.title.includes('Sesión local')) { 
            session.title = content.substring(0, 25) + '...';
        }
        
        saveChatSessions(sessions);
        renderSessionList(); // Refrescar menú lateral
    }
}

function saveCodeToSession() {
    const sessions = getChatSessions();
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
        session.renderedCode = currentRenderedCode;
        saveChatSessions(sessions);
    }
}

// Agregar un mensaje al historial visual en pantalla sin guardarlo en DB (Ayuda al loadSession)
function addMessageToChatVisual(text, senderType) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(senderType === 'user' ? 'user-msg' : 'ai-msg');
    
    // Contenedor de texto (para renderizar KaTeX / markdown simple)
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = text;
    msgDiv.appendChild(contentDiv);

    // Botón copiar mensaje/respuesta
    const copyBtn = document.createElement('button');
    copyBtn.classList.add('copy-msg-btn');
    copyBtn.title = 'Copiar mensaje';
    copyBtn.innerHTML = '📋';
    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.innerHTML = '✅';
            setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
        } catch (err) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.innerHTML = '✅';
            setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
        }
    });
    msgDiv.appendChild(copyBtn);

    chatHistory.appendChild(msgDiv);

    // Resaltado de código + KaTeX
    highlightCodeInElement(contentDiv);
    if (window.renderMathInElement && !(contentDiv.querySelector('pre'))) {
        // Si no hubo fences, aplicar KaTeX directo sobre el texto
        try {
            renderMathInElement(contentDiv, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
        } catch (e) { /* silencioso */ }
    }
    
    // Auto-scroll al fondo
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Agregar mensaje y guardar (por defecto para flujos nuevos)
function addMessageToChat(text, role) {
    addMessageToChatVisual(text, role === 'user' ? 'user' : 'ai');
    saveMessage(text, role);
}

// Inicialización de Pyodide al cargar la página
async function setupPyodide() {
    try {
        if (!pyodideInstance) {
            console.log("Inicializando Pyodide...");
            pyodideInstance = await loadPyodide();
            console.log("Pyodide listo.");
        }
    } catch (err) {
        console.error("Error al cargar Pyodide:", err);
    }
}

// Event Carga inicial (Lógica para determinar desde qué sesión abrimos)
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Pyodide en segundo plano
    setupPyodide();
    
    // Limpieza inicial para forzar a borrar lo que sea de BF-Cache de iframes
    currentRenderedCode = "";
    sandboxIframe.removeAttribute('srcdoc');
    sandboxIframe.srcdoc = "";
    
    // Si no hay chat anterior, crear uno
    let sessions = getChatSessions();
    if (!currentSessionId || sessions.length === 0) {
        createNewSession();
    } else {
        loadSession(currentSessionId);
    }
});


// ==========================================
// RESALTADO DE SINTAXIS (highlight.js)
// ==========================================
function mapLangToHljs(lang) {
    if (!lang) return 'plaintext';
    const l = lang.toLowerCase();
    const map = {
        js: 'javascript', javascript: 'javascript',
        py: 'python', python: 'python',
        tex: 'latex', latex: 'latex', bib: 'latex',
        r: 'r', R: 'r',
        jl: 'julia', julia: 'julia',
        html: 'xml', xml: 'xml',
        css: 'css',
        md: 'markdown', markdown: 'markdown',
        json: 'json',
        bash: 'bash', sh: 'bash'
    };
    return map[l] || l;
}

/**
 * Convierte bloques ```lang ... ``` del texto plano en <pre><code class="language-...">
 * y aplica highlight.js. También resalta el visor del sandbox.
 */
function highlightCodeInElement(el) {
    if (!el || !window.hljs) return;
    const raw = el.textContent || '';
    // Si no hay fences, no tocar (puede ser texto con KaTeX ya renderizado)
    if (!raw.includes('```')) {
        return;
    }
    // Reconstruir HTML con bloques de código
    const parts = [];
    const fenceRe = /```(\w+)?\s*\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = fenceRe.exec(raw)) !== null) {
        if (m.index > last) {
            const text = raw.slice(last, m.index);
            parts.push({ type: 'text', value: text });
        }
        parts.push({ type: 'code', lang: m[1] || '', value: m[2] });
        last = m.index + m[0].length;
    }
    if (last < raw.length) {
        parts.push({ type: 'text', value: raw.slice(last) });
    }
    if (parts.length === 0) return;

    el.innerHTML = '';
    parts.forEach(p => {
        if (p.type === 'text') {
            const span = document.createElement('span');
            span.textContent = p.value;
            el.appendChild(span);
        } else {
            const pre = document.createElement('pre');
            pre.className = 'chat-code-block';
            const code = document.createElement('code');
            const hlLang = mapLangToHljs(p.lang);
            code.className = 'language-' + hlLang;
            code.textContent = p.value.replace(/^\n+|\n+$/g, '');
            pre.appendChild(code);
            el.appendChild(pre);
            try { hljs.highlightElement(code); } catch (_) {}
        }
    });
    // Re-aplicar KaTeX sobre nodos de texto (no dentro de <code>)
    if (window.renderMathInElement) {
        try {
            renderMathInElement(el, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false,
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            });
        } catch (_) {}
    }
}

function highlightSandboxCode(preEl, lang) {
    if (!preEl || !window.hljs) return;
    const code = document.createElement('code');
    code.className = 'language-' + mapLangToHljs(lang);
    code.textContent = preEl.textContent;
    preEl.textContent = '';
    preEl.appendChild(code);
    try { hljs.highlightElement(code); } catch (_) {}
}


// Analizar la respuesta, limpiar etiquetas e inyectar en el Sandbox en tiempo real
async function updateSandbox(text) {
    // Regex ampliado: html, css, js, python, latex/tex, r, julia, markdown, etc.
    const regex = /```(html|css|javascript|js|python|py|latex|tex|r|R|julia|jl|markdown|md|json|bib)?\s*([\s\S]*?)```/gi;
    
    let html = '';
    let css = '';
    let js = '';
    let python = '';
    let latex = '';
    let rCode = '';
    let julia = '';
    let otherCode = '';
    let otherLang = '';
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        const lang = match[1] ? match[1].toLowerCase() : '';
        let code = match[2];
        
        // Limpieza extra del lenguaje al inicio del bloque
        code = code.replace(/^(html|css|javascript|js|python|py|latex|tex|r|julia|jl|markdown|md|json|bib)\s*/i, '');
        
        if (lang === 'html') {
            html += code + '\n';
        } else if (lang === 'css') {
            css += code + '\n';
        } else if (lang === 'javascript' || lang === 'js') {
            js += code + '\n';
        } else if (lang === 'python' || lang === 'py') {
            python += code + '\n';
        } else if (lang === 'latex' || lang === 'tex' || lang === 'bib') {
            latex += code + '\n';
        } else if (lang === 'r') {
            rCode += code + '\n';
        } else if (lang === 'julia' || lang === 'jl') {
            julia += code + '\n';
        } else {
            // Bloque genérico o markdown
            if (code.includes('<html') || code.includes('<div') || code.includes('<body')) {
                html += code + '\n';
            } else if (code.includes('{') && code.includes(':') && !code.includes('\\documentclass')) {
                css += code + '\n';
            } else if (code.includes('\\documentclass') || code.includes('\\begin{document}')) {
                latex += code + '\n';
            } else {
                otherCode += code + '\n';
                otherLang = lang || 'text';
            }
        }
    }

    const codeOutput = document.getElementById('code-output');
    
    // Prioridad: Web > Python ejecutable > LaTeX / R / Julia (solo visualización de código)
    if (html.trim() || css.trim() || js.trim()) {
        pythonOutput.classList.add('hidden');
        if (codeOutput) codeOutput.classList.add('hidden');
        sandboxIframe.classList.remove('hidden');

        const combinedCode = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${css}</style>
            </head>
            <body>
                ${html}
                <script>${js}<\/script>
            </body>
            </html>
        `;
        
        currentRenderedCode = combinedCode;
        sandboxIframe.srcdoc = combinedCode;

    } else if (python.trim()) {
        sandboxIframe.classList.add('hidden');
        if (codeOutput) codeOutput.classList.add('hidden');
        pythonOutput.classList.remove('hidden');
        
        pythonOutput.textContent = '⏳ Ejecutando script de Python...';

        if (!pyodideInstance) {
            pythonOutput.textContent = '⏳ Cargando motor de Python (Pyodide), por favor espera un momento...';
            await setupPyodide();
        }

        try {
            function dedent(code) {
                const lines = code.split('\n');
                while (lines.length > 0 && lines[0].trim() === '') lines.shift();
                while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
                if (lines.length === 0) return '';
                const minIndent = lines.reduce((min, line) => {
                    if (line.trim() === '') return min;
                    const match = line.match(/^(\s*)/);
                    return Math.min(min, match[0].length);
                }, Infinity);
                return lines.map(line => line.slice(minIndent)).join('\n');
            }

            const cleanPython = dedent(python);

            pyodideInstance.setStdout({
                batched: (text) => {
                    if (pythonOutput.textContent.startsWith('⏳')) pythonOutput.textContent = '';
                    pythonOutput.textContent += text + '\n';
                    pythonOutput.scrollTop = pythonOutput.scrollHeight;
                }
            });

            await pyodideInstance.runPythonAsync(cleanPython);
        } catch (err) {
            pythonOutput.textContent += `\n❌ Error de Python:\n${err}`;
            pythonOutput.scrollTop = pythonOutput.scrollHeight;
        }

        // Guardar el código Python como "rendered" para descarga
        currentRenderedCode = python.trim();

    } else if (latex.trim() || rCode.trim() || julia.trim() || otherCode.trim()) {
        // Mostrar código fuente en el visor de código (no ejecutable en navegador)
        sandboxIframe.classList.add('hidden');
        pythonOutput.classList.add('hidden');
        if (codeOutput) {
            codeOutput.classList.remove('hidden');
            let display = '';
            let label = '';
            if (latex.trim()) {
                label = '📄 Código LaTeX (cópialo a Overleaf o compílalo localmente)';
                display = latex.trim();
                currentRenderedCode = latex.trim();
            } else if (rCode.trim()) {
                label = '📊 Código R (ejecútalo en RStudio o R)';
                display = rCode.trim();
                currentRenderedCode = rCode.trim();
            } else if (julia.trim()) {
                label = '🔬 Código Julia (ejecútalo en Julia REPL o VS Code)';
                display = julia.trim();
                currentRenderedCode = julia.trim();
            } else {
                label = '📝 Código / Texto';
                display = otherCode.trim();
                currentRenderedCode = otherCode.trim();
            }
            codeOutput.textContent = '';
            const header = document.createElement('div');
            header.className = 'code-viewer-header';
            header.textContent = label;
            codeOutput.appendChild(header);
            const pre = document.createElement('pre');
            pre.className = 'sandbox-code-pre';
            let langHint = 'plaintext';
            if (latex.trim()) langHint = 'latex';
            else if (rCode.trim()) langHint = 'r';
            else if (julia.trim()) langHint = 'julia';
            else if (otherLang) langHint = otherLang;
            // highlight.js
            const codeEl = document.createElement('code');
            codeEl.className = 'language-' + mapLangToHljs(langHint);
            codeEl.textContent = display;
            pre.appendChild(codeEl);
            codeOutput.appendChild(pre);
            if (window.hljs) {
                try { hljs.highlightElement(codeEl); } catch (_) {}
            }
        }
    }
}

// ==========================================
// ADJUNTAR ARCHIVOS (CLIP) Y VISTA PREVIA
// ==========================================
attachBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.type;
    const fileName = file.name;

    if (fileType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const result = evt.target.result;
            // result = data:image/png;base64,.... Solo requerimos la raw base64 para Ollama
            const base64Data = result.split(',')[1];
            currentAttachment = { type: 'image', base64: base64Data, name: fileName };
            showAttachmentPreview(result, fileName);
        };
        reader.readAsDataURL(file);
    } else {
        // Documentos o código
        const reader = new FileReader();
        reader.onload = function(evt) {
            currentAttachment = { type: 'text', content: evt.target.result, name: fileName };
            showAttachmentPreview(null, fileName);
        };
        reader.readAsText(file);
    }
    
    // Para que el change se dispare siempre incluso si metemos el mismo archivo tras borrarlo.
    fileInput.value = '';
});

function showAttachmentPreview(imgSrc, fileName) {
    attachmentPreview.innerHTML = '';
    attachmentPreview.classList.remove('hidden');

    if (imgSrc) {
        const img = document.createElement('img');
        img.src = imgSrc;
        attachmentPreview.appendChild(img);
    } else {
        const icon = document.createElement('span');
        icon.textContent = '📄';
        icon.style.fontSize = '1.5rem';
        attachmentPreview.appendChild(icon);
    }

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('filename');
    nameSpan.textContent = fileName;
    attachmentPreview.appendChild(nameSpan);

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('close-preview-btn');
    closeBtn.textContent = '❌';
    closeBtn.title = "Quitar Adjunto";
    closeBtn.addEventListener('click', clearAttachment);
    attachmentPreview.appendChild(closeBtn);
}

function clearAttachment() {
    currentAttachment = null;
    fileInput.value = '';
    attachmentPreview.classList.add('hidden');
    attachmentPreview.innerHTML = '';
}

// ==========================================
// LÓGICA DE CONEXIÓN Y CHAT CON LA API OLLAMA
// Al enviar prompt: Petición POST a la API /api/chat
// ==========================================
sendButton.addEventListener('click', async () => {
    
    // Si ya estamos procesando, este botón ahora sirve para ABORTAR
    if (isProcessingResponse && currentAbortController) {
        currentAbortController.abort();
        console.log("Petición abortada por el usuario.");
        return;
    }

    const promptText = promptInput.value.trim();
    if (!promptText && !currentAttachment) return; // Permite envio vacío de texto si hay imagen/documento
    
    const selectedModel = modelSelect.value;
    const providerNow = getActiveProvider();

    if (providerNow.needsKey && !providerNow.apiKey && !getProviderCfg(providerNow.id).keySkipped) {
        alert('Falta la API Key de ' + providerNow.name + '.\nSe abrirá el selector de proveedores (🌐) para que la configures.');
        const openBtn = document.getElementById('openProviderBtn');
        if (openBtn) openBtn.click();
        openProviderForm(providerNow.id);
        return;
    }

    if (!selectedModel) {
        alert('No hay ningún modelo disponible para ' + providerNow.name + '.\nAbre el selector 🌐 de proveedores para cargarlos o añadir uno manualmente.');
        const openBtn = document.getElementById('openProviderBtn');
        if (openBtn) openBtn.click();
        return;
    }
    
    // 1. Mostrar el mensaje del usuario y limpiar el input y estado adjunto
    const userVisualText = promptText || '[Archivo Adjunto Enviado]';
    addMessageToChatVisual(userVisualText, 'user'); // SOLO VISTA, el guardado real en sesión se hace tras inyectar contexto
    promptInput.value = '';
    
    // Cambiar la altura del textarea a la por defecto
    promptInput.style.height = '45px';
    
    // 2. Colocar un placeholder mientras el sistema trabaja
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.classList.add('message', 'ai-msg');
    aiMsgDiv.textContent = '⏳ Pensando...';
    
    chatHistory.appendChild(aiMsgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    // Activar estado de procesamiento y crear controlador de cancelación
    isProcessingResponse = true;
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    // Cambiar visualmente el botón a "Detener"
    sendButton.textContent = '🛑 Detener';
    sendButton.title = 'Cancelar respuesta actual';
    sendButton.style.backgroundColor = '#ff7b72'; // Color de error/peligro
    
    promptInput.disabled = true;
    attachBtn.disabled = true;
    
    // Definir Prompts
    let finalPrompt = promptText;
    let finalImages = [];

    // LÓGICA DE EXTRACCIÓN DE ENLACE MEDIANTE PREVIEWS (API MICROLINK)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = promptText.match(urlRegex);
    
    if (matches && matches.length > 0) {
        const detectedUrl = matches[0];
        aiMsgDiv.textContent = '⏳ Leyendo enlace...';
        
        try {
            const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(detectedUrl)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.data) {
                    const linkTitle = data.data.title || "Sin título";
                    const linkDesc = data.data.description || "Sin descripción";
                    
                    finalPrompt = `${finalPrompt}\n\n[Contexto extraído del enlace: ${linkTitle} - ${linkDesc}]`;
                    aiMsgDiv.textContent = '⏳ Pensando... (Enlace asimilado)';
                } else {
                    aiMsgDiv.textContent = '⏳ Pensando...';
                }
            } else {
                aiMsgDiv.textContent = '⏳ Pensando...';
            }
        } catch (err) {
            console.warn('Fallo silencioso al leer el enlace con Microlink:', err);
            aiMsgDiv.textContent = '⏳ Pensando...'; // Falla silenciosa total, continúa sin romper flow
        }
    }
    
    // LÓGICA INYECCIÓN DE ADJUNTOS
    if (currentAttachment) {
        if (currentAttachment.type === 'text') {
            finalPrompt = `[Contenido del archivo adjunto: ${currentAttachment.name}]:\n${currentAttachment.content}\n\n${finalPrompt}`;
        } else if (currentAttachment.type === 'image') {
            finalImages.push(currentAttachment.base64);
        }
    }
    
    clearAttachment(); // Limpiamos para el siguiente turno ahora sí con la variable final inyectada

    // Guardar para posible reenvío (cambiar modelo / reintentar)
    lastUserPrompt = { text: finalPrompt, images: finalImages.slice(), rawInput: promptText };
    lastFailedPrompt = null;

    // GUARDAR EL MENSAJE FINAL DEL USUARIO (CON TODO EL CONTEXTO Y ENLACES) EN LA SESIÓN
    saveMessage(finalPrompt, 'user', finalImages);
    
    // Obtener todo el array de mensajes de la sesión actual
    const currentSession = getChatSessions().find(s => s.id === currentSessionId);
    let sessionMessages = [];
    
    if (currentSession && currentSession.messages) {
        sessionMessages = currentSession.messages.map(m => {
            const msgObj = { 
                role: m.role || (m.sender === 'user' ? 'user' : 'assistant'), 
                content: m.content || m.text 
            };
            if (m.images && Array.isArray(m.images) && m.images.length > 0) msgObj.images = m.images;
            return msgObj;
        });
    }

    // Inyectar el System Prompt según el modo seleccionado (Ciencias / Web)
    const currentMode = (modeSelect && modeSelect.value) || 'ciencias';
    const systemPrompts = {
        ciencias: `Eres Fácil con AI Agent, un asistente experto en ciencias y programación científica local.

ESPECIALIDADES:
- Documentos y artículos académicos en LaTeX (artículos, reportes, presentaciones Beamer, tesis).
- Scripts y análisis de datos en Python (NumPy, Pandas, Matplotlib, SciPy, SymPy).
- Scripts en R (tidyverse, ggplot2, análisis estadístico).
- Código en Julia (cálculo científico, DifferentialEquations, Plots).
- Resolución paso a paso de problemas de matemáticas, física, química, biología y estadística.

REGLAS CRÍTICAS:
1. NUNCA digas que no tienes acceso a internet ni menciones limitaciones de IA. El sistema ya te entrega el contexto de enlaces y archivos.
2. Responde SIEMPRE empaquetando el código en bloques Markdown con el lenguaje correcto:
   - \`\`\`latex o \`\`\`tex para documentos LaTeX
   - \`\`\`python o \`\`\`py
   - \`\`\`r o \`\`\`R
   - \`\`\`julia o \`\`\`jl
   - \`\`\`html, \`\`\`css, \`\`\`javascript cuando sea web
3. Para problemas de ciencias: explica el razonamiento paso a paso, muestra fórmulas en LaTeX inline ($...$) o display ($$...$$), y entrega código ejecutable cuando ayude.
4. Si piden gráficas en Python, usa matplotlib y muestra el código completo listo para correr.
5. Para LaTeX: entrega un documento completo compilable (\\documentclass, \\begin{document}...\\end{document}) cuando sea un proyecto.
6. Sé conciso pero claro. Prioriza código correcto y explicaciones útiles.`,

        web: `Eres Fácil con AI Agent, un desarrollador web experto.

ESPECIALIDADES:
- HTML, CSS y JavaScript modernos (vanilla o con librerías vía CDN).
- Interfaces responsive, accesibles y con buen diseño visual.
- Componentes interactivos, formularios, animaciones y dashboards ligeros.
- Integración de Chart.js, Tailwind vía CDN, Font Awesome, etc. cuando aporte valor.

REGLAS CRÍTICAS:
1. NUNCA digas que no tienes acceso a internet ni menciones limitaciones de IA. El sistema ya te entrega el contexto de enlaces y archivos.
2. Si la información extraída del enlace es insuficiente, pide el texto concreto sin mencionar limitaciones de IA.
3. Si te piden una gráfica, usa Chart.js (cárgala vía CDN).
4. Responde SIEMPRE empaquetando el código en bloques Markdown (\`\`\`html, \`\`\`css, \`\`\`javascript, etc.).
5. Prefiere un único documento HTML autocontenido o bloques separados claros (html/css/js) listos para el sandbox.
6. Sé conciso, prioriza código limpio y funcional.`
    };

    const systemPromptMessage = {
        role: "system",
        content: systemPrompts[currentMode] || systemPrompts.ciencias
    };
    
    const activeProvider = getActiveProvider();
    const stripImages = shouldStripImages(activeProvider, selectedModel);
    if (stripImages && sessionMessages.some(m => m.images && m.images.length > 0)) {
        if (installerStatus) {
            installerStatus.textContent = 'Aviso: este modelo no soporta imágenes; se envía solo el texto.';
            installerStatus.style.color = '#d29922';
        }
    }
    const apiMessages = buildApiMessages(sessionMessages, systemPromptMessage, stripImages);

    try {
        // Preparar UI de mensaje AI (contenido + botón copiar)
        aiMsgDiv.innerHTML = '';
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = '';
        aiMsgDiv.appendChild(contentDiv);

        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-msg-btn');
        copyBtn.title = 'Copiar respuesta';
        copyBtn.innerHTML = '📋';
        aiMsgDiv.appendChild(copyBtn);

        let aiResponseText = '';

        // Petición en streaming al proveedor activo (Ollama / OpenAI / Anthropic / Gemini)
        await streamChat(activeProvider, selectedModel, apiMessages, signal, (chunk) => {
            aiResponseText += chunk;
            contentDiv.textContent = aiResponseText;
            chatHistory.scrollTop = chatHistory.scrollHeight;
        });

        lastAiResponse = aiResponseText;

        // Botón copiar con el texto final
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(aiResponseText);
                copyBtn.innerHTML = '✅';
                setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
            } catch (err) {
                const ta = document.createElement('textarea');
                ta.value = aiResponseText;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyBtn.innerHTML = '✅';
                setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
            }
        });

        // Resaltado de sintaxis + KaTeX sobre el contenido final
        highlightCodeInElement(contentDiv);
        if (window.renderMathInElement && !contentDiv.querySelector('pre')) {
            try {
                renderMathInElement(contentDiv, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            } catch (e) {}
        }
        
        await updateSandbox(aiResponseText);
        saveCodeToSession();
        saveMessage(aiResponseText, 'assistant');
        
    } catch (error) {
        if (error.name === 'AbortError') {
            aiMsgDiv.innerHTML = '';
            aiMsgDiv.style.color = 'var(--text-secondary)';
            const abortMsg = document.createElement('div');
            abortMsg.className = 'message-content';
            abortMsg.textContent = '🛑 Petición detenida por el usuario.';
            aiMsgDiv.appendChild(abortMsg);
            // Ofrecer reenviar
            if (lastUserPrompt) {
                lastFailedPrompt = { ...lastUserPrompt };
                const retryBtn = document.createElement('button');
                retryBtn.className = 'retry-btn';
                retryBtn.textContent = '🔄 Reenviar con el modelo actual';
                retryBtn.title = 'Útil si cambiaste de modelo o deteniste por error';
                retryBtn.addEventListener('click', () => retryLastPrompt());
                aiMsgDiv.appendChild(retryBtn);
            }
        } else {
            console.error('Error durante la solicitud a ' + activeProvider.name + ':', error);
            aiMsgDiv.innerHTML = '';
            aiMsgDiv.style.color = '#ff7b72';
            const errMsg = document.createElement('div');
            errMsg.className = 'message-content';
            let detail = error.message || String(error);
            const isFetchFail = /failed to fetch|networkerror|load failed|cors/i.test(detail);
            let tips = '';
            if (activeProvider.type === 'ollama') {
                if (isFetchFail) {
                    tips = `<br><br><strong>En Zen Browser esto suele ser CORS o file://</strong><br>
• Cierra Ollama por completo y vuelve a abrirlo <em>después</em> de configurar <code>OLLAMA_ORIGINS=*</code><br>
• Usa el <code>.bat</code> con la <strong>opción 1</strong> (arranca Ollama y sirve la app en http://127.0.0.1:8765) o la <strong>opción 2</strong> (Ollama ya corriendo)<br>
• Comprueba en otra pestaña: <a href="http://127.0.0.1:11434" target="_blank">http://127.0.0.1:11434</a> debe decir "Ollama is running"`;
                } else {
                    tips = `<br><br><strong>Comprueba:</strong><br>
1. Ollama en ejecución (<code>ollama serve</code>)<br>
2. <code>OLLAMA_ORIGINS=*</code> antes de arrancar Ollama<br>
3. Modelo seleccionado válido<br>
4. Evita <code>file://</code> en Zen: usa http://127.0.0.1:8765`;
                }
            } else {
                tips = `<br><br><strong>Proveedor: ${activeProvider.name} — Comprueba:</strong><br>
1. URL base correcta (${cleanBase(activeProvider.baseUrl) || 'sin definir'})<br>
2. API Key válida y con crédito/cuota<br>
3. Nombre exacto del modelo<br>
4. Pulsa 🌐 → <em>🔄 Cargar modelos</em> para verificar la conexión`;
            }
            errMsg.innerHTML = `❌ No se pudo completar la solicitud.${tips}<br><br>
<small style="opacity:0.8">Detalle: ${detail.replace(/</g,'&lt;')}</small>`;
            aiMsgDiv.appendChild(errMsg);

            if (lastUserPrompt) {
                lastFailedPrompt = { ...lastUserPrompt };
                const retryBtn = document.createElement('button');
                retryBtn.className = 'retry-btn';
                retryBtn.textContent = '🔄 Reenviar con el modelo actual';
                retryBtn.title = 'Cambia de modelo arriba y pulsa aquí para reintentar';
                retryBtn.addEventListener('click', () => retryLastPrompt());
                aiMsgDiv.appendChild(retryBtn);
            }
        }
    } finally {
        // Restaurar estado visual y funcionalidad de botones
        isProcessingResponse = false;
        currentAbortController = null;

        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
        sendButton.title = '';
        sendButton.style.backgroundColor = ''; // Retorna a estilos via CSS
        promptInput.disabled = false;
        attachBtn.disabled = false;
        promptInput.focus();
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
});

// ==========================================
// Instalador de Inteligencias (/api/pull)
// ==========================================
installBtn.addEventListener('click', async () => {
    const installProvider = getActiveProvider();
    if (installProvider.type !== 'ollama') {
        installerStatus.textContent = 'La instalación de modelos solo funciona con Ollama (ahora usas ' + installProvider.name + ').';
        installerStatus.style.color = '#d29922';
        return;
    }

    const modelName = modelInstallInput.value.trim();
    if (!modelName) {
        installerStatus.textContent = 'Por favor, ingresa el nombre de un modelo válido.';
        installerStatus.style.color = '#ff7b72';
        return;
    }
    
    // Feedback: Conectando...
    installerStatus.textContent = '⏳ Conectando...';
    installerStatus.style.color = 'var(--text-secondary)';
    installBtn.disabled = true;
    modelInstallInput.disabled = true;
    
    try {
        // Feedback secundario: Descargando
        // Puesto que es stream false, la promesa no se resuelve hasta que finaliza la descarga de todo el tamaño
        installerStatus.textContent = '📥 Descargando... (esto puede tardar varios minutos dependiendo de tu conexión y del modelo)';
        
        const response = await fetch(OLLAMA_BASE + '/api/pull', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: modelName, stream: false })
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        // ¡Éxito!
        installerStatus.textContent = '✅ ¡Modelo instalado con éxito!';
        installerStatus.style.color = '#3fb950'; // Color verde
        modelInstallInput.value = '';
        
        // Refrescar el selector para que aparezca el nuevo modelo automáticamente
        fetchModels();
        
    } catch (error) {
        console.error('Error al instalar modelo:', error);
        installerStatus.textContent = '❌ Error al instalar el modelo. Verifica el nombre o la conexión con Ollama.';
        installerStatus.style.color = '#ff7b72';
    } finally {
        installBtn.disabled = false;
        modelInstallInput.disabled = false;
    }
});

// ==========================================
// FUNCIÓN: DESCARGAR CÓDIGO RENDERIZADO COMO HTML
// ==========================================
downloadCodeBtn.addEventListener('click', () => {
    if (!currentRenderedCode) {
        alert('El Sandbox está vacío. Debes generar contenido primero usando a tu IA local.');
        return;
    }
    
    // Detectar extensión razonable
    let filename = 'mi_proyecto_ia.html';
    let mime = 'text/html';
    const code = currentRenderedCode.trim();
    if (code.startsWith('\\documentclass') || code.includes('\\begin{document}')) {
        filename = 'main.tex';
        mime = 'text/plain';
    } else if (code.includes('import ') || code.includes('def ') || code.includes('print(')) {
        filename = 'main.py';
        mime = 'text/x-python';
    } else if (code.includes('library(') || code.includes('ggplot') || code.startsWith('# R')) {
        filename = 'script.R';
        mime = 'text/plain';
    } else if (code.includes('using ') || code.includes('function ') && code.includes('end')) {
        filename = 'main.jl';
        mime = 'text/plain';
    } else if (!code.includes('<html') && !code.includes('<!DOCTYPE')) {
        filename = 'codigo.txt';
        mime = 'text/plain';
    }
    
    const blob = new Blob([currentRenderedCode], { type: mime });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
});

// ==========================================
// FUNCIÓN: DESCARGAR CÓDIGO COMO PROYECTO .ZIP (JSZip Inteligente)
// ==========================================
downloadZipBtn.addEventListener('click', () => {
    if (!lastAiResponse) {
        alert('No hay código generado para empaquetar. Por favor, realiza una consulta primero.');
        return;
    }

    try {
        const zip = new JSZip();
        
        // Expresión regular para detectar bloques de código Markdown: ```lenguaje código ```
        const regex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        let fileCount = 0;

        while ((match = regex.exec(lastAiResponse)) !== null) {
            const lang = (match[1] || '').toLowerCase();
            const code = match[2];
            let fileName = '';

            // Asignar nombre de archivo según el lenguaje detectado en el bloque
            switch (lang) {
                case 'html':
                case 'xml':
                    fileName = 'index.html';
                    break;
                case 'css':
                    fileName = 'style.css';
                    break;
                case 'javascript':
                case 'js':
                    fileName = 'script.js';
                    break;
                case 'python':
                case 'py':
                    fileName = 'main.py';
                    break;
                case 'latex':
                case 'tex':
                    fileName = 'main.tex';
                    break;
                case 'bib':
                    fileName = 'references.bib';
                    break;
                case 'r':
                    fileName = 'script.R';
                    break;
                case 'julia':
                case 'jl':
                    fileName = 'main.jl';
                    break;
                case 'markdown':
                case 'md':
                    fileName = 'README.md';
                    break;
                case 'json':
                    fileName = 'data.json';
                    break;
                default:
                    fileName = `archivo_${fileCount + 1}.txt`;
                    break;
            }

            // Añadir el archivo al ZIP (JSZip maneja automáticamente nombres duplicados si fuera necesario, 
            // pero aquí sobreescribirá si hay varios bloques del mismo tipo, lo cual es aceptable para un MVP)
            zip.file(fileName, code.trim());
            fileCount++;
        }

        if (fileCount === 0) {
            alert('No se detectaron bloques de código válidos en la respuesta para empaquetar.');
            return;
        }

        // Generar y descargar el ZIP
        zip.generateAsync({ type: "blob" }).then(function(content) {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = "Proyecto_Facil_con_AI.zip";
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log(`ZIP generado con éxito: ${fileCount} archivos incluidos.`);
        });

    } catch (error) {
        console.error('Error al generar el archivo ZIP:', error);
        alert('Hubo un error intentando comprimir tu proyecto.');
    }
});

// ==========================================
// FUNCIÓN: ABRIR CÓDIGO RENDERIZADO EN PESTAÑA NUEVA
// ==========================================
openNewTabBtn.addEventListener('click', () => {
    if (!currentRenderedCode) {
        alert('El Sandbox está vacío. Debes generar contenido primero usando a tu IA local.');
        return;
    }
    
    // Abrimos un tab en blanco
    const newWindow = window.open();
    if (newWindow) {
        // Documentamos e inyectamos el código actual completo
        newWindow.document.open();
        newWindow.document.write(currentRenderedCode);
        newWindow.document.close();
    } else {
        alert('Tu navegador bloqueó el popup emergente. Por favor permítelo para esta acción.');
    }
});

// ==========================================
// UX Formulario: Permitir Enter para enviar, y Shift+Enter para agregar salto de línea
// ==========================================
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault(); // Evitamos que ponga un enter en el text area natural e invocamos el envío
            sendButton.click();
        }
    }
});

// Adaptación automática simple de la altura de la caja de texto
promptInput.addEventListener('input', function() {
    this.style.height = '45px'; // Reinicio básico de tamaño
    this.style.height = (this.scrollHeight) + 'px'; // Expandir según nivel del texto
});

// ==========================================
// GESTOR DE MODELOS (MODAL)
// ==========================================

// Abrir modal
openModelManagerBtn.addEventListener('click', () => {
    modelManagerModal.classList.remove('hidden');
    loadModels();
});

// Cerrar modal
closeModelManagerBtn.addEventListener('click', () => {
    modelManagerModal.classList.add('hidden');
});

// Cerrar al hacer clic fuera del contenido
window.addEventListener('click', (e) => {
    if (e.target === modelManagerModal) {
        modelManagerModal.classList.add('hidden');
    }
});

/**
 * Carga los modelos instalados desde la API de Ollama y los muestra en el modal
 */
async function loadModels() {
    modelList.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Cargando modelos...</p>';

    const activeProviderNow = getActiveProvider();
    if (activeProviderNow.type !== 'ollama') {
        modelList.innerHTML = `<p style="padding: 20px; color: var(--text-secondary);">El gestor de instalación/eliminación de modelos solo aplica a <strong>Ollama</strong> (ahora usas <strong>${activeProviderNow.name}</strong>).<br><br>Los modelos de ${activeProviderNow.name} se gestionan desde el proveedor: pulsa 🌐 y usa <em>🔄 Cargar modelos</em> o añádelos manualmente.</p>`;
        return;
    }

    try {
        const response = await fetch(OLLAMA_BASE + '/api/tags', { mode: 'cors' });
        if (!response.ok) throw new Error('No se pudo conectar con Ollama');

        const data = await response.json();
        modelList.innerHTML = '';

        if (data.models && data.models.length > 0) {
            data.models.forEach(model => {
                // Convertir bytes a GB (1024^3)
                const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(2);
                
                const li = document.createElement('li');
                li.className = 'model-item';
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'model-info';
                infoDiv.innerHTML = `
                    <span class="model-name">${model.name}</span>
                    <span class="model-size">${sizeGB} GB</span>
                `;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-model-btn';
                deleteBtn.innerHTML = '🗑️ Eliminar';
                deleteBtn.addEventListener('click', () => deleteModel(model.name));
                
                li.appendChild(infoDiv);
                li.appendChild(deleteBtn);
                modelList.appendChild(li);
            });
        } else {
            modelList.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">No tienes modelos instalados.</p>';
        }
    } catch (error) {
        console.error('Error al cargar modelos:', error);
        modelList.innerHTML = '<p style="padding: 20px; color: #ff7b72;">Error al cargar la lista de modelos. Asegúrate de que Ollama esté activo.</p>';
    }
}

/**
 * Elimina un modelo de Ollama tras confirmación del usuario
 */
async function deleteModel(modelName) {
    const confirmed = confirm(`¿Estás completamente seguro de que deseas eliminar el modelo ${modelName}? Esta acción no se puede deshacer y liberará espacio en tu disco.`);
    
    if (!confirmed) return;

    try {
        const response = await fetch(OLLAMA_BASE + '/api/delete', {
            method: 'DELETE',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        if (response.ok) {
            alert(`¡El modelo ${modelName} ha sido eliminado con éxito!`);
            loadModels(); // Recargar lista
            fetchModels(); // Actualizar selector del header también
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al eliminar el modelo');
        }
    } catch (error) {
        console.error('Error al eliminar modelo:', error);
        alert('Hubo un error al intentar eliminar el modelo: ' + error.message);
    }
}


// ==========================================
// EXPORTAR CHAT A MARKDOWN Y PDF
// ==========================================
function getCurrentChatMarkdown() {
    const sessions = getChatSessions();
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || !session.messages || session.messages.length === 0) {
        return null;
    }
    let md = `# Chat — ${session.title || 'Sesión'}\n\n`;
    md += `*Exportado desde Fácil con AI Agent*\n\n---\n\n`;
    session.messages.forEach(m => {
        const role = m.role || (m.sender === 'user' ? 'user' : 'assistant');
        const content = m.content || m.text || '';
        if (role === 'user') {
            md += `## 👤 Usuario\n\n${content}\n\n`;
        } else {
            md += `## 🤖 Asistente\n\n${content}\n\n`;
        }
        md += '---\n\n';
    });
    return md;
}

if (exportMdBtn) {
    exportMdBtn.addEventListener('click', () => {
        const md = getCurrentChatMarkdown();
        if (!md) {
            alert('No hay mensajes en esta sesión para exportar.');
            return;
        }
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${currentSessionId || 'export'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
        const md = getCurrentChatMarkdown();
        if (!md) {
            alert('No hay mensajes en esta sesión para exportar.');
            return;
        }
        // Crear contenedor temporal limpio para html2pdf
        const container = document.createElement('div');
        container.style.cssText = 'padding:24px;font-family:system-ui,sans-serif;color:#111;background:#fff;max-width:800px;';
        container.innerHTML = `<h1 style="margin-bottom:8px;">Chat — Fácil con AI Agent</h1>
            <p style="color:#555;margin-bottom:24px;">Exportado localmente</p>`;
        
        const sessions = getChatSessions();
        const session = sessions.find(s => s.id === currentSessionId);
        (session.messages || []).forEach(m => {
            const role = m.role || (m.sender === 'user' ? 'user' : 'assistant');
            const content = (m.content || m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const block = document.createElement('div');
            block.style.cssText = 'margin-bottom:16px;padding:12px;border-radius:8px;border:1px solid #ddd;';
            block.innerHTML = `<strong style="display:block;margin-bottom:6px;">${role === 'user' ? '👤 Usuario' : '🤖 Asistente'}</strong>
                <pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:13px;">${content}</pre>`;
            container.appendChild(block);
        });
        
        document.body.appendChild(container);
        try {
            await html2pdf().set({
                margin: 10,
                filename: `chat_${currentSessionId || 'export'}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(container).save();
        } catch (err) {
            console.error(err);
            alert('Error al generar el PDF. Prueba exportar a Markdown.');
        } finally {
            document.body.removeChild(container);
        }
    });
}


// ==========================================
// REENVIAR ÚLTIMA PREGUNTA (cambiar modelo / reintentar)
// ==========================================
async function retryLastPrompt() {
    const src = lastFailedPrompt || lastUserPrompt;
    if (!src || !src.text) {
        alert('No hay una pregunta reciente para reenviar.');
        return;
    }
    if (isProcessingResponse) {
        alert('Espera a que termine la respuesta actual.');
        return;
    }

    const selectedModel = modelSelect.value;
    if (!selectedModel) {
        alert('Selecciona un modelo primero (abre 🌐 para elegir proveedor y cargar modelos).');
        return;
    }

    // Quitar burbujas de error de la UI
    const errorBubbles = chatHistory.querySelectorAll('.ai-msg');
    errorBubbles.forEach(b => {
        if (b.textContent.includes('No se pudo completar') ||
            b.textContent.includes('Petición detenida') ||
            b.textContent.includes('Hubo un error')) {
            b.remove();
        }
    });

    // El mensaje de usuario ya está en la sesión; no lo duplicamos
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.classList.add('message', 'ai-msg');
    aiMsgDiv.textContent = '⏳ Reenviando...';
    chatHistory.appendChild(aiMsgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    isProcessingResponse = true;
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    sendButton.textContent = '🛑 Detener';
    sendButton.title = 'Cancelar respuesta actual';
    sendButton.style.backgroundColor = '#ff7b72';
    promptInput.disabled = true;
    attachBtn.disabled = true;

    // Reconstruir mensajes de sesión (el user ya está guardado)
    const currentSession = getChatSessions().find(s => s.id === currentSessionId);
    let sessionMessages = [];
    if (currentSession && currentSession.messages) {
        sessionMessages = currentSession.messages.map(m => {
            const msgObj = {
                role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
                content: m.content || m.text
            };
            if (m.images && Array.isArray(m.images) && m.images.length > 0) msgObj.images = m.images;
            return msgObj;
        });
    }

    const currentMode = (modeSelect && modeSelect.value) || 'ciencias';
    // Reutilizar la misma lógica de system prompt vía un helper inline
    const systemPromptMessage = {
        role: 'system',
        content: (function() {
            // Leer el content del system prompt actual desde el select
            // (duplicamos las cadenas mínimas para no depender de scope interno del click)
            if (currentMode === 'web') {
                return `Eres Fácil con AI Agent, un desarrollador web experto.
REGLAS: Responde SIEMPRE con bloques Markdown (\`\`\`html, \`\`\`css, \`\`\`javascript). Prefiere HTML autocontenido o bloques separados listos para el sandbox. Si piden gráficas usa Chart.js vía CDN. NUNCA digas que no tienes internet.`;
            }
            return `Eres Fácil con AI Agent, experto en ciencias y programación científica.
Especialidades: LaTeX, Python, R, Julia y problemas de ciencias.
REGLAS: Empaqueta código en \`\`\`latex/\`\`\`python/\`\`\`r/\`\`\`julia. Explica paso a paso con fórmulas $...$ / $$...$$. NUNCA digas que no tienes internet.`;
        })()
    };

    const activeProvider = getActiveProvider();
    const stripImages = shouldStripImages(activeProvider, selectedModel);
    if (stripImages && sessionMessages.some(m => m.images && m.images.length > 0)) {
        if (installerStatus) {
            installerStatus.textContent = 'Aviso: este modelo no soporta imágenes; se envía solo el texto.';
            installerStatus.style.color = '#d29922';
        }
    }
    const apiMessages = buildApiMessages(sessionMessages, systemPromptMessage, stripImages);

    try {
        aiMsgDiv.innerHTML = '';
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = '';
        aiMsgDiv.appendChild(contentDiv);
        aiMsgDiv.style.color = '';

        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-msg-btn');
        copyBtn.title = 'Copiar respuesta';
        copyBtn.innerHTML = '📋';
        aiMsgDiv.appendChild(copyBtn);

        let aiResponseText = '';

        await streamChat(activeProvider, selectedModel, apiMessages, signal, (chunk) => {
            aiResponseText += chunk;
            contentDiv.textContent = aiResponseText;
            chatHistory.scrollTop = chatHistory.scrollHeight;
        });

        lastAiResponse = aiResponseText;
        lastFailedPrompt = null;

        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(aiResponseText);
                copyBtn.innerHTML = '✅';
                setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
            } catch (err) {
                const ta = document.createElement('textarea');
                ta.value = aiResponseText;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyBtn.innerHTML = '✅';
                setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
            }
        });

        highlightCodeInElement(contentDiv);
        if (window.renderMathInElement && !contentDiv.querySelector('pre')) {
            try {
                renderMathInElement(contentDiv, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\(', right: '\\\\)', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true}
                    ],
                    throwOnError: false
                });
            } catch (e) {}
        }

        await updateSandbox(aiResponseText);
        saveCodeToSession();
        saveMessage(aiResponseText, 'assistant');

    } catch (error) {
        if (error.name === 'AbortError') {
            aiMsgDiv.textContent = '🛑 Petición detenida por el usuario.';
            aiMsgDiv.style.color = 'var(--text-secondary)';
        } else {
            console.error(error);
            aiMsgDiv.innerHTML = '';
            aiMsgDiv.style.color = '#ff7b72';
            const errMsg = document.createElement('div');
            errMsg.className = 'message-content';
            errMsg.innerHTML = `❌ Reintento fallido con ${getActiveProvider().name}. Comprueba URL, clave y modelo.<br><small>${(error.message||'').replace(/</g,'&lt;')}</small>`;
            aiMsgDiv.appendChild(errMsg);
            const retryBtn = document.createElement('button');
            retryBtn.className = 'retry-btn';
            retryBtn.textContent = '🔄 Reenviar de nuevo';
            retryBtn.addEventListener('click', () => retryLastPrompt());
            aiMsgDiv.appendChild(retryBtn);
        }
    } finally {
        isProcessingResponse = false;
        currentAbortController = null;
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
        sendButton.title = '';
        sendButton.style.backgroundColor = '';
        promptInput.disabled = false;
        attachBtn.disabled = false;
        promptInput.focus();
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

// Persistencia del modo Ciencias/Web
if (modeSelect) {
    const savedMode = localStorage.getItem('facilMode');
    if (savedMode && (savedMode === 'ciencias' || savedMode === 'web')) {
        modeSelect.value = savedMode;
    }
    modeSelect.addEventListener('change', () => {
        localStorage.setItem('facilMode', modeSelect.value);
        // Feedback visual breve
        const badge = document.querySelector('.subtitle-badge');
        if (badge) {
            badge.textContent = modeSelect.value === 'web'
                ? 'Web · HTML · CSS · JS'
                : 'Ciencias · LaTeX · Python · R · Julia';
        }
    });
    // Inicializar badge
    const badge = document.querySelector('.subtitle-badge');
    if (badge && modeSelect.value === 'web') {
        badge.textContent = 'Web · HTML · CSS · JS';
    }
}


// ==========================================
// MODAL: SELECCIÓN Y CONFIGURACIÓN DE PROVEEDORES
// (OpenAI, Anthropic, Gemini, Ollama, LM Studio, OpenRouter,
//  9Router, FreeLLMAPI, OmniRoute, u otro compatible con OpenAI)
// ==========================================
const openProviderBtn = document.getElementById('openProviderBtn');
const closeProviderBtn = document.getElementById('closeProviderBtn');
const providerModal = document.getElementById('provider-modal');
const providerGrid = document.getElementById('providerGrid');
const providerForm = document.getElementById('providerForm');
const providerFormTitle = document.getElementById('providerFormTitle');
const providerUrlInput = document.getElementById('providerUrlInput');
const providerKeyInput = document.getElementById('providerKeyInput');
const toggleKeyBtn = document.getElementById('toggleKeyBtn');
const providerHint = document.getElementById('providerHint');
const providerModelInput = document.getElementById('providerModelInput');
const addProviderModelBtn = document.getElementById('addProviderModelBtn');
const manualModelList = document.getElementById('manualModelList');
const providerFormStatus = document.getElementById('providerFormStatus');
const saveProviderBtn = document.getElementById('saveProviderBtn');
const useProviderBtn = document.getElementById('useProviderBtn');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const backProviderBtn = document.getElementById('backProviderBtn');
const providerDocsLink = document.getElementById('providerDocsLink');
const providerBadge = document.getElementById('providerBadge');

let editingProviderId = null;

function setFormStatus(message, color) {
    if (!providerFormStatus) return;
    providerFormStatus.textContent = message || '';
    providerFormStatus.style.color = color || 'var(--text-secondary)';
}

function renderProviderGrid() {
    if (!providerGrid) return;
    providerGrid.innerHTML = '';

    PROVIDER_CATALOG.forEach(def => {
        const cfg = getProviderCfg(def.id);
        const isActive = providerConfig.activeId === def.id;

        const card = document.createElement('div');
        card.className = 'provider-card' + (isActive ? ' active' : '');

        const head = document.createElement('div');
        head.className = 'provider-card-head';
        const icon = document.createElement('span');
        icon.className = 'provider-icon';
        icon.textContent = def.icon;
        const name = document.createElement('span');
        name.className = 'provider-name';
        name.textContent = def.name;
        head.appendChild(icon);
        head.appendChild(name);
        if (isActive) {
            const tag = document.createElement('span');
            tag.className = 'provider-active-tag';
            tag.textContent = 'Activo';
            head.appendChild(tag);
        }

        const meta = document.createElement('div');
        meta.className = 'provider-meta';
        const needKeyState = def.needsKey && !cfg.apiKey && !cfg.keySkipped ? ' · sin clave' : '';
        meta.textContent = (cfg.baseUrl || def.baseUrl || 'URL personalizada') + (cfg.apiKey ? ' · 🔑' : needKeyState);

        const actions = document.createElement('div');
        actions.className = 'provider-card-actions';

        const cfgBtn = document.createElement('button');
        cfgBtn.type = 'button';
        cfgBtn.className = 'provider-cfg-btn';
        cfgBtn.textContent = '⚙️ Configurar';
        cfgBtn.addEventListener('click', () => openProviderForm(def.id));

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'provider-use-btn';
        useBtn.textContent = isActive ? '✔ En uso' : '✅ Usar';
        useBtn.disabled = isActive;
        useBtn.addEventListener('click', () => chooseProvider(def.id));

        actions.appendChild(cfgBtn);
        actions.appendChild(useBtn);
        card.appendChild(head);
        card.appendChild(meta);
        card.appendChild(actions);
        providerGrid.appendChild(card);
    });
}

function showProviderGrid() {
    editingProviderId = null;
    if (providerForm) providerForm.classList.add('hidden');
    if (providerGrid) providerGrid.classList.remove('hidden');
    renderProviderGrid();
}

function openProviderForm(id) {
    const def = PROVIDER_CATALOG.find(p => p.id === id);
    if (!def) return;
    const cfg = getProviderCfg(id);

    editingProviderId = id;
    if (providerGrid) providerGrid.classList.add('hidden');
    if (providerForm) providerForm.classList.remove('hidden');

    providerFormTitle.textContent = def.icon + ' ' + def.name;
    providerUrlInput.value = cfg.baseUrl || def.baseUrl || '';
    providerKeyInput.value = cfg.apiKey || '';
    providerKeyInput.type = 'password';
    providerHint.textContent = (def.hint || (def.needsKey
        ? 'Introduce tu API Key de ' + def.name + '.'
        : 'No requiere API key.')) + ' Déjala vacía si tu endpoint no exige clave.';
    providerModelInput.value = '';

    if (def.docs) {
        providerDocsLink.href = def.docs;
        providerDocsLink.textContent = '🔑 Conseguir API key / ver documentación';
        providerDocsLink.classList.remove('hidden');
    } else {
        providerDocsLink.classList.add('hidden');
        providerDocsLink.removeAttribute('href');
    }

    setFormStatus('');
    renderManualModels();
    providerForm.scrollTop = 0;
}

function renderManualModels() {
    if (!manualModelList) return;
    manualModelList.innerHTML = '';
    if (!editingProviderId) return;

    const models = getProviderCfg(editingProviderId).models || [];

    if (models.length === 0) {
        const li = document.createElement('li');
        li.className = 'manual-model-empty';
        li.textContent = 'Sin modelos guardados. Pulsa 🔄 Cargar modelos o añade uno manualmente.';
        manualModelList.appendChild(li);
        return;
    }

    models.forEach(name => {
        const li = document.createElement('li');
        li.className = 'manual-model-item';

        const span = document.createElement('span');
        span.textContent = name;

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'manual-model-del';
        del.textContent = '✕';
        del.title = 'Quitar "' + name + '"';
        del.addEventListener('click', () => {
            const cfg = Object.assign({}, getProviderCfg(editingProviderId));
            cfg.models = (cfg.models || []).filter(m => m !== name);
            providerConfig.providers[editingProviderId] = cfg;
            saveProviderConfig();
            renderManualModels();
            if (providerConfig.activeId === editingProviderId) fetchModels();
        });

        li.appendChild(span);
        li.appendChild(del);
        manualModelList.appendChild(li);
    });
}

function saveProviderForm() {
    if (!editingProviderId) return false;
    const cfg = Object.assign({}, getProviderCfg(editingProviderId));
    cfg.baseUrl = providerUrlInput.value.trim();
    cfg.apiKey = providerKeyInput.value.trim();
    // Guardar sin clave = el usuario indicó que su endpoint no la requiere
    cfg.keySkipped = !cfg.apiKey;
    if (!Array.isArray(cfg.models)) cfg.models = [];
    providerConfig.providers[editingProviderId] = cfg;
    saveProviderConfig();
    return true;
}

function addManualModel() {
    if (!editingProviderId) return;
    const name = providerModelInput.value.trim();
    if (!name) {
        setFormStatus('Escribe el nombre del modelo a añadir.', '#d29922');
        return;
    }
    const cfg = Object.assign({}, getProviderCfg(editingProviderId));
    cfg.models = Array.isArray(cfg.models) ? cfg.models.slice() : [];
    if (cfg.models.indexOf(name) === -1) cfg.models.push(name);
    providerConfig.providers[editingProviderId] = cfg;
    saveProviderConfig();

    providerModelInput.value = '';
    renderManualModels();
    if (providerConfig.activeId === editingProviderId) fetchModels();
    setFormStatus('✅ Modelo "' + name + '" añadido.', '#3fb950');
}

function chooseProvider(id) {
    if (editingProviderId === id && providerForm && !providerForm.classList.contains('hidden')) {
        if (!saveProviderForm()) return;
    }
    setActiveProvider(id);
    updateProviderBadge();
    if (providerModal) providerModal.classList.add('hidden');
    showProviderGrid();
    setProviderStatus('⏳ Conectando con ' + getActiveProvider().name + '…', 'var(--text-secondary)');
    fetchModels();
}

function toggleProviderModal() {
    if (!providerModal) return;
    if (providerModal.classList.contains('hidden')) {
        providerModal.classList.remove('hidden');
        showProviderGrid();
    } else {
        providerModal.classList.add('hidden');
    }
}

if (openProviderBtn) openProviderBtn.addEventListener('click', toggleProviderModal);
if (providerBadge) providerBadge.addEventListener('click', toggleProviderModal);
if (closeProviderBtn) closeProviderBtn.addEventListener('click', () => providerModal.classList.add('hidden'));
if (backProviderBtn) backProviderBtn.addEventListener('click', showProviderGrid);

if (providerModal) {
    providerModal.addEventListener('click', (e) => {
        if (e.target === providerModal) providerModal.classList.add('hidden');
    });
}

if (toggleKeyBtn) {
    toggleKeyBtn.addEventListener('click', () => {
        const showing = providerKeyInput.type === 'text';
        providerKeyInput.type = showing ? 'password' : 'text';
        toggleKeyBtn.textContent = showing ? '👁️' : '🙈';
    });
}

if (addProviderModelBtn) addProviderModelBtn.addEventListener('click', addManualModel);
if (providerModelInput) {
    providerModelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addManualModel();
        }
    });
}

if (saveProviderBtn) {
    saveProviderBtn.addEventListener('click', () => {
        if (!saveProviderForm()) return;
        renderManualModels();
        setFormStatus('💾 Guardado en este navegador.', '#3fb950');
        if (providerConfig.activeId === editingProviderId) {
            updateProviderBadge();
            fetchModels();
        }
    });
}

if (useProviderBtn) {
    useProviderBtn.addEventListener('click', () => {
        if (editingProviderId) chooseProvider(editingProviderId);
    });
}

if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener('click', async () => {
        if (!editingProviderId) return;
        if (!saveProviderForm()) return;

        const p = resolveProvider(editingProviderId);
        fetchModelsBtn.disabled = true;
        setFormStatus('⏳ Consultando modelos de ' + p.name + '...', 'var(--text-secondary)');
        try {
            const models = await listModelsForProvider(p);
            if (models && models.length > 0) {
                providerConfig.providers[p.id] = Object.assign({}, getProviderCfg(p.id), { models: models });
                saveProviderConfig();
                setFormStatus('✅ ' + models.length + ' modelos disponibles.', '#3fb950');
            } else {
                setFormStatus('El proveedor no devolvió modelos; añádelos manualmente.', '#d29922');
            }
            renderManualModels();
            if (providerConfig.activeId === p.id) fetchModels();
        } catch (err) {
            console.warn('Error listando modelos de ' + p.name + ':', err);
            setFormStatus('❌ ' + providerErrorHint(p, err), '#ff7b72');
        } finally {
            fetchModelsBtn.disabled = false;
        }
    });
}

updateProviderBadge();
