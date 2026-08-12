'use client';

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { CircleUser, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function UserNav() {
  const router = useRouter();
  const { logout, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if logout API fails
      router.push("/login");
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="rounded-full"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? (
        <LogOut className="h-5 w-5 animate-spin" />
      ) : (
        <CircleUser className="h-5 w-5" />
      )}
      <span className="sr-only">Logout</span>
    </Button>
  );
}