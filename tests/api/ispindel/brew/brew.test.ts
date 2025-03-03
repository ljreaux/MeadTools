import { GET, POST, PATCH } from "@/app/api/hydrometer/brew/route";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getBrews, startBrew, endBrew, setBrewName } from "@/lib/db/iSpindel";
import { createRequest } from "node-mocks-http";
import { NextResponse } from "next/server";

jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

jest.mock("@/lib/db/iSpindel", () => ({
  getBrews: jest.fn(),
  startBrew: jest.fn(),
  endBrew: jest.fn(),
  setBrewName: jest.fn(),
}));

describe("/api/ispindel/brew", () => {
  describe("GET", () => {
    it("should get brews successfully", async () => {
      const userId = "test-user";
      const brews = [{ id: "1", name: "Brew 1" }];

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (getBrews as jest.Mock).mockResolvedValue(brews);

      const req = createRequest({ method: "GET" });
      const res = await GET(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(brews);
    });

    it("should return 500 on database error", async () => {
      const userId = "test-user";

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (getBrews as jest.Mock).mockRejectedValue(new Error("Database failure"));

      const req = createRequest({ method: "GET" });
      const res = await GET(req as any);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to get brews." });
    });
  });

  describe("POST", () => {
    it("should create a new brew successfully", async () => {
      const userId = "test-user";
      const device_id = "12345";
      const brew_name = "Test Brew";
      const brew = { id: "1", name: brew_name };

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (startBrew as jest.Mock).mockResolvedValue(brew);

      const req = createRequest({
        method: "POST",
        body: { device_id, brew_name },
        headers: { "Content-Type": "application/json" },
      });
      req.json = async () => req.body;

      const res = await POST(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(brew);
    });

    it("should return 400 if required fields are missing", async () => {
      const req = createRequest({
        method: "POST",
        body: {},
        headers: { "Content-Type": "application/json" },
      });

      req.json = async () => req.body;
      const res = await POST(req as any);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Missing device_id or brew_name",
      });
    });

    it("should return 500 on error", async () => {
      const userId = "test-user";
      const device_id = "12345";
      const brew_name = "Test Brew";

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (startBrew as jest.Mock).mockRejectedValue(new Error("Database failure"));

      const req = createRequest({
        method: "POST",
        body: { device_id, brew_name },
        headers: { "Content-Type": "application/json" },
      });
      req.json = async () => req.body;

      const res = await POST(req as any);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to create brew." });
    });
  });

  describe("PATCH", () => {
    it("should update brew name successfully", async () => {
      const userId = "test-user";
      const device_id = "12345";
      const brew_id = "1";
      const brew_name = "Updated Brew";
      const brew = { id: brew_id, name: brew_name };

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (setBrewName as jest.Mock).mockResolvedValue(brew);

      const req = createRequest({
        method: "PATCH",
        body: { device_id, brew_id, brew_name },
        headers: { "Content-Type": "application/json" },
      });
      req.json = async () => req.body;

      const res = await PATCH(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(brew);
    });

    it("should return 500 on error", async () => {
      const userId = "test-user";
      const device_id = "12345";
      const brew_id = "1";

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (setBrewName as jest.Mock).mockRejectedValue(
        new Error("Database failure")
      );

      const req = createRequest({
        method: "PATCH",
        body: { device_id, brew_id },
        headers: { "Content-Type": "application/json" },
      });
      req.json = async () => req.body;

      const res = await PATCH(req as any);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to update brew." });
    });

    it("should return 400 if required fields are missing", async () => {
      const req = createRequest({
        method: "PATCH",
        body: {},
        headers: { "Content-Type": "application/json" },
      });

      req.json = async () => req.body;
      const res = await PATCH(req as any);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Missing device_id, brew_id, or brew_name",
      });
    });
  });
});
