# MUSIC HOUSE BTA — Young Forever Records

Application web de gestion du studio, des artistes, des rendez-vous, des productions et des opérations financières. La version de développement suit le cahier des charges V1 fourni avec le projet.

## Périmètre livré

- Authentification Firebase par e-mail et mot de passe, création de compte artiste/client, réinitialisation de mot de passe et état de compte actif/inactif.
- Trois rôles (`manager`, `producer`, `client`). Le rôle opérationnel est lu dans les custom claims Firebase Auth ; l'inscription publique crée toujours un client.
- Espaces distincts : pilotage manager, espace de production et portail artiste/client.
- Profils artistes, catalogue des prestations et tarifs XAF, demandes de rendez-vous, affectation d'un producteur, calendrier et verrouillage atomique des créneaux confirmés.
- Projets musicaux et étapes de production, notes internes d'équipe, progression client contrôlée.
- Paiements saisis et vérifiés manuellement, déclarations de paiement client, justificatifs clients, corrections par écritures inverses.
- Dépenses, validation manager, co-signature manager/producteur pour les dépenses exceptionnelles ou au-dessus du seuil choisi.
- Répartitions studio 25 % / 50 % / 25 % et distribution 70 % / 20 % / 10 %, historique des versions, écritures de commissions et réserve.
- Suivi manuel des sorties de distribution, notifications internes, rapports CSV et vues adaptées aux mobiles.
- Cache Firestore mémoire par défaut et cache IndexedDB multi-onglets seulement lorsque l'utilisateur marque l'appareil comme personnel/de confiance.

La V1 n'active aucune passerelle de paiement, intégration automatique de plateformes musicales, stockage audio ni service tiers payant. Une sortie n'est dite publiée que lorsque le manager met manuellement son statut à `published`.

## Prérequis

- Node.js 22 ou version ultérieure et npm.
- Un projet Firebase dédié à MUSIC HOUSE BTA.
- Java 21 pour les tests avec l'émulateur Firestore.
- Firebase CLI pour les émulateurs et le déploiement : `npm install -g firebase-tools` (ou utilisez la dépendance locale du projet avec `npx firebase`).

## Installation locale

```bash
npm install
cp .env.example .env
npm run dev
```

Sous Windows PowerShell, la copie d'environnement s'effectue avec :

```powershell
Copy-Item .env.example .env
```

L'application affiche un écran de configuration explicite tant que Firebase n'est pas configuré. Renseignez ensuite les six variables `VITE_FIREBASE_*` dans `.env` avec les valeurs de **Firebase Console → Project settings → Your apps → Web app config**. `VITE_APP_URL` est facultative et sert uniquement de référence d'URL publique.

Les valeurs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` et `appId` sont la configuration publique de l'application Web Firebase. Ne placez jamais une clé privée de compte de service, un mot de passe ou un secret Admin SDK dans une variable `VITE_*` ou dans Git.

## Configuration Firebase requise par le propriétaire

1. Créer ou sélectionner le projet Firebase dédié et enregistrer une application Web.
2. Dans **Authentication → Sign-in method**, activer **Email/Password**.
3. Dans **Firestore Database**, créer la base en choisissant la région adaptée au projet. Le choix de région est une décision du propriétaire et n'est pas présupposé ici.
4. Copier les six valeurs de configuration Web dans `.env` localement et dans les variables d'environnement du service d'hébergement choisi.
5. Déployer les règles et index avec les commandes ci-dessous. Attendre la construction des index avant les tests fonctionnels dépendant de ceux-ci.
6. Pour les e-mails de vérification et de réinitialisation, configurer le modèle et les domaines autorisés dans Firebase Authentication.
7. Après la mise en place du domaine de production, activer et configurer Firebase App Check selon le fournisseur choisi. App Check n'est pas activé automatiquement par cette V1.

Aucun identifiant de projet, domaine, compte manager, compte producteur, secret, numéro de téléphone ou paramètre de facturation n'est prédéfini dans le dépôt.

## Création des comptes et attribution des rôles

Les deux comptes internes doivent d'abord exister dans Firebase Authentication. Le propriétaire crée les comptes manager et producteur (inscription via l'application ou depuis la console), puis attribue leurs rôles depuis un environnement d'administration de confiance.

Exemple avec Google Application Default Credentials :

```powershell
 gcloud auth application-default login
 $env:FIREBASE_PROJECT_ID = "IDENTIFIANT_REEL_DU_PROJET"
 npm run set:role -- manager@votre-domaine.example manager
 npm run set:role -- producteur@votre-domaine.example producer
