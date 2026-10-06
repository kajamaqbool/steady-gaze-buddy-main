import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuthErrorMessage } from '@/api/authService';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, UserPlus, GraduationCap, Home, School } from 'lucide-react';
import Navbar from '@/components/Navbar';

type AllowedRole = 'STUDENT' | 'PARENT' | 'TEACHER';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [selectedRole, setSelectedRole] = useState<AllowedRole>('STUDENT');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (username.length < 3 || username.length > 50) {
      setError('Username must be between 3 and 50 characters.');
      return;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!dateOfBirth) {
      setError('Date of birth is required.');
      return;
    }
    if (!['M', 'F', 'O'].includes(gender)) {
      setError('Invalid gender selection.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        username,
        email,
        password,
        dateOfBirth,
        gender,
        role: selectedRole,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    {
      id: 'STUDENT' as AllowedRole,
      title: 'Student',
      description: 'Learn & complete reading adventures',
      icon: <GraduationCap className="w-5 h-5 text-primary" />,
      color: 'border-primary bg-primary/5',
    },
    {
      id: 'PARENT' as AllowedRole,
      title: 'Parent',
      description: "Follow my child's reading progress",
      icon: <Home className="w-5 h-5 text-secondary" />,
      color: 'border-secondary bg-secondary/5',
    },
    {
      id: 'TEACHER' as AllowedRole,
      title: 'Teacher',
      description: 'Support and monitor students',
      icon: <School className="w-5 h-5 text-emerald-600" />,
      color: 'border-emerald-500 bg-emerald-50/50',
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 my-4">
        <div className="w-full max-w-lg bg-card rounded-2xl border border-border/80 shadow-md p-6 sm:p-8 space-y-6 animate-fade-in-up">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-secondary/10 text-secondary mb-2">
              <UserPlus className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground font-display">
              Create an Account
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose your role and join Dyslexia Shield
            </p>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="flex items-start gap-3 p-4 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="flex-1">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 p-4 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="flex-1 font-medium">Registration successful! Redirecting to sign in...</p>
            </div>
          )}

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                I am a...
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {roleOptions.map((option) => {
                  const active = selectedRole === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedRole(option.id)}
                      className={`p-3.5 rounded-xl border-2 text-left flex flex-col justify-between gap-2 transition-all ${
                        active
                          ? `${option.color} ring-2 ring-primary/20 shadow-xs`
                          : 'border-border/70 bg-surface hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {option.icon}
                        {active && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-foreground block font-display">
                          {option.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-tight block mt-0.5">
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3.5 pt-2 border-t border-border/40">
              
              <div className="space-y-1">
                <Label htmlFor="username" className="text-sm font-semibold text-foreground">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  required
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 rounded-xl bg-surface border-border focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-xl bg-surface border-border focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 rounded-xl bg-surface border-border pr-10 focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dateOfBirth" className="text-sm font-semibold text-foreground">
                    Date of Birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-10 rounded-xl bg-surface border-border focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="gender" className="text-sm font-semibold text-foreground">
                    Gender
                  </Label>
                  <Select value={gender} onValueChange={(value: 'M'|'F'|'O') => setGender(value)}>
                    <SelectTrigger className="h-10 rounded-xl bg-surface border-border">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                      <SelectItem value="O">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </div>

            <Button
              type="submit"
              disabled={isLoading || success}
              className="w-full h-11 rounded-xl font-bold shadow-sm hover:shadow transition-all duration-200 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </div>
              ) : (
                `Register as ${selectedRole.charAt(0) + selectedRole.slice(1).toLowerCase()}`
              )}
            </Button>
          </form>

          {/* Footer Link */}
          <div className="pt-3 border-t border-border/60 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </div>

        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        🔒 All screening video processing remains strictly on your local device.
      </footer>
    </div>
  );
};

export default Register;


