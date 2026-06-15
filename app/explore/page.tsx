import { redirect } from "next/navigation";

// Explore folded into Community. Keep the route as a redirect so old links still
// land somewhere sensible.
export default function ExplorePage() {
  redirect("/community");
}
