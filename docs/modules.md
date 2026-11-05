# ARCANE — V3 / Hologram

Application expérimentale de suivi de deux mains par webcam, sans backend : vue miroir, 21 landmarks et connexions par main, squelette activable, télémétrie et interface responsive.

## Importer un modèle personnel dans Hologram

Dans **Hologram**, cliquer **Importer un GLB**, choisir un fichier `.glb` autonome glTF 2.0 et attendre son chargement. Le sélecteur permet de retrouver le cristal et les fichiers importés ; **Retirer** enlève le modèle sélectionné. Les fichiers restent en mémoire pour la session, sans envoi ni sauvegarde persistante.

Le cadrage utilise la sphère englobante du modèle : centrage, proportions conservées et taille adaptée, même pendant la rotation. Le pincement et la rotation existants sont réutilisés. Après un changement de modèle, ouvrir les doigts avant de saisir à nouveau.

Les matériaux sont remplacés par une surface holographique avec transparence, lumière, balayage animé et réaction à la saisie. Les textures originales ne sont pas décodées. Les géométries Draco et Meshopt sont prises en charge via Three.js, sans nouvelle dépendance. Les décodeurs Draco sont servis localement par Vite à la demande. Les animations embarquées ne sont pas jouées automatiquement ; les caméras et lumières importées sont ignorées.

Limites : **64 Mio**, **un million de triangles**, **2 000 maillages**. Les références à des fichiers externes sont refusées : exporter un GLB autonome. Les états de chargement et erreurs sont affichés ; un échec laisse un cristal de secours et permet une nouvelle sélection.

Seul le modèle sélectionné est chargé graphiquement. Les chargements sont sérialisés et les résultats annulés sont libérés. Géométries, matériaux, textures éventuelles, squelettes, buffers d’instances et workers Draco sont nettoyés au remplacement ou au démontage. Le chargeur GLB est chargé à la demande et aucune mise à jour React par frame n’est ajoutée.

Fichiers principaux : `HologramModels.tsx` et `hologramAssets.ts` pour l’import/sélection ; `ImportedHologram.tsx` et `hologramModel.ts` pour le chargement et le shader ; `glbValidation.ts` et `modelResources.ts` pour la validation, le cadrage et les ressources. `tests/glb.test.mjs` teste de vrais binaires GLB, les annulations et le nettoyage.

Pour tester : importer un modèle personnel, vérifier centrage/proportions/rendu, viser, pincer, tourner et relâcher. Importer un second modèle de taille différente, alterner avec le cristal, changer pendant une saisie et retirer un modèle. Essayer un fichier invalide puis un valide. Vérifier plein écran, arrêt/reprise caméra, V1 et Air Canvas et comparer les FPS avec le cristal sur le même matériel.

**82 tests automatisés passent**, dont le chargement GLB, le cadrage et la libération des ressources. Le module initial fonctionne selon le retour utilisateur ; le rendu GPU d’un fichier personnel et sa manipulation avec la webcam restent à valider manuellement.

## Hologram — fonctionnement et recette

Le troisième module affiche un cristal holographique 3D manipulable par une seule main. Three.js **0.187** et React Three Fiber **9.8** sont chargés à la demande lors de l’ouverture du module, sans Drei, postprocessing. Le rendu comporte un cristal translucide à effet Fresnel, des lignes de balayage, un cœur éclairé, une trame filaire, des anneaux et un socle de projection. Les animations décoratives restent indépendantes de l’orientation contrôlée : l’objet ne continue pas à tourner après le relâchement.

Le contrôleur réutilise **PinchGesture** (seuils, hystérésis et confirmations existants) et **StrokeFilter**. Le curseur doit se trouver dans la zone projetée de l’objet au début du pincement. Une saisie déclenchée ailleurs ne devient pas active en déplaçant ensuite les doigts fermés vers l’objet : relâcher et pincer à nouveau. La couleur du cristal et de sa couronne s’intensifie lorsqu’il est visé ou saisi ; le curseur affiche **Saisi** pendant la capture.

Les déplacements horizontaux et verticaux produisent des rotations en quaternions autour des axes de la caméra. La saisie commence sans changement d’orientation, le relâchement la fige sans inertie, et les positions ne sont pas intégrées pendant un relâchement incertain. Une brève perte de main fige la rotation et reprend sans appliquer le déplacement manquant. Perte prolongée, saut, arrêt de caméra, changement de module, redimensionnement et onglet masqué relâchent la saisie ; après une interruption, les doigts doivent être observés écartés avant un nouveau pincement. L’orientation acquise est conservée entre les modules. Aucun redimensionnement de l’objet ni interaction à deux mains.

