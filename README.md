# MUSIC HOUSE BTA — Young Forever Records

Application web de gestion du studio, des artistes, des rendez-vous, des productions et des opérations financières. La version de développement suit le cahier des charges V1 fourni avec le projet.

## Périmètre livré

- Authentification Firebase par e-mail et mot de passe, création de compte artiste/client, réinitialisation de mot de passe et état de compte actif/inactif.
- Trois rôles (`manager`, `producer`, `client`). Le rôle opérationnel est lu dans les custom claims Firebase Auth ; l'inscription publique crée toujours un client.
- Espaces distincts : pilotage manager, espace de production et portail artiste/client.
- Profils artistes, catalogue des prestations et tarifs XAF, demandes de rendez-vous, affectation d'un producteur, calendrier et verrouillage atomique des créneaux confirmés.
- Projets musicaux et étapes de production, notes internes d'équipe, progression client contrôlée.
- Paiements Mobile Money par Fapshi, vérification serveur du statut fournisseur, contrôle du montant et de la référence, acomptes et soldes rattachés aux réservations ; déclarations manuelles conservées pour les autres modes.
- Dépenses, validation manager, co-signature manager/producteur pour les dépenses exceptionnelles ou au-dessus du seuil choisi.
- Répartitions studio 25 % / 50 % / 25 % et distribution 70 % / 20 % / 10 %, historique des versions, écritures de commissions et réserve.
- Suivi manuel des sorties de distribution, notifications internes, rapports CSV et vues adaptées aux mobiles.
- Cache Firestore mémoire par défaut et cache IndexedDB multi-onglets seulement lorsque l'utilisateur marque l'appareil comme personnel/de confiance.

Les paiements Fapshi sont intégrés pour les acomptes et soldes des prestations du studio. Aucune intégration automatique de plateformes musicales ni aucun stockage audio n'est activé. Une sortie n'est dite publiée que lorsque le manager met manuellement son statut à `published`.

## Prérequis

- Node.js 22 ou version ultérieure et npm.
- L'accès propriétaire au projet Firebase existant `music-house-bta` pour activer les services et déployer les règles.
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

Les valeurs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` et `measurementId` sont la configuration publique de l'application Web Firebase déjà fournie. Ne placez jamais une clé privée de compte de service, un mot de passe ou un secret Admin SDK dans une variable `VITE_*` ou dans Git.

## Cloudinary, Resend et connexion Google

Les services de profil et de communication réutilisent les conventions déjà présentes dans le dépôt Pata.

### Photos de profil Cloudinary

- Cloud : `do83voiqy`
- Preset unsigned : `afrikdigitalo_upload`
- Dossier : `music-house-bta/avatars`
- Taille maximale d'une photo : 5 Mo.
- Variables publiques optionnelles : `VITE_CLOUDINARY_CLOUD_NAME` et `VITE_CLOUDINARY_UPLOAD_PRESET`.

Le cloud et le preset ne sont pas des secrets. Le preset Cloudinary doit être de type unsigned. Le navigateur envoie la photo directement à Cloudinary ; seule l'URL HTTPS validée est ensuite enregistrée dans les profils Firestore de l'artiste et du compte utilisateur.

### Emails automatiques avec Resend

Configurez les variables suivantes dans Vercel côté serveur, jamais avec le préfixe `VITE_` :
- `RESEND_API_KEY` : clé privée Resend.
- `RESEND_FROM_EMAIL` : expéditeur appartenant à un domaine vérifié dans Resend.
- `APP_URL` : URL HTTPS publique de MUSIC HOUSE BTA utilisée dans les liens des e-mails.

Depuis **Paramètres**, le manager peut utiliser **Envoyer un e-mail de test** : la réponse précise si Resend accepte le message ou indique l’erreur du fournisseur ; le serveur vérifie aussi que le domaine expéditeur est enregistré et vérifié avec la clé configurée. Les événements suivants déclenchent des e-mails : création d'un compte artiste, demande de rendez-vous reçue, rendez-vous validé par le manager, demande de publication soumise, évolution du statut de publication et message direct envoyé par le manager à un artiste. Les e-mails sont envoyés par une fonction serveur ; la clé Resend n'est jamais transmise au navigateur.

### Paiements Fapshi et acomptes

Les paiements en ligne utilisent le même contrat d'intégration que Pata. Configurez dans Vercel, en **variables serveur privées** :

- `FAPSHI_API_USER`
- `FAPSHI_SECRET_KEY`
- `FAPSHI_WEBHOOK_URL` : `https://votre-domaine.com/api/payments`
- `FAPSHI_WEBHOOK_SECRET` : secret partagé avec l'en-tête `x-wh-secret` du webhook.

Dans le tableau de bord Fapshi, configurez également l'URL du webhook ci-dessus et le même secret `x-wh-secret`. Ajouter uniquement la variable URL dans Vercel ne configure pas le webhook chez Fapshi. L'API de paiement est regroupée dans une seule fonction serveur : `POST /api/payments` (création et vérification) et reçoit aussi le webhook Fapshi.

