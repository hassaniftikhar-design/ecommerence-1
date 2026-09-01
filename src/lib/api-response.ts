import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown[];
}

export function apiSuccess<T>(
  message: string,
  data?: T,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      ...(data !== undefined ? { data } : {})
    },
    { status }
  );
}

export function apiError<T = unknown>(
  message: string,
  errors: unknown[] = [],
  status = 400,
  data?: T
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
      ...(data !== undefined ? { data } : {})
    },
    { status }
  );
}
