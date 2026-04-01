import { NextResponse, type NextRequest } from "next/server";
import { runfolioLog } from "@/lib/runfolio-log";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (err) {
    runfolioLog.error("middleware.fatal", err, {
      path: request.nextUrl.pathname,
      method: request.method
    });
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
