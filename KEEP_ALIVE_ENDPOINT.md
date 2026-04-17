# Keep-Alive Endpoint Standard

This document defines the shared contract for the `keep-alive` endpoint so other apps can implement it the same way.

## Purpose

The endpoint updates a single row in a `keep_alive` table to prove the app is still reachable and that database writes are working.

## Endpoint Contract

- Method: `GET`
- Path: `/api/keep-alive`
- Auth header: `Authorization: Bearer <KEEP_ALIVE_SECRET>`
- Content type: JSON responses only

## Required Environment Variables

- `KEEP_ALIVE_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Database Contract

Apps should use a table named `keep_alive` with one canonical row:

```sql
create table if not exists keep_alive (
  id integer primary key,
  last_updated timestamptz
);

insert into keep_alive (id)
values (1)
on conflict (id) do nothing;
```

The endpoint must update the row where `id = 1`.

## Required Behavior

1. Read `KEEP_ALIVE_SECRET` from the server environment.
2. If the secret is missing, return HTTP `500`.
3. Read the `Authorization` header.
4. If the header does not exactly match `Bearer <KEEP_ALIVE_SECRET>`, return HTTP `401`.
5. Create a Supabase client with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
6. Update `keep_alive.last_updated` for `id = 1` using the current ISO timestamp.
7. Select and return the updated `last_updated` value.
8. If the update fails, return HTTP `500`.
9. If no row is found for `id = 1`, return HTTP `404`.

## Response Contract

### Success

HTTP `200`

```json
{
  "ok": true,
  "updated_at": "2026-04-17T10:00:00.000Z"
}
```

### Missing Secret

HTTP `500`

```json
{
  "error": "KEEP_ALIVE_SECRET is not configured on the server"
}
```

### Unauthorized

HTTP `401`

```json
{
  "error": "Unauthorized"
}
```

### Database Failure

HTTP `500`

```json
{
  "error": "Database update failed",
  "detail": "<supabase error message>"
}
```

### Missing Seed Row

HTTP `404`

```json
{
  "error": "Keep-alive row not found",
  "hint": "Run the seed SQL: INSERT INTO keep_alive (id) VALUES (1);"
}
```

## Reference Implementation Pattern

This is the expected implementation shape for Next.js apps using Supabase:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const secret = process.env.KEEP_ALIVE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "KEEP_ALIVE_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("keep_alive")
    .update({ last_updated: new Date().toISOString() })
    .eq("id", 1)
    .select("last_updated")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Database update failed", detail: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error: "Keep-alive row not found",
        hint: "Run the seed SQL: INSERT INTO keep_alive (id) VALUES (1);",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, updated_at: data.last_updated });
}
```

## Example Request

```bash
curl -X GET "https://your-app.example.com/api/keep-alive" \
  -H "Authorization: Bearer $KEEP_ALIVE_SECRET"
```

## Notes For Other Apps

- Keep the route path the same unless there is a strong reason to change it.
- Keep the response payloads and error messages the same so monitoring and agents can rely on a stable contract.
- Use the service role key only on the server.
- Seed the `keep_alive` row during setup or deployment.