Le lien de paiement est créé côté serveur avec `POST https://live.fapshi.com/initiate-pay`. Au retour du navigateur et lors du webhook, le serveur interroge de nouveau `GET https://live.fapshi.com/payment-status/{transId}`. Le statut doit être `SUCCESSFUL` et le montant, l'identifiant externe et le compte doivent correspondre à la tentative sauvegardée dans Firestore. Le webhook et la page de retour ne sont jamais acceptés comme preuve de paiement à eux seuls. Une transaction non confirmée reste en attente ; un montant incohérent est mis en contrôle manuel au lieu d'être crédité.

Les réglages commerciaux se trouvent dans **Paramètres du studio** : acompte par défaut de 50 %, remise par défaut, possibilité d'autoriser ou non le paiement intégral et numéro WhatsApp. Chaque prestation peut avoir son propre prix, sa remise, son pourcentage d'acompte et l'autorisation de paiement intégral. Le prix final, la remise et l'acompte sont figés dans la réservation : changer ensuite le catalogue ne réécrit pas les conditions déjà acceptées. L'artiste voit les prestations actives, peut demander une réservation puis payer l'acompte ou le solde lorsqu'il est dû.

Une réservation n'est confirmée et le créneau n'est verrouillé qu'après la vérification de l'acompte par le fournisseur et la validation du manager. Le manager peut toujours accorder une dérogation explicite avec motif. Les paiements Fapshi confirmés sont reportés dans `payments`, `paymentReceipts`, `allocationBalances` et `commissionEntries` ; les frais Fapshi sont séparés du montant net utilisé pour la répartition.

### Connexion Google et compte manager

Activez le fournisseur **Google** dans Firebase Console → Authentication → Sign-in method, en conservant **Email/Password**. Ajoutez le domaine de production dans Authentication → Settings → Authorized domains.

Le compte manager principal est `exaucenapopolo2@gmail.com`. À sa première connexion, l'API serveur attribue le custom claim `manager` après validation de l'adresse e-mail Firebase. Le compte doit exister dans Firebase Authentication et son adresse doit être vérifiée. La connexion Google fournit normalement une adresse déjà vérifiée.

Le manager peut ensuite inviter des producteurs depuis **Équipe du studio**. Le serveur crée ou associe leur compte Firebase, attribue le rôle producteur et leur envoie un lien sécurisé pour définir leur mot de passe.

### Variables serveur obligatoires dans Vercel

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
FIREBASE_PROJECT_ID=music-house-bta
FIREBASE_SERVICE_ACCOUNT_KEY=
# Alias accepté si cette variable existe déjà dans Vercel : FIREBASE_SERVICE_ACCOUNT=
MUSIC_HOUSE_MANAGER_EMAIL=exaucenapopolo2@gmail.com
APP_URL=https://votre-domaine.com
FAPSHI_API_USER=
FAPSHI_SECRET_KEY=
FAPSHI_WEBHOOK_URL=https://votre-domaine.com/api/payments
FAPSHI_WEBHOOK_SECRET=
```

`FIREBASE_SERVICE_ACCOUNT_KEY` (nom recommandé) ou `FIREBASE_SERVICE_ACCOUNT` (ancien nom accepté) contient le JSON du compte de service du projet **music-house-bta**. Le JSON est analysé tel quel ; conservez les séquences `\\n` de la clé privée. Il doit provenir de ce projet Firebase, être conservé uniquement dans les variables serveur Vercel et ne jamais être ajouté au dépôt. Les clés du projet Pata ne doivent pas être utilisées pour administrer un autre projet Firebase.

## Configuration Firebase requise par le propriétaire

1. Ouvrir le projet existant **`music-house-bta`** dans Firebase Console.
2. Dans **Authentication → Sign-in method**, activer **Email/Password** et **Google**. C'est indispensable pour les formulaires d'inscription, la connexion et l'accès manager.
3. Dans **Firestore Database**, vérifier que la base native existe. Si elle n'existe pas, la créer et choisir sa région (ce choix doit être confirmé par le propriétaire).
4. La configuration Web fournie est déjà intégrée par défaut et dans `.env.example`. Aucune clé privée n'est requise dans le navigateur.
5. Déployer les règles et index avec les commandes ci-dessous. Attendre la construction des index avant les tests fonctionnels dépendant de ceux-ci.
6. Dans **Authentication → Settings → Authorized domains**, ajouter/vérifier le domaine réel de l'application.
7. Pour les e-mails de vérification et de réinitialisation, configurer les modèles d'e-mail Firebase. App Check pourra être activé avant l'ouverture publique.

L'adresse du manager principal est `exaucenapopolo2@gmail.com`. Les secrets Resend et Firebase Admin sont configurés exclusivement dans les variables serveur Vercel et ne sont pas enregistrés dans Git.

## Création des comptes et attribution des rôles

Le compte manager principal `exaucenapopolo2@gmail.com` doit exister dans Firebase Authentication et son adresse doit être vérifiée. À sa connexion, le serveur attribue automatiquement le rôle manager à cette adresse autorisée. Les comptes producteurs sont ensuite créés et invités depuis le module **Équipe du studio** ; le script Admin ci-dessous reste disponible pour une attribution manuelle exceptionnelle.

Exemple avec Google Application Default Credentials :

```powershell
 gcloud auth application-default login
 $env:FIREBASE_PROJECT_ID = "music-house-bta"
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

