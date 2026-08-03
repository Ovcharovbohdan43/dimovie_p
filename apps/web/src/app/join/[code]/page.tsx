"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-spinner";

/** Legacy join links — room page handles guest auth and join flow */
export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/room/${code}`);
  }, [code, router]);

  return (
    <LoadingScreen
      message={`Joining room ${code.toUpperCase()}...`}
      className="min-h-screen bg-black"
    />
  );
}
