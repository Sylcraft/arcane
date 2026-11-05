# Publication ARCANE — 5 novembre 2026

Publication autorisée par l’utilisateur : dépôt public, déploiement Vercel et intégration au portfolio existant par PR, après vérification de la CI et de son aperçu. Le dépôt du portfolio est conservé privé.

## Liens

- Code : https://github.com/Sylcraft/arcane
- Démo : https://arcane-six-mu.vercel.app/
- Portfolio : https://portfolio.fictyverse.com/#projets

## Livraison

Le dépôt ARCANE utilise `main`, un lockfile npm, Node 24 et une CI qui contrôle les fichiers publiables, le lint, les tests, l’audit de production et le build. Les 60 fichiers initiaux ont été examinés avant leur premier push. Les dépendances, sorties de build, environnements, clés et dossiers de travail privés sont exclus.

Le projet Vercel `arcane` est relié au dépôt GitHub, avec le preset Vite, `npm ci`, `npm run build` et la sortie `dist`. La version de production initiale a été construite à partir du commit `49b8e6d9d9c9bdf780fb2bddacee9a300d263b70` et a atteint l’état `READY`. Le domaine de production est public ; les prévisualisations et URL de déploiement restent protégées.

La fiche portfolio réutilise les contenus et styles existants : `src/content/projects.ts`, `src/content/links.ts` et une capture réelle sans caméra. La PR nº 10 a été fusionnée au commit `84f648e416d83b9534f2f7085ff08ac3239dd885` après réussite de la CI Quality et contrôle de son aperçu Vercel. L’aperçu a été consulté avec une authentification OIDC éphémère, sans lien partageable ni modification de ses protections.

## Vérifications

Voir [le compte rendu et la recette webcam](validation.md). Les vérifications de page, de rendu graphique et de téléchargement des ressources ne constituent pas un test réel des interactions webcam.

## Maintenance

Exécuter les contrôles de la CI avant chaque mise à jour. Un push sur `main` peut déclencher une nouvelle production Vercel. Pour le portfolio, continuer à utiliser une PR et vérifier son aperçu protégé avant fusion. Ne jamais copier les fichiers privés de travail ni des identifiants dans les sources, captures ou journaux publiés.
