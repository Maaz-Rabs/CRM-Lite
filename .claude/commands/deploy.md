1. Git pull from current branch
2. If pull reports merge conflicts, invoke @merge-resolver agent
   - Wait for agent to finish and return its report
   - If agent returns "unresolvable" for any file, stop and show the report; do not proceed
   - Otherwise continue — agent has already staged resolved files
3. Stage all remaining changed files
4. Generate a conventional commit message (feat/fix/refactor/docs)
   based on the actual changes but make it short adjust it in 10 words
   - If merge-resolver ran, append " (merged remote)" to the message
5. Show me the commit message and ask: "Push with this message? (yes/no)"
6. If I say no, ask me for new message
7. If I say yes, commit and push to origin
8. Don't explain anything, just do it
