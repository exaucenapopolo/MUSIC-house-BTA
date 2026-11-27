
# MUSIC HOUSE BTA

## Cahier des charges fonctionnel et technique

**Version :** 1.0  
**Date :** 27 novembre 2026  
**Type :** spécification produit et technique — document de référence pour le développement  
**Structure utilisatrice au lancement :** Young Forever Records  
**Base de données :** Firebase Cloud Firestore  
**Langue :** français  
**Devise :** franc CFA (XAF)

---

**MISSION DU PRODUIT**

Centraliser la gestion des artistes, des rendez-vous, des prestations, des productions musicales et du suivi financier dans une application web unique, connectée à Firestore, avec un tableau de bord interne et un espace client privé.

**DOCUMENT DESTINÉ À :** une IA de développement ou une équipe technique chargée de réaliser l'application et de travailler dans le dépôt GitHub désigné par le propriétaire.

# 1. Présentation du projet

## 1.1 Nom et rôle du produit

**MUSIC HOUSE BTA** est une application web de gestion d'une maison de production et d'un studio musical. Elle doit centraliser dans un seul outil les informations des artistes et clients, les rendez-vous, les prestations, les productions musicales, les paiements, les dépenses et les rapports d'activité.

L'application est utilisée au lancement par **Young Forever Records**, une structure qui réalise notamment l'enregistrement, la production musicale, les arrangements, le mixage, le mastering, la distribution numérique et l'accompagnement opérationnel des projets musicaux.

MUSIC HOUSE BTA est le nom du logiciel. Il ne doit pas être présenté comme le nom juridique du studio ni comme le propriétaire des artistes, des enregistrements ou des actifs de Young Forever Records.

## 1.2 Situation de départ

L'équipe opérationnelle est composée de deux personnes :

- **Manager : Napopolo Exaucé** — organisation du studio, gestion des artistes et clients, rendez-vous, suivi des projets, prospection, communication, distribution numérique, administration et suivi financier.
- **Producteur : Dr Veros** — composition et arrangements, enregistrement, mixage, mastering, suivi technique des productions et disponibilité du studio.

Le logiciel doit faciliter leur collaboration. Le manager doit disposer d'une vue globale sur l'activité. Le producteur doit disposer d'un espace de travail adapté à ses missions techniques. Les artistes et clients doivent pouvoir créer un compte et consulter uniquement leurs propres informations.

## 1.3 Problème à résoudre

Les informations sont actuellement susceptibles d'être dispersées entre les conversations, les appels, les notes et différents fichiers. Cela complique le suivi des rendez-vous, des paiements, des projets en cours et des tâches à effectuer.

MUSIC HOUSE BTA doit devenir le point central de suivi de l'activité. Une information doit être enregistrée une seule fois puis réutilisée dans les profils, le calendrier, les projets, les paiements et les tableaux de bord concernés.

## 1.4 Vision produit

Créer un outil professionnel, simple à utiliser et adapté à une petite équipe, mais construit sur une base technique saine qui pourra évoluer avec la croissance du studio.

La priorité n'est pas de développer immédiatement un logiciel énorme. La priorité est de livrer une première version fiable qui apporte une valeur dès le premier jour : inscrire les artistes, retrouver leurs profils, gérer les rendez-vous, suivre les projets et connaître la situation financière réelle.

# 2. Objectifs et résultats attendus

## 2.1 Objectifs de la première version

1. Centraliser les profils des artistes et des clients dans Firestore.
2. Permettre aux artistes de créer leur compte et de compléter leur profil.
3. Donner au manager un tableau de bord connecté aux données réelles.
4. Donner au producteur un espace adapté au suivi des séances et des étapes techniques.
5. Gérer les rendez-vous, les disponibilités et les éventuels conflits de réservation.
6. Enregistrer les prestations commandées, leurs tarifs et leur état d'avancement.
7. Suivre les projets musicaux de la demande initiale jusqu'à la livraison.
8. Enregistrer les paiements, acomptes, soldes, dépenses et commissions.
9. Donner à chaque artiste un espace privé pour consulter son profil, ses rendez-vous, ses projets et ses paiements.
10. Générer des statistiques et des rapports basés exclusivement sur les données Firestore.
11. Maintenir une expérience fiable avec une connexion instable grâce au cache local persistant et à la synchronisation.

## 2.2 Résultats attendus

À la fin de la première version, l'équipe doit pouvoir répondre rapidement aux questions suivantes :

- Combien d'artistes/clients sont enregistrés ?
- Combien de nouveaux artistes se sont inscrits ce mois-ci ?
- Quels rendez-vous sont prévus aujourd'hui, cette semaine ou ce mois-ci ?
- Quels rendez-vous sont confirmés, terminés, annulés ou en attente ?
- Quels projets sont en cours, en retard ou terminés ?
- Combien a été facturé et combien a réellement été encaissé ?
- Quels clients ont un solde à payer ?
- Quelles dépenses ont été enregistrées ?
- Quelles commissions sont dues au manager et au producteur ?
- Quelle somme reste dans la réserve du studio ?

## 2.3 Principes non négociables

- Les données affichées doivent provenir de Firestore, pas de tableaux fictifs ou de chiffres codés en dur.
- Le tableau de bord administrateur et l'espace client doivent utiliser la même base de données et les mêmes enregistrements de référence.
- Un artiste ne doit jamais pouvoir consulter les données d'un autre artiste.
- Les rôles et permissions doivent être vérifiés par Firebase Security Rules, pas seulement masqués dans l'interface.
- Les montants sont stockés en nombres entiers XAF, jamais en nombres décimaux flottants.
- Les opérations financières importantes doivent être traçables et ne doivent pas être dupliquées lors d'une synchronisation.
- L'application doit rester utilisable sur ordinateur et téléphone.
- La première version ne doit pas dépendre d'une API payante externe pour ses fonctions essentielles.

# 3. Périmètre de la première version

## 3.1 Fonctionnalités indispensables — V1

