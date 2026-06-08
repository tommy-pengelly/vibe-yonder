import MapDetail from "@/components/MapDetail";

type Params = { id: string };

export default async function MapDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <MapDetail id={id} />;
}
