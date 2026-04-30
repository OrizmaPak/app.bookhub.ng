// Runtime environment overrides for the dev client
(function generateRuntimeEnv() {
  var serverUrl = window.location.origin;
  var websocketUrl = "wss://".concat(window.location.host, "/ws");

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

