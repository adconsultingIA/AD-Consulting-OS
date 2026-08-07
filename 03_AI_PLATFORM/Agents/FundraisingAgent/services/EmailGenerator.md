# EmailGenerator

## Purpose

Generate the campaign email body only.

The sender identity, signature, CC recipients and attachments are handled by the automation layer.

## Rules

- Generate only the email body.
- Do not generate a signature.
- Do not include "Kind regards", "Best regards" or equivalent closing formulas.
- Do not include sender name.
- Do not include sender title.
- Do not include sender phone.
- Do not include sender email.
- Do not include placeholders such as:
  - [Name]
  - [Title]
  - [Phone]
  - [Email]

## Output

The generated body must end immediately after the final call-to-action sentence.

Example:

Would your team be available for a short introductory call?

## Automation responsibility

Make / EmailEngine adds:

- Sender_Profile
- CC recipient
- sender signature
- attachments
- draft creation
- campaign status update

## Human validation

Every generated email must remain a draft until human validation.
