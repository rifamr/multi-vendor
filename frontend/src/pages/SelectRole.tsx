import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function SelectRole() {
  const navigate = useNavigate();

  useEffect(() => {
    // Role selection is now part of the auth page (Login) so we can store it BEFORE auth.
    navigate("/login?mode=signup", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen gradient-dark-radial flex items-center justify-center px-4">
      <div className="gradient-glow absolute inset-0" />
      <div className="glass-card relative w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Redirecting…</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Taking you to sign up.
        </p>
        <p className="text-sm text-muted-foreground mt-6">
          If you’re not redirected, <Link to="/login?mode=signup" className="text-primary font-medium hover:underline">click here</Link>.
        </p>
      </div>
    </div>
  );
}
