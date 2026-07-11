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

## Commands

```sh
./dot doctor
./dot stow
./dot init
./dot update
./dot edit
```

`home/` is the only directory intended to be stowed into `$HOME`.
The `.pi/` directory intentionally remains at the repository root.

## Oh My Pi

This setup installs Oh My Pi via Homebrew (`can1357/tap/omp`) from `packages/Brewfile` and enables zsh completions when `omp` is available.

Oh My Pi's managed config lives at `.omp/agent/config.yml` in this repo. Runtime databases, logs, worktrees, and OAuth/account files under `.omp/` are ignored.
