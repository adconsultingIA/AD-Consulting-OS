# ADR-001 — FundraisingAgent dans AI Platform

## Statut

Accepté.

## Contexte

FundraisingAgent est utilisé immédiatement pour une campagne réelle de dons de matériel médical.

Il doit ensuite alimenter DonorFlow.

## Décision

FundraisingAgent est placé dans `03_AI_PLATFORM/Agents`.

Il n’est pas considéré comme un produit SaaS indépendant.

DonorFlow sera le produit métier qui consommera cet agent.

## Conséquences

- L’intelligence métier est réutilisable.
- Le prototype peut être utilisé immédiatement.
- DonorFlow peut intégrer l’agent ultérieurement.
- Les moteurs communs doivent être déplacés vers SharedAI.
