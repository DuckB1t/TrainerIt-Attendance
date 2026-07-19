import { getServerUser, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import QRPageClient from "./client";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function QRPage({ params }: Props) {
  const user = await getServerUser();
  if (!user?.email || !(await isAdmin(user.email))) {
    redirect("/login");
  }

  const { classId } = await params;

  return <QRPageClient classId={classId} />;
}
