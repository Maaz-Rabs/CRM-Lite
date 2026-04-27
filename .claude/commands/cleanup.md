Find and remove (frontend only — backend ko mat chedo):
- console.log statements (frontend src/ me)
- Unused imports
- Unused variables
- Commented-out code blocks

Rules (CI/CD safe):
1. Backend ke console.log NA hatao — wo operational logs hain (cron, server, DB pool, webhook)
2. CRA build CI=true me warnings ko errors banata hai — to har removal ke baad eslint chalao
3. React hooks `exhaustive-deps` warnings ko mat chedo — dependency add karne se behavior break ho sakta hai
4. Empty catch `} catch (err) {}` rakho — error swallow kar rahe hain par flow safe hai
5. JSDoc `/** */` aur section dividers `/* ── X ── */` mat hatao — wo documentation hain
6. CSS files (.css) me `/* */` comments mat chedo — wo legitimate CSS hain
7. Variable destructure me agar setter use ho raha hai par value nahi → `const [, setLoading] = useState()` use karo (delete mat karo)

Process:
1. `npx eslint src --ext .js,.jsx` chala ke list nikalo
2. `console.log` aur commented `// const/import/function...` patterns search karo
3. List dikha ke confirm karo before removing
4. Sab edits ke baad eslint dobara chalao — naya warning aaya to fix karo
5. `npm run build` (frontend) bhi run karo — CI=true ke saath fail na ho