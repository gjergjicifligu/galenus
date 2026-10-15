import { z } from "zod";
const text = z.string().max(12000).optional();
const media = z.string().uuid().or(z.literal("")).optional();
export const validDate = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value),
  );
export const recordSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  kind: z.enum([
    "gallery",
    "modules",
    "doctors",
    "pages",
    "settings",
    "contacts",
  ]),
  name: text,
  title_sq: text,
  title_en: text,
  description_sq: text,
  description_en: text,
  biography_sq: text,
  biography_en: text,
  specialty_sq: text,
  specialty_en: text,
  qualifications_sq: text,
  qualifications_en: text,
  experience_sq: text,
  experience_en: text,
  category_sq: text,
  category_en: text,
  lecturer: text,
  lecturerDetails_sq: text,
  lecturerDetails_en: text,
  email: z.string().email().or(z.literal("")).optional(),
  phone: z
    .string()
    .max(100)
    .regex(/^[+\d\s().-]*$/)
    .optional(),
  address_sq: text,
  address_en: text,
  hours_sq: text,
  hours_en: text,
  date: validDate.optional(),
  thumbnail: media,
  media,
  fullMedia: media,
  resources: z
    .array(
      z.object({
        id: z.string().uuid(),
        media: z.string().uuid(),
        title_sq: z.string().trim().min(1).max(200),
        title_en: z.string().max(200).default(""),
        description_sq: z.string().max(12000).default(""),
        description_en: z.string().max(12000).default(""),
        language: z.enum(["sq", "en", "both"]),
        order: z.number().int().min(0).max(10000),
        published: z.boolean(),
        mime: z.string().optional(),
      }),
    )
    .max(50)
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length)
    .optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  placeholder: z.boolean().optional(),
});
export const userSchema = z.object({
  id: z.string().uuid().optional(),
  email: z
    .string()
    .email()
    .max(254)
    .transform((x) => x.toLowerCase()),
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "user"]),
  password: z.string().min(12).max(128).or(z.literal("")).optional(),
});
