---
description: Runtime setup for repository validation commands
---

# Runtime tools

The AI agent shell may not inherit the PATH configured for the VS Code integrated terminal. Before running Node.js or npm commands, prepend the host runtime paths and verify the tools:

```bash
PATH="/run/host/usr/bin:/run/host/bin:$PATH" node --version
PATH="/run/host/usr/bin:/run/host/bin:$PATH" npm --version
```

Use the same PATH prefix when running project checks, for example:

```bash
PATH="/run/host/usr/bin:/run/host/bin:$PATH" npm test
```

Do not assume `node` or `npm` is available from the agent's default PATH just because it works in the integrated terminal.
