import { authenticate } from "../shopify.server";

const COLLECTIONS_QUERY = `#graphql
  query ExportCollections($cursor: String) {
    collections(first: 100, after: $cursor) {
      nodes {
        id
        title
        handle
        description

        image {
          url
        }

        products(first: 250) {
          nodes {
            title
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

  const collections = [];

  let cursor = null;

  do {
    const response = await admin.graphql(COLLECTIONS_QUERY, {
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

    if (!data || !data.collections) {
      return new Response("Invalid Shopify API response", {
        status: 500,
      });
    }

    collections.push(...data.collections.nodes);

    if (data.collections.pageInfo.hasNextPage) {
      cursor = data.collections.pageInfo.endCursor;
    } else {
      cursor = null;
    }
  } while (cursor);

  const metafieldColumns = new Set();

  for (const collection of collections) {
    for (const metafield of collection.metafields.nodes) {
      const column = `${metafield.namespace}.${metafield.key}`;

      metafieldColumns.add(column);
    }
  }

  const sortedMetafieldColumns = [...metafieldColumns].sort();

  const headers = [
    "collection_name",
    "collection_handle",
    "collection_id",
    "collection_description",
    "collection_image",
    "collection_items",
    ...sortedMetafieldColumns,
  ];

  const rows = [];

  rows.push(headers.map(escapeCsv).join(","));

  for (const collection of collections) {
    const metafields = {};

    for (const metafield of collection.metafields.nodes) {
      const column = `${metafield.namespace}.${metafield.key}`;

      metafields[column] = metafield.value;
    }

    const productTitles = collection.products.nodes
      .map((product) => product.title)
      .join("\n");

    const row = [
      collection.title,
      collection.handle,
      gidToId(collection.id),
      collection.description || "",
      collection.image?.url || "",
      productTitles,
      ...sortedMetafieldColumns.map(
        (column) => metafields[column] || ""
      ),
    ];

    rows.push(row.map(escapeCsv).join(","));
  }

  const csv = "\uFEFF" + rows.join("\r\n");

  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shopify-collections-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}