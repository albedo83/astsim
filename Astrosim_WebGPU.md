

------

# Document de Conception : AstroSim WebGPU

## 1. Philosophie et Objectif

L'objectif est de créer un **jumeau numérique** d'une session d'astrophotographie. Contrairement aux planificateurs actuels qui superposent un rectangle sur une image statique, ce moteur génère une image synthétique basée sur la **radiométrie**.

**Le principe directeur :** L'utilisateur ne voit pas ce que le télescope pointe, il voit ce que le capteur *perçoit* après conversion des photons en électrons, incluant le bruit, les défauts optiques et la pollution lumineuse.

------

## 2. Architecture de Données : L'Univers Virtuel (Input Layer)

Avant même de parler d'optique, nous devons définir la source du signal. Une image JPEG standard est inutilisable car non linéaire et compressée.

### 2.1. Le Fond de Ciel (Objets Étendus)

Nous utiliserons le standard **HiPS (Hierarchical Progressive Surveys)**.

- **Source :** Serveurs IVOA (CDS Strasbourg, etc.).
- **Format :** Tuiles FITS ou HEALPix streamées.
- **Données :** Flux photométrique (ex: magnitude/arcsec²).
- **Canaux :** Idéalement, chargement de 3 catalogues distincts pour reconstruire le spectre :
  - *Visible (RGB) :* PanSTARRS ou DSS2.
  - *H-Alpha :* VTSS ou SHASSA (pour simuler l'émission des nébuleuses).
- **Gestion WebGPU :** Ces tuiles sont chargées dans des **Textures 2D Array** ou un **Atlas de textures** flottantes (Float32) pour préserver la gamme dynamique (HDR) infinie de l'espace.

### 2.2. Les Sources Ponctuelles (Étoiles)

Les étoiles sur les images HiPS sont souvent saturées. Nous allons les "effacer" (inpainting basique ou seuillage) et les redessiner proprement.

- **Source :** Catalogue **Gaia DR3** (via requêtes API par zone).
- **Données :** Ascension Droite (RA), Déclinaison (Dec), Magnitude G, Indice de couleur (BP-RP).
- **Gestion WebGPU :** Les étoiles sont stockées dans des **Storage Buffers** (Struct arrays). Le rendu ne se fera pas par rasterisation classique (triangles), mais par *Splatting* dans un Compute Shader ou via des *Point Primitives* avec un shader de fragment personnalisé pour dessiner le profil de l'étoile.

------

## 3. Le Moteur Physique : La Chaîne Optique (Optical Pipeline)

C'est ici que la simulation commence. Le trajet de la lumière est modélisé étape par étape.

### 3.1. L'Atmosphère (Le filtre avant l'optique)

- **Transmission Atmosphérique :** Atténuation du signal selon l'élévation de la cible (masse d'air).
- **Seeing (Turbulence) :** Modélisation de la FWHM (Full Width at Half Maximum) atmosphérique.
  - *Technique :* Application d'un flou gaussien initial sur le buffer de l'univers.
- **Pollution Lumineuse (Skyglow) :**
  - *Input :* Indice Bortle ou SQM (mag/arcsec²).
  - *Action :* Ajout d'une "valeur plancher" (offset) constante de photons sur chaque pixel, dépendant de la longueur d'onde (les filtres anti-pollution couperont ce signal).

### 3.2. Le Tube Optique (OTA) - Simulation Géométrique & Ondulatoire

C'est la partie la plus complexe, mélangeant Raytracing et Fourier.

- **Collecte de Lumière :** Calcul du flux entrant basé sur l'ouverture (D) et l'obstruction centrale (pour les Newton/SCT).
- **Vignetage Physique (Raytracing) :**
  - L'utilisateur définit le diamètre des éléments mécaniques (porte-oculaire, filtres).
  - *Algorithme :* Pour chaque pixel du capteur, on lance un cône inversé vers l'ouverture. On calcule le pourcentage d'occultation par les éléments mécaniques. Cela génère une "Vignetting Map" (texture de masque).
- **Diffraction (Aigrettes et PSF) :**
  - La forme des étoiles est déterminée par la pupille d'entrée (l'ouverture du télescope).
  - *Algorithme :* Nous générons une texture binaire représentant l'ouverture (le rond du miroir + les branches de l'araignée). Nous appliquons une **FFT (Fast Fourier Transform)** sur cette ouverture. Le résultat est la **PSF (Point Spread Function)**.
  - Cette PSF est ensuite convoluée avec les sources ponctuelles (étoiles Gaia) pour créer des aigrettes physiquement exactes.

### 3.3. Les Filtres

- Simulation spectrale simplifiée. Si l'utilisateur sélectionne un filtre "Dual Band (Ha/OIII)", le moteur pondère les canaux RGB et H-Alpha de la source HiPS pour ne laisser passer que les longueurs d'onde correspondantes.

------

## 4. Le Moteur de Capteur : La Conversion Photo-Électronique

Une fois l'image optique formée sur le plan focal virtuel, nous simulons le capteur CMOS/CCD.

### 4.1. Géométrie du Capteur

- **Mapping :** Projection de l'image optique sur la grille de pixels du capteur (Resolution X, Y, Taille des pixels).
- **Calcul d'Échantillonnage :** Détermination de la résolution angulaire (arcsec/pixel).

### 4.2. Physique Quantique (Conversion Photons -> Électrons)

- **Quantum Efficiency (QE) :** Multiplication du flux de photons par la courbe de réponse du capteur (ex: 80% dans le vert, 60% dans le rouge).
- **Temps d'Intégration :** Multiplication par le temps de pose unitaire (sub-exposure).

### 4.3. Simulation du Bruit (Le "Noise Engine")