```

Le script `scripts/set-role.ts` utilise Firebase Admin SDK et Application Default Credentials. L'identité Google utilisée doit avoir les autorisations Firebase Authentication nécessaires pour modifier les custom claims et un accès Firestore pour mettre à jour le profil. À défaut d'ADC, configurez `GOOGLE_APPLICATION_CREDENTIALS` vers un fichier de compte de service stocké hors du dépôt et hors du dossier public. Ne commitez jamais ce fichier.

Pour retirer un rôle privilégié et revenir au rôle client :

```powershell
npm run set:role -- adresse@exemple.com client
```

Après tout changement de rôle, l'utilisateur doit renouveler son jeton en se déconnectant puis en se reconnectant. Les règles Firestore vérifient les custom claims ; modifier le champ `role` d'un document utilisateur depuis le navigateur ne confère aucun privilège.

## Tests et vérifications

```bash
npm run typecheck
npm test
npm run test:rules
npm run test:all
npm run build
```

- `npm test` exécute les tests purs des calculs de commissions et des montants XAF.
- `npm run test:rules` démarre l'émulateur Firestore et teste l'isolation client/producteur/manager, les écritures de paiement et les co-signatures.
- `npm run test:all` exécute les tests financiers et les règles Firestore.

Les tests Firestore utilisent `demo-music-house-bta`, un identifiant d'émulateur local, et ne se connectent pas à une base de production. Ils chargent directement `firestore.rules`.

## Déploiement Firebase Hosting

Après avoir installé Firebase CLI et vous être connecté :

```bash
firebase login
firebase use --add
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

`firebase use --add` crée `.firebaserc` localement. Ce fichier est ignoré par Git afin que l'identifiant réel du projet reste un choix du propriétaire. Vérifiez le projet sélectionné avant toute commande de déploiement.

## Déploiement Vercel

- Framework : **Vite**.
- Build command : `npm run build`.
- Output directory : `dist`.
- Ajouter les six variables `VITE_FIREBASE_*` à l'environnement correspondant (Preview et Production séparément).
- Le fichier `vercel.json` fournit le fallback SPA pour les routes React Router.
- Déployer les règles et index Firestore séparément via Firebase CLI ; Vercel ne les publie pas.

## Modèle de données Firestore

Les collections principales sont `users`, `artists`, `services`, `appointments`, `appointmentLocks`, `projects`, `payments`, `paymentReceipts`, `paymentSubmissions`, `allocationBalances`, `commissionEntries`, `expenses`, `distributionOrders`, `notifications`, `settings` et `activityLogs`. Les écritures sensibles sont effectuées en transactions/batches et les journaux financiers ne sont pas supprimés ; les corrections de paiement créent des écritures inverses.

Les montants sont stockés en entiers XAF. Les paiements validés conservent la version de répartition utilisée au moment de leur validation. Le document `allocationBalances` maintient le cumul et le chaînage du dernier paiement par projet/version dans la même transaction que les écritures ; cela protège les acomptes successifs et autorise la correction du dernier encaissement sans requête de collection dans une transaction web. Les frais déduits de l'assiette des commissions sont uniquement les frais directs explicitement saisis et validés. Les sommes collectées pour le compte d'un tiers sont saisies dans un champ séparé et exclues de la recette de service partageable ; elles ne sont pas assimilées à une commission. Les charges générales ne diminuent pas rétroactivement les commissions.

## Cache et mode hors connexion

Le cache mémoire est utilisé par défaut. L'utilisateur peut cocher « Appareil personnel / de confiance » au moment de la connexion pour activer la persistance Firestore IndexedDB multi-onglets. Firestore peut ensuite afficher hors connexion les documents déjà chargés. Les écritures hors ligne restent en attente de synchronisation ; elles ne constituent pas une confirmation de rendez-vous ou une validation financière. Les confirmations, affectations, paiements validés, changements de taux et co-signatures exigent une connexion.

