'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      await login(email, password);
      // Login successful, redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error('Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-100 px-4 py-10 dark:bg-neutral-900">
      {/* Centered split card */}
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-2xl border bg-white shadow-xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        {/* Left: form */}
        <div className="p-8 sm:p-10">
          <div className="mx-auto w-full max-w-sm space-y-6">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Login to German Steels</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-md text-sm border border-destructive/40 text-destructive bg-destructive/10"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Right: image with logo overlay */}
        <div className="relative h-48 sm:h-64 md:h-auto md:min-h-full">
          <Image
            src="/Steellogo.png"
            alt="German Steels production facility"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover brightness-110 contrast-105 saturate-110 blur-[0.5px] brightness-100 dark:brightness-75 dark:contrast-100 dark:saturate-0 dark:grayscale transition-all duration-500"
            priority
          />

          {/* Subtle overlay for better contrast */}
          <div className="absolute inset-0 bg-white/5 dark:bg-black/20" />

          {/* Centered German TMT brand mark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md dark:bg-white/90">
              <Image
                src="/GermanTmtLogo.png"
                alt="German TMT logo"
                width={1190}
                height={388}
                className="h-auto w-[min(70vw,280px)] object-contain drop-shadow-sm"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
