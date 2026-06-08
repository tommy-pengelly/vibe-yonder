import ListDetail from "@/components/ListDetail";

type Params = { id: string };

export default async function ListDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <ListDetail id={id} />;
}
