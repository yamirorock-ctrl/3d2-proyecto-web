import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // Configuración de CORS y Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="catalog.csv"');

    // Inicializar Supabase (check both VITE_ and standard env vars)
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.VITE_SUPABASE_ANON_TOKEN || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        `Faltan credenciales de Supabase. URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener productos
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      throw new Error(`Supabase Query Error: ${error.message} (${error.code})`);

    // 2. Construir CSV
    const headers = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "google_product_category",
    ];

    const baseUrl = "https://www.creart3d2.com";

    const escapeCsv = (text) => {
      if (!text) return "";
      const CleanText = String(text).replace(/\n/g, " ").replace(/\r/g, "");
      return `"${CleanText.replace(/"/g, '""')}"`;
    };

    const csvRows = (products || []).map((product) => {
      const availability =
        product.stock && product.stock > 0 ? "in stock" : "out of stock";
      let imageUrl = product.image;
      if (
        product.images &&
        Array.isArray(product.images) &&
        product.images.length > 0
      ) {
        const firstImg = product.images[0];
        imageUrl = typeof firstImg === "string" ? firstImg : firstImg.url;
      }
      const price = `${Number(product.price).toFixed(2)} ARS`;
      let googleCategory = "632";
      const cat = (product.category || "").toLowerCase();
      if (cat.includes("juguete") || cat.includes("toy"))
        googleCategory = "1239";
      if (cat.includes("impresión 3d") || cat.includes("3d"))
        googleCategory = "500044";

      return [
        product.id,
        escapeCsv(product.name),
        escapeCsv(product.description),
        availability,
        "new",
        price,
        `${baseUrl}/?product_id=${product.id}`,
        imageUrl || "",
        "3D2",
        googleCategory,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Error generating feed:", error);
    res
      .status(200)
      .send(`Error (Catch-All): ${error.message}\nStack: ${error.stack}`);
  }
}
