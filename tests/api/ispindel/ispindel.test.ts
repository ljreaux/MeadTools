import { GET, POST } from "@/app/api/hydrometer/route";
import { verifyUser } from "@/lib/userAccessFunctions";
import {
  calcGravity,
  createLog,
  getDevicesForUser,
  getHydrometerToken,
  registerDevice,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { createRequest } from "node-mocks-http";

jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

jest.mock("@/lib/db/iSpindel", () => ({
  calcGravity: jest.fn(),
  createLog: jest.fn(),
  getDevicesForUser: jest.fn(),
  getHydrometerToken: jest.fn(),
  registerDevice: jest.fn(),
  updateBrewGravity: jest.fn(),
  verifyToken: jest.fn(),
}));

describe("/api/ispindel", () => {
  describe("GET", () => {
    it("should fetch hydro_token and devices successfully", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (getHydrometerToken as jest.Mock).mockResolvedValue({
        token: "test-token",
      });
      (getDevicesForUser as jest.Mock).mockResolvedValue([
        { id: 1, name: "Device 1" },
      ]);

      const req = createRequest({ method: "GET" });
      const res = await GET(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        token: "test-token",
        devices: [{ id: 1, name: "Device 1" }],
      });
    });

    it("should return 500 if fetching hydro_token fails", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (getHydrometerToken as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const req = createRequest({ method: "GET" });
      const res = await GET(req as any);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to fetch hydro_token",
      });
    });
  });

  describe("POST", () => {
    it("should log data successfully", async () => {
      (verifyToken as jest.Mock).mockResolvedValue("user-id");
      (registerDevice as jest.Mock).mockResolvedValue({
        id: 1,
        coefficients: [1, 2, 3],
        brew_id: 10,
      });
      (calcGravity as jest.Mock).mockReturnValue(1.05);
      (updateBrewGravity as jest.Mock).mockResolvedValue(null);
      (createLog as jest.Mock).mockResolvedValue({
        id: 1,
        gravity: 1.05,
      });

      const req = createRequest({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      req.body = {
        token: "valid-token",
        name: "Test Device",
        angle: 30,
      };
      req.json = async () => req.body;

      const res = await POST(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: 1, gravity: 1.05 });
    });

    it("should return 400 if token is missing", async () => {
      const req = createRequest({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      req.body = { name: "Test Device" };
      req.json = async () => req.body;

      const res = await POST(req as any);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Missing token" });
    });

    it("should return 500 if logging fails", async () => {
      (verifyToken as jest.Mock).mockResolvedValue("user-id");
      (registerDevice as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const req = createRequest({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      req.body = {
        token: "valid-token",
        name: "Test Device",
        angle: 30,
      };
      req.json = async () => req.body;

      const res = await POST(req as any);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to log" });
    });
  });
});
