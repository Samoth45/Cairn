# CLAUDE.local.md — spécificités de ce poste (non versionné)

Ce fichier est propre à chaque machine : il doit être dans `.gitignore`.
Version pour le poste **Windows** ; sur macOS/Linux, adapter ou supprimer.

- Si Docker répond « failed to connect to the docker API » : Docker Desktop n'est pas lancé
  (`C:\Program Files\Docker\Docker\Docker Desktop.exe`).
- Le shell Bash de l'outil gère mal certains heredocs longs contenant des apostrophes :
  créer les fichiers avec l'outil Write.
- **Git Bash convertit les chemins** : tout argument commençant par `/` devient un chemin
  Windows (`/app/x` → `C:/Program Files/Git/app/x`). Pour un chemin du conteneur passé à
  `docker compose run` / `docker run`, préfixer la commande par `MSYS_NO_PATHCONV=1` ou passer
  par `sh -c "…"` ; écrire les fichiers temporaires dans `/tmp` du conteneur, pas dans `/app`
  (= le projet). Incident du 17/11/2026 : `eslint -o /app/lint.json` a créé dans le projet un
  dossier nommé « C » + caractère spécial (affiché `C:`).
- **Jamais de motif ni de `rm` sur un nom qui ressemble à un lecteur** (`C:`, `"C"*`) : sous
  Git Bash, il peut désigner le vrai disque C:. Supprimer un nom bizarre avec PowerShell
  `Remove-Item -LiteralPath` sur un chemin complet vérifié comme étant dans le projet, et
  ne jamais enchaîner une suppression après une commande d'inspection.
