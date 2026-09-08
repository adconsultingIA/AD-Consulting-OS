from enum import Enum


class QuoteStatus(str, Enum):
    DRAFT = "draft"
    READY = "ready"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
