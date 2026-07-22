import { redirect } from "next/navigation";

/** Old landing URL — keep so existing links still work. */
export default function HomeRedirect() {
  redirect("/");
}
