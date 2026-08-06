# ADR-002 — Moteurs IA partagés

## Statut

Accepté.

## Décision

Les moteurs génériques sont centralisés dans :

`03_AI_PLATFORM/SharedAI/Engines`

## Moteurs initiaux

- DocumentParser
- MatchingEngine
- StrategyEngine
- DecisionEngine
- EmailEngine
- FollowUpEngine
- ReportingEngine
- ScoringEngine
- PromptEngine
- MemoryEngine

## Conséquence

Les agents et produits doivent réutiliser ces moteurs avant de créer une nouvelle implémentation.
