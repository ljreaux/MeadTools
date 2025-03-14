import { PATCH, DELETE } from "@/app/api/hydrometer/device/[device_id]/route";
import { verifyUser } from "@/lib/userAccessFunctions";
import { updateCoefficients, deleteDevice } from "@/lib/db/iSpindel";
import { createRequest } from "node-mocks-http";

jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

jest.mock("@/lib/db/iSpindel", () => ({
  updateCoefficients: jest.fn(),
  deleteDevice: jest.fn(),
}));

describe("/api/ispindel/device/[device_id]", () => {
  describe("PATCH", () => {
    it("should update device coefficients successfully", async () => {
      const userId = "test-user";
      const device_id = "12345";
      const coefficients = [1.1, 2.2, 3.3];

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (updateCoefficients as jest.Mock).mockResolvedValue({
        device_id,
        coefficients,
      });

      const req = createRequest({
        method: "PATCH",
        body: { coefficients },
        headers: { "Content-Type": "application/json" },
      });
      req.json = async () => req.body;

      const res = await PATCH(req as any, {
        params: Promise.resolve({ device_id }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ device_id, coefficients });
    });

    it("should return 500 on database error", async () => {
      const userId = "test-user";
      const device_id = "12345";
      const coefficients = [1.1, 2.2, 3.3];

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (updateCoefficients as jest.Mock).mockRejectedValue(
        new Error("Database failure")
      );

      const req = createRequest({
        method: "PATCH",
        body: { coefficients },
        headers: { "Content-Type": "application/json" },
      });
      req.json = async () => req.body;

      const res = await PATCH(req as any, {
        params: Promise.resolve({ device_id }),
      });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to update device." });
    });
  });

  describe("DELETE", () => {
    it("should delete a device successfully", async () => {
      const userId = "test-user";
      const device_id = "12345";

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (deleteDevice as jest.Mock).mockResolvedValue({
        message: "Device deleted successfully.",
      });

      const req = createRequest({ method: "DELETE" });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ device_id }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        message: "Device deleted successfully.",
      });
    });

    it("should return 500 on database error", async () => {
      const userId = "test-user";
      const device_id = "12345";

      (verifyUser as jest.Mock).mockResolvedValue(userId);
      (deleteDevice as jest.Mock).mockRejectedValue(
        new Error("Database failure")
      );

      const req = createRequest({ method: "DELETE" });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ device_id }),
      });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to delete device." });
    });
  });
});