La position de l’index est convertie de la vidéo contenue vers le viewport 3D en tenant compte du miroir et des bandes de cadrage. La cible est une ellipse calculée par projection de la couronne du cristal depuis la caméra Three.js. Le suivi garde jusqu’à deux mains, mais une seule reste propriétaire de la manipulation, indépendamment de leur ordre dans les résultats MediaPipe.

Le contrôleur est un objet mutable indépendant de React et de Three.js ; seule la scène différée importe le moteur 3D. `useFrame` applique les transformations et les uniforms directement, sans état React par frame. La scène utilise peu de géométries procédurales, sans ombres dynamiques, textures réseau ou bloom. Le DPR est borné à 1,5. PixiJS est mis en pause dans ce module ; la scène Three.js est démontée et ses ressources sont libérées quand on quitte Hologram. L’onglet masqué suspend sa boucle. L’aperçu décoratif reste visible sans caméra ; cela ne prouve aucune interaction gestuelle.

La télémétrie distingue **Rendu hologramme** (soumissions Three.js réellement terminées) et **Soumission 3D** (temps CPU d’animation et de soumission des commandes), indépendamment des FPS de détection et du rendu 2D/PixiJS. Ces temps ne mesurent pas la fin du travail GPU ni la latence de l’écran. Le bundle Three.js/R3F différé fait environ 938 ko minifiés / 252 ko gzip ; Vite signale sa taille supérieure à 500 ko. Il est chargé à la première ouverture d’Hologram et ne fait pas partie du chargement initial V1.

### Recette obligatoire avec une vraie webcam

1. Lancer `npm.cmd run dev`, sélectionner **Hologram** et attendre le cristal. Vérifier lumière, transparence, fils, anneaux et socle.
2. Activer la caméra en HTTPS ou localhost. Présenter **une main**, doigts écartés : le curseur doit suivre l’index sans faire tourner le cristal. Vérifier son alignement avec la main, y compris sur écran étroit et en plein écran.
3. Viser le cœur/cercle lumineux, puis toucher le pouce et l’index : le curseur passe à **Saisi**, la couronne et le cristal s’intensifient, sans saut d’orientation.
4. Déplacer doucement la main horizontalement puis verticalement. Vérifier que la rotation suit le mouvement de façon intuitive, sans tremblement excessif. Une fois saisi, on peut sortir de la cible tout en gardant le pincement.
5. Écarter franchement les doigts et déplacer la main : l’orientation doit rester strictement figée. Les lumières et anneaux décoratifs continuent leur animation. Reprendre depuis une autre position en visant puis pinçant : pas de saut.
6. Pincer hors du cristal puis déplacer la main fermée dans la cible : aucune saisie automatique. Relâcher puis pincer pour saisir.
7. Sortir la main du champ, changer d’onglet, arrêter/redémarrer la caméra et changer de module pendant la saisie : vérifier le relâchement, l’absence de rotation fantôme et la nécessité d’ouvrir avant de reprendre. Présenter une seconde main : elle ne doit pas voler la capture ni modifier l’échelle.
8. Vérifier le viewport carré/large, les différentes tailles d’analyse et une caméra 4:3 si disponible. Comparer détection FPS / rendu 3D / temps de soumission sur votre matériel, avec une puis deux mains visibles, sans ralentissement CPU dans les outils de développement.
9. Revenir à la V1 puis à Air Canvas : webcam, squelette, pinceaux classiques et PixiJS, réglages, effacement et anciens dessins doivent rester fonctionnels.

Le module initial fonctionne selon le retour utilisateur. La nouvelle extension GLB reste soumise au test manuel de rendu et de manipulation sur votre appareil.

