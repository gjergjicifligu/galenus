import { notFound } from "next/navigation";
import { dictionary } from "@/lib/db";
import { subscriberForToken } from "@/lib/newsletter";
import { UnsubscribeForm } from "@/components/unsubscribe-form";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { lang } = await params;
  if (lang !== "sq" && lang !== "en") notFound();
  const token = (await searchParams).token || "";
  return (
    <UnsubscribeForm
      t={dictionary(lang)}
      token={token}
      valid={!!subscriberForToken(token)}
    />
  );
}
