"use client";

import { useState } from "react";
import { createClient } from "@/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Code2,
  UtensilsCrossed,
  Music,
  Dumbbell,
  Calculator,
  Palette,
  BookOpen,
  FlaskConical,
  Gamepad2,
  Globe2,
  Heart,
  Camera,
  Plane,
  Leaf,
  Zap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

const INTERESTS = [
  { id: "programming", label: "Programming", icon: Code2 },
  { id: "cooking", label: "Cooking", icon: UtensilsCrossed },
  { id: "music", label: "Music", icon: Music },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "mathematics", label: "Mathematics", icon: Calculator },
  { id: "art", label: "Art", icon: Palette },
  { id: "literature", label: "Literature", icon: BookOpen },
  { id: "science", label: "Science", icon: FlaskConical },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "travel", label: "Travel", icon: Globe2 },
  { id: "health", label: "Health", icon: Heart },
  { id: "photography", label: "Photography", icon: Camera },
  { id: "nature", label: "Nature", icon: Leaf },
  { id: "technology", label: "Technology", icon: Zap },
  { id: "movies", label: "Movies", icon: Sparkles },
  { id: "finance", label: "Finance", icon: Plane },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];

export function hasUserSelectedInterests(user: User | undefined): boolean {
  if (!user) return false;
  const interests = user.user_metadata?.interests;
  return Array.isArray(interests) && interests.length > 0;
}

export function getUserInterests(user: User | undefined): InterestId[] {
  if (!user?.user_metadata?.interests) return [];
  return user.user_metadata.interests as InterestId[];
}

interface InterestSelectionProps {
  user: User;
  onComplete: (selectedInterests: InterestId[]) => void;
}

export default function InterestSelection({
  user,
  onComplete,
}: InterestSelectionProps) {
  const [selected, setSelected] = useState<Set<InterestId>>(
    new Set(getUserInterests(user)),
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (id: InterestId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selected.size === 0) return;

    setIsSaving(true);
    try {
      const supabase = createClient();
      const interests = Array.from(selected);

      const { error } = await supabase.auth.updateUser({
        data: { interests },
      });

      if (error) {
        console.error("Failed to save interests:", error);
        return;
      }

      console.log(
        "[LOG] Interest selection complete, saved to user metadata:",
        interests,
      );
      onComplete(interests);
    } catch (err) {
      console.error("Error saving interests:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-2xl p-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Choose Your Interests
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select at least one topic to personalize your learning graph
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {INTERESTS.map((interest) => {
            const isSelected = selected.has(interest.id);
            const Icon = interest.icon;

            return (
              <button
                key={interest.id}
                onClick={() => toggle(interest.id)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all duration-200",
                  "hover:border-primary/50 hover:bg-accent/50",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card",
                )}
              >
                <div
                  className={cn(
                    "flex h-16 w-full items-center justify-center",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-10 w-10" strokeWidth={1.5} />
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {interest.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={selected.size === 0 || isSaving}
            size="lg"
            className="px-8"
          >
            {isSaving ? "Saving..." : `Continue (${selected.size} selected)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
