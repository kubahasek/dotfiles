# Dotfiles Migration Notes

This repo was reorganized into a Stow-friendly layout inspired by dmmulroy/.dotfiles.

- `home/` mirrors files that should be linked into `$HOME`.
- `packages/` contains Homebrew bundle files.
- `scripts/` contains setup/bootstrap scripts.
- `archive/stale-root/` contains old root-level dotfiles that differed from active `$HOME` files.

Sensitive/generated files are intentionally ignored in `.gitignore` and should be reviewed before committing.
