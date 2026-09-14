import { Suspense } from "react";
import { SearchHome } from "@/components/SearchHome";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafa]" />}>
      <SearchHome />
    </Suspense>
  );
}
