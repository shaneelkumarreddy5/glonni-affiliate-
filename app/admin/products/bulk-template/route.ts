export function GET() {
  const csv = [
    "title,brand,category,store,product_url,price,list_price,image_url,description,provider",
    'Example Product,Example Brand,Electronics,Amazon,https://www.amazon.in/example,999,1299,https://example.com/product.jpg,"Short product description",Cuelinks',
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="glonni-product-upload-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
