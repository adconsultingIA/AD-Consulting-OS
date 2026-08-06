# AD Consulting AI — AI Agent Standard

## 1. Objet

Ce document définit le standard commun de conception, de documentation et d’exploitation de tous les agents IA de l’écosystème AD Consulting OS.

Tous les agents doivent respecter cette structure afin de garantir :

- la réutilisabilité ;
- la cohérence ;
- la sécurité ;
- la traçabilité ;
- la maintenabilité ;
- l’intégration future dans CoreFlow et les produits métiers.

Principe directeur :

> Construire une fois. Réutiliser partout.

---

## 2. Identity Card

Chaque agent doit disposer d’une carte d’identité explicite.

```yaml
agent:
  name: FundraisingAgent
  version: 0.1.0
  platform: AD Consulting AI Platform
  owner: AD Consulting Group
  domain: Fundraising
  status: Prototype
  environment: Internal