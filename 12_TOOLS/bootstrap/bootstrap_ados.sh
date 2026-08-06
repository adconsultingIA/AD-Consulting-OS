#!/usr/bin/env bash

set -euo pipefail

ROOT="$(pwd)"

echo "Création de l’architecture AD Consulting OS dans : $ROOT"

# ============================================================
# 1. AI PLATFORM — SharedAI et moteurs communs
# ============================================================

ENGINES=(
  DocumentParser
  MatchingEngine
  StrategyEngine
  DecisionEngine
  EmailEngine
  FollowUpEngine
  ReportingEngine
  ScoringEngine
  PromptEngine
  MemoryEngine
)

for engine in "${ENGINES[@]}"; do
  mkdir -p \
    "03_AI_PLATFORM/SharedAI/Engines/$engine/docs" \
    "03_AI_PLATFORM/SharedAI/Engines/$engine/schemas" \
    "03_AI_PLATFORM/SharedAI/Engines/$engine/tests"

  if [[ ! -f "03_AI_PLATFORM/SharedAI/Engines/$engine/README.md" ]]; then
    cat > "03_AI_PLATFORM/SharedAI/Engines/$engine/README.md" <<EOF
# $engine

## Mission

Décrire la responsabilité du moteur.

## Entrées

À définir.

## Sorties

À définir.

## Règles métier

À définir.

## Réutilisation

Ce moteur doit pouvoir être utilisé par plusieurs agents et produits.

## Statut

Documentation initiale.
EOF
  fi
done

# ============================================================
# 2. AI PLATFORM — Ressources partagées
# ============================================================

mkdir -p \
  03_AI_PLATFORM/SharedAI/Taxonomies \
  03_AI_PLATFORM/SharedAI/EmailTemplates \
  03_AI_PLATFORM/SharedAI/PromptPatterns \
  03_AI_PLATFORM/SharedAI/ScoringModels \
  03_AI_PLATFORM/SharedAI/DecisionRules \
  03_AI_PLATFORM/SharedAI/JSONSchemas

for directory in \
  Taxonomies \
  EmailTemplates \
  PromptPatterns \
  ScoringModels \
  DecisionRules \
  JSONSchemas
do
  touch "03_AI_PLATFORM/SharedAI/$directory/.gitkeep"
done

# ============================================================
# 3. AI SDK
# ============================================================

mkdir -p \
  03_AI_PLATFORM/SDK/src/ados_ai \
  03_AI_PLATFORM/SDK/tests \
  03_AI_PLATFORM/SDK/docs

SDK_FILES=(
  agent.py
  engines.py
  prompts.py
  memory.py
  tools.py
  schemas.py
  config.py
  __init__.py
)

for file in "${SDK_FILES[@]}"; do
  touch "03_AI_PLATFORM/SDK/src/ados_ai/$file"
done

if [[ ! -f "03_AI_PLATFORM/SDK/README.md" ]]; then
  cat > 03_AI_PLATFORM/SDK/README.md <<'EOF'
# AD Consulting AI SDK

## Objectif

Fournir une bibliothèque commune pour construire les agents IA de l’écosystème.

## Composants prévus

- Agent de base
- Moteurs réutilisables
- Prompts
- Mémoire
- Outils
- Schémas
- Configuration
- Tests

## Statut

Structure initiale. Aucun code de production pour le moment.
EOF
fi

touch \
  03_AI_PLATFORM/SDK/pyproject.toml \
  03_AI_PLATFORM/SDK/CHANGELOG.md

# ============================================================
# 4. FUNDRAISING AGENT
# ============================================================

mkdir -p \
  03_AI_PLATFORM/Agents/FundraisingAgent/config \
  03_AI_PLATFORM/Agents/FundraisingAgent/prompts \
  03_AI_PLATFORM/Agents/FundraisingAgent/knowledge/foundations \
  03_AI_PLATFORM/Agents/FundraisingAgent/knowledge/campaigns \
  03_AI_PLATFORM/Agents/FundraisingAgent/memory \
  03_AI_PLATFORM/Agents/FundraisingAgent/tools \
  03_AI_PLATFORM/Agents/FundraisingAgent/workflows/make \
  03_AI_PLATFORM/Agents/FundraisingAgent/workflows/n8n \
  03_AI_PLATFORM/Agents/FundraisingAgent/templates \
  03_AI_PLATFORM/Agents/FundraisingAgent/tests \
  03_AI_PLATFORM/Agents/FundraisingAgent/docs \
  03_AI_PLATFORM/Agents/FundraisingAgent/logs \
  03_AI_PLATFORM/Agents/FundraisingAgent/examples \
  03_AI_PLATFORM/Agents/FundraisingAgent/campaigns/Campaign_001_Material_Donation/attachments \
  03_AI_PLATFORM/Agents/FundraisingAgent/campaigns/Campaign_001_Material_Donation/emails \
  03_AI_PLATFORM/Agents/FundraisingAgent/campaigns/Campaign_001_Material_Donation/results \
  03_AI_PLATFORM/Agents/FundraisingAgent/campaigns/Campaign_001_Material_Donation/logs

