"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "../ui/Checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import { User } from "@/hooks/reactQuery/useAdminUsersQuery";

interface Props {
  user: User;
}

export default function UserEditForm({ user }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetchWithAuth();

  const [formData, setFormData] = useState({
    email: user.email,
    public_username: user.public_username ?? "",
    role: user.role,
    password: "",
    updateToken: false
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, updateToken: checked }));
  };

  const updateUserMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const body = {
        ...payload,
        password: payload.password || undefined
      };

      await fetchWithAuth<unknown>(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully!"
      });
      queryClient.invalidateQueries({ queryKey: qk.adminUsers });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to update user.",
        variant: "destructive"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      await fetchWithAuth<unknown>(`/api/users/${user.id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "User was deleted." });
      queryClient.invalidateQueries({ queryKey: qk.adminUsers });
      router.push("/admin/users");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to delete user.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserMutation.mutateAsync(formData);
  };

  const handleDelete = async () => {
    await deleteUserMutation.mutateAsync();
  };

  const isSaving = updateUserMutation.isPending;
  const isDeleting = deleteUserMutation.isPending;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Email */}
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      {/* Public Username */}
      <div className="space-y-1">
        <Label htmlFor="public_username">Public Username</Label>
        <Input
          id="public_username"
          name="public_username"
          value={formData.public_username}
          onChange={handleChange}
        />
      </div>

      {/* Password (optional) */}
      <div className="space-y-1">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
        />
      </div>

      {/* Role select */}
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, role: val as "user" | "admin" }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Generate new hydro token */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="updateToken"
          checked={formData.updateToken}
          onCheckedChange={handleCheckboxChange}
        />
        <Label htmlFor="updateToken">Generate new hydro token</Label>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{user.email}</strong>?
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
