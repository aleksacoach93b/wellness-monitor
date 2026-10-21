"use client";
import { useParams } from "next/navigation";
import FocusSessionDetails from "@/components/pvt/FocusSessionDetails";
export default function FocusSessionPage() {
  const params = useParams<{ id: string }>();
  return <FocusSessionDetails id={params.id} />;
}
