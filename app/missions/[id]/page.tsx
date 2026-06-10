import MissionScoreboard from "@/components/MissionScoreboard";

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MissionScoreboard id={id} />;
}
