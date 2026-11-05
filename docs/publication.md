# Publication ARCANE

Publication autorisée par l’utilisateur le 5 novembre 2026 : dépôt public `Sylcraft/arcane`, déploiement Vercel, vérification en ligne, puis PR sur le portfolio privé et fusion après validation des tests et de l’aperçu. Les interactions webcam nécessitent toujours un test réel séparé.

## Cibles

- GitHub : nouveau dépôt public proposé `Sylcraft/arcane`, branche `main`. Aucun dépôt ARCANE existant n’a été trouvé dans les dépôts accessibles lors de la préparation.
- Vercel : nouveau projet `arcane`, équipe `sylvains-projects-d0f6a75c` (`team_Z8JQqt6Xsz9qivFdRRJ0r3Nt`). L’URL réelle sera celle attribuée par Vercel, sans promesse sur la disponibilité de `arcane.vercel.app`.
- Portfolio : dépôt **privé** `Sylcraft/portfolio`, site existant https://portfolio.fictyverse.com/ ; préserver sa visibilité et son identité visuelle.

## Préparation locale

README, captures réelles sans caméra, documentation des modules, recette manuelle, exclusions Git/Vercel, contrôle des fichiers publiables et CI. Aucun compte, backend ou secret applicatif à configurer.

La fiche est intégrée localement au portfolio existant, dans `src/content/projects.ts`, avec ses liens centralisés dans `src/content/links.ts` et sa capture dans `public/images/professional/arcane-hologram.png`. Le composant de présentation et les styles sont conservés. Une copie de préparation est gardée dans `.publication/portfolio/`, exclue du dépôt ARCANE et du déploiement ; les fichiers privés `sources/` n’y sont pas copiés. Les URL de démo et de code ne seront activées qu’après création effective et vérification de leur destination.

## Ordre des opérations autorisées

1. Créer le dépôt public ARCANE, vérifier son nom et sa visibilité, puis envoyer uniquement les sources et ressources examinées (pas `node_modules`, `dist`, `.publication`, secrets ou configurations privées).
2. Créer/importer le projet Vercel dans l’équipe identifiée ; Node 24, preset Vite, `npm ci`, `npm run build`, sortie `dist`. Publier et vérifier la démo HTTPS.
3. Renseigner les URL retournées dans le README et les liens centralisés du portfolio ; proposer une branche et une PR sur le dépôt privé du portfolio, vérifier les contrôles puis publier sa mise à jour selon le périmètre approuvé. Un push peut déclencher automatiquement Vercel.

## Accès à finaliser

Le connecteur GitHub permet de consulter les dépôts et de préparer des modifications sur un dépôt existant, mais ne propose pas la création de dépôt. La session GitHub CLI existante est utilisable : une vérification réseau en lecture seule (`gh api user --jq .login`) confirme **Sylcraft**, malgré l’ancien nom affiché par le trousseau local. L’accès Vercel à l’équipe cible a été autorisé par l’utilisateur pendant la préparation. Ces accès ne valent pas accord de publication.

Les URL et résultats réels seront consignés après vérification. La validation gestuelle avec une vraie webcam reste manuelle, même après un déploiement réussi.
