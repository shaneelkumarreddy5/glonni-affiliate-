export async function POST() {
  return Response.json({ error: 'Owner bootstrap is permanently retired. Use the secured employee invitation workflow.' }, { status: 410 });
}
