# Validation ARCANE

La préparation sépare les tests de logique, le rendu sans caméra et la recette avec une vraie webcam. Aucun geste réel n’est annoncé comme testé automatiquement.

## Contrôles reproductibles

```sh
npm ci
npm run check:publication
npm run lint
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

Les tests couvrent les tracés et interruptions Air Canvas, la simulation des effets et ses budgets, le pincement, la saisie Hologram, les modèles GLB, la cadence de suivi et Magic (paume ouverte, lissage, fondu, expiration et identité de main).

## Résultats locaux — 5 novembre 2026

- ARCANE : contrôle des fichiers publiables, lint, **85 tests** et build réussis. Vite conserve l’avertissement de taille du chunk Hologram différé.
- Chrome : les quatre modules s’ouvrent sans exception JavaScript. Aperçu Hologram visible, caméra désactivée. Captures bureau 1440 px et contrôle mobile 390 px sans débordement horizontal ; aucune validation gestuelle réelle.
- Ressources MediaPipe : requêtes HEAD HTTP 200 pour le WASM SIMD, son chargeur et le modèle distant. Cela vérifie leur disponibilité, sans prouver une inférence webcam complète.
- Portfolio existant avec la fiche ARCANE : lint, **5 tests**, build et contrôle de publication des sorties réussis. Les routes `/`, `/creative`, `/cv` et `/projets/eclipse-chess` répondent HTTP 200 en production locale ; les médias sont accessibles et les chemins privés renvoient 404.
- Fiche portfolio : rendus bureau et mobile contrôlés dans Chrome, sans exception JavaScript ni débordement horizontal. Les liens ARCANE attendent les URL publiques définitives.
- GitHub Actions : installation Linux, contrôle de publication, lint, 85 tests, audit de production et build réussis sur le commit initial publié.
- Vercel ARCANE : déploiement de production `READY`, page publique HTTP 200, en-têtes `nosniff`, `DENY` et caméra limitée à l’origine de l’application.
- Chrome sur la démo HTTPS : les quatre modules s’ouvrent, PixiJS indique WebGL prêt, le cristal Hologram est rendu. Aucune exception JavaScript, erreur de console, requête en échec ou réponse HTTP ≥ 400 pendant le contrôle. Pas de débordement horizontal à 768 et 390 px.
- MediaPipe depuis la démo : téléchargement effectif des chargeurs JS, des WASM SIMD et sans SIMD et du modèle `.task`, tous HTTP 200 ; en-têtes binaires WASM vérifiés. Aucune inférence avec webcam réelle n’est revendiquée.
- Portfolio : PR nº 10 fusionnée après réussite de la CI Quality et contrôle de l’aperçu protégé (fiche, image, liens, console et responsive). La mise en production fait l’objet d’un contrôle distinct après fusion.

## Recette avec une vraie webcam — à effectuer

Sur la démo HTTPS après publication autorisée, tester au minimum un navigateur Chromium de bureau, puis vérifier les appareils mobiles ciblés sans supposer leur compatibilité.

1. Autoriser puis refuser la caméra ; vérifier les messages, l’arrêt, l’annulation et le redémarrage. Tester une caméra occupée ou débranchée.
2. Hand Tracking : présenter une puis deux mains ; vérifier le miroir, le squelette, sa désactivation et l’alignement en plein écran.
3. Air Canvas : dessiner avec le pincement, relâcher et reprendre sans segment parasite. Essayer les pinceaux classiques, ruban, éclair et Cosmic Trail ; effacer puis changer de module et revenir.
4. Hologram : viser le cœur, pincer puis déplacer pour tourner ; relâcher pour figer. Pincer hors de la cible ne doit pas saisir. Importer un petit GLB autonome ; changer de modèle et retirer l’import.
5. Magic : ouvrir les quatre doigts et écarter le pouce ; vérifier l’apparition, la stabilité sur la paume immobile, le suivi lent et rapide et la disparition main fermée ou sortie du champ. Une seconde main ne doit pas voler l’orbe.
6. Pour chaque module : changer d’onglet, sortir la main, changer de mode, arrêter/redémarrer la caméra. Vérifier l’absence d’effet résiduel et de manipulation fantôme.
7. Comparer GPU automatique et CPU ; observer les FPS et la latence sur un appareil moins puissant. Relever navigateur, appareil, résolution et limites constatées.
8. Vérifier à 390, 768 et 1440 px, le plein écran, le zoom navigateur et la navigation clavier des commandes.

## Après publication autorisée

Vérifier l’URL publique finale, HTTP 200, les assets CSS/JS, le chargement des quatre modules, les téléchargements WASM/modèle, l’absence d’erreur JavaScript et les en-têtes caméra. Tester les liens GitHub/démo depuis le portfolio. Consigner séparément la recette webcam ci-dessus.

## Audit des dépendances — 5 novembre 2026

Lors de la publication initiale, l’audit npm de production ne signalait aucune vulnérabilité et l’audit complet signalait 7 entrées modérées dans la chaîne de développement `typescript-eslint → minimatch`. Elles correspondaient à [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), un risque d’amplification de motifs glob. Aucun motif fourni par un visiteur ne passe dans cette chaîne de lint.

La [passe de stabilisation](stabilization.md) corrige cette chaîne par un override limité à son consommateur typescript-estree, vérifié avec le parser typé. L’audit complet local ne signale désormais aucune vulnérabilité. Le correctif automatique qui rétrogradait typescript-eslint n’a pas été appliqué.
