import { notFound } from "next/navigation";
import { dictionary, publicRecords, record, db } from "@/lib/db";
import { Lang } from "@/lib/content";
import { PublicSite } from "@/components/public-site";
import { staff } from "@/lib/security";
import { hasModuleAccess } from "@/lib/module-access";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ lang: string; slug?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const p = await params;
  const lang = p.lang === "en" ? "en" : "sq",
    t = dictionary(lang),
    section = p.slug?.[0] || "home";
  const module = p.slug?.[1] ? record(p.slug[1]) : undefined;
  const title =
    section === "modules" && p.slug?.[1]
      ? module?.published && module.kind === "modules"
        ? module[`title_${lang}`]
        : t.modules
      : t[section as keyof typeof t];
  return {
    metadataBase: new URL(process.env.APP_ORIGIN || "http://localhost:3000"),
    title: `${title || t.home} | ${record("settings")?.siteName || "Galenus Med Academy"}`,
    description: t.intro,
    alternates: {
      canonical: `/${lang}${p.slug?.length ? "/" + p.slug.join("/") : ""}`,
      languages: {
        sq: `/sq/${(p.slug || []).join("/")}`,
        en: `/en/${(p.slug || []).join("/")}`,
      },
    },
  };
}
export default async function Page({ params }: Props) {
  const p = await params;
  if (!["sq", "en"].includes(p.lang)) notFound();
  const lang = p.lang as Lang,
    section = p.slug?.[0] || "home";
  if (
    !["home", "about", "gallery", "modules"].includes(section) ||
    ((p.slug?.length || 0) > 1 && section !== "modules") ||
    (p.slug?.length || 0) > 2
  )
    notFound();
  const modules = publicRecords("modules"),
    doctors = publicRecords("doctors"),
    gallery = publicRecords("gallery");
  const detail = p.slug?.[1]
    ? modules.find((w) => w.id === p.slug?.[1])
    : undefined;
  if (p.slug?.[1] && !detail) notFound();
  let unlocked = false;
  if (detail) {
    unlocked = await hasModuleAccess(detail.id, await staff());
  }
  const media = db()
    .prepare("SELECT id,mime FROM media WHERE private=0")
    .all() as { id: string; mime: string }[];
  const contact = record("contact-details");
  return (
    <PublicSite
      key={`${lang}-${section}-${detail?.id || ""}`}
      lang={lang}
      section={section}
      t={dictionary(lang)}
      settings={record("settings")!}
      contact={contact?.published ? contact : undefined}
      doctors={doctors}
      modules={modules}
      gallery={gallery}
      media={media.map((item) => ({ ...item }))}
      detail={detail}
      unlocked={unlocked}
      hasFull={!!(detail && record(detail.id)?.fullMedia)}
    />
  );
}
