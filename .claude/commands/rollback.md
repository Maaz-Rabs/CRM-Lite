Rollback the repository (local + GitHub) to a specific commit ID.

Usage: `/rollback <commit-id>`

1. Read the commit ID from the user's message (the argument after `/rollback`).
   - If no commit ID is provided, ask: "Which commit ID to roll back to?"
2. Verify the commit exists: `git cat-file -e <commit-id>`
   - If it does not exist, stop and show: "Commit <id> not found locally. Run `git fetch` first."
3. Show the target commit summary: `git log -1 --oneline <commit-id>`
4. Show the commits that will be discarded: `git log --oneline <commit-id>..HEAD`
5. Warn: "Force-push will rewrite GitHub history. Discarded commits are recoverable only via reflog."
6. Ask: "Rollback local + GitHub to <commit-id>? (yes/no)"
7. If no, stop.
8. If yes, run:
   - `git reset --hard <commit-id>`
   - `git push --force origin <current-branch>`
9. Confirm: "Rolled back to <commit-id> on local and origin/<branch>."
10. Don't explain anything else, just do it.