- **P0 — Authentification et rôles :** connexion, inscription client, séparation manager/producteur/client.
- **P0 — Profils artistes/clients :** création, consultation, modification, recherche et archivage.
- **P0 — Tableau de bord :** statistiques réelles et raccourcis vers les tâches prioritaires.
- **P0 — Rendez-vous :** calendrier, demandes, validation, déplacement, annulation et statuts.
- **P0 — Catalogue des prestations :** services, descriptions, tarifs XAF, durée indicative et activation.
- **P0 — Projets musicaux :** fiche projet, étapes de production, responsable et progression.
- **P0 — Paiements :** acompte, paiement partiel, solde, mode et historique.
- **P0 — Suivi financier :** recettes encaissées, impayés, dépenses et commissions calculées.
- **P0 — Espace client :** profil, rendez-vous, projets et paiements personnels.
- **P0 — Cache hors connexion :** cache Firestore persistant, état de synchronisation et gestion des brouillons.
- **P1 — Distribution numérique :** registre de demandes, métadonnées, statut et répartition spécifique.
- **P1 — Rapports :** rapports quotidiens/mensuels et export CSV/print PDF.
- **P1 — Notifications internes :** alertes dans l'application pour rendez-vous, paiements et projets.

Les éléments P1 doivent être réalisés dans la même livraison si le développement le permet sans compromettre la stabilité des modules P0. Les fonctions P0 doivent toujours être terminées et testées en premier.

## 3.2 Hors périmètre de la V1

Ne pas construire maintenant :

- Un logiciel d'enregistrement audio ou une station de travail musicale (DAW).
- Un système de mixage, mastering ou montage audio intégré.
- Une connexion automatique aux catalogues de Spotify, Apple Music, Deezer ou autres distributeurs.
- Un système de paiement en ligne connecté à un agrégateur ou à un opérateur mobile money. Les paiements sont enregistrés et vérifiés manuellement dans la V1.
- Un outil complet de programmation et de publication automatique sur les réseaux sociaux.
- Un CRM commercial complexe avec automatisations marketing avancées.
- Une application mobile native iOS/Android distincte.
- Une comptabilité certifiée ou une gestion fiscale complète.
- Une gestion multi-studio ou multi-entreprise.
- Un système public de marketplace d'artistes.

Ces idées peuvent être inscrites dans une feuille de route ultérieure, mais elles ne doivent pas retarder la première version opérationnelle.

# 4. Utilisateurs, rôles et permissions

L'application comporte trois rôles principaux.

## 4.1 Manager — Napopolo Exaucé

Accès global de gestion opérationnelle.

Le manager peut :

- Consulter et gérer les profils des artistes et clients.
- Ajouter manuellement un client reçu au studio sans inscription en ligne.
- Gérer le catalogue des prestations et les tarifs.
- Créer, confirmer, déplacer et annuler les rendez-vous.
- Affecter un rendez-vous au producteur.
- Créer les projets et suivre toutes leurs étapes.
- Enregistrer et consulter les paiements, dépenses et soldes.
- Consulter les commissions et rapports.
- Gérer les commandes de distribution numérique.
- Gérer les paramètres opérationnels autorisés.
- Consulter l'historique des actions importantes.

Le manager ne peut pas s'attribuer seul un rôle supérieur, modifier les règles Firestore depuis l'interface ou effacer discrètement les historiques financiers.

## 4.2 Producteur — Dr Veros

Accès opérationnel et technique.

Le producteur peut :

- Consulter son calendrier et les rendez-vous du studio.
- Consulter les informations nécessaires sur les artistes concernés.
- Voir les projets qui lui sont affectés.
- Mettre à jour les étapes techniques : arrangement, enregistrement, mixage, mastering, contrôle et livraison.
- Ajouter des notes techniques internes.
- Signaler un retard, un problème ou un besoin matériel.
- Déclarer une dépense liée à une production pour validation/enregistrement.
- Consulter les informations de paiement nécessaires à la préparation d'une séance et son relevé de commissions.
- Consulter les rapports opérationnels et techniques.

Le producteur ne peut pas modifier les rôles, supprimer un paiement validé, altérer les commissions déjà calculées ou modifier seul les pourcentages de répartition. Les changements sensibles sont soumis aux droits et validations prévus dans les paramètres.

## 4.3 Client / Artiste

Accès strictement limité à son compte.

Le client peut :

- Créer un compte et compléter son profil artistique.
- Mettre à jour les informations personnelles autorisées.
- Consulter les services et tarifs actifs.
- Envoyer une demande de rendez-vous.
- Consulter le statut de ses rendez-vous.
- Consulter ses projets et leur progression visible par le client.
- Consulter ses paiements, acomptes, factures/reçus et soldes.
- Consulter les notifications qui le concernent.
- Contacter le studio par les coordonnées affichées.

Le client ne peut jamais voir la liste générale des artistes, les finances globales, les commissions, les notes internes, les autres rendez-vous privés ou les données d'autres clients.

## 4.4 Attribution des rôles

L'inscription publique crée toujours un compte **client**. Aucun utilisateur ne peut choisir « manager » ou « producteur » lors de son inscription.

Les rôles internes doivent être attribués de manière sécurisée depuis un environnement administrateur de confiance, au moyen de Firebase Admin SDK et/ou de custom claims. Le code navigateur ne doit jamais pouvoir s'attribuer un rôle privilégié.

# 5. Structure de navigation et écrans

## 5.1 Partie publique

- Page de connexion.
- Page de création de compte artiste/client.
- Mot de passe oublié.
- Présentation succincte du studio et de ses services.
- Conditions générales et politique de confidentialité accessibles avant l'inscription/commande.

## 5.2 Interface Manager

Menu latéral recommandé :

1. Tableau de bord
2. Artistes et clients
3. Rendez-vous / Calendrier
4. Prestations et tarifs
5. Projets musicaux
6. Paiements et facturation
7. Dépenses
8. Commissions et réserve
9. Distribution numérique
10. Rapports
11. Paramètres