touch \
  03_AI_PLATFORM/Agents/FundraisingAgent/CHANGELOG.md \
  03_AI_PLATFORM/Agents/FundraisingAgent/config/agent.yaml \
  03_AI_PLATFORM/Agents/FundraisingAgent/memory/CampaignMemory.md \
  03_AI_PLATFORM/Agents/FundraisingAgent/tools/TOOLS.md \
  03_AI_PLATFORM/Agents/FundraisingAgent/workflows/make/README.md \
  03_AI_PLATFORM/Agents/FundraisingAgent/tests/TEST_CASES.md \
  03_AI_PLATFORM/Agents/FundraisingAgent/docs/ARCHITECTURE.md \
  03_AI_PLATFORM/Agents/FundraisingAgent/logs/.gitkeep \
  03_AI_PLATFORM/Agents/FundraisingAgent/examples/.gitkeep

if [[ ! -f "03_AI_PLATFORM/Agents/FundraisingAgent/templates/FoundationStrategyTemplate.md" ]]; then
  cat > 03_AI_PLATFORM/Agents/FundraisingAgent/templates/FoundationStrategyTemplate.md <<'EOF'
# Foundation Strategy

## Organisation

## Type d’organisation

## Pays

## Site officiel

## Contact

## Campagne

Campaign 001 — Material Donation

## Score de compatibilité

0/100

## Statut de vérification

Non vérifié

## Pourquoi cette organisation ?

## Objectif du contact

## Arguments recommandés

## Arguments à éviter

## Équipements pertinents

## Pièces jointes

- Présentation du projet
- Liste des équipements

## Canal recommandé

## Langue

## Ton

## Appel à l’action

## Risques

## Informations à vérifier

## Prochaine action

## Validation humaine

Obligatoire
EOF
fi

if [[ ! -f "03_AI_PLATFORM/Agents/FundraisingAgent/templates/EmailTemplate_MaterialDonation.md" ]]; then
  cat > 03_AI_PLATFORM/Agents/FundraisingAgent/templates/EmailTemplate_MaterialDonation.md <<'EOF'
# Email Template — Material Donation

## Objet

À personnaliser.

## Salutation

À personnaliser.

## Présentation

Présentation courte de CDH Medicals Cameroun.

## Contexte

Ouverture et équipement d’une clinique à Mbankomo, près de Yaoundé.

## Correspondance avec le destinataire

Uniquement à partir d’informations vérifiées.

## Demande

Partenariat technique, don d’équipement ou orientation vers le programme approprié.

## Impact attendu

Amélioration de l’accès aux soins pour les populations locales.

## Appel à l’action

Proposer un échange ou demander les modalités de partenariat.

## Pièces jointes

- Présentation du projet
- Liste des équipements

## Validation humaine

Obligatoire avant envoi.
EOF
fi

if [[ ! -f "03_AI_PLATFORM/Agents/FundraisingAgent/knowledge/FundraisingTaxonomy.md" ]]; then
  cat > 03_AI_PLATFORM/Agents/FundraisingAgent/knowledge/FundraisingTaxonomy.md <<'EOF'
# Fundraising Taxonomy

## Secteurs

- Santé
- Santé publique
- Hôpitaux
- Cliniques
- Laboratoire
- Santé maternelle
- Santé infantile
- Urgences
- Humanitaire
- Développement

## Types de soutien

- Don matériel
- Don en nature
- Financement
- Partenariat technique
- Mécénat
- Sponsoring
- Mise à disposition
- Matériel reconditionné
- Formation
- Expertise

## Types d’organisations

- Fondation privée
- Fondation d’entreprise
- Fondation publique
- ONG
- Hôpital
- Clinique
- Fabricant médical
- Distributeur biomédical
- Institution publique
- Organisation internationale

## Zones géographiques

- Afrique
- Afrique centrale
- Cameroun
- Yaoundé
- Mbankomo
- International

## Types d’équipements

- Diagnostic
- Laboratoire
- Hospitalisation
- Consultation
- Maternité
- Dentaire
EOF
fi

# ============================================================
# 5. COREFLOW API — Domaines communs
# ============================================================

COREFLOW_MODULES=(
  Auth
  Users
  Organizations
  Roles
  Projects
  Campaigns
  Documents
  Emails
  Notifications
  Files
  Analytics
  Billing
  Features
  AuditLogs
)

for module in "${COREFLOW_MODULES[@]}"; do
  mkdir -p \
    "02_COREFLOW/API/$module/docs" \
    "02_COREFLOW/API/$module/schemas" \
    "02_COREFLOW/API/$module/tests"

  if [[ ! -f "02_COREFLOW/API/$module/README.md" ]]; then
    cat > "02_COREFLOW/API/$module/README.md" <<EOF
# CoreFlow API — $module

## Responsabilité

À définir.

## Capacités communes

À définir.

