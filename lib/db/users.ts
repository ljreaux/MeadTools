import prisma from "@/lib/prisma";

// Get all users
export async function getAllUsers() {
  return await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      google_id: true,
      public_username: true,
      hydro_token: true
    }
  });
}

// Get a user by ID
export async function getUserById(id: number) {
  return await prisma.users.findUnique({
    where: { id }
  });
}

export async function getUserByEmail(email: string) {
  try {
    const user = await prisma.users.findUnique({
      where: { email }
    });

    return user;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    throw new Error("Failed to fetch user by email.");
  }
}

export async function getUserByGoogleId(google_id?: string) {
  if (!google_id) {
    throw new Error("Google ID is required.");
  }

  try {
    const user = await prisma.users.findFirst({
      where: { google_id }
    });

    return user;
  } catch (error) {
    console.error("Error fetching user by Google ID:", error);
    throw new Error("Failed to fetch user by Google ID.");
  }
}

// Create a user
export async function createUser(data: {
  email: string;
  password?: string;
  role?: string;
  google_id?: string;
  public_username?: string;
  google_avatar_url?: string;
  show_google_avatar: boolean;
}) {
  return await prisma.users.create({
    data
  });
}

// Update a user
export async function updateUser(
  id: number,
  fields: Partial<{
    email: string;
    password: string;
    role: string;
    public_username: string;
    google_id: string;
    hydro_token: string;
  }>
) {
  return await prisma.users.update({
    where: { id },
    data: fields
  });
}

// Delete a user
export async function deleteUser(id: number) {
  if (id === 1) {
    throw new Error("Cannot Delete MeadTools Admin");
  }
  return await prisma.users.delete({
    where: { id }
  });
}
