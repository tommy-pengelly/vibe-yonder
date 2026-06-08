import SharedYonderView from "@/components/SharedYonderView";

export default async function SharedYonderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SharedYonderView id={id} />;
}
