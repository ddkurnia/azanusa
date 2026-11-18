import { NextResponse } from "next/server";
import { SOURCES, isKemenagSihatConfigured, isMirrorEnabled } from "@/lib/prayer/providers";
import { isAdminConfigured } from "@/lib/firebase/server";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { ApiConfigResponse } from "@/types";

export const dynamic = "force-dynamic";

export const APP_VERSION = "1.0.0";

export async function GET() {
  const defaultSource = isKemenagSihatConfigured() ? SOURCES["kemenag-sihat"] : SOURCES.astronomical;
  const body: ApiConfigResponse = {
    appVersion: APP_VERSION,
    providers: {
      kemenagSihatConfigured: isKemenagSihatConfigured(),
      mirrorEnabled: isMirrorEnabled(),
      firebaseConfigured: isFirebaseConfigured() || isAdminConfigured(),
      defaultSource,
    },
  };
  return NextResponse.json({ ok: true, ...body });
}
