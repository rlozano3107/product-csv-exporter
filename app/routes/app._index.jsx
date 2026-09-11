import { useState } from "react";

export default function AppHome() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);

      const response = await fetch("/app/export", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "shopify-products.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export products.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <s-page heading="Product CSV Exporter">
      <s-section heading="Export your products">
        <s-paragraph>
          Download all products and their variants as a CSV file. Product
          metafields will automatically be added as columns.
        </s-paragraph>

        <button type="button" onClick={handleExport} disabled={loading}>
          {loading ? "Exporting..." : "Download CSV"}
        </button>
      </s-section>
    </s-page>
  );
}
