

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# amp
export PATH="$HOME/.local/bin:$PATH"

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"
export PATH="$HOME/.config/herd-lite/bin:$PATH"
export PHP_INI_SCAN_DIR="$HOME/.config/herd-lite/bin:$PHP_INI_SCAN_DIR"

# Cave CLI
export PATH="$HOME/.local/bin:$PATH"

# Codex account helpers
alias codex-personal='CODEX_HOME="$HOME/.codex-personal" codex'
alias codex-work='CODEX_HOME="$HOME/.codex-work" codex'
# Oh My Pi (omp)
if command -v omp >/dev/null 2>&1; then
  eval "$(omp completions zsh)"
fi
