#!/bin/sh

rm -f ./env.js
touch ./env.js

# remove double or single quotes around values, if any
SERVER_URL=${SERVER_URL#\"}
SERVER_URL=${SERVER_URL%\"}
SERVER_URL=${SERVER_URL#\'}
SERVER_URL=${SERVER_URL%\'}

WEBSOCKET_SERVER_URL=${WEBSOCKET_SERVER_URL#\"}
WEBSOCKET_SERVER_URL=${WEBSOCKET_SERVER_URL%\"}
WEBSOCKET_SERVER_URL=${WEBSOCKET_SERVER_URL#\'}
WEBSOCKET_SERVER_URL=${WEBSOCKET_SERVER_URL%\'}

YJS_WEBSOCKET_SERVER_URL=${YJS_WEBSOCKET_SERVER_URL#\"}
YJS_WEBSOCKET_SERVER_URL=${YJS_WEBSOCKET_SERVER_URL%\"}
YJS_WEBSOCKET_SERVER_URL=${YJS_WEBSOCKET_SERVER_URL#\'}
YJS_WEBSOCKET_SERVER_URL=${YJS_WEBSOCKET_SERVER_URL%\'}

if [ -z "$YJS_WEBSOCKET_SERVER_URL" ]; then
  YJS_WEBSOCKET_SERVER_URL=$WEBSOCKET_SERVER_URL
fi

cat <<EOF > ./env.js
(function() {
  var serverUrl = '${SERVER_URL}';
  var websocketUrl = '${WEBSOCKET_SERVER_URL}';
  var yjsWebsocketUrl = '${YJS_WEBSOCKET_SERVER_URL}';

  window.env = {
    serverUrl: serverUrl,
    websocketServerUrl: websocketUrl,
    yjsWebsocketServerUrl: yjsWebsocketUrl,
  };

  window.__ENV__ = {
    SERVER_URL: serverUrl,
    WEBSOCKET_SERVER_URL: websocketUrl,
    YJS_WEBSOCKET_SERVER_URL: yjsWebsocketUrl,
  };
})();
EOF

exec "$@"
