# Boss Ladies Leaderboard — version hébergée (Vercel)

Classement en direct de l'équipe YouGC Academy (Setting & Closing), connecté
en lecture seule aux deux Google Sheets ("SUIVI CLOSING" et "SUIVI SETTING").
Aucune clé API Google requise : les deux fichiers sont partagés en
"Toute personne disposant du lien : Lecteur", et le site lit leurs données
via le point d'export CSV public de Google Sheets, à chaque clic sur
"Rafraîchir".

## Structure

- `index.html` — toute l'interface (design, avatars, hauts faits, feux
  d'artifice, égalités). Appelle `/api/data` pour récupérer les chiffres.
- `api/data.js` — fonction serverless Vercel qui va chercher les 16 onglets
  (9 closing + 7 setting) en direct sur Google Sheets et les met en forme.
- `lib/parse.mjs` — logique de lecture des onglets (CSV → chiffres).

## Déployer

1. Crée un nouveau dépôt sur GitHub (public ou privé, peu importe).
2. Mets-y tous les fichiers de ce dossier tels quels (glisser-déposer sur
   github.com fonctionne très bien pour un premier envoi).
3. Va sur vercel.com → "Add New" → "Project" → importe ce dépôt GitHub.
4. Aucune variable d'environnement à configurer, aucune commande de build à
   changer — laisse les réglages par défaut et clique "Deploy".
5. Une fois déployé, Vercel te donne une URL (ex.
   `boss-ladies-leaderboard.vercel.app`) — c'est le lien à partager avec
   l'équipe.

## Limite connue

Le "Nouveau record d'équipe" (meilleur mois all-time, toutes filles passées
et présentes confondues) n'est pas recalculé automatiquement dans cette
version : il demanderait de lire des lignes historiques masquées dans la
feuille "STATS CLOSING TEAM 2026", inaccessibles depuis un lien public. Tout
le reste (classement du mois, tous les autres hauts faits, avatars, feux
d'artifice, égalités) est 100% en direct.
