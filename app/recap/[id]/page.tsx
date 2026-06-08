import RecapViewer from "@/components/RecapViewer";

type Params = { id: string };

export default async function RecapPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <RecapViewer id={id} />;
}
