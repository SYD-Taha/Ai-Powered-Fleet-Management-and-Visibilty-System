import { useState, FormEvent, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { validateEmail, validatePassword, validateUsername, getPasswordStrengthColor, getPasswordStrengthBgColor } from "@/utils/validation";
import { Check, X } from "lucide-react";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation states
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string[]>([]);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [passwordValidation, setPasswordValidation] = useState<ReturnType<typeof validatePassword> | null>(null);
  
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Real-time validation for username
  useEffect(() => {
    if (username.length > 0) {
      const validation = validateUsername(username);
      setUsernameError(validation.isValid ? null : validation.error || null);
    } else {
      setUsernameError(null);
    }
  }, [username]);

  // Real-time validation for email
  useEffect(() => {
    if (email.length > 0) {
      const validation = validateEmail(email);
      setEmailError(validation.isValid ? null : validation.error || null);
    } else {
      setEmailError(null);
    }
  }, [email]);

  // Real-time validation for password
  useEffect(() => {
    if (password.length > 0) {
      const validation = validatePassword(password);
      setPasswordValidation(validation);
      setPasswordError(validation.errors || []);
    } else {
      setPasswordValidation(null);
      setPasswordError([]);
    }
  }, [password]);

  // Real-time validation for confirm password
  useEffect(() => {
    if (confirmPassword.length > 0) {
      if (password !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match");
      } else {
        setConfirmPasswordError(null);
      }
    } else {
      setConfirmPasswordError(null);
    }
  }, [confirmPassword, password]);

  // Check if form is valid
  const isFormValid = () => {
    const usernameValid = username.length > 0 && !usernameError;
    const emailValid = email.length > 0 && !emailError;
    const passwordValid = password.length > 0 && passwordValidation?.isValid;
    const confirmPasswordValid = confirmPassword.length > 0 && !confirmPasswordError && password === confirmPassword;
    
    return usernameValid && emailValid && passwordValid && confirmPasswordValid;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate all fields
    const usernameValidation = validateUsername(username);
    const emailValidation = validateEmail(email);
    const passwordValidationResult = validatePassword(password);

    if (!usernameValidation.isValid) {
      setUsernameError(usernameValidation.error || null);
      toast({
        title: "Validation Error",
        description: usernameValidation.error || "Invalid username",
        variant: "destructive",
      });
      return;
    }

    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || null);
      toast({
        title: "Validation Error",
        description: emailValidation.error || "Invalid email",
        variant: "destructive",
      });
      return;
    }

    if (!passwordValidationResult.isValid) {
      setPasswordError(passwordValidationResult.errors || []);
      toast({
        title: "Validation Error",
        description: passwordValidationResult.errors?.join(", ") || "Invalid password",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await register(username, email, password);
      toast({
        title: "Success",
        description: "Account created successfully! Please sign in.",
      });
      navigate("/login");
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || "Failed to create account. Please try again.";
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 dark:border-slate-800">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/lovable-uploads/b658376d-bd36-4dc2-9144-3e35b28770ba.png" 
              alt="TappTrack Logo" 
              className="w-12 h-12" 
            />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Create Account
          </CardTitle>
          <CardDescription className="text-base">
            Sign up to get started with TappTrack
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username (3-30 characters)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                className={`h-11 ${usernameError ? 'border-red-500 focus:border-red-500' : username.length > 0 && !usernameError ? 'border-green-500' : ''}`}
              />
              {usernameError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <X className="w-4 h-4" />
                  {usernameError}
                </p>
              )}
              {username.length > 0 && !usernameError && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Username is valid
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className={`h-11 ${emailError ? 'border-red-500 focus:border-red-500' : email.length > 0 && !emailError ? 'border-green-500' : ''}`}
              />
              {emailError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <X className="w-4 h-4" />
                  {emailError}
                </p>
              )}
              {email.length > 0 && !emailError && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Email is valid
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className={`h-11 ${passwordError.length > 0 ? 'border-red-500 focus:border-red-500' : passwordValidation?.isValid ? 'border-green-500' : ''}`}
                minLength={8}
              />
              
              {/* Password Strength Indicator */}
              {password.length > 0 && passwordValidation && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getPasswordStrengthBgColor(passwordValidation.strength)}`}
                        style={{
                          width: passwordValidation.strength === 'strong' ? '100%' : passwordValidation.strength === 'medium' ? '66%' : '33%'
                        }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${getPasswordStrengthColor(passwordValidation.strength)}`}>
                      {passwordValidation.strength.charAt(0).toUpperCase() + passwordValidation.strength.slice(1)}
                    </span>
                  </div>
                  
                  {/* Password Requirements Checklist */}
                  <div className="text-xs space-y-1">
                    <div className={`flex items-center gap-1 ${passwordValidation.requirements.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.requirements.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordValidation.requirements.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.requirements.hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>One uppercase letter (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordValidation.requirements.hasLowercase ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.requirements.hasLowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>One lowercase letter (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordValidation.requirements.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.requirements.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>One number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1 ${passwordValidation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordValidation.requirements.hasSpecialChar ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>One special character (!@#$%^&*...)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className={`h-11 ${confirmPasswordError ? 'border-red-500 focus:border-red-500' : confirmPassword.length > 0 && !confirmPasswordError && password === confirmPassword ? 'border-green-500' : ''}`}
                minLength={8}
              />
              {confirmPasswordError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <X className="w-4 h-4" />
                  {confirmPasswordError}
                </p>
              )}
              {confirmPassword.length > 0 && !confirmPasswordError && password === confirmPassword && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Passwords match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !isFormValid()}
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Signup;