Référence technique : [boucle et mutations via useFrame](https://r3f.docs.pmnd.rs/tutorials/basic-animations).

La V2 ajoute un mode Air Canvas : pincement pouce-index pour dessiner au bout de l’index, déplacement sans encre lorsque les doigts sont écartés, curseur d’interaction, dessin persistant et bouton d’effacement. Le sélecteur permet de revenir au suivi classique V1 sans redémarrer la caméra. Les autres doigts sont libres.

L’atelier de lumière propose trois nouveaux pinceaux animés **Energy Ribbon**, **Lightning**, **Cosmic Trail**, rendus par **PixiJS 8.22 / WebGL**. Les classiques **Neon**, **Laser**, **Particles** restent disponibles. Palette, couleur libre, épaisseur de 2 à 24 px et intensité lumineuse de 0 à 100 % sont réutilisées ; les styles précédents restent inchangés. Energy Ribbon est sélectionné par défaut dans l’interface.

## Effets PixiJS

- **Energy Ribbon** : ruban à cœur lumineux et bords transparents, ondulation et largeur pulsante. La vitesse du mouvement influence son volume et son énergie.
- **Lightning** : tracé électrique irrégulier qui se renouvelle environ 18 fois par seconde, trois ramifications et étincelles éjectées dans la direction du geste.
- **Cosmic Trail** : nuage de particules lumineuses, avec vitesse initiale liée au geste, dispersion courbe, ralentissement, réduction de taille et disparition progressive.

Le pincement, la position filtrée de l’index, les protections contre les sauts et le curseur ne sont pas remplacés. Les segments courbes normalisés alimentent le moteur d’effets ; le GPU rasterise des maillages texturés additifs et un ParticleContainer. La déformation des quelques sommets et la simulation des particules sont calculées sur le CPU, puis leurs buffers sont transmis à PixiJS. Aucun filtre plein écran coûteux ni bibliothèque de shaders supplémentaire n’est utilisé.

Les rubans vivent jusqu’à 6 secondes après le dernier échantillon de chaque portion, les éclairs jusqu’à 2,4 secondes. Leur dernière géométrie est ensuite fixée dans une RenderTexture persistante de 1280 × 720, sans conserver un historique de milliers de maillages. Les longues lignes sont découpées en portions continues. Les traits restent donc présents après l’animation ; **Cosmic Trail est volontairement éphémère** (particules de 1,4 à 3,6 secondes), comme annoncé dans l’interface. Les trois classiques restent persistants.

Le moteur limite les effets à **18 portions actives**, **112 points par portion** et **1000 particules réutilisées** ; les portions les plus anciennes sont fixées si le budget est atteint. Les géométries utilisent des buffers réutilisés, les halos des textures procédurales partagées. Aucun objet React par particule ou point. Le canvas GPU transparent est superposé au calque classique et suit le même ratio vidéo et la même vue miroir. Sa définition est limitée à 1280 px de large, sans multiplier par le devicePixelRatio.

PixiJS est chargé à la première ouverture d’Air Canvas. La boucle RAF existante pilote l’animation avec un temps écoulé réel ; aucun second ticker permanent n’est lancé. L’animation continue entre deux détections sans produire de faux landmarks. Les FPS de rendu incluent maintenant ces vrais rendus PixiJS ; ils peuvent dépasser les FPS de détection. Quand tout est fixé ou dissipé, aucun nouveau rendu GPU n’est demandé. Le squelette n’est pas redessiné à chaque animation.

Les animations sont suspendues avec la caméra, en mode V1 ou dans un onglet masqué ; dessins et effets en cours restent en mémoire pour la reprise. Effacer vide les deux calques, les particules et les portions actives. Au démontage, le renderer, les textures, buffers et événements sont détruits. Un WebGL indisponible ou perdu affiche une erreur dédiée et laisse le tracking et les pinceaux classiques disponibles. Le renderer Pixi exige WebGL, sans repli silencieux vers un renderer CPU. Le délégué GPU/CPU de **MediaPipe** reste un réglage distinct du moteur graphique **PixiJS**.

### Validation des nouveaux effets

1. Lancer `npm.cmd run dev`, choisir Air Canvas et attendre **PixiJS · WebGL prêt**. Activer la caméra, pincer, tracer des boucles et des changements rapides de direction. Masquer le squelette pour mieux voir le rendu.
2. Avec **Energy Ribbon**, observer les ondulations et la variation de largeur, même juste après avoir ouvert les doigts ; le ruban doit se figer ensuite sans disparaître.
3. Avec **Lightning**, vérifier les arcs changeants, les ramifications et les étincelles. Une fois l’animation terminée, la géométrie électrique doit rester.
4. Avec **Cosmic Trail**, observer le mouvement après le relâchement et la disparition complète. Écarter le pouce et l’index pour vérifier qu’aucune nouvelle émission ne suit le doigt en déplacement libre.
5. Modifier couleur, épaisseur et intensité pendant le suivi : les nouvelles émissions changent, les anciennes conservent leur style. Revenir aux classiques et vérifier leur rendu et leur conservation.
6. Tester l’effacement pendant et après l’animation, le changement V1/Air Canvas, l’onglet masqué, l’arrêt/redémarrage caméra, le plein écran et les différents ratios vidéo : aucun raccord artificiel ni étirement des coordonnées.
7. Observer séparément FPS de détection, FPS de rendu, temps d’inférence, temps de dessin et nombres d’effets actifs. Une animation fluide ne prouve pas une détection plus rapide. Dessiner longtemps avec deux mains visibles pour vérifier les budgets et la réactivité sur votre GPU.

Pour examiner uniquement les effets **sans webcam**, ouvrir la page de développement **http://localhost:5173/tests/effects-preview.html** après `npm.cmd run dev`. Elle utilise le même moteur sur une trajectoire scriptée, propose les trois pinceaux, l’arrêt des émissions et l’effacement, avec un compteur de rendu. Cette page de QA est exclue du build de production. Elle ne mesure pas les performances MediaPipe et ne valide pas le geste.

Références : [Application PixiJS](https://pixijs.com/8.x/guides/components/application), [MeshSimple](https://pixijs.download/v8.22.0/docs/scene.MeshSimple.html), [ParticleContainer](https://pixijs.com/8.x/guides/components/scene-objects/particle-container).

## Démarrage

Node.js 22.12+ ou 24 LTS et npm.

```sh
npm ci
npm run dev
```

Ouvrir l’adresse affichée par Vite, habituellement http://localhost:5173. Sous PowerShell, utiliser `npm.cmd` si la politique d’exécution bloque `npm.ps1`.

La webcam nécessite **localhost ou HTTPS**. Une IP locale en HTTP ne suffit pas. Privilégier Chrome ou Edge récent avec WebAssembly ; les autres navigateurs restent à vérifier sur appareil.

## Vérifications

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run preview
```

Le build statique est généré dans `dist/`.

## Architecture et performances

- `src/App.tsx` : interface, commandes, états et télémétrie.
- `src/useHandTracking.ts` : webcam, sessions annulables, boucle vidéo et dessin Canvas 2D.
- `src/handLandmarker.ts` : chargement standard MediaPipe et initialisations sérialisées.
- `src/hologramController.ts` : capture d’une seule main, coordonnées de visée et rotations en quaternions ; aucune dépendance 3D au chargement initial.
- `src/HologramPanel.tsx` : chargement différé et gestion des erreurs du module.
- `src/HologramScene.tsx` : scène Three.js/R3F, shader holographique et animation impérative.
- `tests/hologram.test.mjs` : coordonnées, capture, interruptions, quaternions et télémétrie 3D.
- `src/trackingPerformance.ts` : comptage des opérations terminées, mesures temporelles et limitation aux nouvelles images caméra.
- `src/drawSkeleton.ts` : rendu groupé des connexions et landmarks.
- `src/airCanvas.ts` : reconnaissance géométrique du geste et dessin impératif persistant.
- `src/pinchGesture.ts` : ratio de pincement 3D, hystérésis et confirmations temporelles.
- `src/interactionCursor.ts` : curseur SVG impératif, coordonnées miroir et taille visuelle indépendante de la résolution vidéo.
- `src/strokeFilter.ts` : filtre de position adaptatif selon la vitesse et le temps entre les images.
- `src/brushes.ts` : paramètres bornés et rendus Canvas 2D des trois pinceaux.
- `src/effectSimulation.ts` : simulation bornée, émission spatiale, durées de vie et géométrie des effets.
- `src/PixiEffects.ts` : renderer WebGL, maillages, pool de particules et texture persistante ; importé à la demande.
- `src/effectsPreview.ts` et `tests/effects-preview.html` : trajectoire scriptée pour QA du rendu sans webcam.
- `src/BrushPanel.tsx` : contrôles et aperçus des pinceaux, palette et curseurs accessibles au clavier.
- `tests/airCanvas.test.mjs` : tests du geste, des interruptions, du changement de main et de l’effacement, sans webcam ni dépendance de test.
- `src/style.css` : design responsive et réduction des animations.

MediaPipe Tasks Vision **0.10.32**, modèle officiel float16, mode VIDEO, deux mains, seuils de confiance à 0,6. Le moteur **Auto** tente le délégué **GPU**, puis se replie sur le CPU si l’initialisation GPU échoue ; le moteur sélectionné et la raison du repli sont affichés. Les choix explicites GPU et CPU permettent une comparaison sans repli caché. Le chargement standard reste sur le thread principal pour éviter l’incompatibilité du chargeur ES module déjà rencontrée. `detectForVideo()` demeure synchrone : des appels CPU longs bloqueront toujours l’interface. La séparation des boucles ne rend pas cette API asynchrone.

La capture vise 1280 × 720 / 30 fps. L’analyse conserve par défaut le détail disponible jusqu’à 1280 px de large et passe directement la vidéo au modèle lorsque la taille correspond : aucune copie intermédiaire dans ce cas. Les options 960 et 640 px permettent une comparaison volontaire de charge ; elles conservent le ratio, ne suréchantillonnent pas les petites caméras et ne changent pas la vidéo affichée ni les calques de dessin. Une résolution plus basse peut diminuer les détails de petites mains : vérifier la précision avant de la retenir. Les dimensions effectives et la cadence déclarée par la caméra sont affichées. Le modèle, le nombre de mains et les seuils ne sont pas dégradés automatiquement pour améliorer un compteur.

La détection utilise `requestVideoFrameCallback`, avec repli `requestAnimationFrame` sur les navigateurs qui ne le proposent pas. Seules les images nouvelles sont analysées, au maximum 30 fois par seconde ; il n’existe aucune file d’attente à rattraper. Une seconde boucle `requestAnimationFrame` consomme au plus une fois chaque résultat disponible pour dessiner le squelette et Air Canvas. Le résultat le plus récent remplace un résultat non consommé si nécessaire. Aucun point prédit ou dupliqué n’est ajouté pour gonfler les FPS. Le lissage adaptatif et les courbes restent appliqués aux vrais échantillons, sans tampon d’interpolation supplémentaire.

Le squelette conserve ses 21 points et 21 connexions par main, mais les opérations sont regroupées : un `stroke` et un `fill` par main, au lieu de 21 de chaque et autant d’ombres séparées. Les pinceaux gardent leur budget borné. PixiJS est la dépendance des effets avancés ; Three.js et React Three Fiber sont ajoutés uniquement pour Hologram (avec les types Three.js en développement).

Le canvas est dessiné impérativement ; React reçoit les statistiques une fois par seconde. Les nouvelles inférences et le rendu sont suspendus quand l’onglet est masqué ; les résultats en attente et le segment en cours sont interrompus et les compteurs réinitialisés à la reprise. Vidéo et calques visibles partagent les mêmes dimensions intrinsèques, `object-fit: contain` et une réflexion commune pour préserver l’alignement. Les noms droite/gauche compensent l’image non réfléchie transmise au modèle.

### Télémétrie et mesure dans votre navigateur

- **Détection FPS** : nombre d’appels d’inférence terminés divisé par la durée réelle de la fenêtre, et non `1000 / temps d’inférence`.
- **Rendu FPS** : mises à jour Canvas et PixiJS effectivement réalisées par seconde. Les callbacks RAF sans dessin et la composition native de la vidéo ne sont pas comptés. Les animations GPU et rafraîchissements du squelette sont comptés ; ils ne créent pas de nouvelles détections.
- **Inférence** : moyenne du temps bloqué dans `detectForVideo()`, avec p95 séparé pour repérer les pics.
- **Préparation image** : moyenne du temps de préparation précédant l’inférence, notamment la copie/redimensionnement si une taille d’analyse inférieure est choisie.
- **Dessin Canvas** : moyenne du temps JavaScript de soumission des commandes de rendu, sans mesurer la fin du travail GPU ni la latence physique de l’écran.

Les fenêtres utilisent le temps écoulé réel même si un long appel décale le minuteur. Les échantillons de durée sont bornés à 120 par fenêtre. Aucune mesure réelle de performance webcam n’a pu être effectuée dans l’environnement d’édition : les tests synthétiques ne prouvent pas 30 fps sur votre appareil.

Pour comparer :

1. Lancer `npm.cmd run build` puis `npm.cmd run preview`, ouvrir l’URL locale. Garder le même navigateur, le même éclairage, une seule fenêtre active et les mêmes paramètres de pinceau/squelette. Ne pas appliquer de ralentissement CPU dans les outils développeur.
2. Sélectionner **CPU**, analyse **1280 px**, démarrer la caméra et attendre 5 secondes de chauffe. Pendant 15 à 20 secondes, noter Détection, Rendu, Inférence moyenne/p95 et Dessin Canvas, d’abord avec une main puis deux. Arrêter la caméra.
3. Refaire exactement la séquence en **GPU** ou **Auto** à 1280 px. Vérifier le moteur affiché et la présence d’un éventuel repli CPU. Un délégué nommé GPU ne garantit pas à lui seul l’accélération matérielle : si les temps restent élevés, vérifier les réglages graphiques du navigateur, les pilotes et l’état WebGL dans sa page de diagnostic GPU.
4. Si nécessaire, comparer 960 puis 640 px avec les mêmes conditions. Vérifier aussi les petites mains, les doigts proches et les sorties de champ ; garder la résolution plus basse seulement si la précision reste satisfaisante.
5. Tester V1, Air Canvas et les trois pinceaux. Désactiver le squelette pour isoler son coût. Un temps d’inférence élevé signale le modèle/moteur ; un temps Canvas élevé signale le rendu ; un temps de préparation élevé signale la copie vidéo. À 30 fps, le budget total par image est d’environ 33,3 ms, avec une marge nécessaire pour le navigateur.
6. Vérifier l’effacement, la conservation des styles, les changements de mode, l’arrêt/redémarrage, le masquage d’onglet et les déconnexions caméra. Aucun raccord artificiel ne doit apparaître après une interruption.

### Fluidité et rendu

Le filtre fixe initial et les lignes droites ont été remplacés par un filtre passe-bas adaptatif : plus de stabilisation à faible vitesse, une réponse plus rapide en mouvement. Les coefficients dépendent du temps écoulé plutôt que du nombre d’images. Une suite de courbes quadratiques entre les points médians rend les transitions naturelles, avec environ une demi-image de retard géométrique en plus du filtre. Le dernier demi-segment est terminé au relâchement du pincement et avant un changement de paramètres.

### Interaction par pincement

L’ancienne posture « index tendu et tous les autres doigts repliés » est remplacée par la distance entre les extrémités du pouce (landmark 4) et de l’index (8), rapportée à la taille de la paume dans les world landmarks 3D. Ce ratio est indépendant de l’échelle de la main et de sa rotation. Aucune contrainte n’est imposée aux trois autres doigts.

La fermeture commence à un ratio de 0,28 et le relâchement à 0,45 : cette hystérésis évite les oscillations au voisinage d’un seuil unique. Un contact franc (ratio ≤ 0,14) dessine immédiatement ; une fermeture marginale est confirmée après au moins 20 ms. Une ouverture franche (ratio ≥ 0,65) arrête immédiatement le tracé. Une ouverture marginale suspend immédiatement les dépôts d’encre et confirme la fin après 40 ms ; si la main se referme avant, le segment reprend sans réinitialiser le filtre. Ces confirmations travaillent sur les observations déjà reçues, sans file d’attente ; leur durée effective dépend de la cadence de détection.

Le curseur utilise la même position filtrée que le dessin, sans seconde couche de lissage. Un anneau blanc avec le libellé **Déplacement** indique le déplacement sans encre ; un anneau cyan plein avec **Dessin** indique le tracé ; un anneau pointillé ambre avec **Relâchement** indique la courte suspension d’encre. Il est mis à jour directement dans un SVG, sans état React par image ni nouveau calque Canvas à effacer. Le viewBox suit le ratio vidéo et le miroir est appliqué aux coordonnées, pour garder les libellés lisibles. Un ResizeObserver maintient sa taille visuelle et la lisibilité sur petit écran, sans lecture de mise en page par image.

La main sélectionnée reste propriétaire du curseur même lorsqu’elle ne pince pas : une seconde main ne prend pas le contrôle simplement parce qu’elle pince. Une perte isolée garde cette sélection et l’état de pincement pendant au plus 100 ms, mais masque le curseur et termine la géométrie du trait. Aucun raccord n’est dessiné à travers une observation absente. Une perte plus longue réinitialise le contrôle. Un résultat absent pendant 180 ms masque également le curseur et réinitialise l’interaction. Changements de mode, arrêt caméra, onglet masqué, sauts de position et intervalles de plus de 200 ms continuent à interrompre le tracé. Une variation de couleur ou l’effacement termine uniquement le segment, sans obliger à refaire une séquence gestuelle.

Les déplacements inférieurs à 0,45 px à la résolution de référence sont regroupés pour limiter les dépôts répétés. Les sauts sont évalués sur les positions brutes, pour que le retard du filtre ne provoque pas lui-même une coupure. Seuls quelques points du segment courant sont stockés : aucune liste croissante de points ni redessin de l’historique à chaque image.

Neon dessine un tube coloré avec un cœur lumineux doux ; Laser un filament blanc fin dans une enveloppe colorée resserrée ; Particles dépose une poussière de points répartis le long de la courbe. Les particules sont des pixels persistants, sans simulation animée supplémentaire. Leur densité dépend de la distance et leur nombre est limité à 48 par segment (5 pour un point initial). Les halos sont locaux, sans flou appliqué à tout le canvas. L’intensité à 0 % supprime le halo, tout en conservant le pigment visible. Les épaisseurs sont exprimées à une largeur vidéo de référence de 1280 px et mises à l’échelle avec la résolution.

Un changement de couleur, de pinceau ou de curseur termine le segment avec son ancien style puis commence le suivant avec le nouveau. Le dessin déjà présent reste inchangé. React ne reçoit que les changements explicites de réglages ; les points filtrés et les opérations de dessin restent impératifs. Les pinceaux classiques restent indépendants de PixiJS.

À l’arrêt, à l’erreur et au démontage : pistes caméra arrêtées, détecteur fermé via `HandLandmarker.close()`, animations et délais annulés, source vidéo détachée et canvas effacé. Une autorisation caméra résolue après annulation est également nettoyée. La vidéo est transmise directement au détecteur, sans ImageBitmap intermédiaire. Un chargement du modèle déjà en cours peut se terminer après annulation ; son détecteur est alors fermé sans relancer la caméra. Les initialisations sont sérialisées car le chargeur MediaPipe utilise une factory globale.

## Correction de custom_dbg

L’ancien worker importait le chargeur WASM classique dans un Blob ES module. Le mode strict des modules modifiait la portée de la fonction de journalisation : dans le chargeur 0.10.32, `custom_dbg` est déclarée dans un bloc puis appelée hors de ce bloc. Cette séquence fonctionne en script classique et lève `ReferenceError: custom_dbg is not defined` en mode strict. La même fonction extraite du paquet installé a été exécutée dans les deux modes pour confirmer cette cause. La caméra n’est pas à l’origine de cette erreur.

La V1 utilise désormais le chemin de chargement standard sur le thread principal, sans worker. Le chargeur WASM est chargé comme script classique par MediaPipe. Aucune réécriture du chargeur, import Blob, injection de factory ou modification de la dépendance n’est utilisée.

## Confidentialité et réseau

Images et landmarks restent dans le navigateur ; aucune image n’est envoyée ni enregistrée. Internet est nécessaire au chargement du WASM depuis jsDelivr et du modèle officiel depuis Google Storage. Les polices sont téléchargées depuis Google Fonts, avec polices système de secours. La V1 n’est donc pas entièrement hors ligne. Aucun analytics ni stockage persistant.

Référence : [MediaPipe Hand Landmarker pour le Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

## Recette manuelle

### Air Canvas

1. Démarrer Vite et sélectionner **Air Canvas**, puis activer la caméra. La caméra peut aussi être activée avant de changer de mode.
2. Présenter une main face à la caméra dans un endroit éclairé, pouce et index écartés. Déplacer l’index : l’anneau blanc **Déplacement** doit suivre sans laisser de trait. Le majeur, l’annulaire et l’auriculaire peuvent rester dans une position confortable.
3. Rapprocher le pouce et l’index jusqu’au contact, puis déplacer la main : le curseur doit devenir cyan **Dessin** et le trait doit suivre l’extrémité de l’index. Écarter franchement les doigts, déplacer la main ailleurs, puis pincer de nouveau : deux traits distincts doivent apparaître, sans raccord entre les positions de déplacement.
4. Sortir la main du champ, changer de main, changer d’onglet, arrêter/redémarrer la caméra : les anciens traits doivent rester et aucun pont ne doit apparaître à la reprise.
5. Passer en **Suivi classique** : le dessin est masqué et le suivi V1 reste disponible. Revenir en **Air Canvas** : les traits réapparaissent et le prochain tracé commence séparément.
6. Cliquer **Effacer le dessin** pendant le suivi ou à l’arrêt : le dessin est supprimé, la caméra et le squelette restent inchangés. Vérifier aussi le plein écran et le redimensionnement.
7. Dessiner des cercles, des boucles et des diagonales lentement, puis plus vite. Garder l’index immobile pour observer la réduction du tremblement. Vérifier que la courbe se termine proprement à la levée du geste, sans retour vers le début du trait suivant.
8. Essayer successivement Neon, Laser et Particles. Changer la couleur par palette puis par le sélecteur libre, modifier l’épaisseur et tester la lumière à 0, 50 et 100 %. Les traits précédents doivent conserver leur aspect. Avec Particles, une main immobile ne doit pas continuer à déposer des particules.
9. Manipuler les réglages pendant le suivi, revenir à la V1 puis à Air Canvas, tester les contrôles au clavier et sur écran étroit. Vérifier la réactivité et comparer la fréquence affichée entre les trois pinceaux sur votre appareil. Pour mieux voir le dessin, masquer le squelette avec le contrôle existant.
10. Maintenir un pincement léger en dessinant des cercles et faire varier très légèrement son ouverture : le tracé ne doit pas clignoter à chaque fluctuation. Une ouverture marginale peut afficher brièvement **Relâchement**, sans déposer d’encre ; une ouverture franche doit arrêter immédiatement. Tester aussi à différentes distances et avec une légère rotation de la main.
11. Présenter une deuxième main pendant que la première déplace son curseur : elle ne doit pas voler le contrôle. Sortir la main sélectionnée du champ, puis revenir : le curseur doit disparaître pendant la perte et le dessin reprendre sur un nouveau segment. Vérifier également que le curseur reste lisible et aligné en plein écran, sur mobile et avec les résolutions d’analyse 640/960/1280.

Le dessin reste en mémoire jusqu’à l’effacement ou au rechargement de la page ; il n’est pas sauvegardé sur disque. Il est stocké sur un canvas séparé du squelette, dont les pixels sont conservés et remis à l’échelle si la résolution vidéo change. Aucun état React n’est modifié par point de dessin.

Le contrôle est une heuristique de proximité des deux extrémités, pas une preuve de contact physique. Il fonctionne au mieux avec une main bien visible et éclairée, les bouts des doigts visibles par la caméra. Les identités ambiguës interrompent le trait. Un saut de distance supérieur à 0,18 en coordonnées normalisées ou un intervalle supérieur à 200 ms coupe également le segment. Les déplacements très rapides ou un appareil lent peuvent donc produire des traits séparés pour éviter les raccords artificiels.

Les 82 tests automatisés couvrent Hologram (capture, relâchement, pertes, visée miroir, quaternions comparés à Three.js et télémétrie), le pincement et le curseur, les classiques, les budgets et la géométrie animée des effets, les styles capturés, la télémétrie et le choix GPU/CPU. Ils utilisent des données synthétiques et des contextes Canvas/SVG simulés ; les contrôleurs sont testés indépendamment de WebGL. Ils ne prouvent ni le rendu réel, ni les performances du GPU, ni le fonctionnement du geste sur caméra. Le contrôle de Brave avait expiré en attente d’autorisation du service pendant la validation des effets : aucune vérification visuelle GPU ou webcam n’est revendiquée. La page de QA PixiJS reste disponible, mais elle ne valide pas Hologram.

### Suivi classique et cycle de vie

1. Redémarrer Vite (`npm.cmd run dev`) et recharger complètement la page pour abandonner l’ancien worker et son bundle.
2. Activer la caméra, autoriser l’accès et attendre le modèle. Vérifier l’absence d’erreur `custom_dbg` et la vue miroir.
3. Présenter une puis deux mains bien éclairées : vérifier les 21 points, les connexions, l’alignement et le compteur 0/1/2.
4. Déplacer les doigts et sortir les mains du cadre ; vérifier la reprise du suivi et la disparition du squelette sans main.
5. Activer/désactiver le squelette, tester le plein écran, redimensionner et changer d’onglet.
6. Arrêter : vérifier que l’indicateur caméra du navigateur s’éteint et que les compteurs reviennent à zéro. Redémarrer plusieurs fois.
7. Annuler pendant le chargement et pendant la demande d’autorisation, puis accepter cette demande : la caméra doit rester arrêtée. Réactiver normalement ensuite.
8. Refuser l’accès, réessayer après autorisation, tester sans caméra ou caméra occupée ; vérifier les messages et la récupération.
9. Bloquer le réseau avant le chargement du modèle : vérifier le message d’erreur ou le délai maximal de 45 secondes, puis réessayer après rétablissement.
10. Déconnecter la webcam pendant le suivi ; vérifier l’arrêt et l’erreur. Vérifier également l’interface sur écran étroit et sa réactivité pendant le suivi.

TypeScript/lint/build, les tests synthétiques et la reproduction isolée de l’erreur ne remplacent pas cette recette matérielle. Qualité et performances dépendent de la lumière, de la caméra et de l’appareil. Hologram est un prototype à valider ; le module Magic n’est pas inclus.

## Magic (V4)

Selectionner **Magic**, activer la camera puis ouvrir la main : quatre doigts deplies et pouce ecarte. Une orbe cyan/violet suit le centre de la paume. Fermer la main ou la sortir du champ dissipe progressivement l'effet. Une seule main controle l'orbe ; son identite reste stable lorsque MediaPipe reordonne les detections.

Le module reutilise les detections et la boucle de rendu existantes, sans dependance ajoutee. Le rendu Canvas 2D miroir contient un halo, trois anneaux et 48 particules animees. Le lissage et les fondus dependent du temps ecoule ; une detection datant de plus de 180 ms declenche la disparition. Changement de module, arret camera et onglet masque nettoient le calque. Air Canvas et Hologram gardent leurs moteurs et interactions.

Validation manuelle a effectuer avec une vraie webcam : ouverture/fermeture, deplacement rapide et lent, perte de suivi, deux mains, plein ecran, changement de module et arret/redemarrage. Verifier ensuite dessin/pinceaux dans Air Canvas et saisie/rotation dans Hologram. La lumiere est un effet graphique superpose, sans eclairage physique de la video ni occultation par les doigts. La reconnaissance depend de la visibilite des articulations et de la qualite du suivi MediaPipe.
