#!/bin/zsh
set -euo pipefail

folder="$(osascript <<'APPLESCRIPT'
try
  POSIX path of (choose folder with prompt "Choose folder for Two-Column Dev workspace")
on error number -128
  return ""
end try
APPLESCRIPT
)"

[[ -n "$folder" ]] || exit 0

layout='{"direction":"horizontal","split":0.70,"children":[{"pane":{"surfaces":[{"type":"terminal","name":"Terminal 1","focus":true},{"type":"terminal","name":"Terminal 2"}]}},{"pane":{"surfaces":[{"type":"terminal","name":"Pi"},{"type":"terminal","name":"Docker"},{"type":"terminal","name":"Exec"}]}}]}'

cmux new-workspace --name "$(basename "$folder")" --cwd "$folder" --layout "$layout" --focus true
