"use client";

import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const BACKEND_URL = "http://localhost:8000";

  const uploadFiles = async () => {
    if (!files || files.length === 0) {
      alert("Select files first");
      return;
    }

    try {
      setLoading(true);

      const fileKeys: string[] = [];
      const fileTypes: string[] = [];

      for (const file of Array.from(files)) {
        const uploadRes = await fetch(`${BACKEND_URL}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type || "application/pdf",
          }),
        });
          console.log({"file_name": file.name, "file_type": file.type});
        if (!uploadRes.ok) {
          throw new Error(`Failed to get upload URL for ${file.name}`);
        }

        const uploadData = await uploadRes.json();
        console.log("sending", file.type);
        const s3Upload = await fetch(uploadData.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!s3Upload.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        fileKeys.push(uploadData.file_key);

        const extension =
          file.name.split(".").pop()?.toLowerCase() || "pdf";

        fileTypes.push(extension);
      }
      const extractRes = await fetch(`${BACKEND_URL}/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_keys: fileKeys,
          file_type: fileTypes,
        }),
      });

      if (!extractRes.ok) {
        throw new Error("Extraction failed");
      }

      const extractData = await extractRes.json();

      setResult(extractData);
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">
          Multi File Upload & Extraction
        </h1>

        <input
          type="file"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="border p-2 rounded"
        />

        <button
          onClick={uploadFiles}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded"
        >
          {loading ? "Processing..." : "Upload & Extract"}
        </button>

        {result && (
          <div className="space-y-4">
            <div className="border rounded p-4">
              <h2 className="font-bold text-lg mb-2">
                Normal Response
              </h2>

              <pre className="whitespace-pre-wrap">
                {JSON.stringify(result.normal, null, 2)}
              </pre>
            </div>

            <div className="border rounded p-4">
              <h2 className="font-bold text-lg mb-2">
                CSV Output
              </h2>

              <pre className="whitespace-pre-wrap">
                {JSON.stringify(result.csv_file, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
