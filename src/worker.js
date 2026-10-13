const AUTH = "https://api.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const G = "https://graph.instagram.com";
const SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages";

async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieVal(request, name) {
  const h = request.headers.get("Cookie") || "";
  for (const part of h.split(";")) {
    const p = part.trim();
    if (p.startsWith(name + "=")) return p.slice(name.length + 1);
  }
  return "";
}

const LOGIN_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elton Orvate - Acesso</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b0d;color:#f5f0e8;font-family:Georgia,'Times New Roman',serif}
.card{background:#121316;border:1px solid #2a2c31;border-radius:16px;padding:40px 36px;width:320px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#d4af6a;margin:0 0 6px;text-align:center}
p.sub{font-size:12px;color:#9a948a;text-align:center;margin:0 0 26px;letter-spacing:.08em}
label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9a948a;margin:14px 0 6px}
input{width:100%;box-sizing:border-box;background:#0d0e10;border:1px solid #2a2c31;border-radius:8px;color:#f5f0e8;padding:11px 12px;font-size:14px;outline:none}
input:focus{border-color:#d4af6a}
button{width:100%;margin-top:24px;background:linear-gradient(135deg,#d4af6a,#b8934a);border:none;border-radius:8px;color:#0a0b0d;font-weight:700;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:12px;cursor:pointer}
button:hover{filter:brightness(1.1)}
.err{color:#e06c5b;font-size:12px;margin-top:14px;text-align:center;min-height:14px}
.mono{text-align:center;color:#d4af6a;font-size:26px;letter-spacing:.3em;margin-bottom:2px}
</style></head><body><div class="card">
<div class="mono">EO</div>
<h1>Elton Orvate</h1>
<p class="sub">Painel de Gest&#227;&#227;o - Instagram</p>
<form id="f">
<label>E-mail</label><input id="u" type="email" autocomplete="username" required>
<label>Senha</label><input id="p" type="password" autocomplete="current-password" required>
<button type="submit">Entrar</button>
<div class="err" id="e"></div>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const r = await fetch('/panel/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: document.getElementById('u').value.trim(), password: document.getElementById('p').value }) });
  if (r.ok) { location.href = '/panel'; return; }
  document.getElementById('e').textContent = 'Usu\u00e1rio ou senha inv\u00e1lidos.';
});
</script></div></body></html>`;

async function publishCarousel(V, urls, caption) {
  const tok = await V.get("tok");
  if (!tok) return { ok: 0, error: "no token" };
  const children = [];
  for (const u of urls) {
    const r = await fetch(G + "/me/media", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: tok }).toString()
    }).then((x) => x.json());
    if (!r.id) return { ok: 0, error: "falha ao criar item", detail: r };
    children.push(r.id);
  }
  const cont = await fetch(G + "/me/media", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ caption: caption, media_type: "CAROUSEL", children: children.join(","), access_token: tok }).toString()
  }).then((x) => x.json());
  if (!cont.id) return { ok: 0, error: "falha ao criar container", detail: cont };
  const pub = await fetch(G + "/me/media_publish?creation_id=" + encodeURIComponent(cont.id) + "&access_token=" + encodeURIComponent(tok), { method: "POST" }).then((x) => x.json());
  return { ok: 1, result: pub };
}

async function waSend(text) {
  if (typeof DIGISAC_TOKEN === "undefined" || !DIGISAC_TOKEN) return { ok: 0, error: "digisac nao configurado" };
  const r = await fetch("https://beecont.digisac.app/api/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + DIGISAC_TOKEN },
    body: JSON.stringify({ text: text, type: "chat", serviceId: DIGISAC_SERVICE_ID, number: DIGISAC_NUMBER, dontOpenTicket: true, origin: "bot" })
  });
  let jr = null;
  try { jr = await r.json(); } catch (e) {}
  return { ok: r.ok ? 1 : 0, status: r.status, result: jr };
}

// ---------- GERADOR DE ARTE (SVG -> PNG via resvg-wasm) ----------
const ASSETS_BASE = "https://cdn.jsdelivr.net/gh/beefy-hub/eltonorvate-platform@main/assets";
const EO_GOLD = "#d4af6a";
const EO_CREAM = "#f5f0e8";
const EO_MUTE = "#9a948a";
const EO_BG = "#0a0b0d";
var module = { exports: {} };
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// wasm-binding.ts
var wasm_binding_exports = {};
__export(wasm_binding_exports, {
  Resvg: () => Resvg2,
  initWasm: () => initWasm
});
module.exports = __toCommonJS(wasm_binding_exports);

// wasm/dist/index.js
var wasm;
var heap = new Array(128).fill(void 0);
heap.push(void 0, null, true, false);
var heap_next = heap.length;
function addHeapObject(obj) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
function getObject(idx) {
  return heap[idx];
}
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
var WASM_VECTOR_LEN = 0;
var cachedUint8Memory0 = null;
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
var cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: () => {
  throw Error("TextEncoder not available");
} };
var encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
  return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
  const buf = cachedTextEncoder.encode(arg);
  view.set(buf);
  return {
    read: arg.length,
    written: buf.length
  };
};
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
var cachedInt32Memory0 = null;
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
var cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: () => {
  throw Error("TextDecoder not available");
} };
if (typeof TextDecoder !== "undefined") {
  cachedTextDecoder.decode();
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
  return instance.ptr;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
var BBoxFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_bbox_free(ptr >>> 0));
var BBox = class _BBox {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_BBox.prototype);
    obj.__wbg_ptr = ptr;
    BBoxFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    BBoxFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_bbox_free(ptr);
  }
  /**
  * @returns {number}
  */
  get x() {
    const ret = wasm.__wbg_get_bbox_x(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set x(arg0) {
    wasm.__wbg_set_bbox_x(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get y() {
    const ret = wasm.__wbg_get_bbox_y(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set y(arg0) {
    wasm.__wbg_set_bbox_y(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get width() {
    const ret = wasm.__wbg_get_bbox_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set width(arg0) {
    wasm.__wbg_set_bbox_width(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get height() {
    const ret = wasm.__wbg_get_bbox_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set height(arg0) {
    wasm.__wbg_set_bbox_height(this.__wbg_ptr, arg0);
  }
};
var RenderedImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_renderedimage_free(ptr >>> 0));
var RenderedImage = class _RenderedImage {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_RenderedImage.prototype);
    obj.__wbg_ptr = ptr;
    RenderedImageFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RenderedImageFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_renderedimage_free(ptr);
  }
  /**
  * Get the PNG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.renderedimage_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Get the PNG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.renderedimage_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Write the image data to Uint8Array
  * @returns {Uint8Array}
  */
  asPng() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.renderedimage_asPng(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the RGBA pixels of the image
  * @returns {Uint8Array}
  */
  get pixels() {
    const ret = wasm.renderedimage_pixels(this.__wbg_ptr);
    return takeObject(ret);
  }
};
var ResvgFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_resvg_free(ptr >>> 0));
var Resvg = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ResvgFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_resvg_free(ptr);
  }
  /**
  * @param {Uint8Array | string} svg
  * @param {string | undefined} [options]
  * @param {Array<any> | undefined} [custom_font_buffers]
  */
  constructor(svg, options, custom_font_buffers) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      var ptr0 = isLikeNone(options) ? 0 : passStringToWasm0(options, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len0 = WASM_VECTOR_LEN;
      wasm.resvg_new(retptr, addHeapObject(svg), ptr0, len0, isLikeNone(custom_font_buffers) ? 0 : addHeapObject(custom_font_buffers));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      this.__wbg_ptr = r0 >>> 0;
      return this;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the SVG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.resvg_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * Get the SVG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.resvg_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * Renders an SVG in Wasm
  * @returns {RenderedImage}
  */
  render() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_render(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return RenderedImage.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Output usvg-simplified SVG string
  * @returns {string}
  */
  toString() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_toString(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  *
  * Note: path bounding box are approx values.
  * @returns {BBox | undefined}
  */
  innerBBox() {
    const ret = wasm.resvg_innerBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  * This will first apply transform.
  * Similar to `SVGGraphicsElement.getBBox()` DOM API.
  * @returns {BBox | undefined}
  */
  getBBox() {
    const ret = wasm.resvg_getBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Use a given `BBox` to crop the svg. Currently this method simply changes
  * the viewbox/size of the svg and do not move the elements for simplicity
  * @param {BBox} bbox
  */
  cropByBBox(bbox) {
    _assertClass(bbox, BBox);
    wasm.resvg_cropByBBox(this.__wbg_ptr, bbox.__wbg_ptr);
  }
  /**
  * @returns {Array<any>}
  */
  imagesToResolve() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_imagesToResolve(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * @param {string} href
  * @param {Uint8Array} buffer
  */
  resolveImage(href, buffer) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(href, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.resvg_resolveImage(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(buffer));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      if (r1) {
        throw takeObject(r0);
      }
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
};
async function __wbg_load(module2, imports) {
  if (typeof Response === "function" && module2 instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module2, imports);
      } catch (e) {
        if (module2.headers.get("Content-Type") != "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module2.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module2, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module: module2 };
    } else {
      return instance;
    }
  }
}
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_new_28c511d9baebfa89 = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_values_839f3396d5aac002 = function(arg0) {
    const ret = getObject(arg0).values();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_196c84450b364254 = function() {
    return handleError(function(arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof obj === "string" ? obj : void 0;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
    const ret = new Array();
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
    const ret = getObject(arg0).push(getObject(arg1));
    return ret;
  };
  imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
function __wbg_init_memory(imports, maybe_memory) {
}
function __wbg_finalize_init(instance, module2) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module2;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
async function __wbg_init(input) {
  if (wasm !== void 0)
    return wasm;
  if (typeof input === "undefined") {
    input = new URL("index_bg.wasm", void 0);
  }
  const imports = __wbg_get_imports();
  if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) {
    input = fetch(input);
  }
  __wbg_init_memory(imports);
  const { instance, module: module2 } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module2);
}
var dist_default = __wbg_init;

// wasm-binding.ts
var initialized = false;
var initWasm = async (module_or_path) => {
  if (initialized) {
    throw new Error("Already initialized. The `initWasm()` function can be used only once.");
  }
  await dist_default(await module_or_path);
  initialized = true;
};
var Resvg2 = class extends Resvg {
  /**
   * @param {Uint8Array | string} svg
   * @param {ResvgRenderOptions | undefined} options
   */
  constructor(svg, options) {
    if (!initialized)
      throw new Error("Wasm has not been initialized. Call `initWasm()` function.");
    const font = options?.font;
    if (!!font && isCustomFontsOptions(font)) {
      const serializableOptions = {
        ...options,
        font: {
          ...font,
          fontBuffers: void 0
        }
      };
      super(svg, JSON.stringify(serializableOptions), font.fontBuffers);
    } else {
      super(svg, JSON.stringify(options));
    }
  }
};
function isCustomFontsOptions(value) {
  return Object.prototype.hasOwnProperty.call(value, "fontBuffers");
}

var RESVG_API = { initWasm: wasm_binding_exports.initWasm, Resvg: wasm_binding_exports.Resvg };

let RESVG_READY = null;
async function ensureResvg() {
  if (RESVG_READY) return RESVG_READY;
  RESVG_READY = (async () => {
    const wasmBuf = await fetch(ASSETS_BASE + "/index_bg.wasm").then((r) => {
      if (!r.ok) throw new Error("wasm indisponivel (" + r.status + ")");
      return r.arrayBuffer();
    });
    await RESVG_API.initWasm(wasmBuf);
    const fonts = [];
    for (const f of ["playfair-400.ttf", "playfair-700.ttf", "playfair-italic.ttf"]) {
      fonts.push(await fetch(ASSETS_BASE + "/" + f).then((r) => {
        if (!r.ok) throw new Error("fonte indisponivel (" + r.status + ")");
        return r.arrayBuffer();
      }));
    }
    return { fonts: fonts };
  })();
  return RESVG_READY;
}

function b64FromBytes(bytes) {
  let s = "";
  const CH = 32768;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

function bytesFromB64(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function escXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapLine(s, maxChars) {
  const words = String(s).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (t.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

async function filesIndex(V) {
  try { return JSON.parse(await V.get("f:index") || "{}"); } catch (e) { return {}; }
}

let SELO_B64 = null;
async function getSelo() {
  if (SELO_B64) return SELO_B64;
  const r = await fetch(ASSETS_BASE + "/selo-eo.png");
  if (!r.ok) throw new Error("selo indisponivel (" + r.status + ")");
  SELO_B64 = "data:image/png;base64," + b64FromBytes(new Uint8Array(await r.arrayBuffer()));
  return SELO_B64;
}

async function getFotoBytes(V, ref) {
  if (/^https?:\/\//.test(ref)) {
    const r = await fetch(ref);
    if (!r.ok) throw new Error("foto url inacessivel (" + r.status + ")");
    const ct2 = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (ct2.indexOf("image/") !== 0) throw new Error("a url nao eh uma imagem");
    return { bytes: new Uint8Array(await r.arrayBuffer()), ct: ct2 };
  }
  const name = String(ref).toLowerCase().replace(/^\/file\//, "");
  const buf = await V.get("f:" + name, { type: "arrayBuffer" });
  if (!buf) throw new Error("arquivo nao encontrado na biblioteca: " + name);
  const idx = await filesIndex(V);
  return { bytes: new Uint8Array(buf), ct: (idx[name] && idx[name].ct) || "image/png" };
}

async function buildArtSvg(V, b) {
  const titulo = String(b.titulo || "").trim() || "Analise do dia";
  const linhas = (Array.isArray(b.linhas) ? b.linhas : String(b.linhas || "").split("\n")).map((x) => String(x).trim()).filter(Boolean).slice(0, 5);
  const rodape = String(b.rodape || "").trim();
  const numero = String(b.numero || "").trim();
  let fotoUri = null;
  if (b.foto) {
    const f = await getFotoBytes(V, String(b.foto).trim());
    if (f.bytes.length > 6 * 1024 * 1024) throw new Error("foto maior que 6MB");
    fotoUri = "data:" + f.ct + ";base64," + b64FromBytes(f.bytes);
  }
  const selo = await getSelo();
  const W = 1080, H = 1350;
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">');
  p.push('<rect width="' + W + '" height="' + H + '" fill="' + EO_BG + '"/>');
  if (fotoUri) {
    p.push('<image width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice" xlink:href="' + fotoUri + '" href="' + fotoUri + '"/>');
    p.push('<linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.30"/><stop offset="0.45" stop-color="#000000" stop-opacity="0.72"/><stop offset="1" stop-color="#000000" stop-opacity="0.92"/></linearGradient>');
    p.push('<rect width="' + W + '" height="' + H + '" fill="url(#gd)"/>');
  }
  p.push('<rect x="36" y="36" width="' + (W - 72) + '" height="' + (H - 72) + '" fill="none" stroke="' + EO_GOLD + '" stroke-width="2"/>');
  p.push('<rect x="50" y="50" width="' + (W - 100) + '" height="' + (H - 100) + '" fill="none" stroke="' + EO_GOLD + '" stroke-width="1" opacity="0.35"/>');
  const kickY = fotoUri ? 620 : 158;
  const parts2 = [];
  parts2.push('<text x="90" y="' + kickY + '" font-family="Playfair Display" font-size="30" font-weight="700" fill="' + EO_GOLD + '" letter-spacing="6">ELTON ORVATE</text>');
  parts2.push('<text x="90" y="' + (kickY + 38) + '" font-family="Playfair Display" font-size="22" fill="' + EO_MUTE + '" letter-spacing="4">ANALISE DO DIA</text>');
  const titleLines = wrapLine(titulo, fotoUri ? 24 : 30);
  let y = kickY + 128;
  for (const ln of titleLines) {
    parts2.push('<text x="90" y="' + y + '" font-family="Playfair Display" font-size="62" font-weight="700" fill="' + EO_CREAM + '">' + escXml(ln) + "</text>");
    y += 78;
  }
  y += 26;
  let bulletCount = 0;
  for (const blt of linhas) {
    if (bulletCount >= 4 && fotoUri) break;
    const bl = wrapLine(blt, fotoUri ? 40 : 48);
    let first = true;
    for (const ln of bl) {
      if (first) parts2.push('<text x="90" y="' + y + '" font-family="Playfair Display" font-size="24" fill="' + EO_GOLD + '">&#8212;</text>');
      parts2.push('<text x="126" y="' + y + '" font-family="Playfair Display" font-size="38" fill="' + EO_CREAM + '">' + escXml(ln) + "</text>");
      y += 56;
      first = false;
    }
    y += 14;
    bulletCount++;
    if (y > H - 320) break;
  }
  if (rodape) {
    const rl = wrapLine(rodape, 46);
    let ry = H - 150 - (rl.length - 1) * 48;
    for (const ln of rl) {
      parts2.push('<text x="90" y="' + ry + '" font-family="Playfair Display" font-size="36" font-style="italic" fill="' + EO_GOLD + '">' + escXml(ln) + "</text>");
      ry += 48;
    }
  }
  parts2.push('<image x="' + (W - 268) + '" y="' + (H - 296) + '" width="172" height="172" xlink:href="' + selo + '" href="' + selo + '"/>');
  if (numero) parts2.push('<text x="90" y="' + (H - 96) + '" font-family="Playfair Display" font-size="26" fill="' + EO_MUTE + '" letter-spacing="3">' + escXml(numero) + "</text>");
  parts2.push("</svg>");
  return p.concat(parts2).join("");
}

async function generateArt(V, b) {
  const ready = await ensureResvg();
  const svg = await buildArtSvg(V, b);
  const resvg = new RESVG_API.Resvg(svg, {
    fitTo: { mode: "width", value: 1080 },
    background: EO_BG,
    font: { fontBuffers: ready.fonts, loadSystemFonts: false, defaultFontFamily: "Playfair Display" }
  });
  const png = resvg.render().asPng();
  const name = "art-" + Date.now() + ".png";
  await V.put("f:" + name, png);
  const idx = await filesIndex(V);
  idx[name] = { ct: "image/png", size: png.length || png.byteLength || 0, ts: Date.now() };
  await V.put("f:index", JSON.stringify(idx));
  return { ok: 1, name: name, url: (typeof BASE_URL !== "undefined" ? BASE_URL : "") + "/file/" + name };
}

function slugTags(tema) {
  const stop = ["de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "a", "o", "as", "os", "um", "uma", "para", "com", "que", "se", "ao", "aos"];
  return String(tema).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3 && stop.indexOf(w) < 0).slice(0, 4).map((w) => "#" + w[0].toUpperCase() + w.slice(1));
}

function buildCaption(b) {
  const tema = String(b.tema || "").trim();
  const bullets = (Array.isArray(b.bullets) ? b.bullets : String(b.bullets || "").split("\n")).map((x) => String(x).trim()).filter(Boolean).slice(0, 5);
  const tom = String(b.tom || "critico");
  const pergunta = String(b.pergunta || "").trim();
  let gancho;
  if (tom === "dados") gancho = "Numero nao tem lado. Tem consequencia. E esse aqui muda a conta de qualquer gestor:";
  else if (tom === "motivacional") gancho = "O Brasil nao precisa de mais promessa. Precisa de gestao. Veja o que isso significa na pratica:";
  else gancho = "Enquanto o debate politico gira em fofoca, quem empreende e quem paga conta sabe: o que importa e isso aqui:";
  const body = bullets.map((x) => "- " + x).join("\n");
  const tags = ["#EltonOrvate", "#MenosEstadoMaisEmpreendedor", "#PoliticaComNegocios"].concat(slugTags(tema)).concat(["#DireitaConservadora"]).join(" ");
  let cap = gancho + "\n\n" + (body ? body + "\n\n" : "");
  if (pergunta) cap += pergunta + "\n\n";
  cap += "Sou Elton Orvate: contador, DEV e empreendedor. Analiso politica com a mesma regua dos negocios: resultado.\n\nMe segue para acompanhar as proximas analises.\n\n" + tags;
  return cap;
}

async function runDue(V, dryRun) {
  const l = await V.list({ prefix: "s:" });
  const now = Date.now();
  const out = [];
  for (const k of l.keys) {
    const v = await V.get(k.name);
    let it;
    try { it = JSON.parse(v); } catch (e) { continue; }
    if (!it || typeof it !== "object") continue;
    if (it.status !== "agendado" || !it.run_at || it.run_at > now) continue;
    if (dryRun) { out.push({ id: k.name, due: 1, caption: (it.caption || "").slice(0, 60) }); continue; }
    const r = await publishCarousel(V, it.urls, it.caption);
    it.status = r.ok ? "publicado" : "erro";
    it.result = r;
    it.finished_at = Date.now();
    await V.put(k.name, JSON.stringify(it));
    out.push({ id: k.name, status: it.status });
  }
  return out;
}

addEventListener("scheduled", (event) => {
  event.waitUntil((async () => {
    const r = await runDue(PLATFORM_KV, false);
    console.log("cron runDue:", JSON.stringify(r));
  })());
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const V = PLATFORM_KV;
    const j = (r) => r.json();

    if (url.pathname === "/health") return Response.json({ ok: 1, svc: "beefyhub-ig" });

    // ---------- PAINEL ----------
    if (url.pathname === "/panel" || url.pathname === "/panel/") {
      const sess = cookieVal(request, "sess");
      const expect = await hmacHex(PANEL_PASSWORD, PANEL_USER + "|sess");
      if (!sess || sess !== expect) return Response.redirect(url.origin + "/panel/login", 302);
      const html = await V.get("panel:html");
      if (!html) return new Response("Painel ainda nao publicado (KV panel:html vazio).", { status: 503 });
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/panel/login") {
      if (request.method === "GET") return new Response(LOGIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const okUser = (body.user || "").trim().toLowerCase() === (PANEL_USER || "").toLowerCase();
        const okPass = body.password === PANEL_PASSWORD;
        if (!okUser || !okPass) return Response.json({ error: "invalid" }, { status: 401 });
        const token = await hmacHex(PANEL_PASSWORD, PANEL_USER + "|sess");
        return Response.json({ ok: 1 }, { headers: { "Set-Cookie": "sess=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400" } });
      }
      return new Response("method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/panel/api/")) {
      const sess = cookieVal(request, "sess");
      const expect = await hmacHex(PANEL_PASSWORD, PANEL_USER + "|sess");
      if (!sess || sess !== expect) return Response.json({ error: "unauthorized" }, { status: 401 });

      const tok = await V.get("tok");
      if (!tok) return Response.json({ error: "no token" }, { status: 401 });
      const T = encodeURIComponent(tok);

      if (url.pathname === "/panel/api/summary" && request.method === "GET") {
        const [me, limit, ins] = await Promise.all([
          fetch(G + "/me?fields=id,username,name,followers_count,follows_count,media_count,account_type&access_token=" + T).then(j),
          fetch(G + "/me/content_publishing_limit?access_token=" + T).then(j).catch(() => null),
          fetch(G + "/me/insights?metric=reach,accounts_engaged,total_interactions,follower_count,profile_views&period=day&access_token=" + T).then(j).catch(() => null)
        ]);
        return Response.json({ me, limit, insights: ins });
      }

      if (url.pathname === "/panel/api/media" && request.method === "GET") {
        const m = await fetch(G + "/me/media?fields=id,caption,media_type,media_product_type,permalink,timestamp&limit=12&access_token=" + T).then(j);
        const items = (m.data || []).slice(0, 8);
        const withIns = await Promise.all(items.map(async (it) => {
          if (it.media_product_type !== "FEED" && it.media_product_type !== "REELS") return it;
          const metric = it.media_product_type === "REELS" ? "likes,comments,reach,saved,shares,plays" : "likes,comments,reach,saved,shares";
          const ins = await fetch(G + "/" + it.id + "/insights?metric=" + metric + "&access_token=" + T).then(j).catch(() => null);
          return { ...it, insights: ins && ins.data ? ins.data : null };
        }));
        return Response.json({ data: withIns });
      }

      if (url.pathname === "/panel/api/comments" && request.method === "GET") {
        const mid = url.searchParams.get("media_id");
        if (!mid) return Response.json({ error: "informe media_id na query" }, { status: 400 });
        return Response.json(await fetch(G + "/" + mid + "/comments?fields=id,text,username,timestamp&access_token=" + T).then(j));
      }

      if (url.pathname === "/panel/api/reply" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.comment_id || !b.message) return Response.json({ error: "comment_id e message sao obrigatorios" }, { status: 400 });
        const r = await fetch(G + "/" + encodeURIComponent(b.comment_id) + "/replies", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ message: b.message, access_token: tok }).toString()
        }).then(j);
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/hide" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.comment_id) return Response.json({ error: "comment_id obrigatorio" }, { status: 400 });
        const r = await fetch(G + "/" + encodeURIComponent(b.comment_id) + "?access_token=" + T, { method: "DELETE" }).then(j);
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/queue" && request.method === "GET") {
        const l = await V.list({ prefix: "q:" });
        const items = await Promise.all(l.keys.map(async (k) => {
          const v = await V.get(k.name);
          try { return { id: k.name, ...JSON.parse(v) }; } catch (e) { return { id: k.name, raw: v }; }
        }));
        items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return Response.json({ data: items });
      }

      if (url.pathname === "/panel/api/wa-test" && request.method === "POST") {
        const r = await waSend("Beefy HUB IG: integracao WhatsApp ativa. Aprovacoes de pauta chegarao por aqui - responda APROVAR ou REJEITAR com o codigo.");
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/wa-approve" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.id || b.id.indexOf("q:") !== 0) return Response.json({ error: "id invalido" }, { status: 400 });
        const v = await V.get(b.id);
        if (!v) return Response.json({ error: "item nao encontrado" }, { status: 404 });
        let it;
        try { it = JSON.parse(v); } catch (e) { it = {}; }
        const code = b.id.slice(2);
        const resumo = (it.titulo || it.caption || it.tipo || "post").toString().slice(0, 80);
        const n = (it.urls || []).length;
        const msg = "APROVACAO DE POST - @eltonorvate\n\nPauta: " + resumo + "\nCodigo: " + code + "\nImagens: " + n +
          (it.descricao ? "\n\n" + String(it.descricao).slice(0, 200) : "") +
          "\n\nResponda:\nAPROVAR " + code + " - publica agora\nREJEITAR " + code + " - descarta";
        const r = await waSend(msg);
        return Response.json(r);
      }

      if (url.pathname === "/panel/api/files" && request.method === "GET") {
        return Response.json({ data: await filesIndex(V) });
      }

      if (url.pathname === "/panel/api/files" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const name = String(b.name || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
        const ct = String(b.ct || "");
        if (!name || !/^image\/(png|jpe?g|webp)$/.test(ct)) return Response.json({ error: "envie imagem png/jpg/webp com nome valido" }, { status: 400 });
        let bytes;
        try { bytes = bytesFromB64(String(b.data || "")); } catch (e) { return Response.json({ error: "base64 invalido" }, { status: 400 }); }
        if (!bytes.length || bytes.length > 12 * 1024 * 1024) return Response.json({ error: "arquivo vazio ou maior que 12MB" }, { status: 400 });
        await V.put("f:" + name, bytes);
        const idx = await filesIndex(V);
        idx[name] = { ct: ct, size: bytes.length, ts: Date.now() };
        await V.put("f:index", JSON.stringify(idx));
        return Response.json({ ok: 1, name: name, url: (typeof BASE_URL !== "undefined" ? BASE_URL : url.origin) + "/file/" + name });
      }

      if (url.pathname === "/panel/api/files/delete" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const name = String(b.name || "").toLowerCase();
        if (!name || name.indexOf("/") >= 0) return Response.json({ error: "nome invalido" }, { status: 400 });
        await V.delete("f:" + name);
        const idx = await filesIndex(V);
        delete idx[name];
        await V.put("f:index", JSON.stringify(idx));
        return Response.json({ ok: 1 });
      }

      if (url.pathname === "/panel/api/art" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        try {
          return Response.json(await generateArt(V, b));
        } catch (e) {
          return Response.json({ error: String(e && e.message || e).slice(0, 200) }, { status: 500 });
        }
      }

      if (url.pathname === "/panel/api/caption" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        return Response.json({ ok: 1, caption: buildCaption(b) });
      }

      if (url.pathname === "/panel/api/queue/action" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.id || !b.action) return Response.json({ error: "id e action sao obrigatorios" }, { status: 400 });
        const v = await V.get(b.id);
        if (!v) return Response.json({ error: "item nao encontrado" }, { status: 404 });
        let item;
        try { item = JSON.parse(v); } catch (e) { item = {}; }
        item.status = b.action === "approve" ? "aprovado" : "rejeitado";
        item.decided_at = Date.now();
        await V.put(b.id, JSON.stringify(item));
        return Response.json({ ok: 1, item });
      }

      if (url.pathname === "/panel/api/publish" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.urls || !b.urls.length || !b.caption) return Response.json({ error: "urls e caption sao obrigatorios" }, { status: 400 });
        if (b.urls.length < 2) return Response.json({ error: "carrossel precisa de no minimo 2 imagens" }, { status: 400 });
        const children = [];
        for (const u of b.urls) {
          const r = await fetch(G + "/me/media", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: tok }).toString()
          }).then(j);
          if (!r.id) return Response.json({ error: "falha ao criar item", detail: r }, { status: 500 });
          children.push(r.id);
        }
        const cont = await fetch(G + "/me/media", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ caption: b.caption, media_type: "CAROUSEL", children: children.join(","), access_token: tok }).toString()
        }).then(j);
        if (!cont.id) return Response.json({ error: "falha ao criar container", detail: cont }, { status: 500 });
        const pub = await fetch(G + "/me/media_publish?creation_id=" + encodeURIComponent(cont.id) + "&access_token=" + T, { method: "POST" }).then(j);
        return Response.json({ ok: 1, result: pub });
      }

      if (url.pathname === "/panel/api/schedule" && request.method === "GET") {
        const l = await V.list({ prefix: "s:" });
        const items = await Promise.all(l.keys.map(async (k) => {
          const v = await V.get(k.name);
          try { return { id: k.name, ...JSON.parse(v) }; } catch (e) { return { id: k.name, raw: v }; }
        }));
        items.sort((a, b) => (a.run_at || 0) - (b.run_at || 0));
        return Response.json({ data: items, now: Date.now() });
      }

      if (url.pathname === "/panel/api/schedule" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.urls || !b.urls.length || !b.caption || !b.run_at) return Response.json({ error: "urls, caption e run_at sao obrigatorios" }, { status: 400 });
        const id = "s:" + Date.now();
        const item = { urls: b.urls, caption: b.caption, run_at: Number(b.run_at), status: "agendado", created_at: Date.now() };
        await V.put(id, JSON.stringify(item));
        return Response.json({ ok: 1, id, item });
      }

      if (url.pathname === "/panel/api/schedule/delete" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (!b.id || b.id.indexOf("s:") !== 0) return Response.json({ error: "id invalido" }, { status: 400 });
        await V.delete(b.id);
        return Response.json({ ok: 1 });
      }

      if (url.pathname === "/panel/api/schedule/run-now" && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const r = await runDue(V, !!b.dry_run);
        return Response.json({ ran: r });
      }

      return Response.json({ error: "rota nao encontrada" }, { status: 404 });
    }

    if (url.pathname === "/auth") {
      const st = crypto.randomUUID();
      await V.put("st:" + st, "1", { expirationTtl: 600 });
      const a = new URL(AUTH);
      a.searchParams.set("client_id", IG_APP_ID);
      a.searchParams.set("redirect_uri", BASE_URL + "/callback");
      a.searchParams.set("scope", SCOPES);
      a.searchParams.set("response_type", "code");
      a.searchParams.set("state", st);
      return Response.redirect(a.toString(), 302);
    }

    if (url.pathname === "/callback") {
      // Se ja existe token, nao reprocessa o code (evita "code has been used" ao atualizar a pagina)
      if (await V.get("tok")) return Response.redirect(url.origin + "/", 302);
      const code = url.searchParams.get("code");
      const st = url.searchParams.get("state");
      if (!code) return new Response("no code", { status: 400 });
      if (!await V.get("st:" + st)) return new Response("bad state", { status: 400 });
      const t = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: BASE_URL + "/callback", code }).toString()
      }).then(j);
      if (!t.access_token) return new Response("TOKEN FAIL: " + JSON.stringify(t), { status: 500 });
      const l = await fetch(G + "/access_token?grant_type=ig_exchange_token&client_secret=" + IG_APP_SECRET + "&access_token=" + encodeURIComponent(t.access_token)).then(j);
      if (!l.access_token) return new Response("LONG FAIL: " + JSON.stringify(l), { status: 500 });
      await V.put("tok", l.access_token, { expirationTtl: (l.expires_in || 5184000) - 3600 });
      const m = await fetch(G + "/me?fields=id,username,name,followers_count,follows_count,media_count,account_type&access_token=" + encodeURIComponent(l.access_token)).then(j);
      await V.put("user", JSON.stringify(m));
      return new Response("CONECTADO: " + JSON.stringify(m));
    }

    if (url.pathname === "/api/me") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      return Response.json(await fetch(G + "/me?fields=id,username,followers_count,media_count&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/media") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      return Response.json(await fetch(G + "/me/media?fields=id,caption,media_type,permalink,timestamp&limit=12&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/comments") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      const mid = url.searchParams.get("media_id");
      if (!mid) return Response.json({ error: "informe media_id na query" }, { status: 400 });
      return Response.json(await fetch(G + "/" + mid + "/comments?fields=id,text,username,timestamp&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/publishing-limit") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      return Response.json(await fetch(G + "/me/content_publishing_limit?access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/api/insights") {
      const t = await V.get("tok");
      if (!t) return Response.json({ error: "no token" }, { status: 401 });
      const mid = url.searchParams.get("media_id");
      const target = mid || "me";
      const metric = mid ? "likes,comments,reach,saved,shares" : "reach,accounts_engaged,total_interactions,follower_count,profile_views";
      const apiUrl = G + "/" + target + "/insights?metric=" + metric + (mid ? "" : "&period=day");
      return Response.json(await fetch(apiUrl + "&access_token=" + encodeURIComponent(t)).then(j));
    }

    if (url.pathname === "/webhook") {
      if (request.method === "GET") {
        const m = url.searchParams.get("hub.mode"), t = url.searchParams.get("hub.verify_token"), c = url.searchParams.get("hub.challenge");
        if (m === "subscribe" && t === WEBHOOK_VERIFY_TOKEN) return new Response(c);
        return new Response("forbidden", { status: 403 });
      }
      if (request.method === "POST") {
        const ev = await request.json().catch(() => null);
        if (ev) await V.put("webhook:" + Date.now(), JSON.stringify(ev), { expirationTtl: 86400 });
        return Response.json({ ok: 1 });
      }
      return new Response("method not allowed", { status: 405 });
    }

    if (url.pathname === "/digisac" && request.method === "POST") {
      const ev = await request.json().catch(() => null);
      await V.put("wa:" + Date.now(), JSON.stringify(ev), { expirationTtl: 86400 });
      const msg = (ev && (ev.data || ev.message)) || ev || {};
      const num = String(msg.number || msg.from || "").replace(/\D/g, "");
      const admin = String(typeof DIGISAC_NUMBER !== "undefined" ? DIGISAC_NUMBER : "").replace(/\D/g, "");
      if (!admin || !num.endsWith(admin)) return Response.json({ ok: 0, error: "numero nao autorizado" }, { status: 403 });
      const text = String(msg.text || msg.body || "").trim();
      const m = text.match(/^(APROVAR|REJEITAR)\s*(\S+)?/i);
      if (!m) return Response.json({ ok: 0, error: "comando nao reconhecido" }, { status: 400 });
      const action = m[1].toLowerCase() === "aprovar" ? "approve" : "reject";
      let id = m[2] ? (m[2].indexOf("q:") === 0 ? m[2] : "q:" + m[2]) : null;
      if (!id) {
        const l = await V.list({ prefix: "q:" });
        const items = await Promise.all(l.keys.map(async (k) => {
          const v = await V.get(k.name);
          let it2;
          try { it2 = JSON.parse(v); } catch (e) { it2 = null; }
          return it2 ? { id: k.name, ...it2 } : null;
        }));
        const pend = items.filter(x => x && (x.status === "pendente" || !x.status)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
        if (!pend.length) { await waSend("Nenhuma pauta pendente de aprovacao."); return Response.json({ ok: 0, error: "nenhum pendente" }); }
        id = pend[0].id;
      }
      const v = await V.get(id);
      if (!v) { await waSend("Item " + id + " nao encontrado. Verifique o codigo."); return Response.json({ ok: 0, error: "nao encontrado" }, { status: 404 }); }
      let item;
      try { item = JSON.parse(v); } catch (e) { item = {}; }
      if (action === "reject") {
        item.status = "rejeitado";
        item.decided_at = Date.now();
        await V.put(id, JSON.stringify(item));
        await waSend("Rejeitado (" + id + "). A pauta foi descartada.");
        return Response.json({ ok: 1, id, status: "rejeitado" });
      }
      item.status = "aprovado";
      item.decided_at = Date.now();
      if (item.urls && item.urls.length && item.caption) {
        const r = await publishCarousel(V, item.urls, item.caption);
        item.status = r.ok ? "publicado" : "erro";
        item.result = r;
        item.finished_at = Date.now();
        await V.put(id, JSON.stringify(item));
        await waSend(r.ok ? ("Publicado no Instagram: " + id) : ("Falha ao publicar " + id + ": " + JSON.stringify(r.error || r).slice(0, 150)));
        return Response.json({ ok: 1, id, status: item.status });
      }
      await V.put(id, JSON.stringify(item));
      await waSend("Aprovado (" + id + "). Sem artes anexadas - aguardando publicacao pelo painel.");
      return Response.json({ ok: 1, id, status: "aprovado" });
    }

    if (url.pathname.indexOf("/file/") === 0 && request.method === "GET") {
      const name = url.pathname.slice(6).toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) return new Response("invalid", { status: 400 });
      const buf = await V.get("f:" + name, { type: "arrayBuffer" });
      if (!buf) return new Response("not found", { status: 404 });
      const idx = await filesIndex(V);
      const meta = idx[name];
      return new Response(buf, { headers: { "Content-Type": (meta && meta.ct) || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
    }

    const sv = await V.get("user");
    return new Response("Beefy HUB IG | plataforma @eltonorvate | conta: " + (sv || "nenhuma") + " | rotas: /panel /auth /callback /api/me /api/media /api/comments /api/insights /api/publishing-limit /health /webhook");
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
