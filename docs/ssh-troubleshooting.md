# SSH Troubleshooting for Push Permission Issues

This document explains the most common cause of "permission denied" when pushing over SSH and how to fix it.

Summary
- If you added your public key under a repository's *Deploy keys* section, the key is read-only unless you explicitly checked *Allow write access*. Deploy keys are read-only by default.
- Best practice for personal development machines: add the public key to your GitHub *account* (Settings → SSH and GPG keys). Account SSH keys inherit your normal repository permissions and allow pushes according to your account permissions.

Best fix: add the key to your GitHub account
1. On GitHub, click your profile picture → Settings.
2. Select **SSH and GPG keys**.
3. Click **New SSH key**.
4. Give it a clear title, e.g. `MacBook Pro`.
5. In Terminal on your Mac, copy your public key:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

6. Paste the public key into GitHub's **Key** box.
7. Click **Add SSH key** (or **Confirm** if prompted).

Do NOT add the key under:
```
Repository → Settings → Deploy keys
```
Account SSH keys (Settings → SSH and GPG keys) are the correct place for personal development machines.

If you already added a deploy key (and you want to keep using a deploy key)
- Delete the deploy key and re-add it under the repository's **Deploy keys** section, checking **Allow write access** when you add it.
- Deploy keys are best used for CI or single-server access, not personal workstations shared across repositories.

Reload the SSH key on macOS
Run the agent and add the key to the agent/keychain:

```bash
# start the agent (if not already running)
eval "$(ssh-agent -s)"

# add key to macOS keychain (preferred on modern macOS)
ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# fallback if the above option isn't accepted
ssh-add ~/.ssh/id_ed25519

# confirm the private key is loaded
ssh-add -l -E sha256
```

Testing GitHub authentication

```bash
ssh -T git@github.com
```

A successful response looks like:

```
Hi <your-github-username>! You've successfully authenticated, but GitHub does not provide shell access.
```

(SSH connections to GitHub always use the user `git` in the connection; the greeting shows your account username.)

Confirm the remote URL in your repository

A common local error is a malformed remote URL. Check remotes with:

```bash
git remote -v
```

Valid SSH remote URL format (recommended):

```
origin  git@github.com:<owner>/<repo>.git (fetch)
origin  git@github.com:<owner>/<repo>.git (push)
```

If your remote looks like `github.com/owner/repo.git` (missing the `git@` and colon), update it:

```bash
git remote set-url origin git@github.com:your-user/your-repo.git
```

Alternative: use HTTPS remotes

If you prefer HTTPS, set the remote to an HTTPS URL and use a personal access token (PAT) when prompted:

```bash
git remote set-url origin https://github.com/your-user/your-repo.git
```

Test pushing safely

Create and push a test branch before pushing main:

```bash
git checkout -b ssh-permission-test
git push -u origin ssh-permission-test
```

If the push succeeds, you have push permissions. Then merge or push to main as appropriate.

Multiple SSH keys / multiple GitHub accounts

If you use multiple keys or multiple accounts on one machine, configure ~/.ssh/config to select the correct key per host. Example:

```text
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  UseKeychain yes
  AddKeysToAgent yes
```

Notes
- `ssh-add --apple-use-keychain` is macOS-specific. On Linux or other systems, `ssh-add ~/.ssh/id_ed25519` is the typical command.
- Deploy keys are scoped to a single repository. Account keys apply to whatever repos your account has permission to access.

References
- Managing deploy keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys
- Error: Permission denied (publickey): https://docs.github.com/en/authentication/troubleshooting-ssh/error-permission-denied-publickey
