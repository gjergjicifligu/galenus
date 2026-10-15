import { notFound } from "next/navigation";
import { staff } from "@/lib/security";
import { dictionary } from "@/lib/db";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Management | Galenus Med Academy",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (lang !== "sq" && lang !== "en") notFound();
  return (
    <Dashboard
      key={lang}
      lang={lang}
      t={dictionary(lang)}
      initialUser={(await staff()) || null}
    />
  );
}
