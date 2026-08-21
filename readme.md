# Dotfiles

Personal macOS dotfiles managed with GNU Stow and a small `dot` helper.

## Layout

```txt
~/Developer/dotfiles/
├── dot                 # management CLI
├── home/               # mirrors files linked into $HOME
│   └── .config/        # app configs
├── packages/           # Homebrew Brewfiles
├── scripts/            # setup/bootstrap scripts
├── docs/               # notes
├── archive/            # old configs/backups not actively stowed
├── .omp/               # Oh My Pi config kept at repo root
└── .pi/                # kept at repo root for the pi agent runtime
```

## `dot` CLI

`dot` is a Bash CLI for installing, linking, updating, and diagnosing this
dotfiles setup. Run it directly from the repository:

```sh
./dot help
```

To make it available globally as `dot`:

```sh
./dot link
dot doctor
```

The link is created at `~/.local/bin/dot`. `~/.local/bin` must be in `PATH`.

### Requirements

- macOS
- Bash
- Git
- Internet access for Homebrew and package installation

Homebrew and tools listed in `packages/Brewfile` are installed by `dot init`.
GNU Stow is used to link files from `home/` into `$HOME`.

### Local environment

Machine-specific values, credentials, and identity data belong in `.env`,
which is not committed:

```sh
cp .env.example .env
$EDITOR .env
```

`dot init` uses these variables to generate local Git identity files under
`~/.config/dotfiles/`. See [ENV.md](ENV.md) for available variables and Git
identity routing.

### Commands

#### `dot init`

Bootstrap a new machine:

```sh
./dot init
```

It performs these steps:

1. Install Homebrew when missing.
2. Install packages from `packages/Brewfile`.
3. Offer to install each optional `packages/Brewfile.*` file.
4. link files from `home/` into `$HOME` with GNU Stow.
5. Generate local Git identity configs from `.env` when configured.
6. Run `pi update` when Pi is installed.
7. Run `dot doctor`.

Running `init` again is safe: Brew Bundle and Stow reconcile existing state.

#### `dot update`

Update an existing installation:

```sh
dot update
```

It pulls this repository with `git pull --ff-only`, optionally runs
`brew update`, applies `packages/Brewfile`, optionally runs `brew upgrade`,
restows dotfiles, updates Pi, optionally syncs Pi skills, then runs diagnostics.

Interactive prompts make package upgrades and skill synchronization opt-in.

#### `dot stow`

Create or refresh symlinks from `home/` into `$HOME`:

```sh
dot stow
```

Equivalent Stow operation:

```sh
stow --dir "$DOTFILES" --target "$HOME" --restow home
```

`home/` is the only directory intended to be stowed. `.pi/` and `.omp/`
remain at the repository root.

#### `dot unstow`

Remove symlinks created for the `home/` package without deleting source files:

```sh
dot unstow
```

#### `dot doctor`

Inspect installation health:

```sh
dot doctor
```

Checks include:

- availability of Git, Homebrew, Stow, Oh My Pi, Pi, Neovim, tmux, Node.js,
  npm, and Bun;
- required repository directories and `packages/Brewfile`;
- `.pi/` placement at the repository root;
- broken symlinks below `$HOME` up to three levels deep;
- whether `dot` is available in `PATH`;
- whether a `DOTFILES` override differs from the script location.

Missing optional tools produce warnings. Missing critical repository paths make
the command fail.

#### `dot link` and `dot unlink`

Expose or remove the CLI through `~/.local/bin`:

```sh
./dot link
dot unlink
```

`unlink` also removes an older `/usr/local/bin/dot` symlink when present. It
does not delete this repository.

#### `dot edit`

Open the repository in `$EDITOR`:

```sh
dot edit
```

When `EDITOR` is unset, VS Code's `code` command is used.

#### `dot package`

Manage entries in `packages/Brewfile`:

```sh
dot package list
dot package add brew ripgrep
dot package add cask ghostty
dot package remove ripgrep
dot package update
```