Les modules Distribution numérique et Rapports peuvent être placés en P1, mais leur structure doit être prévue pour ne pas imposer une refonte plus tard.

## 5.3 Interface Producteur

Menu adapté à son travail :

1. Vue d'ensemble
2. Mon calendrier
3. Artistes concernés
4. Projets et productions
5. Étapes techniques
6. Dépenses à déclarer
7. Mon relevé de commissions

Le producteur ne doit pas être submergé par les menus administratifs dont il n'a pas besoin.

## 5.4 Espace Client / Artiste

Menu simple :

1. Mon accueil
2. Mon profil artistique
3. Prendre rendez-vous
4. Mes rendez-vous
5. Mes projets
6. Mes paiements
7. Notifications
8. Conditions et aide

Sur téléphone, la navigation doit rester simple, avec un menu compact et des actions principales immédiatement visibles.

# 6. Spécifications fonctionnelles détaillées

## 6.1 Authentification et création de compte

- Utiliser Firebase Authentication.
- Prévoir inscription par adresse électronique et mot de passe pour la première version.
- Prévoir connexion, déconnexion, réinitialisation du mot de passe et gestion de session.
- La vérification de l'adresse électronique doit être proposée et exigée avant les actions sensibles si cela est adapté au parcours retenu.
- Lors de la première inscription, créer le document utilisateur correspondant dans Firestore.
- Le rôle initial est toujours `client`.
- Un compte interne manager ou producteur est créé/autorisé séparément par une procédure de configuration sécurisée.
- Gérer correctement les états de chargement, les erreurs d'identifiants et les comptes désactivés.

## 6.2 Inscription et profil artiste

Le formulaire doit rester court. Ne demander que les informations réellement utiles.

Champs recommandés :

