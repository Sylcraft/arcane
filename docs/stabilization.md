# Stabilisation ARCANE et portfolio — préparation locale du 5 novembre 2026

Les corrections sont préparées sur deux branches locales, sans push ni PR. Les déploiements existants ont été examinés en lecture seule ; les nouvelles prévisualisations et mises en production attendent l’autorisation de publication.

## Accès depuis le portfolio

La démo répond HTTP 200. L’URL de la fiche est correcte, mais son action « Explorer la démo » se trouve dans un panneau de détails fermé par défaut ; le titre, l’image et la flèche ne sont pas des liens.

Le correctif réutilise le composant de projet et ses styles : action principale déclarée dans les contenus, bouton visible avant les détails, titre, capture et flèche cliquables. L’action d’Eclipse Chess conserve sa destination et son libellé. Les liens externes ouvrent un onglet isolé avec `noopener noreferrer`. Aucun iframe n’est ajouté.

Validation : cinq parcours réels dans Chrome depuis le portfolio corrigé en production locale — clic sur l’image, le titre, la flèche, le bouton, puis activation au clavier. Les détails restent fermés ; chaque parcours charge la démo publique et ses quatre boutons de module. Aucun débordement horizontal à 320, 390, 768 et 1440 px. La console du portfolio est sans erreur ni avertissement pendant ce contrôle.

## Magic

- L’expiration de 180 ms partait du début de l’inférence. Avec une inférence lente, le résultat pouvait déjà être expiré au moment du rendu. Le délai part maintenant de sa réception, comme pour Hologram.
- L’identité de la main était libérée dès sa disparition, ce qui permettait à une seconde main de reprendre l’orbe pendant le fondu. Elle est conservée jusqu’à l’extinction ; les identités ambiguës déclenchent également un fondu.
- Après une longue période sans rendu, l’ancien temps de frame pouvait rendre la réapparition instantanée. Une nouvelle apparition réinitialise cette référence temporelle.

Validation : tests de régression sur l’identité, les ambiguïtés et la réapparition. Un contrôle navigateur local utilise une vidéo produite par Canvas et des landmarks synthétiques avec une inférence volontairement bloquée 220 ms : l’orbe reste visible et se dissipe à la perte de la main simulée. Aucune webcam réelle n’a été utilisée.

## Audit des dépendances

L’audit initial compte **7 entrées modérées dans ARCANE et 8 dans le portfolio**, toutes reliées à [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), dans la chaîne `typescript-eslint → typescript-estree → minimatch`.

Le correctif npm impose **minimatch 11.0.1 uniquement sous `@typescript-eslint/typescript-estree`**, dans les deux projets. Les instances de minimatch 3 utilisées par ESLint et les autres extensions ne changent pas. Aucun changement de version d’ESLint, de Next.js, de TypeScript ou des bibliothèques applicatives ; un seul paquet transitif supplémentaire est nécessaire au moteur corrigé.

Il s’agit d’un changement majeur **transitif et circonscrit**, pas d’un simple patch. Le [changelog minimatch](https://raw.githubusercontent.com/isaacs/minimatch/v11.0.1/changelog.md) supprime notamment `makeRe` et `AST`, mais typescript-estree utilise seulement la fonction `minimatch` avec l’option `dot`, conservée dans la nouvelle version. Le lint typé est testé par l’API réelle de son parser avec `projectService.allowDefaultProject`, en complément du lint ordinaire. L’exécution Node 24 est compatible.

Après installation, les deux audits complets ne signalent **aucune vulnérabilité**. Les lockfiles enregistrent les binaires corrigés ; aucun avertissement n’est filtré. Les CI proposées rendent désormais l’audit complet bloquant dès le niveau modéré. L’override est temporaire : le retirer lorsque typescript-eslint publiera une dépendance compatible corrigée, après nouvelle vérification.

## Contrôles et réserves

- ARCANE : lint, **89 tests** et build réussis.
- Portfolio : lint, **6 tests**, build, contrôle des sorties publiables et contrôles HTTP réussis. Les routes, le CV, la galerie et les médias restent accessibles ; les chemins privés renvoient 404.
- Les quatre interfaces ARCANE ont été parcourues deux fois en production existante puis en build corrigé local ; PixiJS initialise WebGL et la scène Hologram monte et se démonte. Aucune erreur JavaScript ou réseau observée.
- Les déploiements existants ARCANE et portfolio sont `READY`. Ces résultats ne décrivent pas un déploiement des nouvelles corrections : les PR et leurs aperçus attendent l’accord utilisateur.
- **Avertissement conservé :** React Three Fiber 9.8.2 instancie `THREE.Clock`, déprécié par Three.js. La version publiée la plus récente de Fiber vérifiée est déjà celle installée. Le correctif dépend d’une version amont compatible ; aucun filtrage du message ni patch de `node_modules` n’est appliqué.
- **Avertissement conservé :** le chunk Hologram différé dépasse 500 ko (environ 938 ko minifiés / 252 ko gzip). Il est déjà chargé à la demande. Aucune hausse du seuil Vite pour cacher le message.
- Le statut de support d’ESLint 9 est signalé par npm ; une migration majeure du lint n’est pas mélangée à cette correction ciblée. L’audit ne relève plus de vulnérabilité dans sa chaîne installée.
- **Tests manuels restants :** gestes réels, qualité du suivi, éclairages variés, appareils mobiles physiques et fluidité GPU/CPU. Les tests synthétiques ne valident pas ces usages.

## Publication proposée

Après autorisation : pousser les deux branches, ouvrir les PR, vérifier leurs CI et aperçus Vercel, puis fusionner seulement si ces contrôles passent. Rejouer ensuite les parcours depuis le portfolio public et les quatre interfaces ARCANE. Conserver le dépôt du portfolio privé.
