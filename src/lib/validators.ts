import { z } from "zod";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const phone = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .regex(/^[+0-9\s-]+$/, "Enter a valid phone number");

export const signupSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    mobile: phone,
    password,
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords must match",
        path: ["confirmPassword"],
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const forgotEmailSchema = z.object({
  phone: phone,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Missing reset token"),
    password,
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords must match",
        path: ["confirmPassword"],
      });
    }
  });

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  mobile: phone,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords must match",
        path: ["confirmPassword"],
      });
    }
  });

export const createProductSchema = z
  .object({
    name: z.string().min(1, "Product name is required"),
    price: z.number().positive("Price must be greater than zero"),
    stock: z.number().int().nonnegative("Stock must be zero or greater"),
    imageUrl: z.string().optional().or(z.literal("")),
    categoryId: z.string().optional(),
    categoryName: z.string().min(1, "Category name is required").optional(),
  })
  .refine(
    (data) => Boolean(data.categoryId) || Boolean(data.categoryName),
    {
      message: "Category ID or name is required",
      path: ["categoryName"],
    },
  );

export const updateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    stock: z.number().int().nonnegative().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
    categoryId: z.string().optional(),
    categoryName: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.categoryId) || Boolean(data.categoryName) ||
      Boolean(data.name) ||
      data.price !== undefined ||
      data.stock !== undefined ||
      data.imageUrl !== undefined,
    {
      message: "At least one field is required for update",
      path: ["name"],
    },
  );
