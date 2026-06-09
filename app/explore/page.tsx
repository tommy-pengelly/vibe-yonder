import { redirect } from "next/navigation";

// Explore folded into Community (the home tab). Keep the route as a redirect
// so old links still land somewhere sensible.
export default function ExplorePage() {
  redirect("/");
}
