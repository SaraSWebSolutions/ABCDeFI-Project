// src/components/UI/Card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple reusable Card component with a subtle glass‑morphism style.
 * It accepts children and an optional className to allow further styling.
 */
export const Card: React.FC<CardProps> = ({ children, className }) => (
  <div
    className={`bg-white bg-opacity-10 rounded-xl p-4 backdrop-blur-md ${
      className ?? ""
    }`}
  >
    {children}
  </div>
);

export default Card;
