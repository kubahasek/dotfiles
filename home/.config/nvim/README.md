# Neovim Config

This is my personal [Neovim](https://neovim.io/) configuration, built on top of the [LazyVim](https://github.com/LazyVim/LazyVim) starter template.

## Setup Overview

- **Plugin Manager:** [lazy.nvim](https://github.com/folke/lazy.nvim)
- **Base Distro:** [LazyVim](https://github.com/LazyVim/LazyVim) (with the neo-tree extras from LazyVim)
- **Colorscheme:** **Vercel** — a custom colorscheme adapted from the Vercel Dark / Vercel Light themes in the [Zed editor](https://zed.dev/). Supports dark & light modes (toggle via `<leader>uCd` / `<leader>uCl`).
- **Formatter:** [prettierd](https://github.com/fsouza/prettierd) (daemonized Prettier, ~50× faster after first run). Only formats when a Prettier config is present in the project. Installed via Mason.

## Key Plugins & Extras

| Plugin | Purpose |
|---|---|
| [neo-tree.nvim](https://github.com/nvim-neo-tree/neo-tree.nvim) | File explorer (dotfiles visible by default) |
| [pi-nvim](https://github.com/carderne/pi-nvim) | Pi coding agent integration — send prompts, files, buffers, or selections directly to the Pi agent |
| [snacks.nvim](https://github.com/folke/snacks.nvim) | UI enhancements (scrolling disabled) |
| [conform.nvim](https://github.com/stevearc/conform.nvim) | Formatting (prettierd) |
| mini-starter | Dashboard / startup screen |
| prettier | Formatting for JS/TS/CSS/JSON/MD/etc. (via LazyVim extras) |

## Custom Keymaps

| Key | Mode | Action |
|---|---|---|
| `<C-y>` | Visual | Yank to system clipboard |
| `<C-p>` | Normal, Visual | Paste from system clipboard |
| `<S-C-p>` | Normal, Visual | Paste before cursor from system clipboard |
| `<leader>pp` | Normal | Pi: send prompt |
| `<leader>pf` | Normal | Pi: send file |
| `<leader>ps` | Visual | Pi: send selection |
| `<leader>pb` | Normal | Pi: send buffer |
| `<leader>pi` | Normal | Pi: ping |
| `<leader>uCd` | Normal | Switch to Vercel Dark |
| `<leader>uCl` | Normal | Switch to Vercel Light |

## Custom Options

- System clipboard is **disabled** (`clipboard = ""`) — clipboard operations use explicit keymaps instead.

## Structure

```
~/.config/nvim/
├── init.lua              # Entry point → requires "config.lazy"
├── lazyvim.json          # LazyVim extras configuration
├── stylua.toml           # Lua formatting config
├── colors/
│   └── vercel.lua        # Thin entry point for :colorscheme vercel
├── lua/
│   ├── config/
│   │   ├── lazy.lua      # Plugin bootstrap & lazy.nvim setup
│   │   ├── options.lua   # Editor options
│   │   ├── keymaps.lua   # Custom keymaps
│   │   └── autocmds.lua  # Autocommands (currently empty)
│   ├── plugins/
│   │   ├── neo-tree.lua          # neo-tree config (dotfiles visible)
│   │   ├── pi-nvim.lua           # Pi agent integration
│   │   ├── prettier.lua          # prettierd formatter setup
│   │   ├── snacks.lua            # snacks.nvim options
│   │   ├── vercel-colorscheme.lua # Vercel colorscheme + toggle keymaps
│   │   └── example.lua           # Example/disabled plugin specs (not loaded)
│   └── vercel/
│       └── init.lua      # Full Vercel colorscheme implementation
```
