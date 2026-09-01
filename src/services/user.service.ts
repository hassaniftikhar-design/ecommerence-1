import type { UserAddress, UpdateAddressPayload } from "@/types/user.types";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export async function getUserAddress(): Promise<UserAddress> {
  const response = await fetch("/api/user/address", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const json: ApiResponse<{ address: UserAddress }> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || "Failed to load address");
  }

  return json.data.address;
}

export async function updateUserAddress(
  payload: UpdateAddressPayload
): Promise<UserAddress> {
  const response = await fetch("/api/user/address", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<{ address: UserAddress }> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || "Failed to update address");
  }

  return json.data.address;
}
