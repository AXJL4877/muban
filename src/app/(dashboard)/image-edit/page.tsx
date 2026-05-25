import { ImageEditor } from "@/components/image-editor/image-editor";

export default async function ImageEditPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; fromAi?: string }>;
}) {
  const { templateId, fromAi } = await searchParams;
  return (
    <ImageEditor
      templateId={templateId}
      fromAi={fromAi === "1" || fromAi === "true"}
    />
  );
}
