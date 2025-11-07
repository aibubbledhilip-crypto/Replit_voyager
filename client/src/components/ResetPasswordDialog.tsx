import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

interface ResetPasswordDialogProps {
  userId: string;
  username: string;
  onResetPassword: (userId: string, newPassword: string) => void;
  trigger?: React.ReactNode;
}

export default function ResetPasswordDialog({ 
  userId, 
  username, 
  onResetPassword,
  trigger 
}: ResetPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return;
    }
    onResetPassword(userId, newPassword);
    setNewPassword("");
    setConfirmPassword("");
    setOpen(false);
  };

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = newPassword.length >= 6 && passwordsMatch;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" data-testid={`button-reset-password-${userId}`}>
            <KeyRound className="h-4 w-4 mr-2" />
            Reset Password
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid={`dialog-reset-password-${userId}`}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for user <span className="font-medium text-foreground">{username}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                data-testid={`input-new-password-${userId}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid={`input-confirm-password-${userId}`}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewPassword("");
                setConfirmPassword("");
                setOpen(false);
              }}
              data-testid={`button-cancel-reset-${userId}`}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isValid}
              data-testid={`button-submit-reset-${userId}`}
            >
              Reset Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
