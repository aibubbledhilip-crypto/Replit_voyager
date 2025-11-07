import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import loginBg from "@assets/generated_images/Data_visualization_login_background_22211783.png";

export default function LoginPage() {
  const handleLogin = (provider: string) => {
    console.log(`Login with ${provider} triggered`);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/80" />
      </div>
      
      <Card className="relative w-full max-w-md mx-4 shadow-xl" data-testid="card-login">
        <CardHeader className="space-y-4 text-center pb-4">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary rounded-lg">
              <Database className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-semibold">Voyager</CardTitle>
          <CardDescription className="text-base">
            Secure AWS Athena Query Platform
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-2">
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full h-10"
              onClick={() => handleLogin('Google')}
              data-testid="button-login-google"
            >
              Sign in with Google
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full h-10"
              onClick={() => handleLogin('GitHub')}
              data-testid="button-login-github"
            >
              Sign in with GitHub
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full h-10"
              onClick={() => handleLogin('Email')}
              data-testid="button-login-email"
            >
              Sign in with Email
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center pt-2">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}