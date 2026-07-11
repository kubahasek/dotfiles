if status is-interactive
    # Commands to run in interactive sessions can go here
end

# Add amp to PATH
set -U fish_user_paths $HOME/.local/bin $fish_user_paths
/opt/homebrew/bin/brew shellenv | source
starship init fish | source

# Auto-switch theme based on system appearance
set -l system_style (defaults read -g AppleInterfaceStyle 2>/dev/null)
if test "$system_style" = Dark
    omf theme robbyrussell
else
    omf theme clearance
end

alias lg=lazygit
alias nr="npm run"

fish_add_path ~/.opencode/bin
fish_add_path ~/.bun/bin