- L'identifiant du projet et la configuration Web sont fournis (`music-house-bta`). La région Firestore et le domaine public final doivent encore être confirmés par le propriétaire.
- Le compte manager principal est identifié par `exaucenapopolo2@gmail.com`. Les producteurs sont invités depuis le tableau de bord manager ou ajoutés manuellement avec le script Admin.
- Le seuil de dépense exceptionnelle est configurable dans Paramètres. La valeur initiale est volontairement vide ; le manager doit la définir s'il souhaite un seuil numérique. Les dépenses explicitement marquées exceptionnelles exigent toujours les deux validations.
- Les transactions Fapshi doivent être configurées avec les quatre variables serveur ci-dessus et le webhook doit être enregistré dans le tableau de bord Fapshi. Les transactions réelles ne sont pas certifiées tant qu'un essai de bout en bout n'a pas été exécuté avec les secrets du compte.
- Les conditions légales/texte contractuel final, logo officiel, coordonnées publiques, canaux de support et domaine définitif sont des éléments du propriétaire à renseigner avant ouverture publique.

## Structure du dépôt

- `src/` : application React/TypeScript, accès Firebase, règles métier et interface.
- `firestore.rules` : règles de sécurité Firestore.
- `firestore.indexes.json` : index composites utilisés par les requêtes.
- `scripts/set-role.ts` : attribution sécurisée des rôles via Admin SDK.
- `tests/` : tests financiers et tests de règles via Firebase Emulator.
- `.env.example` : configuration Web publique préremplie et noms des variables serveur attendues ; les secrets restent vides.
- `firebase.json` / `vercel.json` : configuration d'hébergement et d'émulateur.

## Licence

Voir `LICENSE`.

## Configuration Firebase déjà renseignée

La configuration Web fournie pour le projet `music-house-bta` est intégrée dans `src/firebase.ts` comme configuration par défaut et préremplie dans `.env.example`. La configuration publique est donc disponible en développement et en build, même si aucun fichier `.env` local n'a encore été créé. Les variables `VITE_FIREBASE_*` peuvent toujours remplacer ces valeurs lors d'un déploiement.

Le projet Firebase utilisé est `music-house-bta`, avec le domaine Auth `music-house-bta.firebaseapp.com`, le bucket `music-house-bta.firebasestorage.app` et la mesure Analytics `G-5JMCBBRKX2`.

### Activation obligatoire dans Firebase Console

La configuration Web ne crée pas à elle seule la base ni n'active les méthodes d'authentification. Dans le projet `music-house-bta`, le propriétaire doit vérifier :
1. **Authentication → Sign-in method → Email/Password** : activer le fournisseur e-mail/mot de passe.
2. **Firestore Database** : créer la base de données native si elle n'existe pas encore et choisir sa région.
3. **Authentication → Settings → Authorized domains** : vérifier que le domaine de l'application sera autorisé.

Après connexion avec Firebase CLI, le projet par défaut est défini par le fichier `.firebaserc`. Déployer les règles et les index avec :
```powershell
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

### Sécurité Firestore

Les règles de sécurité appliquent les custom claims Firebase pour séparer les accès Manager, Producteur et Client. Les clients ne peuvent pas modifier le catalogue tarifaire, les montants des réservations ni les registres financiers. Les règles doivent être déployées dans le projet Firebase avec Firebase CLI ; un déploiement Vercel ne les publie pas.


### Dépannage Firebase Admin et Resend

- Le serveur accepte les variables FIREBASE_SERVICE_ACCOUNT_KEY et FIREBASE_SERVICE_ACCOUNT. Si les deux existent, FIREBASE_SERVICE_ACCOUNT_KEY est prioritaire.
- Collez le JSON complet du fichier téléchargé depuis Firebase Console comme valeur de la variable, sans ajouter de guillemets autour de tout le JSON et sans remplacer les séquences \\n à l’intérieur de private_key.
- FIREBASE_PROJECT_ID doit être exactement music-house-bta et le compte de service doit appartenir à ce même projet.
- Les e-mails utilisent les variables serveur RESEND_API_KEY et RESEND_FROM_EMAIL, identiques à Pata. L’adresse d’expédition doit appartenir à un domaine vérifié dans le compte Resend associé à cette clé.
- Le bouton Envoyer un e-mail de test dans Paramètres envoie un message au compte manager connecté. Une erreur Resend affichée doit être corrigée (clé invalide, adresse expéditeur invalide, domaine non vérifié ou restrictions du compte).
- Après modification de variables dans Vercel, déclenchez un nouveau déploiement de Production pour que les fonctions API chargent les nouvelles valeurs.
- Toute clé de compte de service affichée ou partagée dans un chat doit être révoquée et remplacée par une nouvelle clé privée.
