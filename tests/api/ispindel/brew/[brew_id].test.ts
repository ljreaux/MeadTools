import { PATCH, DELETE } from "@/app/api/hydrometer/brew/[brew_id]/route";
import { verifyUser } from "@/lib/userAccessFunctions";
import { addRecipeToBrew, deleteBrew } from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

// Mock necessary imports
jest.mock("@/lib/userAccessFunctions", () => ({
  verifyUser: jest.fn(),
}));

jest.mock("@/lib/db/iSpindel", () => ({
  addRecipeToBrew: jest.fn(),
  deleteBrew: jest.fn(),
}));

describe("api/ispindel/brew/[brew_id]", () => {
  let req: NextRequest;
  let params: { brew_id: string };

  // Before each test, mock the methods
  beforeEach(() => {
    req = {
      json: jest.fn() as jest.Mock,
      headers: {
        get: jest.fn(),
      },
      url: "http://localhost:3000/api/ispindel/brew/[brew_id]",
    } as unknown as NextRequest;

    params = { brew_id: "123" }; // Mock brew_id

    (verifyUser as jest.Mock) = jest.fn().mockResolvedValue(123); // Simulate user verification returning user ID
  });

  describe("PATCH", () => {
    it("should successfully add a recipe to the brew", async () => {
      const body = { recipe_id: 456 };
      (req.json as jest.Mock).mockResolvedValue(body);

      (addRecipeToBrew as jest.Mock).mockResolvedValue({
        id: 123,
        recipe_id: 456,
        brew_id: "123",
      });

      const res = await PATCH(req, { params: Promise.resolve(params) });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        id: 123,
        recipe_id: 456,
        brew_id: "123",
      });
    });

    it("should return 400 if brew_id or recipe_id is missing", async () => {
      const body = {}; // Missing recipe_id
      (req.json as jest.Mock).mockResolvedValue(body);

      const res = await PATCH(req, { params: Promise.resolve(params) });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Missing brew_id or recipe_id",
      });
    });

    it("should return 500 if there is an error adding the recipe to the brew", async () => {
      const body = { recipe_id: 456 };
      (req.json as jest.Mock).mockResolvedValue(body);
      (addRecipeToBrew as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const res = await PATCH(req, { params: Promise.resolve(params) });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to update brew." });
    });
  });

  describe("DELETE", () => {
    it("should delete the brew successfully", async () => {
      (deleteBrew as jest.Mock).mockResolvedValue(true);

      const res = await DELETE(req, { params: Promise.resolve(params) });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        message: "Brew deleted successfully.",
      });
    });

    it("should return 400 if brew_id is missing", async () => {
      const res = await DELETE(req, {
        params: Promise.resolve({ brew_id: "" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Missing brew_id" });
    });

    it("should return 500 if there is an error deleting the brew", async () => {
      (deleteBrew as jest.Mock).mockRejectedValue(new Error("Deletion error"));

      const res = await DELETE(req, { params: Promise.resolve(params) });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to delete brew." });
    });
  });
});
