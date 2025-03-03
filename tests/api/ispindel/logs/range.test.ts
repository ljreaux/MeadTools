import { DELETE } from "@/app/api/hydrometer/logs/range/route";
import { verifyUser } from "@/lib/userAccessFunctions";
import { deleteLogsInRange } from "@/lib/db/iSpindel";
import { NextResponse } from "next/server"; // Import this to fix the ReferenceError
import { createRequest } from "node-mocks-http";

jest.mock("@/lib/db/iSpindel", () => ({
  deleteLogsInRange: jest.fn(),
}));

jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

describe("/api/ispindel/logs/range", () => {
  describe("DELETE", () => {
    it("should delete logs in the specified range", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (deleteLogsInRange as jest.Mock).mockResolvedValue(undefined);

      const req = createRequest({
        method: "DELETE",
        url: `http://localhost/api/ispindel/logs/range?device_id=123&start_date=2024-01-01&end_date=2024-01-10`,
      });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.message).toMatch(
        /Logs from .* to .* were deleted successfully./
      );

      expect(deleteLogsInRange).toHaveBeenCalledWith(
        "123",
        new Date("2024-01-01"),
        new Date("2024-01-10")
      );
    });

    it("should return 400 if required parameters are missing", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");

      const req = createRequest({
        method: "DELETE",
        url: `http://localhost/api/ispindel/logs/range?device_id=123&start_date=2024-01-01`, // Missing end_date
      });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Missing device_id, start_date, or end_date parameters",
      });
    });

    it("should return 400 if log deletion fails", async () => {
      (verifyUser as jest.Mock).mockResolvedValue("user-id");
      (deleteLogsInRange as jest.Mock).mockRejectedValue(
        new Error("Deletion error")
      );

      const req = createRequest({
        method: "DELETE",
        url: `http://localhost/api/ispindel/logs/range?device_id=123&start_date=2024-01-01&end_date=2024-01-10`,
      });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Error deleting log." });
    });

    it("should return 401 if the user is not verified", async () => {
      (verifyUser as jest.Mock).mockResolvedValue(
        new NextResponse("Unauthorized", { status: 401 })
      );

      const req = createRequest({
        method: "DELETE",
        url: `http://localhost/api/ispindel/logs/range?device_id=123&start_date=2024-01-01&end_date=2024-01-10`,
      });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(res.status).toBe(401);
      expect(await res.text()).toEqual("Unauthorized");
    });
  });
});