C'est l'étape critique pour le réalisme. Nous ne simulons pas une seule image, mais le résultat mathématique d'un empilement (stack).

- **Shot Noise (Bruit de Photons) :** Le signal arrive selon une loi de Poisson.
  - *Formule WebGPU :* `Bruit_Photon = sqrt(Signal_Cible + Signal_Ciel)`.
  - Nous utilisons un générateur de nombres aléatoires (PRNG) dans le shader pour perturber la valeur de chaque pixel selon cet écart-type.
- **Dark Current Noise :** Bruit thermique du capteur.
  - Fonction de la température et du temps de pose.
- **Read Noise (Bruit de Lecture) :** Bruit électronique injecté à chaque lecture.
  - Loi Gaussienne fixe par pixel.
- **Pattern Noise (Optionnel) :** Simulation des pixels chauds/froids (Hot pixels) via une map de défauts fixe.

### 4.4. Convertisseur A/N (Analogique Numérique)

- **Gain :** Conversion des électrons en ADU (Analog to Digital Units).
- **Full Well Capacity :** Simulation de la saturation. Si `électrons > capacité`, le pixel est "clipé" à la valeur max (blanc pur).
- **Bit Depth :** Quantification du signal (12-bit, 14-bit, 16-bit).

------

## 5. Stratégie d'Implémentation WebGPU

L'application ne peut pas se permettre de ramer. Voici l'architecture technique.

### 5.1. Pipeline de Rendu (The Render Loop)

Nous n'allons pas utiliser le pipeline graphique standard pour le calcul, mais massivement les **Compute Shaders**.

1. **Pass 0 : Data Fetch & Prep (CPU -> GPU)**
   - Le CPU détermine les coordonnées célestes, télécharge les tuiles HiPS et les données Gaia, et met à jour les Uniform Buffers (paramètres du télescope).
2. **Pass 1 : Kernel PSF (Compute Shader)**
   - Génération de la forme de l'étoile (via FFT ou approximation analytique) basée sur l'ouverture du télescope. Résultat stocké dans une petite texture `R32Float`.
3. **Pass 2 : Scene Composition (Compute Shader)**
   - Mapping de la texture HiPS (Galaxie/Nébuleuse) sur le plan focal.
   - Injection des étoiles Gaia. Pour chaque étoile, on "additonne" la texture PSF à la position correspondante, mise à l'échelle par la magnitude de l'étoile.
   - Sortie : Une texture `Linear_Irradiance_Map` (haute précision, valeurs physiques réelles).
4. **Pass 3 : Sensor Simulation (Compute Shader)**
   - Ce shader prend la `Linear_Irradiance_Map` et applique :
     - Vignetage.
     - Multiplication par le temps de pose.
     - Ajout du Skyglow.
     - Génération du bruit aléatoire (Poisson/Gaussien).
   - Sortie : `Raw_Sensor_Data` (L'image brute virtuelle).
5. **Pass 4 : Display Processing (Fragment Shader)**
   - C'est le "visualiseur" à l'écran. Il prend les données brutes et simule le "Stretch" (montée d'histogramme) que fait l'astrophotographe.
   - Transformation : `Linear` -> `Non-Linear` (STF - Screen Transfer Function).
   - Débayerisation (si on simule une caméra couleur) pour l'affichage final.

### 5.2. Optimisations Critiques

- **Tile Cache System :** Un système LRU (Least Recently Used) pour gérer les tuiles HiPS en mémoire vidéo sans saturer la VRAM.
- **Progressive Rendering :** Si le calcul est trop lourd (ex: millions d'étoiles), on divise le rendu des étoiles en plusieurs frames (Time-slicing) pour garder l'interface fluide à 60 FPS.

------

## 6. Interface Utilisateur (UX)

L'écran est divisé en deux : Le Panneau de Contrôle et Le Viewport.

### 6.1. Le Viewport (Canvas WebGPU)

- Affiche l'image simulée.
- Contrôles de zoom/panoramique fluides.
- Indicateurs en surimpression : Rectangle du capteur (FOV), grille de coordonnées.

### 6.2. Le Panneau "Matériel"

C'est là que l'utilisateur construit son rig.

- **Sélecteur Optique :** Focal, Diamètre, Type (Refracteur, Newton, SC), Réducteur de focale.
- **Sélecteur Caméra :** Liste pré-remplie (ZWO, QHY, DSLR) avec leurs specs techniques (taille pixel, bruit de lecture, full well).
- **Environnement :** Slider de pollution lumineuse (Bortle 1 à 9), Phase de la lune.

### 6.3. Le Panneau "Exposition" (Le cœur de l'expérience)

- **Slider "Temps de Pose Unitaire" :** 30s, 60s, 300s... (Impacte la saturation des étoiles).
- **Slider "Temps d'Intégration Total" :** 1h, 10h, 20h... (Impacte la réduction du bruit).
- **Histogramme Temps Réel :** Affiche les courbes RGB pour montrer si le signal est détaché du bruit de fond.

------

## 7. Stack Technique

- **Langage Principal :** TypeScript.
- **API Graphique :** WebGPU (via le device `navigator.gpu`).
- **Langage Shaders :** WGSL (WebGPU Shading Language).
- **UI Framework :** Angular 21 (pour les panneaux latéraux et la gestion d'état).
- **Maths Astronomiques :** implémentation interne sauf necessité
- **Manipulation FITS :** Implémentation interne  sauf necessité

------

### Résumé de la Valeur Ajoutée

Ce projet transforme la planification d'une **estimation géométrique** (cadrage) en une **prédiction scientifique** (rapport signal/bruit). Il permet à l'astrophotographe de répondre à la question : *"Est-ce que ça vaut le coup de sortir le matériel ce soir pour cette cible avec mon équipement ?"*