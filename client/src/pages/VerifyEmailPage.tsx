import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import loginBackground from "@assets/generated_images/Data_visualization_login_background_22211783.png";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("No verification token found in the link.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setState("success");
        } else {
          setState("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("A network error occurred. Please try again.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />

      <Card className="w-full max-w-md mx-4 relative z-10 shadow-2xl bg-background/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
               style={{ background: state === "success" ? "hsl(var(--primary) / 0.1)" : state === "error" ? "hsl(var(--destructive) / 0.1)" : "hsl(var(--muted))" }}>
            {state === "loading" && <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />}
            {state === "success" && <CheckCircle className="h-7 w-7 text-primary" />}
            {state === "error" && <XCircle className="h-7 w-7 text-destructive" />}
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="text-verify-status-title">
            {state === "loading" && "Verifying your email..."}
            {state === "success" && "Email verified!"}
            {state === "error" && "Verification failed"}
          </CardTitle>
          <CardDescription data-testid="text-verify-status-desc">
            {state === "loading" && "Please wait while we confirm your email address."}
            {state === "success" && "Your account is now active. You can sign in to Voyager."}
            {state === "error" && (message || "The link may have expired or already been used.")}
          </CardDescription>
        </CardHeader>

        {state !== "loading" && (
          <>
            <CardContent />
            <CardFooter className="flex flex-col gap-3">
              {state === "success" && (
                <Button
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-go-to-login"
                >
                  Sign in to Voyager
                </Button>
              )}
              {state === "error" && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => setLocation("/login")}
                    data-testid="button-go-to-login"
                  >
                    Back to sign in
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setLocation("/signup")}
                    data-testid="button-go-to-signup"
                  >
                    Create a new account
                  </Button>
                </>
              )}
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
