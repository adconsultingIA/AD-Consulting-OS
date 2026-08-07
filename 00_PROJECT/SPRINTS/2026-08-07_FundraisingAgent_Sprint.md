# Sprint Progress — FundraisingAgent

**Date:** 2026-08-07  
**Projet:** AD Consulting IA  
**Composant:** FundraisingAgent  
**Campagne:** Campaign_001_Material_Donation  
**Statut:** Core workflow validated

---

## 1. Objectif du sprint

Construire et valider un premier workflow opérationnel de fundraising assisté par IA pour CDH Medicals Cameroun, depuis la qualification des organisations jusqu'à la création contrôlée de brouillons Gmail.

Principe d'architecture :

> Construire une fois. Réutiliser partout.

---

## 2. Réalisations

| Élément | Statut |
|---|---|
| Qualification Top 5 | DONE |
| Vérification des contacts | DONE |
| Emails_Top5 | DONE |
| DRAFT GATE Make | DONE |
| Contrôle Email vérifié | DONE |
| Contrôle Email destinataire | DONE |
| Sender_Profile | DONE |
| Signature dynamique | DONE |
| CC dynamique | DONE |
| Pièce jointe PDF | DONE |
| Création Gmail Draft | DONE |
| Update Row automatique | DONE |
| Statut Brouillon créé | DONE |
| Foundations_DB | DONE |
| Documentation Foundations_DB | DONE |
| Validation humaine avant envoi | ACTIVE |

---

## 3. Organisations qualifiées

- UNFPA Cameroun
- Catholic Relief Services Cameroun
- Clinton Health Access Initiative Cameroun
- UNICEF Cameroun
- Wellbeing Foundation Africa

Les contacts retenus ont été intégrés dans `Foundations_DB` avec leur niveau de vérification, source et date de vérification.

---

## 4. Architecture validée

### Foundations_DB

Base de connaissance durable des fondations, partenaires et contacts vérifiés.

### Emails_Top5

Table opérationnelle propre à la campagne.

### FundraisingAgent

Produit le contenu personnalisé des emails.

Le générateur doit produire uniquement le corps du message.

### Sender_Profile

Centralise l'identité de l'expéditeur :

- nom
- fonction
- organisation
- téléphone
- email
- CC
- signature

### Make

Orchestre :

1. lecture des lignes de campagne ;
2. contrôle DRAFT GATE ;
3. récupération de la pièce jointe ;
4. récupération du Sender_Profile ;
5. création du brouillon Gmail ;
6. mise à jour du statut.

### Human-in-the-loop

Aucun email de fundraising n'est envoyé automatiquement.

La validation humaine reste obligatoire avant envoi.

---

## 5. DRAFT GATE

Un brouillon ne peut être créé que lorsque :

- `Statut = Brouillon à valider`
- `Email vérifié = YES`
- `Email destinataire` existe

Après création réussie :

`Brouillon à valider -> Brouillon créé`

Cette règle empêche notamment l'utilisation automatique de contacts non vérifiés.

---

## 6. Décisions d'architecture

### Séparation données / campagne

`Foundations_DB` devient la base durable.

Les campagnes ne doivent pas reconstruire les informations déjà vérifiées.

### Séparation contenu / identité

FundraisingAgent génère le corps du message.

Make injecte l'identité et la signature depuis `Sender_Profile`.

### Human validation

La génération peut être automatisée.

L'envoi reste une décision humaine.

---

## 7. Dette technique identifiée

- construire le workflow de suivi après envoi ;
- gérer les relances ;
- enregistrer les réponses ;
- synchroniser les informations de campagne vers Foundations_DB ;
- automatiser progressivement l'enrichissement de Foundations_DB ;
- compléter le bootstrap MediFlow actuellement placeholder.

---

## 8. Prochain sprint

### Campaign Follow-up

Pipeline cible :

`Brouillon créé -> Envoyé -> En attente -> Réponse reçue -> Relance -> Opportunité / Refus`

Données prévues :

- Date_Envoi
- Statut_Suivi
- Date_Derniere_Relance
- Date_Prochaine_Action
- Reponse
- Notes_Suivi

---

## 9. Preuves Git

Commits principaux :

- `9a63734` — chore: bootstrap MediFlow product architecture
- `a7f4cbb` — feat(fundraising): standardize email body and sender profile workflow
- `afda907` — feat(fundraising): establish reusable foundations database

---

## 10. Résultat du sprint

Le projet dispose désormais d'un premier pipeline FundraisingAgent opérationnel et réutilisable :

`Foundation intelligence -> Campaign -> AI email body -> Quality Gate -> Sender Profile -> Gmail Draft -> Human Validation`

La prochaine évolution porte sur le suivi du cycle de relation après création et envoi des emails.
