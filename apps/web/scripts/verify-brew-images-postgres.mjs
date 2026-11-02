import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { test, beforeEach, after } from "node:test";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
assert.equal(url.pathname, "/meadtools_brew_images_test");
process.env.PREMIUM_ACCESS_ENABLED = "true";
const { default: db } = await import("../lib/prisma.ts");
const { createBrewImageService } = await import("../lib/db/brew-images.ts");
const { deleteBrewForApp, patchBrewMetadata, getBrewForApp, deleteBrewEntryForApp } =
  await import("../lib/db/brews.ts");
const { deleteUser } = await import("../lib/db/users.ts");
const { BREW_IMAGE_LIMITS: limits } =
  await import("@meadtools/brew-domain/images");
const { NextRequest } = await import("next/server");
let objects = new Map();
let failPut = 0;
let failDelete = false;
let puts = 0;
let hold = null;
const storage = {
  async put(key, data) {
    puts++;
    if (hold) await hold;
    objects.set(key, data);
    if (puts === failPut) throw Error("simulated write response lost");
  },
  async remove(key) {
    if (failDelete) throw Error("simulated storage outage");
    objects.delete(key);
  },
  async signedRead(key) {
    return `https://fixture.invalid/${key}?expires=60`;
  },
};
const normal = async () => ({
  image: Buffer.alloc(512),
  thumbnail: Buffer.alloc(64),
  width: 16,
  height: 8,
});
const service = createBrewImageService({
  database: db,
  storage: () => storage,
  configured: () => true,
  normalize: normal,
});
const nextServerModule = import.meta.resolve("next/server");
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/userAccessFunctions")
      return {
        url:
          "data:text/javascript," +
          encodeURIComponent(
            `import {NextResponse} from "${nextServerModule}"; export async function verifyUser(req) { const id=Number(req.headers.get("x-fixture-user")); return id || NextResponse.json({error:"Invalid or expired token"},{status:401}); }`,
          ),
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const listRoute = await import("../app/api/brews/[brew_id]/images/route.ts");
const imageRoute =
  await import("../app/api/brews/[brew_id]/images/[image_id]/route.ts");
hooks.deregister();
beforeEach(async () => {
  await db.$executeRawUnsafe("TRUNCATE users CASCADE");
  objects = new Map();
  failPut = 0;
  failDelete = false;
  puts = 0;
  hold = null;
  process.env.PREMIUM_ACCESS_ENABLED = "true";
});
after(() => db.$disconnect());
async function owner(premium = true) {
  const user = await db.users.create({
    data: { email: `${randomUUID()}@fixture.invalid` },
  });
  if (premium)
    await db.premium_memberships.create({
      data: {
        user_id: user.id,
        source: "manual",
        paid_through: new Date("2100-01-01"),
      },
    });
  const brew = await db.brews.create({ data: { user_id: user.id } });
  return { userId: user.id, brewId: brew.id };
}
const payload = () => ({
  operation_id: randomUUID(),
  content_type: "image/jpeg",
  base64: "YWJj",
  caption: "Sample",
});
const code = (expected) => (e) => e?.code === expected;
const future = () => new Date(Date.now() + 20 * 60_000);
async function publicBrew(f) {
  const recipe = await db.recipes.create({
    data: {
      user_id: f.userId,
      name: "Public recipe",
      private: false,
      recipeData: "{}",
      yanContribution: "{}",
      nutrientData: "{}",
      advanced: false,
      primaryNotes: [],
      secondaryNotes: [],
    },
  });
  await db.brews.update({
    where: { id: f.brewId },
    data: { public: true, recipe_id: recipe.id },
  });
  return recipe.id;
}

test("upload persists, replays without additional objects, rejects changed requests and foreign owners", async () => {
  const f = await owner();
  const body = payload();
  const result = await service.upload(f.userId, f.brewId, body);
  assert.equal(objects.size, 2);
  assert.equal((await service.list(f.brewId, f.userId)).used_bytes, 576);
  assert.deepEqual(await service.upload(f.userId, f.brewId, body), result);
  assert.equal(puts, 2);
  await assert.rejects(
    service.upload(f.userId, f.brewId, { ...body, caption: "Different" }),
    code("OPERATION_CONFLICT"),
  );
  const other = await owner();
  await assert.rejects(
    service.upload(other.userId, f.brewId, payload()),
    code("NOT_FOUND"),
  );
  await assert.rejects(
    service.update(other.userId, f.brewId, result.image.id, "foreign"),
    code("NOT_FOUND"),
  );
  await assert.rejects(
    service.remove(other.userId, f.brewId, result.image.id),
    code("NOT_FOUND"),
  );
  assert.equal(JSON.stringify(result).includes("image_key"), false);
});
test("actual concurrent reservations cannot oversubscribe account allowance", async () => {
  const f = await owner();
  const reserved = limits.displayBytes + limits.thumbnailBytes;
  await service.upload(f.userId, f.brewId, payload());
  await db.brew_images.updateMany({
    data: { reserved_bytes: limits.accountBytes - reserved },
  });
  let release;
  hold = new Promise((resolve) => {
    release = resolve;
  });
  const requests = [
    service.upload(f.userId, f.brewId, payload()),
    service.upload(f.userId, f.brewId, payload()),
  ];
  // Wait for the accepted request to reach the storage boundary before releasing it.
  for (let i = 0; i < 100; i++) {
    if (await db.brew_images.count({ where: { status: "pending" } })) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  release();
  hold = null;
  const results = await Promise.allSettled(requests);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    results.some(
      (r) => r.status === "rejected" && r.reason.code === "QUOTA_EXCEEDED",
    ),
  );
});
test("concurrent last brew slot is reserved once", async () => {
  const f = await owner();
  for (let i = 0; i < 19; i++)
    await service.upload(f.userId, f.brewId, payload());
  const results = await Promise.allSettled([
    service.upload(f.userId, f.brewId, payload()),
    service.upload(f.userId, f.brewId, payload()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await db.brew_images.count({ where: { status: "ready" } }), 20);
});
test("duplicate concurrent operation is never processed twice", async () => {
  const f = await owner();
  const body = payload();
  let release;
  hold = new Promise((resolve) => (release = resolve));
  const first = service.upload(f.userId, f.brewId, body);
  for (let i = 0; i < 100; i++) {
    if (await db.brew_images.count({ where: { status: "pending" } })) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  await assert.rejects(
    service.upload(f.userId, f.brewId, body),
    code("UPLOAD_IN_PROGRESS"),
  );
  release();
  hold = null;
  await first;
  assert.equal(puts, 2);
});
test("partial writes are retained for cleanup, failed deletion retains quota, then retry reuses the operation safely", async () => {
  const f = await owner();
  const body = payload();
  failPut = 2;
  await assert.rejects(
    service.upload(f.userId, f.brewId, body),
    code("UPLOAD_FAILED"),
  );
  assert.equal(objects.size, 2);
  assert.equal((await service.list(f.brewId, f.userId)).images.length, 0);
  assert.ok((await service.list(f.brewId, f.userId)).used_bytes > 0);
  assert.deepEqual(await service.cleanup(), { cleaned: 0, failed: 0 });
  failDelete = true;
  assert.deepEqual(await service.cleanup(future()), { cleaned: 0, failed: 1 });
  assert.ok((await service.list(f.brewId, f.userId)).used_bytes > 0);
  failDelete = false;
  await service.cleanup(new Date(Date.now() + 40 * 60_000));
  assert.equal(objects.size, 0);
  assert.equal((await service.list(f.brewId, f.userId)).used_bytes, 0);
  failPut = 0;
  const result = await service.upload(f.userId, f.brewId, body);
  assert.equal(result.image.id, body.operation_id);
  assert.equal(objects.size, 2);
});
test("crashed pending reservation is reclaimed and never published", async () => {
  const f = await owner();
  failPut = 1;
  const body = payload();
  await assert.rejects(service.upload(f.userId, f.brewId, body));
  await db.brew_images.updateMany({ data: { status: "pending" } });
  await service.cleanup(future());
  assert.equal(objects.size, 0);
  assert.equal((await service.list(f.brewId, f.userId)).used_bytes, 0);
});
test("expiry blocks new uploads but preserves captions, reads and removal; rollout gate blocks upload", async () => {
  const f = await owner();
  const { image } = await service.upload(f.userId, f.brewId, payload());
  await db.premium_memberships.updateMany({
    data: { paid_through: new Date("2020-01-01") },
  });
  assert.equal((await service.list(f.brewId, f.userId)).can_upload, false);
  await assert.rejects(
    service.upload(f.userId, f.brewId, payload()),
    code("PREMIUM_REQUIRED"),
  );
  await service.update(f.userId, f.brewId, image.id, "Retained");
  assert.ok(
    (await service.signedRead(f.brewId, image.id, "image", f.userId)).url,
  );
  await service.remove(f.userId, f.brewId, image.id);
  await service.remove(f.userId, f.brewId, image.id);
  await assert.rejects(
    service.signedRead(f.brewId, image.id, "image", f.userId),
    code("NOT_FOUND"),
  );
  await service.cleanup(future());
  assert.equal(objects.size, 0);
  const paid = await owner();
  process.env.PREMIUM_ACCESS_ENABLED = "false";
  await assert.rejects(
    service.upload(paid.userId, paid.brewId, payload()),
    code("PREMIUM_REQUIRED"),
  );
});
test("public direct access checks both flags and active owner on every request", async () => {
  const f = await owner();
  const { image } = await service.upload(f.userId, f.brewId, payload());
  await assert.rejects(
    service.signedRead(f.brewId, image.id, "image"),
    code("NOT_FOUND"),
  );
  const recipeId = await publicBrew(f);
  assert.ok((await service.signedRead(f.brewId, image.id, "image")).url);
  await db.brews.update({ where: { id: f.brewId }, data: { public: false } });
  await assert.rejects(
    service.signedRead(f.brewId, image.id, "thumbnail"),
    code("NOT_FOUND"),
  );
  await db.brews.update({ where: { id: f.brewId }, data: { public: true } });
  await db.recipes.update({ where: { id: recipeId }, data: { private: true } });
  await assert.rejects(service.list(f.brewId), code("NOT_FOUND"));
  await db.recipes.update({
    where: { id: recipeId },
    data: { private: false },
  });
  await db.users.update({ where: { id: f.userId }, data: { active: false } });
  await assert.rejects(
    service.signedRead(f.brewId, image.id, "image"),
    code("NOT_FOUND"),
  );
  await assert.rejects(
    service.signedRead(f.brewId, image.id, "image", f.userId),
    code("NOT_FOUND"),
  );
});
test("brew deletion and account deactivation preserve durable cleanup identities", async () => {
  for (const kind of ["brew", "account"]) {
    const f = await owner();
    await service.upload(f.userId, f.brewId, payload());
    if (kind === "brew") await deleteBrewForApp(f.brewId, f.userId);
    else await deleteUser(f.userId);
    assert.equal((await db.brew_images.findFirst()).status, "deleting");
    await service.cleanup(future());
    assert.equal(objects.size, 0);
    await db.$executeRawUnsafe("TRUNCATE users CASCADE");
  }
});
test("payment restriction blocks uploads and invalid decoding creates no published objects", async () => {
  const f = await owner();
  await db.credit_accounts.create({
    data: { user_id: f.userId, payment_restricted_at: new Date() },
  });
  await assert.rejects(
    service.upload(f.userId, f.brewId, payload()),
    code("PREMIUM_REQUIRED"),
  );
  await db.credit_accounts.updateMany({
    data: { payment_restricted_at: null },
  });
  const broken = createBrewImageService({
    database: db,
    storage: () => storage,
    normalize: async () => {
      const e = new Error("bad");
      e.code = "INVALID_IMAGE";
      throw e;
    },
  });
  await assert.rejects(broken.upload(f.userId, f.brewId, payload()));
  assert.equal(objects.size, 0);
});
test("HTTP public opt-in does not bypass privacy and caption/removal never accept anonymous callers", async () => {
  const f = await owner();
  const context = {
    params: Promise.resolve({ brew_id: f.brewId, image_id: randomUUID() }),
  };
  let response = await listRoute.GET(
    new NextRequest(
      `http://localhost/api/brews/${f.brewId}/images?public=true`,
    ),
    context,
  );
  assert.equal(response.status, 404);
  response = await listRoute.GET(
    new NextRequest(`http://localhost/api/brews/${f.brewId}/images`),
    context,
  );
  assert.equal(response.status, 401);
  for (const method of ["PATCH", "DELETE"]) {
    response = await imageRoute[method](
      new NextRequest(
        `http://localhost/api/brews/${f.brewId}/images/${randomUUID()}?public=true`,
        {
          method,
          body:
            method === "PATCH"
              ? JSON.stringify({ caption: "attack" })
              : undefined,
        },
      ),
      context,
    );
    assert.equal(response.status, 401);
  }
  await publicBrew(f);
  response = await listRoute.GET(
    new NextRequest(
      `http://localhost/api/brews/${f.brewId}/images?public=true`,
    ),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  response = await listRoute.POST(
    new NextRequest(`http://localhost/api/brews/${f.brewId}/images`, {
      method: "POST",
      headers: { "x-fixture-user": String(f.userId) },
      body: JSON.stringify({}),
    }),
    context,
  );
  assert.equal(response.status, 400);
  response = await listRoute.POST(
    new NextRequest(`http://localhost/api/brews/${f.brewId}/images`, {
      method: "POST",
      headers: {
        "x-fixture-user": String(f.userId),
        "content-length": "5000000",
      },
      body: "{}",
    }),
    context,
  );
  assert.equal(response.status, 413);
});

test("completing a brew retains its photos", async () => {
  const f = await owner();
  await service.upload(f.userId, f.brewId, payload());
  await patchBrewMetadata(f.userId, f.brewId, { stage: "COMPLETE" });
  assert.equal((await db.brew_images.findFirst()).status, "ready");
});

test("direct brew uploads create hidden entries; visible entry uploads retain their context", async () => {
  const f = await owner();
  const direct = await service.upload(f.userId, f.brewId, payload());
  const hidden = await db.brew_entries.findUniqueOrThrow({where:{id: direct.image.entry_id}});
  assert.equal(hidden.type, "NOTE");
  assert.equal(hidden.data.hidden, true);
  assert.equal(direct.image.entry_hidden, true);
  const { projectBrewTimeline } = await import("@meadtools/brew-domain/timeline");
  assert.equal(projectBrewTimeline(await getBrewForApp(f.userId,f.brewId)).some(entry=>entry.id===hidden.id),false);
  const entry = await db.brew_entries.create({data:{brew_id:f.brewId,user_id:f.userId,type:"NOTE",title:"First tasting"}});
  const body = {...payload(),entry_id:entry.id};
  const attached = await service.upload(f.userId,f.brewId,body);
  assert.equal(attached.image.entry_id,entry.id);
  assert.equal(attached.image.entry_title,"First tasting");
  assert.equal(attached.image.entry_hidden,false);
  assert.equal((await service.list(f.brewId,f.userId)).images.length,2);
  await assert.rejects(service.upload(f.userId,f.brewId,{...payload(),entry_id:hidden.id}),code("NOT_FOUND"));
  const other = await owner();
  await assert.rejects(service.upload(other.userId,other.brewId,{...payload(),entry_id:entry.id}),code("NOT_FOUND"));
  await db.brew_entries.delete({where:{id:entry.id}});
  assert.equal((await service.list(f.brewId,f.userId)).images.length,1);
  await assert.rejects(service.signedRead(f.brewId,attached.image.id,"image",f.userId),code("NOT_FOUND"));
  await service.cleanup(future());
  assert.equal(objects.size,2);
  await service.remove(f.userId,f.brewId,direct.image.id);
  await service.cleanup(future());
  assert.equal(await db.brew_entries.count({where:{id:hidden.id}}),0);
});

test("deleting an entry during upload never publishes its photos", async () => {
  const f = await owner();
  const entry = await db.brew_entries.create({data:{brew_id:f.brewId,user_id:f.userId,type:"NOTE"}});
  let release; hold = new Promise(resolve=>{release=resolve;});
  const uploading = service.upload(f.userId,f.brewId,{...payload(),entry_id:entry.id});
  while(!puts) await new Promise(resolve=>setTimeout(resolve,10));
  await db.brew_entries.delete({where:{id:entry.id}});
  release(); hold=null;
  await assert.rejects(uploading);
  assert.equal((await service.list(f.brewId,f.userId)).images.length,0);
  await service.cleanup(future());
  assert.equal(objects.size,0);
});


test("normal entry deletion queues its attachments immediately", async () => {
  const f = await owner();
  const entry = await db.brew_entries.create({data:{brew_id:f.brewId,user_id:f.userId,type:"NOTE"}});
  const image = await service.upload(f.userId,f.brewId,{...payload(),entry_id:entry.id});
  await deleteBrewEntryForApp(f.userId,f.brewId,entry.id);
  const row = await db.brew_images.findUniqueOrThrow({where:{id:image.image.id}});
  assert.equal(row.status,"deleting");
  assert.equal(row.removed,true);
  assert.equal((await service.list(f.brewId,f.userId)).images.length,0);
  await service.cleanup(future());
  assert.equal(objects.size,0);
});
