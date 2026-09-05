import { NextResponse } from "next/server";
import { analyseSkyPhoto } from "@/lib/google/gemini";
import { transcribeAudio } from "@/lib/google/speech";
import { addReport, listReports, type CitizenReport } from "@/lib/reports-store";
import { resolveTehsil } from "@/lib/sources/geocode";

/*
   POST /api/observe — a citizen files a report.

   This is the entry point the problem statement asks for and the one place
   citizen-sourced data enters the system. A photograph and a location go in;
   a structured, bounded, explicitly-caveated observation comes back, and is
   entered in the register with a weight that reflects how much corroboration
   it has.

   The route deliberately does not fail closed on a bad photograph. An
   unusable frame is stored with weight zero and a plain-language reason, so
   the reporter is told why rather than silently ignored.
*/

export const runtime = "nodejs";
/* Reads request state and mutates a store; nothing here may be cached. */
export const dynamic = "force-dynamic";

/* Roughly 8 MB of base64, which is about a 6 MB photograph. Larger frames
   carry no extra optical information at the resolution this model reads. */
const MAX_IMAGE_CHARS = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

interface ObserveBody {
  imageBase64?: string;
  mimeType?: string;
  lat?: number;
  lng?: number;
  capturedAt?: string;
  note?: string;
  language?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

export async function POST(request: Request) {
  let body: ObserveBody;
  try {
    body = (await request.json()) as ObserveBody;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { imageBase64, mimeType, lat, lng } = body;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json(
      { error: "A photograph is required. Send it as base64 in `imageBase64`." },
      { status: 400 }
    );
  }
  if (imageBase64.length > MAX_IMAGE_CHARS) {
    return NextResponse.json(
      { error: "Photograph is too large. Please send an image under about 6 MB." },
      { status: 413 }
    );
  }
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported image type. Accepted: ${[...ALLOWED_MIME].join(", ")}.` },
      { status: 415 }
    );
  }
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "A location is required. Without one the report cannot be placed in any register." },
      { status: 400 }
    );
  }

  const language = typeof body.language === "string" ? body.language : "en";

  /* A spoken note is transcribed before the photograph is read, so the
      reporter's own words can be shown next to the model's reading. */
  let transcript: string | null = null;
  if (body.audioBase64) {
    const heard = await transcribeAudio(body.audioBase64, language);
    transcript = heard.data.transcript;
  }

  const place = await resolveTehsil(lat, lng);

  const analysed = await analyseSkyPhoto(imageBase64, mimeType, {
    capturedAt: body.capturedAt,
    lat,
    lng,
    place: place.label ?? undefined,
  });

  const report: CitizenReport = {
    id: `CR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    receivedAt: new Date().toISOString(),
    capturedAt: body.capturedAt ?? null,
    lat,
    lng,
    tehsil: place.tehsil,
    district: place.district,
    state: place.state,
    language,
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    transcript,
    observation: analysed.data,
    analysisMode: analysed.mode,
    model: analysed.model,
    weight: 0,
  };

  const stored = addReport(report);

  return NextResponse.json({
    report: stored,
    provenance: {
      mode: analysed.mode,
      model: analysed.model,
      latencyMs: analysed.latencyMs,
      fellBackBecause: analysed.fellBackBecause ?? null,
      geocodeMode: place.mode,
    },
  });
}

export async function GET() {
  return NextResponse.json({ reports: listReports() });
}