La persistance Web conserve les données sur le navigateur ; ne l'activez jamais sur un appareil partagé. À la déconnexion, le code tente de vider ce cache. Si le navigateur refuse son effacement automatique, l'utilisateur doit effacer les données du site dans les paramètres du navigateur. La documentation Firebase rappelle que la persistance Web n'est pas activée par défaut et recommande de tenir compte de la confiance accordée à l'appareil : https://firebase.google.com/docs/firestore/manage-data/enable-offline.

## Limites V1 et décisions encore à fournir

- Les détails réels du projet Firebase (ID, région, domaine, configuration Web) sont à fournir par le propriétaire ; aucune valeur fictive n'est injectée.
- Les adresses e-mail des comptes manager et producteur sont à choisir par le propriétaire avant l'attribution des rôles.
- Le seuil de dépense exceptionnelle est configurable dans Paramètres. La valeur initiale est volontairement vide ; le manager doit la définir s'il souhaite un seuil numérique. Les dépenses explicitement marquées exceptionnelles exigent toujours les deux validations.
- Les paiements sont saisis manuellement après vérification réelle des fonds. La V1 ne vérifie pas automatiquement les comptes Mobile Money ou bancaires.
- Les conditions légales/texte contractuel final, logo officiel, coordonnées publiques, canaux de support et domaine définitif sont des éléments du propriétaire à renseigner avant ouverture publique.

## Structure du dépôt

- `src/` : application React/TypeScript, accès Firebase, règles métier et interface.
- `firestore.rules` : règles de sécurité Firestore.
- `firestore.indexes.json` : index composites utilisés par les requêtes.
- `scripts/set-role.ts` : attribution sécurisée des rôles via Admin SDK.
- `tests/` : tests financiers et tests de règles via Firebase Emulator.
- `.env.example` : modèle sans identifiants réels.
- `firebase.json` / `vercel.json` : configuration d'hébergement et d'émulateur.

## Licence

Voir `LICENSE`.

## Configuration Firebase déjà renseignée

La configuration Web fournie pour le projet `music-house-bta` est intégrée dans `src/firebase.ts` comme configuration par défaut et préremplie dans `.env.example`. La configuration publique est donc disponible en développement et en build, même si aucun fichier `.env` local n'a encore été créé. Les variables `VITE_FIREBASE_*` peuvent toujours remplacer ces valeurs lors d'un déploiement.

Le projet Firebase utilisé est `music-house-bta`, avec le domaine Auth `music-house-bta.firebaseapp.com`, le bucket `music-house-bta.firebasestorage.app` et la mesure Analytics `G-5JMCBBRKX2`.

### Activation obligatoire dans Firebase Console

La configuration Web ne crée pas à elle seule la base ni n'active les méthodes d'authentification. Dans le projet `music-house-bta), le propriétaire doit vérifier :
1. **Authentication → Sign-in method → Email/Password** : activer le fournisseur e-mail/mot de passe.
2. **Firestore Database** : créer la base de données native si elle n'existe pas encore et choisir sa région.
3. **Authentication → Settings → Authorized domains** : vérifier que le domaine de l'application sera autorisé.

Après connexion avec Firebase CLI, le projet par défaut est défini par le fichier `.firebaserc`. Déployer les règles et les index avec :
```powershell
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

### Avertissement — règles temporaires

Pour faciliter l'inscription, la connexion, les tests et le développement initial, les règles Firestore V1 sont volontairement simplifiées : **tout compte authentifié peut lire et écrire tous les documents**, tandis que les visiteurs non connectés sont refusés. Les rôles Manager/Producteur/Client restent présents dans l'application et dans les custom claims, mais ces règles temporaires ne séparent pas encore les données selon ces rôles.

Ne pas conserver ces règles pour une ouverture publique, ni y stocker de vraies données financières ou privées partagées avec des comptes non fiables. Avant la mise en production, remplacer ce mode temporaire par des règles spécifiques à chaque collection et à chaque rôle, puis relancer `npm run test:rules`.
