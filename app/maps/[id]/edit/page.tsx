import MapEditor from "@/components/MapEditor";

type Params = { id: string };

export default async function EditMapPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <MapEditor editId={id} />;
}
