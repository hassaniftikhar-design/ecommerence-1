export interface UserAddress {
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  name?: string;
  email?: string;
}

export interface UpdateAddressPayload {
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  name?: string;
}

