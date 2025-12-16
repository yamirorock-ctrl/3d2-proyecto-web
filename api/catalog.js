import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Configuración de CORS y Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="catalog.csv"');

  // Inicializar Supabase (check both VITE_ and standard env vars)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_TOKEN || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Faltan variables de entorno de Supabase (VITE_SUPABASE_URL/SUPABASE_URL)"
    );
    return res
      .status(500)
      .send("Error de configuración del servidor: Faltan credenciales.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Obtener productos de la base de datos
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .eq("draft", false) // Asumiendo que podría haber campo draft, si no, se ignora
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 2. Construir CSV para Facebook Catalog
    // Campos requeridos: id, title, description, availability, condition, price, link, image_link, brand
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
      "google_product_category", // Opcional pero recomendado
    ];

    const baseUrl = "https://www.creart3d2.com";

    // Función para escapar comillas dobles en CSV
    const escapeCsv = (text) => {
      if (!text) return "";
      const CleanText = String(text).replace(/\n/g, " ").replace(/\r/g, "");
      return `"${CleanText.replace(/"/g, '""')}"`;
    };

    const csvRows = products.map((product) => {
      // Determinar disponibilidad
      const availability =
        product.stock && product.stock > 0 ? "in stock" : "out of stock";

      // Determinar imagen (primera del array o string simple)
      let imageUrl = product.image;
      if (
        product.images &&
        Array.isArray(product.images) &&
        product.images.length > 0
      ) {
        // Asumimos estructura { url: '...' } o string directo
        const firstImg = product.images[0];
        imageUrl = typeof firstImg === "string" ? firstImg : firstImg.url;
      }

      // Determinar precio (formato: "1500.00 ARS")
      const price = `${Number(product.price).toFixed(2)} ARS`;

      // Determinar categoría de Google (Taxonomy ID) based on internal category
      // 632: Home & Garden > Decor
      // 500044: Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Crafting Materials > Textiles > Fabric
      // Usaremos genérico "Home & Garden > Decor" (632) o "Toys & Games" (1239) según categoría
      let googleCategory = "632"; // Default Deco
      const cat = (product.category || "").toLowerCase();
      if (cat.includes("juguete") || cat.includes("toy"))
        googleCategory = "1239";
      if (cat.includes("impresión 3d") || cat.includes("3d"))
        googleCategory = "500044"; // Art materialsish

      return [
        product.id, // id
        escapeCsv(product.name), // title
        escapeCsv(product.description), // description
        availability, // availability
        "new", // condition
        price, // price
        `${baseUrl}/?product_id=${product.id}`, // link (homepage + query param para tracking)
        imageUrl || "", // image_link
        "3D2", // brand
        googleCategory, // google_product_category
      ].join(",");
    });

    // 3. Unir todo
    const csvContent = [headers.join(","), ...csvRows].join("\n");

    // 4. Enviar respuesta
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Error generando feed:", error);
    res.status(500).send("Error generando el catálogo");
  }
}
