import { useState } from "react";

export default function CollectionExport() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);

      const response = await fetch("/app/exportcollections", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "shopify-collections.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export collections.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <s-page heading="Collection CSV Exporter">
      <s-section heading="Export your collections">
        <s-paragraph>
          Download all collections and their products as a CSV file.
          Collection metafields will automatically be added as columns.
        </s-paragraph>

        <button type="button" onClick={handleExport} disabled={loading}>
          {loading ? "Exporting..." : "Download CSV"}
        </button>
      </s-section>
    </s-page>
  );
}

