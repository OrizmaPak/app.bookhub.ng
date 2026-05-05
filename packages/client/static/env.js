// Runtime environment overrides for the dev client
(function generateRuntimeEnv() {
  var isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  var wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  var serverUrl = isLocalhost
    ? "".concat(window.location.protocol, "//").concat(window.location.hostname, ":43100")
    : window.location.origin;
  var websocketUrl = isLocalhost
    ? "".concat(wsProtocol, "://").concat(window.location.hostname, ":43334")
    : "".concat(wsProtocol, "://").concat(window.location.host, "/ws");

  window.env = {
    serverUrl: serverUrl,
    websocketServerUrl: websocketUrl,
    yjsWebsocketServerUrl: websocketUrl,
  };

  window.__ENV__ = {
    SERVER_URL: serverUrl,
    WEBSOCKET_SERVER_URL: websocketUrl,
    YJS_WEBSOCKET_SERVER_URL: websocketUrl,
  };
})();

