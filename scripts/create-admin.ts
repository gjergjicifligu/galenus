import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { passwordHash } from "../lib/security";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.ADMIN_PASSWORD;
if (
  !email ||
  !/^\S+@\S+\.\S+$/.test(email) ||
  !password ||
  password.length < 12
)
  throw new Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in the process environment.",
  );
db()
  .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
  .run(
    randomUUID(),
    email,
    process.env.ADMIN_NAME || "Administrator",
    passwordHash(password),
    "admin",
  );
console.log(
  "Administrator created. Clear ADMIN_PASSWORD from the environment.",
);
