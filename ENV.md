# Local environment

Personal identity and contact values live in untracked `.env`.

## Setup

```sh
cp .env.example .env
$EDITOR .env
chmod 600 .env
```

Required before `./dot init`:

- `GIT_USER_NAME` — personal Git author name.
- `GIT_PERSONAL_EMAIL` — personal Git author email.

Optional:

- `GIT_WORK_NAME` — work Git author name; defaults to `GIT_USER_NAME`.
- `GIT_WORK_EMAIL` — work Git author email. Needed for work repos.

Required before `scripts/macos-defaults.sh`:

- `MAC_LOGINWINDOW_TEXT` — lock-screen recovery message. Put contact details here, not in tracked files.

`./dot init` reads `.env`, then writes identity-only Git configs under
`~/.config/dotfiles/`. `.env`, generated runtime state, auth files, and session
history are ignored by Git.

Validate before committing:

```sh
git check-ignore -v .env
git diff --cached
```
