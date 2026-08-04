import { proxyCatalogRequest } from "@/lib/catalog-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  return proxyCatalogRequest(req, "/catalog/rezka/parse");
}
