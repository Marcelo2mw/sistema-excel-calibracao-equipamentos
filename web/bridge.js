/* ---------------------------------------------------------------------------
 * bridge.js - transport layer between the page and the C# side.
 *
 * Do not edit this in day-to-day work. What you use is:
 *
 *     const sheets = await bridge.call('listSheets');
 *     bridge.on('selectionChanged', function (d) { ... });
 *
 * How it works: every call carries an id; C# answers with the same id, and that
 * is what lets the right Promise resolve. Events pushed by C# (never asked for)
 * arrive through a separate path, _event.
 *
 * The API is in English on purpose: it is the public contract that the app
 * author - and the AI assistant working alongside them - writes against.
 *
 * The wire field names below (acao, dados, erro, evento) are deliberately left
 * alone. They are the internal envelope, they never surface to the app author,
 * and they are bound to the [JsonProperty] names in Ponte/Envelope.cs by string.
 * Renaming one side without the other produces an app that loads and answers
 * nothing.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var pending = {};
  var listeners = {};
  var sequence = 0;

  function available() {
    return !!(window.chrome && window.chrome.webview);
  }

  /** Calls an action on the C# side and returns a Promise with the result. */
  function call(action, data) {
    return new Promise(function (resolve, reject) {
      if (!available()) {
        reject(new Error('Bridge unavailable: this page is not running inside the WebView2 host.'));
        return;
      }
      var id = 'c' + (++sequence);
      pending[id] = { resolve: resolve, reject: reject };
      window.chrome.webview.postMessage(JSON.stringify({
        id: id,
        acao: action,
        dados: data || {}
      }));
    });
  }

  /** Registers a listener for an event pushed by the C# side. */
  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  /** Called from C#. Resolves the Promise matching the id. */
  function _resolve(response) {
    var waiting = response && response.id ? pending[response.id] : null;
    if (!waiting) {
      if (response && !response.ok) console.error('[bridge]', response.erro);
      return;
    }
    delete pending[response.id];
    if (response.ok) waiting.resolve(response.dados);
    else waiting.reject(new Error(response.erro || 'Unknown error on the C# side.'));
  }

  /** Called from C#. Delivers the event to the registered listeners. */
  function _event(message) {
    var list = message ? listeners[message.evento] : null;
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](message.dados);
      } catch (e) {
        console.error('[bridge] listener for "' + message.evento + '" failed:', e);
      }
    }
  }

  window.bridge = {
    call: call,
    on: on,
    available: available,
    _resolve: _resolve,
    _event: _event
  };
})();
