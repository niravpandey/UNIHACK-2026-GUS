"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSound } from "@/hooks/useSound";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
}

export default function LandingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { onboardingCompleted } = useSession();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDarkening, setIsDarkening] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const { playOnce: splash } = useSound("splash");
  /*
  =========================
  Spawn bubbles
  =========================
  */

  useEffect(() => {
    if (!isTransitioning) return;

    let id = 0;

    const spawn = () => {
      setBubbles((prev) => [
        ...prev,
        {
          id: id++,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: 40 + Math.random() * 80,
        },
      ]);
    };

    const interval = setInterval(spawn, 50);

    setTimeout(() => {
      clearInterval(interval);
      setIsDarkening(true);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTransitioning]);

  /*
  =========================
  Redirect
  =========================
  */

  useEffect(() => {
    if (!isDarkening) return;

    const timer = setTimeout(() => {
      router.push("/app");
    }, 700);

    return () => clearTimeout(timer);
  }, [isDarkening, router]);

  return (
    <main
      className="h-[300vh] w-full relative background-pattern bg-background"
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full pointer-events-auto"
      />

      {/* Center content */}
      <div className="fixed inset-0 z-10 flex items-center justify-center">
        <div className="text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1
              className="text-6xl font-barlow md:text-8xl font-bold mb-4"
            >
              GRAPH SURF
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl mb-12 font-light font-geist"
          >
            novel, graph-based web exploration
          </motion.p>
          <Button primary="true" onClick={() => {
            setIsTransitioning(true);
            setTimeout(() => {
              router.push("/app");
            }, 700);

            if (onboardingCompleted) {
              setTimeout(() => {
                splash();
              }, 1300);
            }
          }}>Take the Plunge</Button>
        </div>
      </div>

      {/* Bubble animation */}
      <AnimatePresence>
        {isTransitioning &&
          bubbles.map((bubble) => (
            <motion.div
              key={bubble.id}
              initial={{ scale: 0 }}
              animate={{ scale: 20 }}
              transition={{ duration: 1.1 }}
              className="fixed rounded-full z-40"
              style={{
                left: bubble.x,
                top: bubble.y,
                width: bubble.size,
                height: bubble.size,
                background: "#01438d",
              }}
            />
          ))}
      </AnimatePresence>

      {/* Darkening */}
      <AnimatePresence>
        {isDarkening && (
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: "oklch(0.23 0.07 254.08)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}