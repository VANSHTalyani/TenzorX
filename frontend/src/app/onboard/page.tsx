"use client";

import { Suspense } from "react";
import OnboardClient from "./OnboardClient";

export default function OnboardPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <OnboardClient />
    </Suspense>
  );
}