- Nom et prénom.
- Nom de scène (facultatif au moment de l'inscription).
- Adresse électronique.
- Téléphone.
- Ville (facultatif).
- Genre musical ou spécialité (facultatif).
- Liens vers réseaux sociaux (facultatifs).
- Courte présentation (facultative).

Le manager peut compléter ou corriger le profil avec l'accord du client. Un client peut modifier ses propres coordonnées et informations artistiques autorisées, mais pas son rôle, son historique de paiements ou les notes internes.

Prévoir la possibilité d'enregistrer un artiste reçu physiquement au studio sans lui créer immédiatement un compte. Le profil pourra être relié à un compte utilisateur plus tard.

Conserver la date de création, la date de dernière modification, la source d'inscription (site ou ajout manuel) et la version des conditions acceptées avec la date d'acceptation.

## 6.3 Tableau de bord Manager

Le tableau de bord doit être connecté à Firestore et se mettre à jour sans recharger toute l'application lorsque les données changent.

### Indicateurs prioritaires

- Nombre total d'artistes/clients actifs.
- Nouveaux artistes inscrits pendant le mois sélectionné.
- Rendez-vous aujourd'hui.
- Rendez-vous à venir.
- Rendez-vous terminés sur la période.
- Projets en cours.
- Projets terminés sur la période.
- Total encaissé sur la période.
- Solde des paiements encore dus.
- Dépenses enregistrées sur la période.
- Commissions dues au manager.
- Commissions dues au producteur.
- Solde de la réserve du studio.

### Contenu complémentaire

- Liste des prochains rendez-vous.
- Dernières inscriptions.
- Projets nécessitant une action.
- Paiements en attente de vérification.
- Impayés et soldes à relancer.
- Activité récente.

Les indicateurs doivent proposer des filtres de période : aujourd'hui, cette semaine, ce mois, mois précédent et période personnalisée.

Chaque carte statistique doit ouvrir la liste détaillée correspondante avec les filtres déjà appliqués.

Aucun chiffre de démonstration ne doit apparaître en environnement réel. Si la base est vide, afficher zéro et un état vide explicatif.

## 6.4 Tableau de bord Producteur

Afficher en priorité :

- Rendez-vous du jour et de la semaine.
- Projets qui lui sont affectés.
- Productions dont une étape est en retard.
- Étapes à réaliser prochainement.
- Dernières notes et demandes du manager.
- Dépenses techniques déclarées en attente de traitement.
- Relevé de ses commissions sur les prestations encaissées.

## 6.5 Catalogue des prestations

Le manager peut créer, modifier, désactiver et réactiver une prestation.

Chaque prestation comprend :

- Nom.
- Catégorie.
- Description claire.
- Prix en XAF.
- Durée indicative en minutes ou heures (si applicable).
- Acompte requis (50 % par défaut pour une réservation de séance).
- Statut actif/inactif.
- Type de répartition financière : `studio` ou `distribution`.

Exemples de catégories :

- Enregistrement.
- Composition / instrumental.
- Arrangement.
- Mixage.
- Mastering.
- Production complète.
- Distribution numérique.
- Service complémentaire.

Lorsqu'un service est ajouté à un rendez-vous ou à une commande, enregistrer un **instantané du nom, du prix et des conditions applicables à cette date**. Une modification future du tarif ne doit pas modifier les anciennes commandes.

## 6.6 Rendez-vous et calendrier

Le calendrier est un module prioritaire.

### Vues

- Jour.
- Semaine.
- Mois.
- Liste chronologique.

### Création d'un rendez-vous

Un rendez-vous contient :

- Client/artiste associé.
- Prestation ou motif.
- Date.
- Heure de début.
- Heure de fin ou durée.
- Producteur/intervenant.
- Prix estimé.
- Acompte attendu.
- Montant payé.
- Solde restant.
- Statut.
- Notes internes.
- Notes visibles par le client si nécessaire.

### Statuts recommandés

- `requested` : demande reçue.
- `awaiting_deposit` : créneau proposé, acompte attendu.
- `confirmed` : rendez-vous confirmé.
- `in_progress` : séance en cours.
- `completed` : séance terminée.
- `cancelled` : annulé.
- `no_show` : client absent.
- `rescheduled` : déplacé (conserver l'historique du changement).

### Règle d'acompte

L'acompte standard est fixé à **50 % du montant estimé de la prestation ou du devis accepté**. Le rendez-vous ne passe à `confirmed` qu'après validation du créneau et vérification de l'acompte par une personne autorisée, sauf dérogation documentée par le manager.

Le client peut envoyer une demande de rendez-vous, mais une demande ne doit pas bloquer définitivement le calendrier tant qu'elle n'est pas validée. Le manager vérifie la disponibilité avant confirmation.

### Anti-double réservation

- Empêcher deux rendez-vous confirmés qui se chevauchent pour la même ressource (studio/intervenant).
- Contrôler les conflits au moment de la confirmation, pas seulement à l'affichage du calendrier.
- Utiliser une transaction ou une stratégie atomique Firestore adaptée.
- Une demande créée hors connexion reste une demande non confirmée jusqu'à la vérification de disponibilité en ligne.

### Fuseau horaire

Toutes les dates/horaires de l'interface opérationnelle doivent être affichés dans le fuseau **Africa/Douala**. Stocker les horodatages de manière cohérente et convertir à l'affichage.

## 6.7 Projets musicaux et suivi de production

Un projet musical est rattaché à un artiste/client. Il peut correspondre à un single, un EP, un album ou une autre prestation.

Champs principaux :

- Titre du projet ou du morceau.
- Artiste principal.
- Type de projet.
- Prestation(s) concernée(s).
- Producteur responsable.
- Date de début.
- Date cible de livraison.
- Statut global.
- Prix convenu et situation de paiement.
- Notes internes.
- Notes visibles par le client.
- Historique des changements.

### Étapes techniques par défaut

1. Préparation / composition / arrangement.
2. Enregistrement.
3. Mixage.
4. Mastering.
5. Vérification finale.
6. Livraison.

Les étapes doivent pouvoir être adaptées par projet. Le producteur met à jour les étapes techniques. Le manager suit l'ensemble, communique avec l'artiste et signale les retards.

Le client voit une progression simplifiée, sans les notes internes ni les informations financières internes.

La V1 gère le suivi et les métadonnées du projet. Elle ne stocke pas les sessions audio lourdes et ne remplace pas les logiciels de production musicale.

## 6.8 Paiements et soldes clients

La première version utilise un **enregistrement manuel des paiements**. Aucun agrégateur de paiement ne doit être intégré obligatoirement au lancement.

Modes de paiement possibles :

- Espèces.
- MTN Mobile Money.
- Orange Money.
- Virement.
- Autre moyen configuré.

Chaque paiement comporte :

- Client.
- Rendez-vous ou projet associé.
- Montant XAF entier.
- Date et heure.
- Mode de paiement.
- Référence facultative.
- Personne ayant enregistré le paiement.
- Statut : en attente de vérification, validé, rejeté ou annulé.
- Commentaire et référence de justificatif si disponible.

Calculer automatiquement :

- Montant total convenu.
- Total encaissé et validé.
- Solde restant.
- Pourcentage payé.
- État : non payé, partiellement payé ou payé.

Un client ne peut jamais créer un paiement validé ni changer le montant encaissé. S'il soumet une référence ou un justificatif, celui-ci reste en attente jusqu'à validation par le manager ou un rôle autorisé.

Les écritures financières validées ne sont pas supprimées. En cas d'erreur, créer une opération d'annulation/correction liée à l'écriture d'origine afin de conserver une piste d'audit.

## 6.9 Répartition automatique des recettes et commissions

Les pourcentages convenus doivent être configurables dans les paramètres, avec historique des changements et date d'entrée en vigueur.

### A. Prestations ordinaires du studio

- **Manager : 25 %**
- **Producteur : 50 %**
- **Réserve du studio : 25 %**
- **Total : 100 %**

### B. Distribution numérique

- **Manager : 70 %**
- **Producteur : 20 %**
- **Réserve du studio : 10 %**
- **Total : 100 %**

Ces pourcentages s'appliquent aux recettes de prestations réellement encaissées et attribuées au type correspondant. Pour une distribution facturée à 5 000 XAF, la répartition de référence est : manager 3 500 XAF, producteur 1 000 XAF, réserve 500 XAF.

### Base de calcul

La base de répartition est le montant effectivement encaissé pour la prestation, après déduction uniquement des frais externes directement liés à cette opération, lorsqu'ils sont réels, justifiés et enregistrés comme déductibles selon les règles convenues. Les charges générales du studio (électricité, entretien courant, fonctionnement) sont financées par la réserve et ne doivent pas être déduites une deuxième fois avant la répartition.

Les sommes perçues pour le compte d'un tiers (par exemple, une somme reversée intégralement à un distributeur ou une plateforme) ne constituent pas automatiquement une recette de service à partager. Enregistrer séparément les frais de service de Young Forever Records et les montants tiers éventuels.

### Calcul et traçabilité

- Calculer les parts à chaque paiement validé, y compris en cas de paiement partiel.
- Conserver le pourcentage applicable au moment du paiement.
- Utiliser les montants entiers XAF.
- Appliquer une règle d'arrondi stable : arrondir les parts calculées au FCFA inférieur et affecter le reliquat à la réserve afin que la somme des parts soit exactement égale à la base partageable.
- Créer une écriture de commission par bénéficiaire, avec statut `due` puis `paid` lors du règlement réel.
- Ne jamais calculer deux fois les commissions lors d'une synchronisation ou d'une nouvelle tentative.
- Ne pas confondre les commissions de service avec les droits d'auteur, droits d'artistes-interprètes ou droits sur les masters.

## 6.10 Dépenses

Permettre d'enregistrer une dépense avec :

- Libellé.
- Catégorie.
- Montant XAF entier.
- Date.
- Personne ayant déclaré la dépense.
- Projet ou rendez-vous lié, si applicable.
- Motif.
- Justificatif ou référence, si disponible.
- Statut : déclarée, à valider, validée, payée ou rejetée.

Les dépenses courantes imputables au fonctionnement général sont suivies dans la réserve. Les frais directement imputables à une commande doivent être identifiés afin d'appliquer correctement la base de répartition.

Prévoir un paramètre de seuil d'autorisation. Tant que le seuil n'est pas défini, les dépenses exceptionnelles ou les investissements importants doivent être marqués « validation conjointe requise » et ne doivent pas être considérés comme autorisés par défaut.

## 6.11 Distribution numérique — version simple

Ce module doit soutenir le travail de distribution déjà réalisé par le manager, sans connexion automatique aux plateformes dans la V1.

Une commande de distribution comprend :

- Artiste.
- Titre du morceau ou nom de l'album/EP.
- Type de sortie.
- Artistes principaux et invités.
- Pochette : référence/URL si disponible.
- Crédits et contributeurs.
- Date souhaitée de sortie.
- Distributeur utilisé.
- Plateformes demandées.
- UPC/EAN et ISRC, lorsqu'ils sont disponibles.
- Tarif du service de distribution.
- Paiement et solde.
- Statut de traitement.
- Date de soumission et date effective de sortie.
- Notes et lien vers la page publique une fois disponible.

Statuts possibles : brouillon, informations à compléter, prêt à soumettre, soumis, en vérification, accepté, publié, rejeté, retiré.

Le logiciel ne doit pas prétendre qu'une sortie est publiée tant que le manager n'a pas confirmé la publication. Il ne doit pas récupérer automatiquement les redevances musicales ni les mélanger aux frais de service.

## 6.12 Notifications internes

Créer des notifications dans l'application pour :

- Nouvelle demande de rendez-vous.
- Rendez-vous confirmé, déplacé ou annulé.
- Acompte à vérifier.
- Paiement enregistré ou rejeté.
- Projet affecté ou étape mise à jour.
- Projet proche de la date cible ou en retard.
- Solde client restant.

Une notification ouverte peut être marquée comme lue. Conserver l'historique nécessaire, mais ne pas encombrer l'écran avec les notifications déjà lues.

Les notifications push, SMS, WhatsApp et emails automatisés ne sont pas obligatoires dans la V1.

## 6.13 Recherche, filtres et exports

Prévoir une recherche globale simple sur les artistes, projets et rendez-vous, avec filtrage par statut, date et type de prestation.

Les listes doivent proposer pagination ou chargement progressif, tri et filtres utiles. Éviter de charger toute la base Firestore à chaque ouverture d'écran.

Prévoir :

- Export CSV des listes et rapports autorisés.
- Vue imprimable du rapport mensuel.
- Export PDF simple des reçus et rapports si réalisable sans service payant.

# 7. Tableau de données Firestore

## 7.1 Source de vérité

**Cloud Firestore est la base de données centrale et la source de vérité du projet.** Les profils, rendez-vous, prestations, projets, paiements, dépenses, commissions, paramètres et notifications doivent être enregistrés dans Firestore.

Ne pas utiliser des données de démonstration comme remplacement permanent de la base. Une donnée saisie dans l'interface doit être persistée dans Firestore et retrouvée après reconnexion ou changement d'appareil.

## 7.2 Collections recommandées

- **`users` :** compte, UID, rôle et état du compte. Accès du propriétaire du compte et des rôles internes autorisés.
- **`artists` :** fiche artiste/client et coordonnées. Accès Manager ; client propriétaire ; producteur selon besoin.
- **`services` :** catalogue et tarifs. Lecture des services actifs par les clients ; écriture Manager.
- **`appointments` :** réservations et séances. Accès Manager ; producteur concerné ; client propriétaire.
- **`projects` :** projets et étapes de production. Accès Manager ; producteur affecté ; client propriétaire pour la partie visible.
- **`payments` :** encaissements et statut de validation. Accès Manager ; client propriétaire en lecture limitée ; producteur selon droit de consultation.
- **`expenses` :** dépenses et justificatifs. Accès Manager ; producteur pour déclarer les dépenses techniques.
- **`commissionEntries` :** parts dues au manager, au producteur et à la réserve. Accès Manager ; producteur sur son relevé.
- **`distributionOrders` :** commandes et suivi de distribution. Accès Manager ; client propriétaire en lecture limitée.
- **`notifications` :** alertes par utilisateur. Accès du destinataire et des rôles internes autorisés.
- **`settings` :** tarifs par défaut, pourcentages, horaires, devise et règles. Accès Manager et permissions conjointes selon le paramètre.
- **`activityLogs` :** historique des actions sensibles. Lecture Manager ; création contrôlée par l'application.

## 7.3 Champs et conventions

- Identifiants : IDs Firestore générés, avec relations par UID ou document ID.
- Montants : entiers XAF.
- Dates : Firestore Timestamp et champs `createdAt`, `updatedAt`.
- Création/modification : utiliser des timestamps serveur lorsque possible.
- Statuts : valeurs normalisées et documentées, pas de variantes libres.
- Propriétaire client : stocker `ownerUid` ou `artistId` pour filtrer les données privées.
- Historique : préférer l'archivage ou un statut inactif plutôt que supprimer les enregistrements métiers importants.

## 7.4 Relations principales

- Un utilisateur client peut être relié à une fiche artiste.
- Un artiste peut avoir plusieurs rendez-vous.
- Un artiste peut avoir plusieurs projets.
- Un rendez-vous peut contenir une ou plusieurs lignes de prestation si nécessaire.
- Un projet peut être lié à plusieurs paiements.
- Un paiement validé peut produire plusieurs écritures de commission.
- Une commande de distribution est liée à un artiste et à une ou plusieurs sorties musicales.

## 7.5 Index et qualité des requêtes

Créer et versionner les index Firestore nécessaires pour les filtres combinant notamment :

- `ownerUid` + `createdAt`.
- `artistId` + `scheduledAt`.
- `status` + `scheduledAt`.
- `producerUid` + `status` + `targetDate`.
- `artistId` + `createdAt`.
- `paymentStatus` + `createdAt`.

Ne pas effectuer de lecture globale non filtrée si une requête limitée suffit. Utiliser pagination et limites de résultats.

# 8. Fonctionnement local, cache et mode hors connexion

## 8.1 Exigence forte de persistance locale

Le logiciel doit rester fluide même lorsque la connexion Internet est instable. Mettre en œuvre le cache local persistant de Firestore pour le Web au moyen de l'API modulaire Firebase actuellement recommandée : `persistentLocalCache`, avec gestion multi-onglets si compatible.

Sur le Web, le cache persistant Firestore s'appuie sur IndexedDB. Il permet de consulter les données déjà mises en cache et de mettre en file les écritures hors connexion ; les changements sont synchronisés lorsque la connexion revient.

## 8.2 Rôle de localStorage

Utiliser `localStorage` uniquement pour les éléments légers non sensibles :

- Préférences d'affichage.
- Thème et densité d'interface.
- Derniers filtres et vues du calendrier.
- Brouillons de formulaires non sensibles.
- Préférences de navigation.

Ne pas utiliser `localStorage` comme base de données principale. Ne pas y stocker les mots de passe, jetons privés, données bancaires, documents d'identité ou l'ensemble des profils clients.

## 8.3 Comportement hors connexion

Afficher clairement l'état : En ligne, Hors connexion, Synchronisation en cours, Modifications en attente, Erreur de synchronisation.

- Les données déjà consultées doivent rester visibles depuis le cache.
- Les changements compatibles avec Firestore peuvent être mis en attente localement.
- Une action non synchronisée doit être signalée comme telle à l'utilisateur.
- Les rendez-vous créés hors connexion restent des demandes non confirmées.
- La confirmation définitive d'un créneau, la validation d'un paiement, les changements de rôles, la modification des pourcentages et les autres opérations financières sensibles exigent une connexion et une vérification en ligne.
- Prévoir un traitement propre des conflits de synchronisation et informer l'utilisateur si une modification n'a pas pu être appliquée.

## 8.4 Confidentialité des appareils

Les données persistantes Firestore peuvent rester en cache sur un appareil. Prévoir une information claire pour les appareils partagés et une option « appareil de confiance » avant d'activer la persistance locale pour des données sensibles. À la déconnexion, effacer les brouillons et données applicatives sensibles conservés par l'application. Documenter la procédure de suppression des données du site sur un appareil public.

# 9. Identité visuelle et expérience utilisateur

## 9.1 Priorité à l'identité existante

Avant de créer l'interface, l'IA de développement doit examiner le dépôt GitHub fourni et rechercher : logo, favicon, couleurs CSS, polices, images, composants existants et conventions graphiques. Si une identité visuelle MUSIC HOUSE BTA est déjà présente dans le dépôt ou fournie par l'utilisateur, elle doit être respectée et réutilisée.

Ne pas inventer une nouvelle identité qui entre en conflit avec les ressources existantes.

## 9.2 Direction artistique de secours

Si aucun logo ni palette n'existe, utiliser une proposition provisoire, facilement modifiable par variables CSS :

- Charbon profond : `#17191F`.
- Noir bleuté : `#101218`.
- Accent or doux : `#C6A56A`.
- Fond clair : `#F6F5F2`.
- Surface : `#FFFFFF`.
- Texte principal : `#22252B`.
- Texte secondaire : `#747B86`.

Cette palette est un point de départ technique, pas une affirmation que ce sont les couleurs officielles de la structure. Centraliser les couleurs, rayons, espacements et typographies dans un thème facilement modifiable.

## 9.3 Style visuel attendu

- Interface premium, moderne, sobre et professionnelle.
- Mise en page nette, hiérarchie typographique claire.
- Tableau de bord lisible sans surcharge de cartes ou de couleurs.
- Sidebar sombre et contenu principal clair, sauf si l'identité existante impose une autre direction.
- Utiliser des icônes cohérentes et peu nombreuses.
- Éviter les dégradés excessifs, les animations décoratives, les badges inutiles et les graphiques sans valeur métier.
- Tableaux, formulaires, filtres et calendrier doivent rester faciles à lire.
- Prévoir les états chargement, vide, erreur, succès et absence de connexion.

## 9.4 Responsive design

L'application doit être pleinement utilisable sur :

- Ordinateur de bureau : expérience de gestion complète.
- Tablette : menus adaptés et tableaux utilisables.
- Téléphone : formulaires courts, navigation simplifiée, calendrier en liste/jour et cartes adaptées.

Ne pas simplement réduire la largeur du bureau : réorganiser les écrans pour le mobile.

## 9.5 Langue et formats

- Interface française par défaut.
- Montants formatés en FCFA/XAF.
- Fuseau horaire Africa/Douala.
- Dates au format français lisible.
- Textes compréhensibles, sans jargon technique destiné aux artistes.

# 10. Architecture technique recommandée

## 10.1 Règle de départ : inspecter le dépôt GitHub

Avant de créer ou modifier des fichiers, l'IA doit examiner la structure du dépôt fourni, les technologies existantes, les scripts, le système de build et les composants déjà disponibles.

Si le dépôt contient déjà une application compatible, la faire évoluer sans réécrire arbitrairement l'ensemble du projet. S'il est vide, initialiser une application propre.

Ne supprimer aucun fichier sans nécessité démontrée. Ne pas remplacer les fichiers de configuration existants sans analyser leurs effets.

## 10.2 Stack de référence

Si le dépôt est vide et qu'aucune contrainte n'est imposée, utiliser :

- React avec TypeScript.
- Vite pour le build frontend.
- Firebase JavaScript SDK modulaire.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Security Rules.
- Tailwind CSS ou un système CSS cohérent et maintenable.
- React Router pour les routes privées/publiques.
- React Hook Form et Zod (ou équivalent léger) pour les formulaires et validations.
- Une bibliothèque d'icônes cohérente telle que Lucide.

Ne pas ajouter des dépendances lourdes sans besoin concret. Réutiliser le framework déjà présent dans le dépôt s'il est sain et compatible.

## 10.3 Firebase

Configurer :

- Firebase Authentication.
- Cloud Firestore.
- Firestore Security Rules.
- Firestore indexes versionnés dans le dépôt.
- Firebase App Check après configuration du domaine de production, si compatible avec le déploiement.
- Firebase Storage uniquement si une fonction d'envoi de fichiers est réellement incluse et configurée ; l'application principale ne doit pas dépendre d'un stockage de gros fichiers audio.

Ne jamais exposer de clé de compte de service ou de secret Admin SDK dans le code frontend.

## 10.4 Configuration et secrets

Créer un fichier `.env.example` listant les variables nécessaires, par exemple les variables publiques de configuration Firebase. Les vraies valeurs sont fournies par le propriétaire dans les variables d'environnement du poste de développement et de l'hébergeur.

Ne jamais committer :

- fichiers `.env` réels ;
- clés privées ;
- fichiers de compte de service ;
- mots de passe ;
- jetons d'accès ;
- données clients réelles.

Ajouter un `.gitignore` correct.

## 10.5 Déploiement

Préparer le projet pour un déploiement frontend sur Vercel ou une plateforme statique équivalente. Documenter clairement la configuration des variables d'environnement et les règles de réécriture des routes SPA.

Les règles Firestore et les index doivent être livrés dans le dépôt et leur procédure de déploiement expliquée. Ne pas déployer sur la production ni modifier les paramètres de facturation sans autorisation explicite du propriétaire.

# 11. Sécurité et protection des données

## 11.1 Sécurité obligatoire

- Toutes les routes privées vérifient la session utilisateur.
- Les droits sont vérifiés dans Firestore Security Rules.
- Un client ne lit et ne modifie que les données autorisées de son propre compte.
- Le client ne peut pas changer `role`, `ownerUid`, `paymentStatus`, les commissions ou les champs de validation.
- Le producteur n'accède qu'aux fonctions autorisées par son rôle.
- Les paiements validés et écritures de commission sont protégés contre la modification ou suppression non autorisée.
- Aucun écran caché ne constitue à lui seul une protection.
- Toute règle doit être refusée par défaut si aucun cas d'autorisation explicite ne s'applique.

## 11.2 Historique des actions

Journaliser les actions sensibles : création/modification d'un profil par un employé, confirmation/annulation d'un rendez-vous, validation/correction d'un paiement, ajout d'une dépense, changement d'un prix, changement de pourcentage et changement d'état d'un projet.

Conserver l'auteur, la date, le type d'action, l'objet concerné et les informations nécessaires à l'audit sans recopier inutilement des données personnelles.

## 11.3 Données personnelles

Ne collecter que les informations utiles à la gestion du studio. Prévoir une politique de confidentialité accessible, une information claire sur l'usage des données, une procédure de correction et une procédure d'archivage/suppression selon les obligations applicables.

Ne pas exposer publiquement les adresses électroniques, numéros, contrats, fichiers ou informations financières des artistes.

# 12. Qualité, tests et critères d'acceptation

La V1 n'est considérée comme terminée que si les scénarios suivants fonctionnent sur la vraie base de test Firebase.

## 12.1 Scénarios fonctionnels obligatoires

1. Un nouvel artiste s'inscrit ; son compte client et sa fiche sont créés dans Firebase Authentication et Firestore.
2. Le manager retrouve ce profil dans la liste et le tableau de bord se met à jour.
3. Le client ne peut pas consulter le profil d'un autre client en modifiant une URL ou un identifiant.
4. Le manager crée une prestation avec un tarif XAF ; le client voit uniquement les prestations actives.
5. Le client envoie une demande de rendez-vous ; elle apparaît dans le calendrier administrateur avec le statut correct.
6. Le manager peut confirmer ou déplacer le rendez-vous ; un conflit d'horaire est bloqué.
7. Un acompte de 50 % est attendu ; un rendez-vous n'est confirmé qu'après validation selon la règle définie.
8. Le manager enregistre un paiement partiel ; le solde restant est recalculé correctement.
9. Les commissions sont calculées une seule fois sur les montants validés avec les pourcentages applicables.
10. Le producteur met à jour une étape technique ; le manager et le client voient chacun la bonne version de l'information selon leurs droits.
11. Le client voit uniquement ses propres projets et paiements.
12. Le tableau de bord affiche des données réelles et cohérentes avec les documents Firestore.
13. Une modification hors connexion est indiquée comme en attente, puis synchronisée au retour du réseau lorsque l'opération est autorisée.
14. Une confirmation de rendez-vous ou validation financière hors connexion est empêchée.
15. Les listes restent utilisables avec pagination et filtres.
16. Le projet démarre et se construit avec les instructions documentées.

## 12.2 Tests de calcul financier

Tester explicitement :

- 100 000 XAF de prestation studio sans frais directs : 25 000 manager, 50 000 producteur, 25 000 réserve.
- 5 000 XAF de frais de service de distribution : 3 500 manager, 1 000 producteur, 500 réserve.
- Paiement fractionné : les commissions cumulées doivent être identiques à celles calculées sur le total encaissé, sans doublon.
- Correction/annulation : les écritures inverses doivent être traçables et le total doit rester cohérent.
- Arrondis : la somme des parts doit toujours être exactement égale à la base partageable.

## 12.3 Tests techniques et sécurité

- `npm install` puis `npm run build` réussissent.
- Le lint/type-check réussit si ces scripts sont définis.
- Les règles Firestore sont testées avec Firebase Emulator Suite ou un environnement de test isolé.
- Les accès non autorisés sont refusés.
- Les index Firestore nécessaires sont fournis.
- Les erreurs réseau, erreurs Firebase et états vides sont gérés proprement.
- Aucun secret n'est présent dans Git.
- Aucune donnée de démonstration ne pollue la base de production.

# 13. Livrables attendus de l'IA de développement

L'IA ne doit pas livrer uniquement une maquette ou une explication. Elle doit réaliser une application fonctionnelle connectée à Firebase.

Livrables attendus dans le dépôt :

- Application complète et responsive.
- Routes Manager, Producteur et Client.
- Configuration Firebase modulaire.
- Modèles/types TypeScript des données.
- Services/repositories Firestore organisés par domaine.
- Firestore Security Rules.
- Firestore indexes.
- `.env.example` et `.gitignore`.
- Procédure sécurisée de création des comptes Manager/Producteur et d'attribution de rôles.
- Données de démonstration facultatives séparées et jamais activées sur la production.
- README en français : installation, configuration Firebase, lancement local, tests, règles et déploiement.
- Tests des calculs financiers, permissions et parcours essentiels.
- Interface avec états de chargement, erreurs, absence de données et mode hors connexion.

# 14. Instructions impératives à l'IA qui réalisera le projet

Le texte ci-dessous constitue l'ordre de réalisation. L'IA doit suivre le cahier des charges et exécuter le développement, pas se limiter à proposer un plan.

1. Commencer par inspecter le dépôt GitHub fourni et résumer brièvement son état, ses technologies et les risques avant toute modification.
2. Si le dépôt est vide, créer le projet selon la stack de référence. S'il existe déjà une application compatible, préserver sa structure et ne modifier que ce qui est nécessaire.
3. Créer une branche de travail dédiée, par exemple `feature/music-house-bta-v1`. Ne pas écraser la branche principale, ne pas faire de force-push, ne pas supprimer de branches et ne pas fusionner sans autorisation explicite.
4. Construire une vraie application connectée à Firebase. Ne pas remplacer Firestore par des données statiques ou un stockage local comme source de vérité.
5. Mettre en place en premier l'authentification, les rôles, les règles de sécurité et le modèle Firestore, puis les profils, le tableau de bord, le calendrier, les prestations, les projets et les finances.
6. Faire fonctionner réellement le parcours complet : inscription artiste → profil Firestore → demande de rendez-vous → validation manager → séance/projet → paiement → calcul des commissions → affichage actualisé des tableaux de bord.
7. Implémenter le cache hors connexion Firestore et les états de synchronisation sans compromettre la confidentialité des données.
8. Ne pas créer de fonctionnalités fictives, boutons sans action, chiffres de démonstration permanents ou pages vides présentées comme terminées.
9. Ne pas intégrer de service payant, passerelle de paiement, API musicale ou dépendance commerciale externe sans autorisation préalable.
10. Ne jamais demander ni inscrire les mots de passe, clés privées ou fichiers de compte de service dans le dépôt. Utiliser `.env.example` et expliquer les variables nécessaires.
11. Après chaque grande étape, exécuter le build et les tests pertinents, corriger les erreurs avant de continuer.
12. À la fin, fournir un bilan des fonctionnalités réellement terminées, les fichiers principaux créés/modifiés, les tests exécutés, les variables Firebase à renseigner et les étapes restant à faire dans la console Firebase.
13. Ne pas déployer en production, ne pas modifier les paramètres de facturation Firebase et ne pas fusionner la branche sans validation explicite.

**Résultat final recherché :** une première version de MUSIC HOUSE BTA immédiatement exploitable par Napopolo Exaucé et Dr Veros pour gérer les artistes, les rendez-vous, les prestations, les productions et le suivi financier, avec un espace client réellement connecté et des données centralisées dans Firestore.

# 15. Comptes et éléments à préparer avant le développement

Le propriétaire du projet préparera les éléments suivants et les transmettra à l'IA par un moyen sécurisé, sans jamais les publier dans GitHub :

- Dépôt GitHub cible et droits d'accès nécessaires.
- Projet Firebase dédié à MUSIC HOUSE BTA.
- Application Web Firebase enregistrée.
- Authentification Email/Mot de passe activée.
- Base Cloud Firestore créée dans la région choisie (le choix de région doit être fait avec attention car il ne se change pas librement après création).
- Domaine de production prévu, si déjà connu.
- Logo MUSIC HOUSE BTA et éléments de marque existants, s'ils existent.
- Coordonnées de contact officielles qui doivent apparaître dans l'espace client.

L'IA doit expliquer comment fournir les variables Firebase via `.env` local et les variables de l'hébergeur. Elle ne doit pas demander les identifiants de connexion personnels de l'utilisateur.

# 16. Évolutions possibles après la V1

À envisager uniquement après validation de la V1 :

- Intégration d'un partenaire de paiement.
- Notifications email, WhatsApp ou push.
- Upload contrôlé de pochettes et justificatifs via Firebase Storage.
- Automatisation ou intégration d'un distributeur numérique, si une API officielle existe et est autorisée.
- Gestion plus avancée des partenariats et prospects.
- Campagnes de communication et calendrier éditorial.
- Gestion d'événements, showcases et concerts.
- Application PWA installable et amélioration du mode hors connexion.
- Plusieurs studios, producteurs ou structures.
- Tableaux de bord analytiques plus poussés.

Aucune de ces évolutions ne doit être développée au détriment de la stabilité, de la sécurité et de la simplicité de la V1.

# 17. Références techniques

Les choix de cache hors connexion, d'autorisations et de gestion des rôles doivent suivre la documentation officielle Firebase à jour au moment du développement :

- Firestore — accès hors connexion et cache persistant : https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firestore — règles de sécurité : https://firebase.google.com/docs/firestore/security/get-started
- Firebase Authentication — custom claims et rôles : https://firebase.google.com/docs/auth/admin/custom-claims
- Firebase App Check : https://firebase.google.com/docs/app-check

L'IA doit vérifier la documentation actuelle avant d'utiliser une API Firebase, notamment pour la configuration du cache persistant Web. Ne pas utiliser une API dépréciée si une API modulaire recommandée plus récente existe.

---

**Fin du cahier des charges — MUSIC HOUSE BTA — Version 1.0**
