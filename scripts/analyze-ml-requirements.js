// Categorías típicas de un negocio de Impresión 3D y Láser
const TARGET_CATEGORIES = [
  { id: "MLA392282", name: "Mates y Accesorios" },
  { id: "MLA11332", name: "Figuras de Acción (Muñecos 3D)" },
  { id: "MLA432797", name: "Adornos y Decoración" },
  { id: "MLA3024", name: "Llaveros" },
  { id: "MLA412445", name: "Cortantes de Repostería" },
  { id: "MLA417686", name: "Soportes Celular" },
  { id: "MLA40545", name: "Lámparas 3D" },
];

async function analyze() {
  console.log("🔍 Analizando requisitos de MercadoLibre por categoría...\n");

  const report = [];

  for (const cat of TARGET_CATEGORIES) {
    try {
      const res = await fetch(
        `https://api.mercadolibre.com/categories/${cat.id}/attributes`,
      );
      const attributes = await res.json();

      // Filtrar solo los obligatorios (required o catalog_required)
      // Excluimos los obvios como BRAND, MODEL, ITEM_CONDITION que ya manejamos
      const required = attributes.filter(
        (a) =>
          (a.tags?.required || a.tags?.catalog_required) &&
          !["BRAND", "MODEL", "ITEM_CONDITION", "GTIN", "SELLER_SKU"].includes(
            a.id,
          ),
      );

      // Buscar atributos que permiten variaciones (Color, Talle, etc)
      const variations = attributes.filter((a) => a.tags?.allow_variations);

      report.push({
        category: cat.name,
        id: cat.id,
        obligatorios_faltantes: required.map((a) => ({
          id: a.id,
          nombre: a.name,
          ejemplos: a.values
            ? a.values
                .map((v) => v.name)
                .slice(0, 3)
                .join(", ")
            : "Texto libre",
        })),
        variables_clave: variations.map((a) => a.name),
      });
    } catch (e) {
      console.error(`Error en ${cat.name}:`, e.message);
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

analyze();
