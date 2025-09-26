
DIR="$(pwd)"

osascript <<EOF
tell application "Terminal"
  do script "cd '$DIR'; python3 -m http.server 8000; echo 'http.server 8000 exited'; exec $SHELL"
  delay 0.2
  do script "cd '$DIR'; python3 -m http.server 8001; echo 'http.server 8001 exited'; exec $SHELL"
  delay 0.2
  do script "cd '$DIR'; node server/index.js; echo 'node exited'; exec $SHELL"
  activate
end tell
EOF
