import { POST } from "@/app/api/hydrometer/token/route";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createHydrometerToken } from "@/lib/db/iSpindel";
import { createRequest } from "node-mocks-http";
import { NextResponse } from "next/server";

jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

jest.mock("@/lib/db/iSpindel", () => ({
  createHydrometerToken: jest.fn(),
}));

describe("/api/ispindel/register", () => {
  describe("POST", () => {
    it("should create a hydro_token successfully", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (createHydrometerToken as jest.Mock).mockResolvedValue({
        token: "new-hydro-token",
      });

      const req = createRequest({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ token: "new-hydro-token" });
    });

    it("should return 401 if user is not verified", async () => {
      (verifyUser as jest.Mock).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );

      const req = createRequest({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req as any);

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("should return 500 if creating hydro_token fails", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (createHydrometerToken as jest.Mock).mockRejectedValue(
        new Error("Database failure")
      );

      const req = createRequest({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req as any);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to create hydro_token",
      });
    });
  });
});
