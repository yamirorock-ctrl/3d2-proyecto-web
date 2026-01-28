async function searchAll() {
  const sites = ["MLA", "MLM", "MLB", "MLC", "MLU", "MPE"];
  for (const site of sites) {
    try {
      const r = await fetch(
        `https://api.mercadolibre.com/sites/${site}/search?nickname=YAMIRO`,
      );
      const d = await r.json();
      console.log(`Site ${site}:`, d.paging?.total || 0, "items");
    } catch (e) {}
  }
}
searchAll();
