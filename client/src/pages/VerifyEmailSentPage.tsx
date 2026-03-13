import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import loginBackground from "@assets/generated_images/Data_visualization_login_background_22211783.png";

export default function VerifyEmailSentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      setResent(true);
      toast({ title: "Email sent", description: "A fresh verification link has been sent." });
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />

      <Card className="w-full max-w-md mx-4 relative z-10 shadow-2xl bg-background/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="text-verify-title">
            Check your inbox
          </CardTitle>
          <CardDescription>
            We sent a verification link to
            {email && (
              <span className="block font-medium text-foreground mt-1" data-testid="text-verify-email">
                {email}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-sm text-muted-foreground text-center">
          <p>Click the link in that email to activate your account. The link expires in 24 hours.</p>
          <p>Can't find it? Check your spam folder or request a new link below.</p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {email && (
            <Button
              className="w-full"
              variant="outline"
              onClick={handleResend}
              disabled={resending || resent}
              data-testid="button-resend-verification"
            >
              {resending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : resent ? (
                "Link sent — check your inbox"
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Resend verification email</>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLocation("/login")}
            data-testid="button-back-to-login"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
