import { GET } from "@/app/api/hydrometer/logs/route";
import { getLogs } from "@/lib/db/iSpindel";
import { createRequest } from "node-mocks-http";

jest.mock("@/lib/db/iSpindel", () => ({
  getLogs: jest.fn(),
}));

describe("/api/ispindel/logs", () => {
  describe("GET", () => {
    it("should fetch logs successfully", async () => {
      const device_id = "12345";
      const start_date = "2024-01-01";
      const end_date = "2024-01-10";

      const logs = [
        { timestamp: "2024-01-01T12:00:00Z", gravity: 1.05 },
        { timestamp: "2024-01-02T12:00:00Z", gravity: 1.04 },
      ];

      (getLogs as jest.Mock).mockResolvedValue(logs);

      const req = createRequest({
        method: "GET",
        url: `http://localhost/api/ispindel/logs?device_id=${device_id}&start_date=${start_date}&end_date=${end_date}`,
      });

      const res = await GET(req as any);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(logs);
    });

    it("should return 400 if device_id is missing", async () => {
      const start_date = "2024-01-01";
      const end_date = "2024-01-10";

      const req = createRequest({
        method: "GET",
        url: `http://localhost/api/ispindel/logs?start_date=${start_date}&end_date=${end_date}`,
      });

      const res = await GET(req as any);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Date or Device Id error" });
    });

    it("should return 400 if start_date is missing", async () => {
      const device_id = "12345";
      const end_date = "2024-01-10";

      const req = createRequest({
        method: "GET",
        url: `http://localhost/api/ispindel/logs?device_id=${device_id}&end_date=${end_date}`,
      });

      const res = await GET(req as any);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Date or Device Id error" });
    });

    it("should handle errors during log fetching", async () => {
      const device_id = "12345";
      const start_date = "2024-01-01";
      const end_date = "2024-01-10";

      (getLogs as jest.Mock).mockRejectedValue(new Error("Database failure"));

      const req = createRequest({
        method: "GET",
        url: `http://localhost/api/ispindel/logs?device_id=${device_id}&start_date=${start_date}&end_date=${end_date}`,
      });

      const res = await GET(req as any);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Date or Device Id error" });
    });
  });
});
