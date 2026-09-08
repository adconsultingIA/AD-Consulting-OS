from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


CustomerType = Literal[
    "business",
    "consumer",
]


class ClientCreate(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr

    phone: Optional[str] = None
    address: Optional[str] = None

    country_code: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=2,
    )

    region: Optional[str] = None

    customer_type: CustomerType = "business"

    tax_system: Optional[str] = None
    tax_registered: Optional[bool] = None
    tax_identifier: Optional[str] = None

    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None

    phone: Optional[str] = None
    address: Optional[str] = None

    country_code: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=2,
    )

    region: Optional[str] = None

    customer_type: Optional[
        CustomerType
    ] = None

    tax_system: Optional[str] = None
    tax_registered: Optional[bool] = None
    tax_identifier: Optional[str] = None

    notes: Optional[str] = None

    active: Optional[bool] = None


class ClientResponse(ClientCreate):
    id: str
    active: bool = True
    created_at: datetime
