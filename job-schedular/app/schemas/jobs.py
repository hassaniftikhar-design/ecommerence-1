"""Job request and payload schemas."""

from typing import Optional
from pydantic import BaseModel, Field, EmailStr, model_validator


class ForgotPasswordJobRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="User ID in database")
    email: Optional[str] = Field(None, description="User email address")
    reset_token: str = Field(..., min_length=8, description="Secure password reset token")
    expiry_minutes: Optional[int] = Field(None, description="Password reset expiration time in minutes")

    @model_validator(mode="after")
    def check_identifier(self):
        if not self.user_id and not self.email:
            raise ValueError("Either user_id or email must be provided")
        return self


class OrderPlacedJobRequest(BaseModel):
    order_id: str = Field(..., min_length=1, description="Database ID of the placed order")


class OrderStatusJobRequest(BaseModel):
    order_id: str = Field(..., min_length=1, description="Database ID of the order")
    previous_status: Optional[str] = Field(None, description="Status before update")
    new_status: Optional[str] = Field(None, description="Status after update")


class FacebookOtpJobRequest(BaseModel):
    email: str = Field(..., min_length=3, description="Recipient email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP verification code")