| Subcommand | Action |
| --- | --- |
| `list` | Print active, non-comment Brewfile entries. |
| `add <type> <name>` | Append a `brew`, `cask`, `tap`, `mas`, or `vscode` entry unless it already exists. |
| `remove <name>` | Remove entries containing the quoted name. Creates a timestamped Brewfile backup first. |
| `update` | Run `brew bundle --file packages/Brewfile`. |

`dot pkg` is an alias for `dot package`.

#### `dot pi`

Pi-specific helpers:

```sh
dot pi update
dot pi sync-skills
dot pi doctor
```

| Subcommand | Action |
| --- | --- |
| `update` | Run `pi update` from this repository. |
| `sync-skills` | Run the configured `sync-pocock-skills` Pi skill. |
| `doctor` | Run the standard `dot doctor` diagnostics. |

Pi must be installed for these commands.

#### Completions, help, and version

```sh
dot completions   # print a zsh completion function
dot help          # show command summary
dot version       # print CLI version
```

Save or source the completion output from your zsh completion setup.

### Configuration overrides

By default, `dot` treats the directory containing the script as the repository
root. Set `DOTFILES` to override it:

```sh
DOTFILES="$HOME/Developer/dotfiles" dot doctor
```

The override changes paths used for `home/`, `packages/Brewfile`, `.env`, and
`.pi/`. `dot doctor` warns when it differs from the script directory.

## Oh My Pi

This setup installs Oh My Pi via Homebrew (`can1357/tap/omp`) from `packages/Brewfile` and enables zsh completions when `omp` is available.

Oh My Pi's managed config lives at `.omp/agent/config.yml` in this repo. Runtime databases, logs, worktrees, and OAuth/account files under `.omp/` are ignored.

## AeroSpace keybinds

Karabiner maps `Caps Lock` to virtual `F18`, which opens AeroSpace's leader mode.
Press leader, release it, then press an action key. `Alt+;` remains available as a fallback leader.
`Fn+Caps Lock` provides normal Caps Lock functionality.

### Window focus and movement

| Key after leader | Action            |
| ---------------- | ----------------- |
| `H`              | Focus left        |
| `J`              | Focus down        |
| `K`              | Focus up          |
| `L`              | Focus right       |
| `Shift+H`        | Move window left  |
| `Shift+J`        | Move window down  |
| `Shift+K`        | Move window up    |
| `Shift+L`        | Move window right |

### Layout and size

| Key after leader | Action                                     |
| ---------------- | ------------------------------------------ |
| `/` or `T`       | Cycle tiled horizontal/vertical layout     |
| `,`              | Cycle accordion horizontal/vertical layout |
| `-`              | Shrink focused window by 50 px             |
| `=`              | Grow focused window by 50 px               |
| `Esc`            | Leave leader mode without an action        |

### Workspaces and monitors

| Key after leader    | Action                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `1`–`9`             | Focus workspace 1–9                                                               |
| `0`                 | Focus workspace 10                                                                |
| `Shift+1`–`Shift+9` | Move focused window to workspace 1–9                                              |
| `Shift+0`           | Move focused window to workspace 10                                               |
| `Tab`               | Switch to previous workspace                                                      |
| `M`                 | Focus next monitor                                                                |
| `Shift+M`           | Move focused window to next monitor and follow it                                 |
| `Shift+Tab`         | Move workspace to next monitor; no-op while fixed monitor assignments are enabled |

Workspaces 1–7 stay on whichever external display macOS marks as main. Workspaces 8–10 stay on built-in display.

### Service mode

Press leader, then `S`, then one of these keys:

| Service key | Action                                            |
| ----------- | ------------------------------------------------- |
| `R`         | Flatten/reset workspace tree                      |
| `F`         | Toggle focused window between floating and tiling |
| `Backspace` | Close all windows except focused window           |
| `Shift+H`   | Join focused window with window on left           |
| `Shift+J`   | Join focused window with window below             |
| `Shift+K`   | Join focused window with window above             |
| `Shift+L`   | Join focused window with window on right          |
| `Esc`       | Reload AeroSpace config and leave service mode    |
