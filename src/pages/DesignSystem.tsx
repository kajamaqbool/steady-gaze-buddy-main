import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFontPreference } from "@/hooks/useFontPreference";

const DesignSystem = () => {
  const { preference: fontPreference, changePreference: handleFontChange } = useFontPreference();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="max-w-2xl space-y-3">
          <Badge variant="secondary">DysLex Shield foundation</Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Design system preview</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            A small, internal surface for checking shared colors, type, spacing, controls, and accessibility behavior.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]" aria-label="Typography and controls">
          <Card>
            <CardHeader>
              <CardTitle>Reading type</CardTitle>
              <CardDescription>Lexend is the default. The alternative stays available for readers who prefer it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3" role="group" aria-label="Font preference">
                <Button
                  variant={fontPreference === "lexend" ? "default" : "outline"}
                  onClick={() => handleFontChange("lexend")}
                >
                  Lexend default
                </Button>
                <Button
                  variant={fontPreference === "dyslexic" ? "default" : "outline"}
                  onClick={() => handleFontChange("dyslexic")}
                >
                  OpenDyslexic option
                </Button>
              </div>
              <p className="max-w-prose text-lg leading-[1.7] tracking-[0.015em]">
                Steady reading grows from calm focus. Short lines, generous space, and clear contrast help each word feel easier to follow.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color language</CardTitle>
              <CardDescription>Semantic colors keep feedback consistent.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge><CheckCircle2 aria-hidden="true" /> Ready</Badge>
              <Badge variant="secondary"><Sparkles aria-hidden="true" /> Encouragement</Badge>
              <Badge variant="outline"><Info aria-hidden="true" /> Informational</Badge>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2" aria-label="Component examples">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              <CardDescription>Inputs and actions share touch-friendly sizing and visible focus states.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="preview-name">Reader name</Label>
                <Input id="preview-name" placeholder="A gentle placeholder" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-note">Practice note</Label>
                <Textarea id="preview-note" placeholder="Write a short note..." />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary action</Button>
                <Button variant="outline">Secondary action</Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Show more information">
                      <Info aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Helpful context appears here.</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress and motion</CardTitle>
              <CardDescription>Progress uses a restrained transition and honors reduced-motion preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Reading practice</span>
                  <span>68%</span>
                </div>
                <Progress value={68} aria-label="Reading practice 68 percent complete" />
              </div>
              <div className="rounded-md border border-info/20 bg-info/10 p-4 text-sm leading-relaxed text-info">
                Gentle movement supports orientation. The global reduced-motion rule removes nonessential animation.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
};

export default DesignSystem;