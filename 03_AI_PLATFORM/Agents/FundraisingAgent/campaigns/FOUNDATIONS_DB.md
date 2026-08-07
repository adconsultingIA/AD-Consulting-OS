# Foundations DB

## Purpose

`Foundations_DB` is the master reusable foundation and donor knowledge base for FundraisingAgent and future DonorFlow workflows.

The operational source of truth is the Google Sheets tab:

`Foundations_DB`

## Architecture

- `Foundations_DB` = reusable verified foundation/contact data
- `Emails_Top5` = campaign-specific email execution data
- `Sender_Profile` = sender identity and signature data
- `Make` = workflow orchestration, eligibility control, PDF attachment and Gmail draft creation

## Data quality rules

A foundation record should preserve:

- organisation identity
- country and website
- contact name and role when available
- email address
- email verification status
- contact type
- verification source
- verification date
- confidence level
- intervention domains
- partnership types
- geographic scope
- relationship status
- latest campaign
- notes

## Email verification

An email must not be treated as verified unless supported by a sufficiently reliable source.

Campaign automation must not create a draft when:

- `Email_Verifie != YES`
- the recipient email is missing
- the campaign status is not eligible for draft creation

## Reuse principle

Research once. Verify once. Store once. Reuse across campaigns.

Future fundraising campaigns should query and enrich `Foundations_DB` instead of rebuilding foundation contact data from scratch.

## Current status

The database was initialized during `Campaign_001_Material_Donation` with the first five qualified target organisations.
