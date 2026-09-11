import { authenticate } from "../shopify.server";

const PRODUCTS_QUERY = `#graphql
  query ExportProducts($cursor: String) {
    products(first: 100, after: $cursor) {
      nodes {
        id
        title
        handle
        status

        variants(first: 250) {
          nodes {
            id
            sku
          }
        }

        metafields(first: 250) {
          nodes {
            namespace
            key
            value
          }
        }
      }

      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function gidToId(gid) {
  return gid.split("/").pop() || gid;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  const products = [];

  let cursor = null;

  do {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: {
        cursor,
      },
    });

    const responseJson = await response.json();

    if (responseJson.errors) {
      console.error("Shopify GraphQL errors:", responseJson.errors);

      return new Response("Shopify API error", {
        status: 500,
      });
    }

    const data = responseJson.data;

    if (!data || !data.products) {
      return new Response("Invalid Shopify API response", {
        status: 500,
      });
    }

    products.push(...data.products.nodes);

    if (data.products.pageInfo.hasNextPage) {
      cursor = data.products.pageInfo.endCursor;
    } else {
      cursor = null;
    }
  } while (cursor);

  const metafieldColumns = new Set();

  for (const product of products) {
    for (const metafield of product.metafields.nodes) {
      const column = `${metafield.namespace}.${metafield.key}`;

      metafieldColumns.add(column);
    }
  }

  const sortedMetafieldColumns = [...metafieldColumns].sort();

  const headers = [
    "product_title",
    "product_handle",
    "product_id",
    "product_status",
    "variant_id",
    "variant_sku",
    ...sortedMetafieldColumns,
  ];

  const rows = [];

  rows.push(headers.map(escapeCsv).join(","));

  for (const product of products) {
    const metafields = {};

    for (const metafield of product.metafields.nodes) {
      const column = `${metafield.namespace}.${metafield.key}`;

      metafields[column] = metafield.value;
    }

    for (const variant of product.variants.nodes) {
      const row = [
        product.title,
        product.handle,
        gidToId(product.id),
        product.status,
        gidToId(variant.id),
        variant.sku || "",
        ...sortedMetafieldColumns.map(
          (column) => metafields[column] || ""
        ),
      ];

      rows.push(row.map(escapeCsv).join(","));
    }
  }

  const csv = "\uFEFF" + rows.join("\r\n");

  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shopify-products-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}