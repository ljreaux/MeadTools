import { GET, PATCH, DELETE } from "@/app/api/hydrometer/logs/[id]/route";
import { getLogsForBrew, updateLog, deleteLog } from "@/lib/db/iSpindel";
import { verifyUser } from "@/lib/userAccessFunctions";
import { createRequest } from "node-mocks-http";

jest.mock("@/lib/db/iSpindel", () => ({
  getLogsForBrew: jest.fn(),
  updateLog: jest.fn(),
  deleteLog: jest.fn(),
}));

jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

describe("/api/ispindel/logs/[id]", () => {
  const mockParams = async () => ({ id: "123" });

  describe("GET", () => {
    it("should fetch logs for a brew successfully", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (getLogsForBrew as jest.Mock).mockResolvedValue([{ id: 1, log: "data" }]);

      const req = createRequest({
        method: "GET",
        url: "http://localhost/api/ispindel/logs/123",
      });
      const res = await GET(req as any, { params: mockParams() });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ id: 1, log: "data" }]);
    });

    it("should return 500 on database error", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (getLogsForBrew as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const req = createRequest({
        method: "GET",
        url: "http://localhost/api/ispindel/logs/123",
      });
      const res = await GET(req as any, { params: mockParams() });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to fetch logs." });
    });
  });

  describe("PATCH", () => {
    it("should update a log successfully", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (updateLog as jest.Mock).mockResolvedValue({ id: "123", updated: true });

      const req = createRequest({
        method: "PATCH",
        url: "http://localhost/api/ispindel/logs/123?device_id=456",
        body: { log: "updated data" },
      });
      req.json = async () => req.body;

      const res = await PATCH(req as any, { params: mockParams() });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: "123", updated: true });
    });

    it("should return 500 on update error", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (updateLog as jest.Mock).mockRejectedValue(new Error("Update error"));

      const req = createRequest({
        method: "PATCH",
        url: "http://localhost/api/ispindel/logs/123?device_id=456",
        body: { log: "updated data" },
      });
      req.json = async () => req.body;

      const res = await PATCH(req as any, { params: mockParams() });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to update log." });
    });
  });

  describe("DELETE", () => {
    it("should delete a log successfully", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (deleteLog as jest.Mock).mockResolvedValue({ id: "123", deleted: true });

      const req = createRequest({
        method: "DELETE",
        url: "http://localhost/api/ispindel/logs/123?device_id=456",
      });
      const res = await DELETE(req as any, { params: mockParams() });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: "123", deleted: true });
    });

    it("should return 400 if device_id is missing", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");

      const req = createRequest({
        method: "DELETE",
        url: "http://localhost/api/ispindel/logs/123",
      });
      const res = await DELETE(req as any, { params: mockParams() });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Must provide a device id." });
    });

    it("should return 500 on deletion error", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (deleteLog as jest.Mock).mockRejectedValue(new Error("Deletion error"));

      const req = createRequest({
        method: "DELETE",
        url: "http://localhost/api/ispindel/logs/123?device_id=456",
      });
      const res = await DELETE(req as any, { params: mockParams() });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to delete log." });
    });
  });
});