## Produits consommateurs

À définir.

## Statut

Conception.
EOF
  fi
done

# ============================================================
# 6. DONORFLOW — Structure préparatoire
# ============================================================

mkdir -p \
  04_PRODUCTS/DonorFlow/backend/app \
  04_PRODUCTS/DonorFlow/backend/tests \
  04_PRODUCTS/DonorFlow/frontend/src \
  04_PRODUCTS/DonorFlow/frontend/tests \
  04_PRODUCTS/DonorFlow/database/migrations \
  04_PRODUCTS/DonorFlow/docs/adr \
  04_PRODUCTS/DonorFlow/knowledge \
  04_PRODUCTS/DonorFlow/agents \
  04_PRODUCTS/DonorFlow/api \
  04_PRODUCTS/DonorFlow/automations \
  04_PRODUCTS/DonorFlow/assets

touch \
  04_PRODUCTS/DonorFlow/backend/app/.gitkeep \
  04_PRODUCTS/DonorFlow/backend/tests/.gitkeep \
  04_PRODUCTS/DonorFlow/frontend/src/.gitkeep \
  04_PRODUCTS/DonorFlow/frontend/tests/.gitkeep \
  04_PRODUCTS/DonorFlow/database/migrations/.gitkeep \
  04_PRODUCTS/DonorFlow/docs/adr/.gitkeep \
  04_PRODUCTS/DonorFlow/knowledge/.gitkeep \
  04_PRODUCTS/DonorFlow/agents/.gitkeep \
  04_PRODUCTS/DonorFlow/api/.gitkeep \
  04_PRODUCTS/DonorFlow/automations/.gitkeep \
  04_PRODUCTS/DonorFlow/assets/.gitkeep

# ============================================================
# 7. DÉMONSTRATEURS
# ============================================================

DEMOS=(
  FundraisingAgent
  DevisFlow
  DonorFlow
  BookingFlow
  InsightFlow
  ColiAfrikFlow
  ADConsultingGroupWebsite
  ClientWebsites
)

for demo in "${DEMOS[@]}"; do
  mkdir -p \
    "98_DEMOS/$demo/screenshots" \
    "98_DEMOS/$demo/videos" \
    "98_DEMOS/$demo/docs"

  touch \
    "98_DEMOS/$demo/screenshots/.gitkeep" \
    "98_DEMOS/$demo/videos/.gitkeep"

  if [[ ! -f "98_DEMOS/$demo/README.md" ]]; then
    cat > "98_DEMOS/$demo/README.md" <<EOF
# Démonstrateur — $demo

## Problème résolu

À compléter.

## Solution

À compléter.

## Démonstration

À compléter.

## Technologies

À compléter.

## Résultats

À compléter.

## Statut

En préparation.
EOF
  fi
done

# ============================================================
# 8. ADR — Décisions d’architecture
# ============================================================

mkdir -p \
  01_BOS/ADR \
  99_PROJECT_MEMORY/SPRINTS

if [[ ! -f "01_BOS/ADR/ADR-001-FundraisingAgent-in-AI-Platform.md" ]]; then
  cat > 01_BOS/ADR/ADR-001-FundraisingAgent-in-AI-Platform.md <<'EOF'
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
EOF
fi

if [[ ! -f "01_BOS/ADR/ADR-002-Shared-AI-Engines.md" ]]; then
  cat > 01_BOS/ADR/ADR-002-Shared-AI-Engines.md <<'EOF'
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
EOF
fi

if [[ ! -f "99_PROJECT_MEMORY/SPRINTS/SPRINT_001.md" ]]; then
  cat > 99_PROJECT_MEMORY/SPRINTS/SPRINT_001.md <<'EOF'
# Sprint 001 — FundraisingAgent MVP

## Objectif

Préparer et lancer une première campagne contrôlée de demandes de dons de matériel médical pour CDH Medicals Cameroun.

## Livrables

- AI Agent Standard
- FundraisingAgent
- Analyse du projet
- Scoring des organismes
- Top 10
- Fiches de stratégie
- Emails personnalisés
- Workflow Make
- Brouillons Gmail
- Suivi de campagne

## Résultat attendu

Première vague d’emails validés et envoyés.

## Statut

En cours.
EOF
fi

# ============================================================
# 9. Index technique
# ============================================================

if [[ ! -f "03_AI_PLATFORM/SharedAI/README.md" ]]; then
  cat > 03_AI_PLATFORM/SharedAI/README.md <<'EOF'
# SharedAI

SharedAI rassemble les moteurs, taxonomies, modèles, règles et schémas réutilisables par plusieurs agents et produits.

## Principe

Construire une fois. Réutiliser partout.
EOF
fi

# ============================================================
# 10. Résultat
# ============================================================

echo
echo "Architecture générée avec succès."
echo
echo "Résumé Git :"
git status --short
echo
echo "Étape suivante :"
echo "  git add ."
echo '  git commit -m "chore: bootstrap reusable AI platform architecture"'
echo "  git push"
