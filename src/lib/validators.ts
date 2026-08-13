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

export const productOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  values: z.array(z.string().min(1, "Option value cannot be empty")).min(1, "At least one value is required"),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().optional(),
  stock: z.number().int().nonnegative("Stock must be zero or greater"),
  images: z.array(z.string()).default([]),
  attributes: z.record(z.string()).default({}),
});

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Product Title is required").max(500, "Product Title cannot exceed 500 characters"),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
    options: z.array(productOptionSchema).default([]),
    variants: z.array(productVariantSchema).default([]),
    // Backward-compatibility single variant fields
    // price: z.number().positive().optional(),
    price: z.number().positive(),
    stock: z.number().int().nonnegative().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => Boolean(data.categoryId) || Boolean(data.categoryName),
    {
      message: "Category is required",
      path: ["categoryName"],
    }
  );

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(500).optional(),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
    options: z.array(productOptionSchema).optional(),
    variants: z.array(productVariantSchema).optional(),
    price: z.number().positive().optional(),
    stock: z.number().int().nonnegative().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
  });

export const productVariantItemSchema = z.object({
  id: z.string().optional(),
  color: z.string().optional().or(z.literal("")),
  size: z.string().optional().or(z.literal("")),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .min(0, "Quantity cannot be negative"),
  file: z.any().optional(),
  previewUrl: z.string().optional(),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Product Title is required").max(500, "Product Title cannot exceed 500 characters"),
    categoryName: z.string().trim().min(1, "Category is required"),
    price: z
      .number({ invalid_type_error: "Price must be a number" })
      .min(0, "Price cannot be negative"),
    defaultImageFile: z.any().optional(),
    defaultImageUrl: z.string().optional(),
    variants: z.array(productVariantItemSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.defaultImageFile && (!data.defaultImageUrl || !data.defaultImageUrl.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Default Product Image is required",
        path: ["defaultImageUrl"],
      });
    }

    const seenCombos = new Set<string>();
    data.variants.forEach((v, index) => {
      const colorVal = (v.color || "").trim().toLowerCase();
      const sizeVal = (v.size || "").trim().toLowerCase();
      if (colorVal || sizeVal) {
        const comboKey = `${colorVal}:${sizeVal}`;
        if (seenCombos.has(comboKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate variant combination`,
            path: ["variants", index, "color"],
          });
        }
        seenCombos.add(comboKey);
      }
    });
  });

export type ProductFormSchemaValues = z.infer<typeof productFormSchema>;

