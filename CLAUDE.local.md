# CLAUDE.local.md — spécificités de ce poste (non versionné)

Ce fichier est propre à chaque machine : il doit être dans `.gitignore`.
Version pour le poste **Windows** ; sur macOS/Linux, adapter ou supprimer.

- Si Docker répond « failed to connect to the docker API » : Docker Desktop n'est pas lancé
  (`C:\Program Files\Docker\Docker\Docker Desktop.exe`).
- Le shell Bash de l'outil gère mal certains heredocs longs contenant des apostrophes :
  créer les fichiers avec l'outil Write.
