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
  price: z.number().positive("Price must be greater than zero"),
  stock: z.number().int().nonnegative("Stock must be zero or greater"),
  images: z.array(z.string()).default([]),
  attributes: z.record(z.string()).default({}),
});

export const createProductSchema = z
  .object({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional().nullable(),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
    options: z.array(productOptionSchema).default([]),
    variants: z.array(productVariantSchema).default([]),
    // Backward-compatibility single variant fields
    price: z.number().positive().optional(),
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
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
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
  color: z.string().trim().min(1, "Color is required"),
  size: z.string().trim().min(1, "Size is required"),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .gt(0, "Quantity must be greater than 0"),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Product Name is required"),
    description: z.string().optional(),
    categoryName: z.string().trim().min(1, "Category is required"),
    price: z
      .number({ invalid_type_error: "Price must be a number" })
      .gt(0, "Price must be greater than 0"),
    imageUrl: z.string().optional(),
    variants: z
      .array(productVariantItemSchema)
      .min(1, "At least one variant is required"),
  })
  .superRefine((data, ctx) => {
    const seenCombos = new Set<string>();
    data.variants.forEach((v, index) => {
      if (v.color && v.size) {
        const comboKey = `${v.color.trim().toLowerCase()}:${v.size.trim().toLowerCase()}`;
        if (seenCombos.has(comboKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate Color (${v.color}) and Size (${v.size}) combination`,
            path: ["variants", index, "color"],
          });
        }
        seenCombos.add(comboKey);
      }
    });
  });

export type ProductFormSchemaValues = z.infer<typeof productFormSchema>;

