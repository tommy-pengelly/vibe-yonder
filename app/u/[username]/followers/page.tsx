import FollowList from "@/components/FollowList";

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <FollowList username={username} mode="followers" />;
}
